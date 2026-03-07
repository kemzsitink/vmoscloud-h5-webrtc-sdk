import type { TouchConfig } from "../../core/types";
import type HuoshanRTC from "../huoshanRtc";
import { generateTouchCoord } from "../../utils/mixins";
import { isMobile, isTouchDevice } from "../../utils/index";

export class TouchInputHandler {
  private touchConfig: TouchConfig = {
    action: 0,
    widthPixels: 0,
    heightPixels: 0,
    pointCount: 1,
    touchType: "gesture",
    properties: [],
    coords: [],
  };
  
  private poolCoords: any[] = [];
  private poolProps: any[] = [];

  constructor(private rtc: HuoshanRTC) {
    for (let i = 0; i < 10; i++) {
      this.poolCoords.push(generateTouchCoord());
      this.poolProps.push({ id: i, toolType: 1 });
    }
  }

  private syncDimensions() {
    if (!this.rtc.videoDomRect) this.rtc.updateDomCache();
    const rtc = this.rtc;
    const { videoDomWidth, videoDomHeight, rotateType, remoteResolution } = rtc;
    
    const bigSide = videoDomWidth > videoDomHeight ? videoDomWidth : videoDomHeight;
    const smallSide = videoDomWidth > videoDomHeight ? videoDomHeight : videoDomWidth;

    let w = rotateType === 1 ? bigSide : smallSide;
    let h = rotateType === 1 ? smallSide : bigSide;

    if (rotateType === 1 && remoteResolution.height > remoteResolution.width) {
      w = smallSide; h = bigSide;
    } else if (rotateType === 0 && remoteResolution.width > remoteResolution.height) {
      w = bigSide; h = smallSide;
    }
    
    // Wisebite: Ép số nguyên bằng bitwise
    this.touchConfig.widthPixels = w | 0;
    this.touchConfig.heightPixels = h | 0;
  }

  public bindEvents(videoDom: HTMLElement) {
    const isMobileFlag = isTouchDevice() || isMobile();
    const eventTypeStart = isMobileFlag ? "touchstart" : "mousedown";
    const eventTypeMove = isMobileFlag ? "touchmove" : "mousemove";
    const eventTypeEnd = isMobileFlag ? "touchend" : "mouseup";

    if (this.rtc.options.disableContextMenu) {
      videoDom.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    videoDom.addEventListener("wheel", (e) => {
      const rtc = this.rtc;
      if (rtc.options.disable || !rtc.videoDomRect) return;
      const swipe = e.deltaY > 0 ? -1 : 1;
      
      // Wisebite cho tọa độ Wheel
      const rx = (e.clientX - rtc.videoDomRect.left) | 0;
      const ry = (e.clientY - rtc.videoDomRect.top) | 0;

      const msg = `{"coords":[{"pressure":1,"size":1,"x":${rx},"y":${ry}}],"widthPixels":${this.touchConfig.widthPixels},"heightPixels":${this.touchConfig.heightPixels},"pointCount":1,"properties":[{"id":0,"toolType":1}],"touchType":"gestureSwipe","swipe":${swipe}}`;
      rtc.sendUserMessage(rtc.options.clientId, msg);
    }, { passive: true });

    videoDom.addEventListener(eventTypeStart, (e) => {
      const rtc = this.rtc;
      if (rtc.options.disable) return;
      if (!isMobileFlag) e.preventDefault(); 

      rtc.hasPushDown = true;
      this.syncDimensions(); 
      
      const opts = rtc.options;
      if (rtc.inputElement && ((opts.allowLocalIMEInCloud && opts.keyboard === "pad") || opts.keyboard === "local")) {
        if (rtc.roomMessage.inputStateIsOpen) rtc.inputElement.focus();
        else rtc.inputElement.blur();
      }

      this.processEvent(e, 0, isMobileFlag); 
    });

    videoDom.addEventListener(eventTypeMove, (e) => {
      if (this.rtc.options.disable || !this.rtc.hasPushDown) return;
      if (e.cancelable) e.preventDefault(); 
      this.processEvent(e, 2, isMobileFlag); 
    }, { passive: false });

    videoDom.addEventListener(eventTypeEnd, (e) => {
      const rtc = this.rtc;
      if (rtc.options.disable) return;
      rtc.hasPushDown = false;
      
      if (isMobileFlag && (e as TouchEvent).touches.length > 0) return;
      
      // Manual String cho sự kiện Up
      const msg = `{"action":1,"widthPixels":${this.touchConfig.widthPixels},"heightPixels":${this.touchConfig.heightPixels},"pointCount":1,"touchType":"gesture","properties":[{"id":0,"toolType":1}],"coords":[{"x":0,"y":0,"pressure":0,"size":0}]}`;
      rtc.sendUserMessage(rtc.options.clientId, msg);
    });

    videoDom.addEventListener("mouseleave", () => {
      const rtc = this.rtc;
      if (rtc.options.disable || !rtc.hasPushDown) return;
      rtc.hasPushDown = false;
      const msg = `{"action":1,"widthPixels":${this.touchConfig.widthPixels},"heightPixels":${this.touchConfig.heightPixels},"pointCount":1,"touchType":"gesture","properties":[{"id":0,"toolType":1}],"coords":[{"x":0,"y":0,"pressure":0,"size":0}]}`;
      rtc.sendUserMessage(rtc.options.clientId, msg);
    });
  }

  private processEvent(e: Event, action: number, isMobileFlag: boolean) {
    const rtc = this.rtc;
    const touches = isMobileFlag ? (e as TouchEvent).touches : [e as MouseEvent];
    const touchCount = touches.length;
    if (touchCount === 0 && action !== 1) return;

    const finalAction = (action === 0 && touchCount > 1) ? 261 : action;
    const rect = rtc.videoDomRect!;
    const rectLeft = rect.left;
    const rectTop = rect.top;
    const rectWidth = rect.width;
    const rectHeight = rect.height;
    const rotateType = rtc.rotateType;
    const remoteRes = rtc.remoteResolution;
    const isRotated1 = rotateType === 1 && remoteRes.height > remoteRes.width;
    const isRotated0 = rotateType === 0 && remoteRes.width > remoteRes.height;

    let coordsJson = "";
    let propsJson = "";

    for (let i = 0; i < touchCount; i++) {
      const touch = touches[i] as any;
      const poolCoord = this.poolCoords[i];
      
      // Đảm bảo tọa độ chính xác bằng clientX
      let x = touch.clientX - rectLeft;
      let y = touch.clientY - rectTop;

      if (isRotated1) {
        const tx = x; x = rectHeight - y; y = tx;
      } else if (isRotated0) {
        const tx = x; x = y; y = rectWidth - tx;
      }

      // Wisebite: Bitwise OR cho tọa độ
      const rx = x | 0;
      const ry = y | 0;

      // Khôi phục orientation biến thiên nhẹ để server nhận diện gesture chính xác
      const orientation = action === 2 ? 0 : Number((0.01 * Math.random()).toFixed(3));

      // Nối chuỗi thủ công cực nhanh
      coordsJson += (i > 0 ? "," : "") + `{"x":${rx},"y":${ry},"pressure":${poolCoord.pressure},"size":${poolCoord.size},"touchMajor":${poolCoord.touchMajor},"touchMinor":${poolCoord.touchMinor},"toolMajor":${poolCoord.toolMajor},"toolMinor":${poolCoord.toolMinor},"orientation":${orientation}}`;
      propsJson += (i > 0 ? "," : "") + `{"id":${i},"toolType":1}`;
    }

    const message = `{"action":${finalAction},"widthPixels":${this.touchConfig.widthPixels},"heightPixels":${this.touchConfig.heightPixels},"pointCount":${touchCount},"touchType":"gesture","properties":[${propsJson}],"coords":[${coordsJson}]}`;
    
    rtc.sendUserMessage(rtc.options.clientId, message);
  }
}
