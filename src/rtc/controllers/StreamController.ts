import type { MediaType } from "../../vendor/volcengine-rtc";
import type HuoshanRTC from "../huoshanRtc";
import type { CustomDefinition } from "../../core/types";

export class StreamController {
  constructor(private rtc: HuoshanRTC) {}

  muted() {
    this.rtc.engine?.unsubscribeStream(this.rtc.options.clientId, 1 as MediaType); // MediaType.AUDIO
  }

  unmuted() {
    this.rtc.engine?.subscribeStream(this.rtc.options.clientId, 1 as MediaType); // MediaType.AUDIO
  }

  startPlay() {
    if (this.rtc.engine) this.rtc.engine.play(this.rtc.options.clientId);
  }

  async subscribeStream(mediaType: MediaType) {
    return await this.rtc.engine?.subscribeStream(this.rtc.options.clientId, mediaType);
  }

  unsubscribeStream(mediaType: MediaType): Promise<void> {
    return this.rtc.engine
      ? this.rtc.engine.unsubscribeStream(this.rtc.options.clientId, mediaType)
      : Promise.resolve();
  }

  pauseAllSubscribedStream(mediaType = 3) {
    this.rtc.triggerRecoveryTimeCallback();
    const contentObj = { type: "openAudioAndVideo", isOpen: false };
    const messageObj = { touchType: "eventSdk", content: JSON.stringify(contentObj) };
    const userId = this.rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    this.rtc.engine?.sendUserMessage(userId, message);
    return this.rtc.engine?.pauseAllSubscribedStream(mediaType);
  }

  resumeAllSubscribedStream(mediaType = 3) {
    this.rtc.triggerRecoveryTimeCallback();
    this.rtc.startPlay();
    if (mediaType !== 3) {
      return this.rtc.engine?.resumeAllSubscribedStream(mediaType);
    }
    const contentObj = { type: "openAudioAndVideo", isOpen: true };
    const messageObj = { touchType: "eventSdk", content: JSON.stringify(contentObj) };
    const userId = this.rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    this.rtc.sendUserMessage(userId, message);
    return this.rtc.engine?.resumeAllSubscribedStream(mediaType);
  }

  setStreamConfig(config: CustomDefinition) {
    const regExp = /^[1-9]\d*$/;
    if (config.definitionId && config.framerateId && config.bitrateId) {
      const values = Object.values(config);
      if (values.every((value) => value !== null && regExp.test(String(value)))) {
        const contentObj = {
          type: "definitionUpdata",
          definitionId: config.definitionId,
          framerateId: config.framerateId,
          bitrateId: config.bitrateId,
        };
        const messageObj = {
          touchType: "eventSdk",
          content: JSON.stringify(contentObj),
        };
        const userId = this.rtc.options.clientId;
        const message = JSON.stringify(messageObj);
        this.rtc.sendUserMessage(userId, message, true);
      }
    }
  }

  injectVideoStream(
    type: "startVideoInjection" | "stopVideoInjection",
    options?: { fileUrl?: string; isLoop?: boolean; fileName?: string }
  ) {
    const userId = this.rtc.options.clientId;
    if (!userId) return;
    const message = JSON.stringify({
      touchType: "eventSdk",
      content: JSON.stringify(
        type === "startVideoInjection"
          ? {
              type,
              fileUrl: options?.fileUrl,
              isLoop: options?.isLoop ?? true,
              fileName: options?.fileName,
            }
          : {
              type,
            }
      ),
    });
    console.log("注入视频到相机", message);
    this.rtc.sendUserMessage(userId, message);
  }
}
