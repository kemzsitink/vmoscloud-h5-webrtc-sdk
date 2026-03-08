import type { TouchInfo } from "../../core/webrtcType";
import type { TouchConfig } from "../../core/types";
import type HuoshanRTC from "../huoshanRtc";
import { generateTouchCoord } from "../../utils/mixins";
import { isMobile, isTouchDevice } from "../../utils/index";

interface TouchPointPayload {
  x: number;
  y: number;
  pressure: number;
  size: number;
  touchMajor: number;
  touchMinor: number;
  toolMajor: number;
  toolMinor: number;
  orientation: number;
}

export class TouchInputHandler {
  private boundElement: HTMLElement | null = null;
  private domListeners: {
    type: string;
    listener: EventListener;
    options: AddEventListenerOptions | boolean | undefined;
  }[] = [];

  private touchConfig: TouchConfig = {
    action: 0,
    widthPixels: 0,
    heightPixels: 0,
    pointCount: 1,
    touchType: "gesture",
    properties: [],
    coords: [],
  };

  private poolCoords: TouchInfo[] = [];
  private poolProps: { id: number; toolType: number }[] = [];
  private lastCoords: TouchPointPayload[] = [];
  private lastProps: { id: number; toolType: number }[] = [];

  constructor(private rtc: HuoshanRTC) {
    for (let i = 0; i < 10; i++) {
      this.poolCoords.push(generateTouchCoord());
      this.poolProps.push({ id: i, toolType: 1 });
    }
  }

  private syncDimensions(): void {
    if (!this.rtc.videoDomRect) this.rtc.updateDomCache();
    const rtc = this.rtc;
    const { videoDomWidth, videoDomHeight, rotateType, remoteResolution } = rtc;

    const bigSide = videoDomWidth > videoDomHeight ? videoDomWidth : videoDomHeight;
    const smallSide = videoDomWidth > videoDomHeight ? videoDomHeight : videoDomWidth;

    let w = rotateType === 1 ? bigSide : smallSide;
    let h = rotateType === 1 ? smallSide : bigSide;

    if (rotateType === 1 && remoteResolution.height > remoteResolution.width) {
      w = smallSide;
      h = bigSide;
    } else if (rotateType === 0 && remoteResolution.width > remoteResolution.height) {
      w = bigSide;
      h = smallSide;
    }

    this.touchConfig.widthPixels = w | 0;
    this.touchConfig.heightPixels = h | 0;
  }

  public bindEvents(videoDom: HTMLElement): void {
    this.unbindEvents();
    this.boundElement = videoDom;

    const isMobileFlag = isTouchDevice() || isMobile();
    const eventTypeStart = isMobileFlag ? "touchstart" : "mousedown";
    const eventTypeMove = isMobileFlag ? "touchmove" : "mousemove";
    const eventTypeEnd = isMobileFlag ? "touchend" : "mouseup";
    const addListener = (
      type: string,
      listener: EventListener,
      options?: AddEventListenerOptions | boolean
    ): void => {
      videoDom.addEventListener(type, listener, options);
      this.domListeners.push({ type, listener, options });
    };

    if (this.rtc.options.disableContextMenu) {
      const onContextMenu = (e: Event): void => {
        e.preventDefault();
      };
      addListener("contextmenu", onContextMenu);
    }

    const onWheel = (e: Event): void => {
      const wheelEvent = e as WheelEvent;
      const rtc = this.rtc;
      if (rtc.options.disable || !rtc.videoDomRect) return;

      const swipe = wheelEvent.deltaY > 0 ? -1 : 1;
      const rx = (wheelEvent.clientX - rtc.videoDomRect.left) | 0;
      const ry = (wheelEvent.clientY - rtc.videoDomRect.top) | 0;

      const msg = JSON.stringify({
        coords: [{ pressure: 1, size: 1, x: rx, y: ry }],
        widthPixels: this.touchConfig.widthPixels,
        heightPixels: this.touchConfig.heightPixels,
        pointCount: 1,
        properties: [{ id: 0, toolType: 1 }],
        touchType: "gestureSwipe",
        swipe,
      });

      void rtc.sendUserMessage(rtc.options.clientId, msg);
    };
    addListener("wheel", onWheel, { passive: true });

    const onStart = (e: Event): void => {
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
    };
    addListener(eventTypeStart, onStart);

    const onMove = (e: Event): void => {
      if (this.rtc.options.disable || !this.rtc.hasPushDown) return;
      if (e.cancelable) e.preventDefault();
      this.processEvent(e, 2, isMobileFlag);
    };
    addListener(eventTypeMove, onMove, { passive: false });

    const onEnd = (e: Event): void => {
      const rtc = this.rtc;
      if (rtc.options.disable) return;
      rtc.hasPushDown = false;

      if (isMobileFlag) {
        if ((e as TouchEvent).touches.length === 0) {
          this.processEvent(e, 1, isMobileFlag);
        }
      } else {
        this.processEvent(e, 1, isMobileFlag);
      }
    };
    addListener(eventTypeEnd, onEnd);

    const onMouseLeave = (): void => {
      const rtc = this.rtc;
      if (rtc.options.disable || !rtc.hasPushDown) return;
      rtc.hasPushDown = false;
      this.processEvent(null, 1, isMobileFlag);
    };
    addListener("mouseleave", onMouseLeave);
  }

  public unbindEvents(): void {
    if (!this.boundElement) return;
    for (const { type, listener, options } of this.domListeners) {
      this.boundElement.removeEventListener(type, listener, options);
    }
    this.domListeners = [];
    this.boundElement = null;
  }

  private processEvent(e: Event | null, action: number, isMobileFlag: boolean): void {
    const rtc = this.rtc;
    const touches = isMobileFlag && e ? (e as TouchEvent).touches : e ? [e as MouseEvent] : [];
    const touchCount = touches.length;

    if (touchCount === 0 && action !== 1 && e !== null) return;

    this.touchConfig.action = action === 0 && touchCount > 1 ? 261 : action;

    const isValidTouch = isMobileFlag ? touchCount > 0 : e !== null;
    if (isValidTouch) {
      this.touchConfig.pointCount = isMobileFlag ? touchCount : 1;
    }

    const rect = rtc.videoDomRect;
    if (!rect) return;

    const rectLeft = rect.left;
    const rectTop = rect.top;
    const rectWidth = rect.width;
    const rectHeight = rect.height;
    const rotateType = rtc.rotateType;
    const remoteRes = rtc.remoteResolution;
    const isRotated1 = rotateType === 1 && remoteRes.height > remoteRes.width;
    const isRotated0 = rotateType === 0 && remoteRes.width > remoteRes.height;

    let coords: TouchPointPayload[] = [];
    let props: { id: number; toolType: number }[] = [];

    if (isValidTouch) {
      const iterations = isMobileFlag ? touchCount : 1;
      for (let i = 0; i < iterations; i++) {
        const touch = isMobileFlag ? (touches as TouchList)[i] : (e as MouseEvent);
        if (!touch) continue;

        const poolCoord = this.poolCoords[i] ?? generateTouchCoord();

        let x = touch.clientX - rectLeft;
        let y = touch.clientY - rectTop;

        if (isRotated1) {
          const tx = x;
          x = rectHeight - y;
          y = tx;
        } else if (isRotated0) {
          const tx = x;
          x = y;
          y = rectWidth - tx;
        }

        const rotationTouch = touch as Touch & { rotationAngle?: number };
        const orientation =
          typeof rotationTouch.rotationAngle === "number"
            ? Number(rotationTouch.rotationAngle.toFixed(3))
            : 0;

        coords.push({
          x: x | 0,
          y: y | 0,
          pressure: poolCoord.pressure,
          size: poolCoord.size,
          touchMajor: poolCoord.touchMajor,
          touchMinor: poolCoord.touchMinor,
          toolMajor: poolCoord.toolMajor,
          toolMinor: poolCoord.toolMinor,
          orientation,
        });
        props.push({ id: i, toolType: 1 });
      }

      this.lastCoords = coords;
      this.lastProps = props;
    } else {
      coords = this.lastCoords;
      props = this.lastProps;
    }

    const message = JSON.stringify({
      action: this.touchConfig.action,
      widthPixels: this.touchConfig.widthPixels,
      heightPixels: this.touchConfig.heightPixels,
      pointCount: this.touchConfig.pointCount,
      touchType: "gesture",
      properties: props,
      coords,
    });

    void rtc.sendUserMessage(rtc.options.clientId, message);
  }
}
