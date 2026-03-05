import type HuoshanRTC from "../huoshanRtc";
import VERTC, { StreamIndex, MediaType, SimulcastStreamType } from "../../vendor/volcengine-rtc";
import ScreenshotOverlay from "../../features/screenshot";

export class MessageController {
  constructor(private rtc: HuoshanRTC) {}

  onUserLeave() {
    this.rtc.engine?.on(VERTC.events.onUserLeave, (res: { userInfo: { userId: string } }) => {
      this.rtc.callbacks.onUserLeave(res);
    });
  }

  onUserJoined() {
    this.rtc.engine?.on(VERTC.events.onUserJoined, (user: { userInfo?: { userId: string } }) => {
      if (user.userInfo?.userId === this.rtc.options.clientId) {
        this.rtc.addReportInfo({
          describe: "远端用户加入房间",
          user,
        });
        setTimeout(() => {
          this.rtc.updateUiH5();
          // 查询输入状态
          this.rtc.onCheckInputState();
          this.rtc.setKeyboardStyle(this.rtc.options.keyboard as "pad" | "local");
          this.rtc.triggerRecoveryTimeCallback();
        }, 300);
      }
    });
  }

  onRemoteVideoFirstFrame() {
    this.rtc.engine?.on(VERTC.events.onRemoteVideoFirstFrame, async (event: { width: number; height: number }) => {
      console.log("视频首帧渲染回调", event);
      try {
        if (!this.rtc.isFirstRotate) {
          await this.rtc.uiController.initRotateScreen(event.width, event.height);
        }
      } finally {
        this.rtc.callbacks.onRenderedFirstFrame();
      }
    });
  }

  onUserPublishStream(): void {
    const handleUserPublishStream = async (e: {
      userId: string;
      mediaType: MediaType;
    }) => {
      if (e.userId === this.rtc.options.clientId) {
        const player = document.querySelector(`#${this.rtc.videoDomId}`) as HTMLDivElement;

        this.rtc.addReportInfo({
          describe: "订阅和播放房间内的音视频流",
          e,
        });
        await this.rtc.setRemoteVideoRotation(this.rtc.rotation);

        await this.rtc.engine?.subscribeStream(
          this.rtc.options.clientId,
          this.rtc.options.mediaType
        );

        if (this.rtc.engine) {
          // Force high quality stream for cloud gaming
          this.rtc.engine.setRemoteSimulcastStreamType(
            this.rtc.options.clientId,
            SimulcastStreamType.VIDEO_STREAM_HIGH
          );

          this.rtc.engine.setJitterBufferTarget(
            this.rtc.options.clientId,
            StreamIndex.STREAM_INDEX_MAIN,
            this.rtc.options.latencyTarget ?? 0,
            false // Non-progressive adjustment for extreme low latency
          );
        }

        if (!this.rtc.screenShotInstance) {
          this.rtc.screenShotInstance = new ScreenshotOverlay(
            player,
            this.rtc.rotation
          );
        }
      }
    };
    this.rtc.engine?.on(VERTC.events.onUserPublishStream, handleUserPublishStream);
  }

  checkInputState(msg: { data: string }): void {
    const { allowLocalIMEInCloud, keyboard } = this.rtc.options;
    const msgData = JSON.parse(msg.data);

    this.rtc.roomMessage.inputStateIsOpen = msgData.isOpen;
    // 仅在 enterkeyhint 存在时设置属性
    const enterkeyhintText = this.rtc.enterkeyhintObj[msgData.imeOptions as keyof typeof this.rtc.enterkeyhintObj];
    if (enterkeyhintText) {
      this.rtc.inputElement?.setAttribute("enterkeyhint", enterkeyhintText);
    }
    // 处理输入框焦点逻辑
    const shouldHandleFocus =
      (allowLocalIMEInCloud && keyboard === "pad") || keyboard === "local";

    if (shouldHandleFocus && typeof msgData.isOpen === "boolean") {
      if (msgData.isOpen) { this.rtc.inputElement?.focus(); } else { this.rtc.inputElement?.blur(); }
    }
  }

  onRoomMessageReceived() {
    const onRoomMessageReceived = async (e: {
      userId: string;
      message: string;
    }) => {
      if (e.message) {
        const msg = JSON.parse(e.message);
        this.rtc.addReportInfo({
          describe: "接收到房间内广播消息的回调",
          msg,
        });
        // 消息透传
        if (msg.key === "message") {
          this.rtc.callbacks.onTransparentMsg(0, msg.data);
        }
        // ui消息
        if (msg.key === "refreshUiType") {
          const msgData = JSON.parse(msg.data);
          this.rtc.roomMessage.isVertical = msgData.isVertical;
          // 若宽高没变，则不重新绘制页面
          if (
            msgData.width === this.rtc.remoteResolution.width &&
            msgData.height === this.rtc.remoteResolution.height
          ) {
            console.log("宽高没变，不重新绘制页面", this.rtc.remoteUserId);
            return;
          }

          this.rtc.uiController.initRotateScreen(msgData.width, msgData.height);
        }
        // 云机、本机键盘使用消息
        if (msg.key === "inputState" && this.rtc.inputElement) {
          this.rtc.checkInputState(msg);
        }
        // 将云机内容复制到本机剪切板
        if (msg.key === "clipboard") {
          if (this.rtc.options.saveCloudClipboard) {
            const msgData = JSON.parse(msg.data);
            this.rtc.callbacks.onOutputClipper(msgData);
          }
        }
      }
    };
    this.rtc.engine?.on(VERTC.events.onRoomMessageReceived, onRoomMessageReceived);
  }

  onUserMessageReceived() {
    const parseResolution = (resolution: string) => {
      const [width, height] = resolution?.split("*").map(Number);
      return { width, height };
    };
    const onUserMessageReceived = async (e: {
      userId: string;
      message: string;
    }) => {
      if (e.message) {
        const msg = JSON.parse(e.message);
        this.rtc.addReportInfo({
          describe:
            "收到来自房间中其他用户通过 sendUserMessage 发来的点对点文本消息",
          msg,
        });
        if (msg.key === "callBack") {
          const callData = JSON.parse(msg.data);
          const result = JSON.parse(callData.data);
          switch (callData.type) {
            case "definition":
              this.rtc.callbacks.onChangeResolution({
                from: parseResolution(result.from),
                to: parseResolution(result.to),
              });
              break;
            case "startVideoInjection":
            case "stopVideoInjection":
              this.rtc.callbacks?.onInjectVideoResult(callData.type, result);
              break;
          }
        }

        if (msg.key === "equipmentInfo") {
          this.rtc.callbacks?.onEquipmentInfo(JSON.parse(msg.data || []));
        }
        if (msg.key === "inputAdb") {
          this.rtc.callbacks?.onAdbOutput(JSON.parse(msg.data || {}));
        }
        // 音视频采集
        if (msg.key === "videoAndAudioControl") {
          if (!this.rtc.enableMicrophone && !this.rtc.enableCamera) {
            return;
          }
          const msgData = JSON.parse(msg.data);

          const pushType =
            this.rtc.enableMicrophone && this.rtc.enableCamera
              ? MediaType.AUDIO_AND_VIDEO
              : this.rtc.enableCamera
                ? MediaType.VIDEO
                : MediaType.AUDIO;
          if (msgData.isOpen) {
            if (this.rtc.enableCamera) {
              const videoDeviceId =
                this.rtc.videoDeviceId ||
                (msgData.isFront ? "user" : "environment");

              await this.rtc.engine?.setVideoCaptureDevice(videoDeviceId);

              await this.rtc.engine
                ?.startVideoCapture()
                .then((res: unknown) => {
                  this.rtc.callbacks.onVideoInit(res);
                  this.rtc.engine?.publishStream(MediaType.VIDEO);
                })
                .catch((err: unknown) => {
                  this.rtc.callbacks.onVideoError(err);
                });
            }

            if (this.rtc.enableMicrophone) {
              if (this.rtc.audioDeviceId) {
                await this.rtc.engine?.setAudioCaptureDevice(this.rtc.audioDeviceId);
              }
              await this.rtc.engine
                ?.startAudioCapture()
                .then((res: unknown) => {
                  this.rtc.callbacks.onAudioInit(res);
                  this.rtc.engine?.publishStream(MediaType.AUDIO);
                })
                .catch((err: unknown) => {
                  this.rtc.callbacks.onAudioError(err);
                });
            }
          } else {
            await this.rtc.engine?.stopAudioCapture();
            await this.rtc.engine?.stopVideoCapture();
            await this.rtc.engine?.unpublishStream(pushType);
          }
        }
        // 云机、本机键盘使用消息
        if (msg.key === "inputState" && this.rtc.inputElement) {
          this.rtc.checkInputState(msg);
        }
        // 音频采集
        if (msg.key === "audioControl" && this.rtc.enableMicrophone) {
          const msgData = JSON.parse(msg.data);
          if (msgData.isOpen) {
            this.rtc.engine
              ?.startAudioCapture()
              .then((res: unknown) => {
                this.rtc.callbacks.onAudioInit(res);
                this.rtc.engine?.publishStream(MediaType.AUDIO);
              })
              .catch((error: unknown) => {
                this.rtc.callbacks.onAudioError(error);
              });
          } else {
            this.rtc.engine?.stopAudioCapture();
            this.rtc.engine?.unpublishStream(MediaType.AUDIO);
          }
        }
      }
    };
    this.rtc.engine?.on(VERTC.events.onUserMessageReceived, onUserMessageReceived);
  }
}
