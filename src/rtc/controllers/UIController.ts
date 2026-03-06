import type HuoshanRTC from "../huoshanRtc";
import { isMobile, isTouchDevice } from "../../utils/index";
import { StreamIndex } from "../../vendor/volcengine-rtc";

export class UIController {
  constructor(private rtc: HuoshanRTC) {}

  setViewSize(width: number, height: number, rotateType: 0 | 1 = 0) {
    const h5Dom = document.getElementById(this.rtc.initDomId);
    const videoDom = document.getElementById(
      this.rtc.videoDomId
    ) as HTMLDivElement | null;

    if (h5Dom && videoDom) {
      const setDimensions = (
        element: HTMLElement,
        width: number,
        height: number
      ) => {
        element.style.width = width + "px";
        element.style.height = height + "px";
      };

      // 设置宽高
      setDimensions(h5Dom, width, height);

      if (rotateType === 1) {
        setDimensions(videoDom, height, width);
        return;
      }
      setDimensions(videoDom, width, height);
    }
  }

  rotateContainerVideo(type: 0 | 1 = 0) {
    const player = document.querySelector(`#${this.rtc.videoDomId} div`) as HTMLElement | null;
    if (player) {
      let translateY,
        rotate = 0;

      if (type === 1) {
        const { clientWidth, clientHeight } = player;

        // 计算 translateY 为百分比
        translateY = ((clientWidth - clientHeight) / 2 / clientHeight) * 100; // 转换为百分比

        rotate = -90;
        player.style.transform = `translateY(${translateY}%) rotate(${rotate}deg)`;
        return;
      }

      player.style.transform = "";
      this.rtc.options.rotateType = type;
      this.rtc.rotateType = type;
    }
  }

  setScreenshotRotation(rotation = 0) {
    this.rtc.screenShotInstance?.setScreenshotrotateType(rotation as 0 | 1);
  }

  takeScreenshot(rotation = 0) {
    console.log("生成封面图", this.rtc.remoteUserId);
    this.rtc.screenShotInstance?.takeScreenshot(rotation);
  }

  resizeScreenshot(width: number, height: number) {
    this.rtc.screenShotInstance?.resizeScreenshot(width, height);
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
    const contentObj = {
      type: "localScreenshot",
    };
    const messageObj = {
      touchType: "eventSdk",
      content: JSON.stringify(contentObj),
    };
    const userId = this.rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    this.rtc.sendUserMessage(userId, message);
  }

  setPhoneRotation(type: number) {
    this.rtc.triggerRecoveryTimeCallback();
    this.rtc.rotateScreen(type);
  }

  async rotateScreen(type: number) {
    // console.log(1111, `type=${type}`)
    // 获取父元素（调用方）的原始宽度和高度，这里要重新获取，因为外层的div可能宽高发生变化
    const h5Dom = document.getElementById(this.rtc.initDomId);
    if (!h5Dom) return;
    this.rtc.rotateType = type;

    let parentWidth =
      h5Dom.clientWidth > window.innerWidth
        ? window.innerWidth
        : h5Dom.clientWidth;
    let parentHeight =
      h5Dom.clientHeight > window.innerHeight
        ? window.innerHeight
        : h5Dom.clientHeight;

    let bigSide = parentHeight;
    let smallSide = parentWidth;
    if (parentWidth > parentHeight) {
      bigSide = parentWidth;
      smallSide = parentHeight;
    }

    if (type === 1) {
      parentWidth = bigSide;
      parentHeight = smallSide;
    } else {
      parentWidth = smallSide;
      parentHeight = bigSide;
    }

    h5Dom.style.width = parentWidth + "px";
    h5Dom.style.height = parentHeight + "px";

    const videoIsLandscape =
      this.rtc.remoteResolution.width > this.rtc.remoteResolution.height;

    // 外层 div
    let armcloudVideoWidth = 0;
    let armcloudVideoHeight = 0;
    // 旋转角度
    let videoWrapperRotate = 0;

    const videoDom = document.getElementById(this.rtc.videoDomId) as HTMLDivElement;

    if (type === 1) {
      const w = videoIsLandscape
        ? this.rtc.remoteResolution.width
        : this.rtc.remoteResolution.height;
      const h = videoIsLandscape
        ? this.rtc.remoteResolution.height
        : this.rtc.remoteResolution.width;

      const scale = Math.min(parentWidth / w, parentHeight / h);
      armcloudVideoWidth = w * scale;
      armcloudVideoHeight = h * scale;
      videoWrapperRotate = videoIsLandscape ? 0 : 270;
    } else {
      // 竖屏处理
      const w = videoIsLandscape
        ? this.rtc.remoteResolution.height
        : this.rtc.remoteResolution.width;
      const h = videoIsLandscape
        ? this.rtc.remoteResolution.width
        : this.rtc.remoteResolution.height;

      const scale = Math.min(parentWidth / w, parentHeight / h);
      armcloudVideoWidth = w * scale;
      armcloudVideoHeight = h * scale;
      videoWrapperRotate = videoIsLandscape ? 90 : 0;
    }

    this.rtc.rotation = videoWrapperRotate;
    // armcloudVideo
    videoDom.style.width = `${armcloudVideoWidth}px`;
    videoDom.style.height = `${armcloudVideoHeight}px`;

    await this.rtc.setRemoteVideoRotation(videoWrapperRotate);

    this.rtc.callbacks.onChangeRotate(type, {
      width: armcloudVideoWidth,
      height: armcloudVideoHeight,
    });
  }

  async setRemoteVideoRotation(rotation: number) {
    const videoDom = document.getElementById(this.rtc.videoDomId);
    if (videoDom) {
      // Logic: Use createBLWEngine optimized rendering path.
      // We pass the renderDom but ensure the SDK manages the internal video track lifecycle
      // without extra DOM layering that causes browser throttling.
      await this.rtc.engine?.setRemoteVideoPlayer(StreamIndex.STREAM_INDEX_MAIN, {
        userId: this.rtc.options.clientId,
        renderDom: videoDom,
        renderMode: 2, // fill
        rotation,
      });
    }
  }

  async updateUiH5() {
    try {
      const userId = this.rtc.options.clientId;
      const contentObj = {
        type: "updateUiH5",
      };
      const messageObj = {
        touchType: "eventSdk",
        content: JSON.stringify(contentObj),
      };
      const message = JSON.stringify(messageObj);
      const res = await this.rtc.sendUserMessage(userId, message);

      this.rtc.addReportInfo({
        describe: "发送updateUiH5信息",
        res,
      });
    } catch {
      this.rtc.addReportInfo({
        describe: "发送updateUiH5失败",
      });
      this.rtc.updateUiH5();
    }
  }

  public async initRotateScreen(width: number, height: number) {
    // 移动端需要强制竖屏
    if (isTouchDevice() || isMobile()) {
      this.rtc.options.rotateType = 0;
    }

    const { rotateType } = this.rtc.options;
    if (rotateType && this.rtc.isFirstRotate) {
      return;
    }

    /** 是否首次旋转 */
    if (!this.rtc.isFirstRotate) {
      this.rtc.isFirstRotate = true;
    }

    // 存储云机分辨率
    Object.assign(this.rtc.remoteResolution, {
      width,
      height,
    });
    // 0 为竖屏，1 为横屏
    let targetRotateType;

    // 判断是否为 0 或 1
    if (rotateType === 0 || rotateType === 1) {
      targetRotateType = rotateType;
    } else {
      // 根据宽高自动设置旋转类型，
      targetRotateType = width > height ? 1 : 0;
    }

    await this.rtc.rotateScreen(targetRotateType);
  }
}
