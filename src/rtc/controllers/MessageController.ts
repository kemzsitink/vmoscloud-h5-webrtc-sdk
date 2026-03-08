import type HuoshanRTC from "../huoshanRtc";
import VERTC, { StreamIndex, MediaType, SimulcastStreamType } from "../../vendor/volcengine-rtc";
import ScreenshotOverlay from "../../features/screenshot";

interface UserEvent {
  userId: string;
  message: string;
}

interface ParsedMessage {
  key?: string;
  data?: string;
}

interface InputStatePayload {
  isOpen?: boolean;
  imeOptions?: number;
}

interface RefreshUiTypePayload {
  isVertical?: boolean;
  width: number;
  height: number;
}

interface CallbackPayload {
  type?: string;
  data?: string;
}

interface DefinitionResultPayload {
  from: string;
  to: string;
}

interface VideoAndAudioControlPayload {
  isOpen?: boolean;
  isFront?: boolean;
}

interface AudioControlPayload {
  isOpen?: boolean;
}

const parseJson = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export class MessageController {
  constructor(private rtc: HuoshanRTC) {}

  onUserLeave(): void {
    this.rtc.engine?.on(VERTC.events.onUserLeave, (res: { userInfo: { userId: string } }) => {
      this.rtc.callbacks.onUserLeave(res);
    });
  }

  onUserJoined(): void {
    this.rtc.engine?.on(VERTC.events.onUserJoined, (user: { userInfo?: { userId: string } }) => {
      if (user.userInfo?.userId !== this.rtc.options.clientId) return;

      this.rtc.addReportInfo({ describe: "远端用户加入房间", user });

      setTimeout(() => {
        void this.rtc.updateUiH5();
        void this.rtc.onCheckInputState();
        this.rtc.setKeyboardStyle(this.rtc.options.keyboard as "pad" | "local");
        this.rtc.triggerRecoveryTimeCallback();
      }, 300);
    });
  }

  onRemoteVideoFirstFrame(): void {
    this.rtc.engine?.on(VERTC.events.onRemoteVideoFirstFrame, (event: { width: number; height: number }) => {
      void (async (): Promise<void> => {
        console.log("视频首帧渲染回调", event);
        try {
          if (!this.rtc.isFirstRotate) {
            await this.rtc.uiController.initRotateScreen(event.width, event.height);
          }
        } finally {
          this.rtc.callbacks.onRenderedFirstFrame();
        }
      })();
    });
  }

  onUserPublishStream(): void {
    const handleUserPublishStream = async (e: { userId: string; mediaType: MediaType }): Promise<void> => {
      if (e.userId !== this.rtc.options.clientId) return;

      this.rtc.addReportInfo({ describe: "开始订阅 và 播放云机音视频流", e });

      await this.rtc.setRemoteVideoRotation(this.rtc.rotation);
      await this.rtc.engine?.subscribeStream(this.rtc.options.clientId, this.rtc.options.mediaType);

      if (this.rtc.engine) {
        void this.rtc.engine.setRemoteSimulcastStreamType(
          this.rtc.options.clientId,
          SimulcastStreamType.VIDEO_STREAM_HIGH
        );

        this.rtc.engine.setJitterBufferTarget(
          this.rtc.options.clientId,
          StreamIndex.STREAM_INDEX_MAIN,
          this.rtc.options.latencyTarget ?? 0,
          false
        );
      }

      if (this.rtc.screenShotInstance === null) {
        const player = document.getElementById(this.rtc.videoDomId);
        if (player) {
          this.rtc.screenShotInstance = new ScreenshotOverlay(player as HTMLDivElement, this.rtc.rotation);
        }
      }
    };

    this.rtc.engine?.on(VERTC.events.onUserPublishStream, (event) => {
      void handleUserPublishStream(event);
    });
  }

  checkInputState(msg: { data: string }): void {
    const { allowLocalIMEInCloud, keyboard } = this.rtc.options;
    const msgData = parseJson<InputStatePayload>(msg.data, {});

    if (typeof msgData.isOpen === "boolean") {
      this.rtc.roomMessage.inputStateIsOpen = msgData.isOpen;
    }
    const enterkeyhintText = this.rtc.enterkeyhintObj[msgData.imeOptions as keyof typeof this.rtc.enterkeyhintObj];
    if (enterkeyhintText) {
      this.rtc.inputElement?.setAttribute("enterkeyhint", enterkeyhintText);
    }

    const shouldHandleFocus = (allowLocalIMEInCloud && keyboard === "pad") || keyboard === "local";
    if (shouldHandleFocus && typeof msgData.isOpen === "boolean") {
      if (msgData.isOpen) {
        this.rtc.inputElement?.focus();
      } else {
        this.rtc.inputElement?.blur();
      }
    }
  }

  onRoomMessageReceived(): void {
    const onRoomMessageReceived = (e: UserEvent): void => {
      if (!e.message) return;
      const msg = parseJson<ParsedMessage>(e.message, {});

      if (msg.key === "message") {
        this.rtc.callbacks.onTransparentMsg(0, msg.data ?? "");
        return;
      }

      if (msg.key === "refreshUiType" && typeof msg.data === "string") {
        const msgData = parseJson<RefreshUiTypePayload>(msg.data, {
          width: this.rtc.remoteResolution.width,
          height: this.rtc.remoteResolution.height,
        });

        this.rtc.roomMessage.isVertical = msgData.isVertical;
        if (msgData.width !== this.rtc.remoteResolution.width || msgData.height !== this.rtc.remoteResolution.height) {
          void this.rtc.uiController.initRotateScreen(msgData.width, msgData.height);
        }
        return;
      }

      if (msg.key === "inputState" && this.rtc.inputElement && typeof msg.data === "string") {
        this.rtc.checkInputState({ data: msg.data });
        return;
      }

      if (msg.key === "clipboard" && this.rtc.options.saveCloudClipboard && typeof msg.data === "string") {
        this.rtc.callbacks.onOutputClipper(parseJson<object>(msg.data, {}));
      }
    };

    this.rtc.engine?.on(VERTC.events.onRoomMessageReceived, onRoomMessageReceived);
  }

  onUserMessageReceived(): void {
    const parseResolution = (resolution: string): { width: number; height: number } => {
      const [width, height] = resolution.split("*").map(Number);
      return { width: width ?? 0, height: height ?? 0 };
    };

    const onUserMessageReceived = async (e: UserEvent): Promise<void> => {
      if (!e.message) return;
      const msg = parseJson<ParsedMessage>(e.message, {});
      if (typeof msg.data !== "string") return;

      if (msg.key === "callBack") {
        const callData = parseJson<CallbackPayload>(msg.data, {});
        const result = parseJson<DefinitionResultPayload | object>(callData.data ?? "{}", {});
        switch (callData.type) {
          case "definition": {
            const typedResult = result as Partial<DefinitionResultPayload>;
            if (typeof typedResult.from === "string" && typeof typedResult.to === "string") {
              this.rtc.callbacks.onChangeResolution({
                from: parseResolution(typedResult.from),
                to: parseResolution(typedResult.to),
              });
            }
            break;
          }
          case "startVideoInjection":
          case "stopVideoInjection":
            this.rtc.callbacks.onInjectVideoResult(callData.type, result);
            break;
          default:
            break;
        }
        return;
      }

      if (msg.key === "equipmentInfo") {
        this.rtc.callbacks.onEquipmentInfo(parseJson<object[]>(msg.data, []));
        return;
      }

      if (msg.key === "inputAdb") {
        this.rtc.callbacks.onAdbOutput(parseJson<object>(msg.data, {}));
        return;
      }

      if (msg.key === "videoAndAudioControl") {
        if (!this.rtc.enableMicrophone && !this.rtc.enableCamera) return;

        const msgData = parseJson<VideoAndAudioControlPayload>(msg.data, {});
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
            try {
              const res = await this.rtc.engine?.startVideoCapture();
              this.rtc.callbacks.onVideoInit(res ?? {});
              void this.rtc.engine?.publishStream(MediaType.VIDEO);
            } catch (err) {
              this.rtc.callbacks.onVideoError(err instanceof Error ? err : new Error("startVideoCapture failed"));
            }
          }

          if (this.rtc.enableMicrophone) {
            if (this.rtc.audioDeviceId) {
              await this.rtc.engine?.setAudioCaptureDevice(this.rtc.audioDeviceId);
            }
            try {
              const res = await this.rtc.engine?.startAudioCapture();
              this.rtc.callbacks.onAudioInit(res ?? {});
              void this.rtc.engine?.publishStream(MediaType.AUDIO);
            } catch (err) {
              this.rtc.callbacks.onAudioError(err instanceof Error ? err : new Error("startAudioCapture failed"));
            }
          }
        } else {
          await this.rtc.engine?.stopAudioCapture();
          await this.rtc.engine?.stopVideoCapture();
          await this.rtc.engine?.unpublishStream(pushType);
        }
        return;
      }

      if (msg.key === "inputState" && this.rtc.inputElement) {
        this.rtc.checkInputState({ data: msg.data });
        return;
      }

      if (msg.key === "audioControl" && this.rtc.enableMicrophone) {
        const msgData = parseJson<AudioControlPayload>(msg.data, {});
        if (msgData.isOpen) {
          try {
            const res = await this.rtc.engine?.startAudioCapture();
            this.rtc.callbacks.onAudioInit(res ?? {});
            void this.rtc.engine?.publishStream(MediaType.AUDIO);
          } catch (error) {
            this.rtc.callbacks.onAudioError(error instanceof Error ? error : new Error("audioControl start failed"));
          }
        } else {
          await this.rtc.engine?.stopAudioCapture();
          await this.rtc.engine?.unpublishStream(MediaType.AUDIO);
        }
      }
    };

    this.rtc.engine?.on(VERTC.events.onUserMessageReceived, (event) => {
      void onUserMessageReceived(event);
    });
  }
}
