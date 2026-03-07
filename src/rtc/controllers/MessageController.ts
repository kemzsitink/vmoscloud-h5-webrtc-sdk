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
      // 检查是否是我们要订阅 cloud phone 用户
      if (e.userId === this.rtc.options.clientId) {
        this.rtc.addReportInfo({
          describe: "开始订阅 và 播放云机音视频流",
          e,
        });

        // 1. 确保 VideoElement 的容器已就绪并绑定到 SDK
        // setRemoteVideoRotation 内部会调用 setRemoteVideoPlayer 映射到 VideoElement.getContainerId()
        await this.rtc.setRemoteVideoRotation(this.rtc.rotation);

        // 2. 执行订阅
        await this.rtc.engine?.subscribeStream(
          this.rtc.options.clientId,
          this.rtc.options.mediaType
        );

        if (this.rtc.engine) {
          // 3. 强制高质量流 (High quality for cloud gaming/phone)
          this.rtc.engine.setRemoteSimulcastStreamType(
            this.rtc.options.clientId,
            SimulcastStreamType.VIDEO_STREAM_HIGH
          );

          // 4. Thiết lập mục tiêu Jitter Buffer nội tại (Instant-jump)
          this.rtc.engine.setJitterBufferTarget(
            this.rtc.options.clientId,
            StreamIndex.STREAM_INDEX_MAIN,
            this.rtc.options.latencyTarget ?? 0,
            false // Progressive = false: Ép nhảy về 0ms ngay lập tức, không chờ điều chỉnh dần
          );
        }

        // 5. 初始化截图覆盖层 (指向 outer videoDomId 以覆盖整个区域)
        if (!this.rtc.screenShotInstance) {
          const player = document.getElementById(this.rtc.videoDomId);
          if (player) {
            this.rtc.screenShotInstance = new ScreenshotOverlay(
              player as HTMLDivElement,
              this.rtc.rotation
            );
          }
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
      if (!e.message) return;
      try {
        const msg = JSON.parse(e.message);
        
        // 消息透传
        if (msg.key === "message") {
          this.rtc.callbacks.onTransparentMsg(0, msg.data);
        }
        // ui消息
        else if (msg.key === "refreshUiType") {
          const msgData = JSON.parse(msg.data);
          this.rtc.roomMessage.isVertical = msgData.isVertical;
          // 若宽高没变，则不重新绘制页面
          if (
            msgData.width !== this.rtc.remoteResolution.width ||
            msgData.height !== this.rtc.remoteResolution.height
          ) {
            this.rtc.uiController.initRotateScreen(msgData.width, msgData.height);
          }
        }
        // 云机、本机键盘使用消息
        else if (msg.key === "inputState" && this.rtc.inputElement) {
          this.rtc.checkInputState(msg);
        }
        // 将云机内容复制到本机剪切板
        else if (msg.key === "clipboard" && this.rtc.options.saveCloudClipboard) {
          this.rtc.callbacks.onOutputClipper(JSON.parse(msg.data));
        }
      } catch (err) {
        // Bỏ qua lỗi parse để không sập luồng chính
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
      if (!e.message) return;
      try {
        const msg = JSON.parse(e.message);
        
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
        else if (msg.key === "equipmentInfo") {
          this.rtc.callbacks?.onEquipmentInfo(JSON.parse(msg.data || "[]"));
        }
        else if (msg.key === "inputAdb") {
          this.rtc.callbacks?.onAdbOutput(JSON.parse(msg.data || "{}"));
        }
        // 音视频采集
        else if (msg.key === "videoAndAudioControl") {
          if (!this.rtc.enableMicrophone && !this.rtc.enableCamera) return;
          const msgData = JSON.parse(msg.data);

          const pushType =
            this.rtc.enableMicrophone && this.rtc.enableCamera
              ? MediaType.AUDIO_AND_VIDEO
              : this.rtc.enableCamera
                ? MediaType.VIDEO
                : MediaType.AUDIO;
          if (msgData.isOpen) {
            if (this.rtc.enableCamera) {
              const videoDeviceId = this.rtc.videoDeviceId || (msgData.isFront ? "user" : "environment");
              await this.rtc.engine?.setVideoCaptureDevice(videoDeviceId);
              this.rtc.engine?.startVideoCapture().then((res: unknown) => {
                this.rtc.callbacks.onVideoInit(res);
                this.rtc.engine?.publishStream(MediaType.VIDEO);
              }).catch((err: unknown) => this.rtc.callbacks.onVideoError(err));
            }

            if (this.rtc.enableMicrophone) {
              if (this.rtc.audioDeviceId) await this.rtc.engine?.setAudioCaptureDevice(this.rtc.audioDeviceId);
              this.rtc.engine?.startAudioCapture().then((res: unknown) => {
                this.rtc.callbacks.onAudioInit(res);
                this.rtc.engine?.publishStream(MediaType.AUDIO);
              }).catch((err: unknown) => this.rtc.callbacks.onAudioError(err));
            }
          } else {
            await this.rtc.engine?.stopAudioCapture();
            await this.rtc.engine?.stopVideoCapture();
            await this.rtc.engine?.unpublishStream(pushType);
          }
        }
        // 云机、本机键盘使用消息
        else if (msg.key === "inputState" && this.rtc.inputElement) {
          this.rtc.checkInputState(msg);
        }
        // 音频采集
        else if (msg.key === "audioControl" && this.rtc.enableMicrophone) {
          const msgData = JSON.parse(msg.data);
          if (msgData.isOpen) {
            this.rtc.engine?.startAudioCapture().then((res: unknown) => {
              this.rtc.callbacks.onAudioInit(res);
              this.rtc.engine?.publishStream(MediaType.AUDIO);
            }).catch((error: unknown) => this.rtc.callbacks.onAudioError(error));
          } else {
            this.rtc.engine?.stopAudioCapture();
            this.rtc.engine?.unpublishStream(MediaType.AUDIO);
          }
        }
      } catch (err) {
        // Bỏ qua lỗi parse
      }
    };
    this.rtc.engine?.on(VERTC.events.onUserMessageReceived, onUserMessageReceived);
  }
}
