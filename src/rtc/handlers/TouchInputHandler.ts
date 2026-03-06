import type { TouchConfig } from "../../core/types";
import type HuoshanRTC from "../huoshanRtc";
import { generateTouchCoord } from "../../utils/mixins";
import { isMobile, isTouchDevice } from "../../utils/index";

export class TouchInputHandler {
  private touchConfig: TouchConfig = {
    action: 0,
    widthPixels: document.body.clientWidth,
    heightPixels: document.body.clientHeight,
    pointCount: 1,
    touchType: "gesture",
    properties: [],
    coords: [],
  };
  private wheelConfig: any = {
    coords: [{ pressure: 1.0, size: 1.0, x: 0, y: 0 }],
    widthPixels: 0,
    heightPixels: 0,
    pointCount: 1,
    properties: [{ id: 0, toolType: 1 }],
    touchType: "gestureSwipe",
    swipe: 1,
  };
  private poolCoords: any[] = [];
  private poolProps: any[] = [];

  constructor(private rtc: HuoshanRTC) {
    for (let i = 0; i < 10; i++) {
      this.poolCoords.push(generateTouchCoord());
      this.poolProps.push({ id: i, toolType: 1 });
    }
  }

  public bindEvents(videoDom: HTMLElement) {
    const isMobileFlag = isTouchDevice() || isMobile();
    let eventTypeStart = "touchstart";
    let eventTypeMove = "touchmove";
    let eventTypeEnd = "touchend";

    if (!isMobileFlag) {
      eventTypeStart = "mousedown";
      eventTypeMove = "mousemove";
      eventTypeEnd = "mouseup";
    }

    if (this.rtc.options.disableContextMenu) {
      videoDom.addEventListener("contextmenu", (e) => { e.preventDefault(); });
    }

    // Wheel event
    videoDom.addEventListener("wheel", (e) => {
      if (this.rtc.options.disable) return;
      const { offsetX, offsetY, deltaY } = e;
      this.wheelConfig.coords[0].x = offsetX;
      this.wheelConfig.coords[0].y = offsetY;
      this.wheelConfig.widthPixels = videoDom.clientWidth;
      this.wheelConfig.heightPixels = videoDom.clientHeight;
      this.wheelConfig.swipe = deltaY > 0 ? -1 : 1;
      this.rtc.sendUserMessage(this.rtc.options.clientId, JSON.stringify(this.wheelConfig));
    });

    // Mouse leave
    videoDom.addEventListener("mouseleave", (e: MouseEvent) => {
      e.preventDefault();
      if (this.rtc.options.disable) return;
      if (!this.rtc.hasPushDown) return;
      this.touchConfig.action = 1; // 抬起
      this.rtc.sendUserMessage(this.rtc.options.clientId, JSON.stringify(this.touchConfig));
    });

    // Touch/Mouse Start
    videoDom.addEventListener(eventTypeStart, (e) => {
      e.preventDefault();
      if (this.rtc.options.disable) return;
      this.rtc.hasPushDown = true;
      const { allowLocalIMEInCloud, keyboard } = this.rtc.options;
      const { inputStateIsOpen } = this.rtc.roomMessage;
      
      const shouldHandleFocus = (allowLocalIMEInCloud && keyboard === "pad") || keyboard === "local";

      if (this.rtc.inputElement && shouldHandleFocus && typeof inputStateIsOpen === "boolean") {
        if (inputStateIsOpen) {
          this.rtc.inputElement.focus();
        } else {
          this.rtc.inputElement.blur();
        }
      }

      if (!this.rtc.videoDomRect) this.rtc.updateDomCache();
      const videoDomIdRect = this.rtc.videoDomRect!;
      const distanceToTop = videoDomIdRect.top;
      const distanceToLeft = videoDomIdRect.left;

      const touchCount = isMobileFlag ? (e as TouchEvent)?.touches?.length : 1;
      this.touchConfig.action = touchCount > 1 ? 261 : 0;
      this.touchConfig.pointCount = touchCount;

      const bigSide = this.rtc.videoDomWidth > this.rtc.videoDomHeight ? this.rtc.videoDomWidth : this.rtc.videoDomHeight;
      const smallSide = this.rtc.videoDomWidth > this.rtc.videoDomHeight ? this.rtc.videoDomHeight : this.rtc.videoDomWidth;

      this.touchConfig.widthPixels = this.rtc.rotateType === 1 ? bigSide : smallSide;
      this.touchConfig.heightPixels = this.rtc.rotateType === 1 ? smallSide : bigSide;

      if (this.rtc.rotateType === 1 && this.rtc.remoteResolution.height > this.rtc.remoteResolution.width) {
        this.touchConfig.widthPixels = smallSide;
        this.touchConfig.heightPixels = bigSide;
      } else if (this.rtc.rotateType === 0 && this.rtc.remoteResolution.width > this.rtc.remoteResolution.height) {
        this.touchConfig.widthPixels = bigSide;
        this.touchConfig.heightPixels = smallSide;
      }

      for (let i = 0; i < touchCount; i += 1) {
        const touch = isMobileFlag ? (e as TouchEvent).touches[i]! : (e as MouseEvent);
        if (!this.poolCoords[i]) {
          this.poolCoords[i] = generateTouchCoord();
          this.poolProps[i] = { id: i, toolType: 1 };
        }
        const coord = this.poolCoords[i];
        const prop = this.poolProps[i];
        
        let x = 'offsetX' in touch ? touch.offsetX : undefined;
        let y = 'offsetX' in touch ? touch.offsetY : undefined;
        if (x === undefined) {
          x = touch.clientX - distanceToLeft;
          y = touch.clientY - distanceToTop;
          if (this.rtc.rotateType === 1 && this.rtc.remoteResolution.height > this.rtc.remoteResolution.width) {
            x = videoDomIdRect.bottom - touch.clientY;
            y = touch.clientX - distanceToLeft;
          } else if (this.rtc.rotateType === 0 && this.rtc.remoteResolution.width > this.rtc.remoteResolution.height) {
            x = touch.clientY - distanceToTop;
            y = videoDomIdRect.right - touch.clientX;
          }
        }
        coord.orientation = Number((0.01 * Math.random()).toFixed(3));
        coord.x = Math.round(x ?? 0);
        coord.y = Math.round(y ?? 0);
        
        this.touchConfig.coords[i] = coord;
        this.touchConfig.properties[i] = prop;
      }
      
      this.touchConfig.coords.length = touchCount;
      this.touchConfig.properties.length = touchCount;
      this.rtc.sendUserMessage(this.rtc.options.clientId, JSON.stringify(this.touchConfig));
    });

    // Touch/Mouse Move
    videoDom.addEventListener(eventTypeMove, (e) => {
      e.preventDefault();
      if (this.rtc.options.disable || !this.rtc.hasPushDown) return;
      if (!this.rtc.videoDomRect) this.rtc.updateDomCache();
      const videoDomIdRect = this.rtc.videoDomRect!;
      const distanceToTop = videoDomIdRect.top;
      const distanceToLeft = videoDomIdRect.left;

      const touchCount = isMobileFlag ? (e as TouchEvent)?.touches?.length : 1;
      this.touchConfig.action = 2; // 触摸中
      this.touchConfig.pointCount = touchCount;

      for (let i = 0; i < touchCount; i += 1) {
        const touch = isMobileFlag ? (e as TouchEvent).touches[i]! : (e as MouseEvent);
        if (!this.poolCoords[i]) {
          this.poolCoords[i] = generateTouchCoord();
          this.poolProps[i] = { id: i, toolType: 1 };
        }
        const coord = this.poolCoords[i];
        const prop = this.poolProps[i];
        
        let x = 'offsetX' in touch ? touch.offsetX : undefined;
        let y = 'offsetX' in touch ? touch.offsetY : undefined;
        if (x === undefined) {
          x = touch.clientX - distanceToLeft;
          y = touch.clientY - distanceToTop;
          if (this.rtc.rotateType === 1 && this.rtc.remoteResolution.height > this.rtc.remoteResolution.width) {
            x = videoDomIdRect.bottom - touch.clientY;
            y = touch.clientX - distanceToLeft;
          } else if (this.rtc.rotateType === 0 && this.rtc.remoteResolution.width > this.rtc.remoteResolution.height) {
            x = touch.clientY - distanceToTop;
            y = videoDomIdRect.right - touch.clientX;
          }
        }
        coord.orientation = Number((0.01 * Math.random()).toFixed(3));
        coord.x = Math.round(x ?? 0);
        coord.y = Math.round(y ?? 0);
        
        this.touchConfig.coords[i] = coord;
        this.touchConfig.properties[i] = prop;
      }
      this.touchConfig.coords.length = touchCount;
      this.touchConfig.properties.length = touchCount;
      this.rtc.sendUserMessage(this.rtc.options.clientId, JSON.stringify(this.touchConfig));
    });

    // Touch/Mouse End
    videoDom.addEventListener(eventTypeEnd, (e) => {
      e.preventDefault();
      if (this.rtc.options.disable) return;
      this.rtc.hasPushDown = false;
      if (isMobileFlag) {
        if ((e as TouchEvent).touches.length === 0) {
          this.touchConfig.action = 1; // 抬起
          this.rtc.sendUserMessage(this.rtc.options.clientId, JSON.stringify(this.touchConfig));
        }
      } else {
        this.touchConfig.action = 1;
        this.rtc.sendUserMessage(this.rtc.options.clientId, JSON.stringify(this.touchConfig));
      }
    });
  }
}
