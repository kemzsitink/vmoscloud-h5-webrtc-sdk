import type HuoshanRTC from "../huoshanRtc";
import { isMobile, isTouchDevice } from "../../utils/index";
import { StreamIndex } from "../../vendor/volcengine-rtc";

export class UIController {
  constructor(private rtc: HuoshanRTC) {}

  setViewSize(width: number, height: number, rotateType: 0 | 1 = 0) {
    const rtc = this.rtc;
    const h5Dom = document.getElementById(rtc.initDomId);
    const videoDom = document.getElementById(rtc.videoDomId);

    if (h5Dom && videoDom) {
      const w = width | 0;
      const h = height | 0;
      h5Dom.style.width = w + "px";
      h5Dom.style.height = h + "px";

      if (rotateType === 1) {
        videoDom.style.width = h + "px";
        videoDom.style.height = w + "px";
      } else {
        videoDom.style.width = w + "px";
        videoDom.style.height = h + "px";
      }
    }
  }

  rotateContainerVideo(type: 0 | 1 = 0) {
    const rtc = this.rtc;
    const player = document.querySelector(`#${rtc.videoDomId} div`) as HTMLElement | null;
    if (player) {
      if (type === 1) {
        const cw = player.clientWidth;
        const ch = player.clientHeight;
        const translateY = ((cw - ch) / 2 / ch) * 100; 
        player.style.transform = `translateY(${translateY}%) rotate(-90deg)`;
      } else {
        player.style.transform = "";
      }
      rtc.options.rotateType = type;
      rtc.rotateType = type;
    }
  }

  setScreenshotRotation(rotation = 0) {
    this.rtc.screenShotInstance?.setScreenshotrotateType(rotation as 0 | 1);
  }

  takeScreenshot(rotation = 0) {
    this.rtc.screenShotInstance?.takeScreenshot(rotation);
  }

  resizeScreenshot(width: number, height: number) {
    this.rtc.screenShotInstance?.resizeScreenshot(width | 0, height | 0);
  }

  showScreenShot() {
    this.rtc.screenShotInstance?.showScreenShot();
  }

  hideScreenShot() {
    this.rtc.screenShotInstance?.hideScreenShot();
  }

  clearScreenShot() {
    this.rtc.screenShotInstance?.clearScreenShot();
  }

  saveScreenShotToLocal(): Promise<ImageData | undefined> {
    const userId = this.rtc.options.clientId;
    return this.rtc.engine ? this.rtc.engine.takeRemoteSnapshot(userId, 0) : Promise.resolve(undefined);
  }

  saveScreenShotToRemote() {
    const msg = '{"touchType":"eventSdk","content":"{\\"type\\":\\"localScreenshot\\"}"}';
    this.rtc.sendUserMessage(this.rtc.options.clientId, msg);
  }

  setPhoneRotation(type: number) {
    this.rtc.triggerRecoveryTimeCallback();
    this.rtc.rotateScreen(type);
  }

  async rotateScreen(type: number) {
    const rtc = this.rtc;
    const h5Dom = document.getElementById(rtc.initDomId);
    if (!h5Dom) return;
    rtc.rotateType = type;

    const winW = window.innerWidth;
    const winH = window.innerHeight;
    let parentWidth = h5Dom.clientWidth > winW ? winW : h5Dom.clientWidth;
    let parentHeight = h5Dom.clientHeight > winH ? winH : h5Dom.clientHeight;

    const bigSide = parentWidth > parentHeight ? parentWidth : parentHeight;
    const smallSide = parentWidth > parentHeight ? parentHeight : parentWidth;

    if (type === 1) {
      parentWidth = bigSide;
      parentHeight = smallSide;
    } else {
      parentWidth = smallSide;
      parentHeight = bigSide;
    }

    h5Dom.style.width = (parentWidth | 0) + "px";
    h5Dom.style.height = (parentHeight | 0) + "px";

    const remoteRes = rtc.remoteResolution;
    const videoIsLandscape = remoteRes.width > remoteRes.height;

    let w: number, h: number;
    let videoWrapperRotate = 0;

    if (type === 1) {
      w = videoIsLandscape ? remoteRes.width : remoteRes.height;
      h = videoIsLandscape ? remoteRes.height : remoteRes.width;
      videoWrapperRotate = videoIsLandscape ? 0 : 270;
    } else {
      w = videoIsLandscape ? remoteRes.height : remoteRes.width;
      h = videoIsLandscape ? remoteRes.width : remoteRes.height;
      videoWrapperRotate = videoIsLandscape ? 90 : 0;
    }

    const scale = Math.min(parentWidth / w, parentHeight / h);
    const armcloudVideoWidth = (w * scale) | 0;
    const armcloudVideoHeight = (h * scale) | 0;

    rtc.rotation = videoWrapperRotate;
    const videoDom = document.getElementById(rtc.videoDomId);
    if (videoDom) {
      videoDom.style.width = armcloudVideoWidth + "px";
      videoDom.style.height = armcloudVideoHeight + "px";
    }

    await this.rtc.setRemoteVideoRotation(videoWrapperRotate);

    rtc.callbacks.onChangeRotate(type, {
      width: armcloudVideoWidth,
      height: armcloudVideoHeight,
    });
  }

  async setRemoteVideoRotation(rotation: number) {
    const rtc = this.rtc;
    const videoDom = document.getElementById(rtc.videoDomId);
    if (videoDom && rtc.engine) {
      await rtc.engine.setRemoteVideoPlayer(StreamIndex.STREAM_INDEX_MAIN, {
        userId: rtc.options.clientId,
        renderDom: videoDom,
        renderMode: 1, // RenderMode 1: Hidden (Aspect Fill) - Đảm bảo không méo hình
        rotation,
      });
    }
  }

  async updateUiH5() {
    try {
      const msg = '{"touchType":"eventSdk","content":"{\\"type\\":\\"updateUiH5\\"}"}';
      await this.rtc.sendUserMessage(this.rtc.options.clientId, msg);
    } catch {
      setTimeout(() => this.updateUiH5(), 1000);
    }
  }

  public async initRotateScreen(width: number, height: number) {
    const rtc = this.rtc;
    if (isTouchDevice() || isMobile()) rtc.options.rotateType = 0;

    const { rotateType } = rtc.options;
    if (rotateType !== undefined && rtc.isFirstRotate) return;

    rtc.isFirstRotate = true;
    rtc.remoteResolution.width = width | 0;
    rtc.remoteResolution.height = height | 0;

    let targetRotateType = (rotateType === 0 || rotateType === 1) 
      ? rotateType 
      : (width > height ? 1 : 0);

    await this.rotateScreen(targetRotateType);
  }
}
