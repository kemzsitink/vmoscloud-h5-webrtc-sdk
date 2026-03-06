import type HuoshanRTC from "../huoshanRtc";
import VERTC, { AudioProfileType } from "../../vendor/volcengine-rtc";
import huoshanGroupRtc from "../huoshanGroupRtc";
import { addInputElement } from "../../features/input";
import type { RTCOptions } from "../../core/types";

// --- ZERO LATENCY SDP HACK ---
// Intercept RTCPeerConnection to forcefully strip NACK and Google Congestion Control (GCC).
// This prevents the browser from requesting retransmission and forces blind-streaming without bandwidth estimation.
const OriginalRTCPeerConnection = window.RTCPeerConnection;

const stripLatencyKillers = (sdp: string | undefined): string => {
  if (!sdp) return "";
  let modifiedSdp = sdp;

  // 1. NACK & PLI (DO NOT KILL THEM WITHOUT INTRA-REFRESH/FEC)
  // If we kill NACK, a single dropped packet forces a PLI.
  // A PLI forces the server to send a massive I-Frame.
  // The massive I-Frame causes network congestion -> Packet loss spikes -> 1-2s freeze.
  // modifiedSdp = modifiedSdp.replace(/a=rtcp-fb:\d+ nack\r\n/g, "");
  // modifiedSdp = modifiedSdp.replace(/a=rtcp-fb:\d+ nack pli\r\n/g, "");

  // 2. Kill Google Congestion Control (GCC) & Bandwidth Estimation (BWE)
  modifiedSdp = modifiedSdp.replace(/a=rtcp-fb:\d+ transport-cc\r\n/g, "");
  modifiedSdp = modifiedSdp.replace(/a=extmap:\d+ http:\/\/www\.ietf\.org\/id\/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n/g, "");
  modifiedSdp = modifiedSdp.replace(/a=rtcp-fb:\d+ goog-remb\r\n/g, "");
  modifiedSdp = modifiedSdp.replace(/a=extmap:\d+ http:\/\/www\.webrtc\.org\/experiments\/rtp-hdrext\/abs-send-time\r\n/g, "");

  // 3. Inject Playout Delay Extension safely (Authorize local playoutDelayHint=0)
  if (!modifiedSdp.includes("http://www.webrtc.org/experiments/rtp-hdrext/playout-delay")) {
    modifiedSdp = modifiedSdp.replace(/(a=rtcp-mux\r\n)/g, "$1a=extmap:14 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r\n");
  }

  return modifiedSdp;
};

class PatchedRTCPeerConnection extends OriginalRTCPeerConnection {
  // Reverted unsafe constructor override. We will hook into getReceivers instead.

  override setLocalDescription(description?: RTCLocalSessionDescriptionInit): Promise<void> {
    if (description && description.sdp) {
      const oldLength = description.sdp.length;
      description.sdp = stripLatencyKillers(description.sdp);
      if (description.sdp.length !== oldLength) {
        console.warn("[Zero-Latency Hack] Stripped NACK and GCC from Local SDP");
      }
    }
    return super.setLocalDescription(description);
  }

  override async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (description && description.sdp) {
      const oldLength = description.sdp.length;
      description.sdp = stripLatencyKillers(description.sdp);
      if (description.sdp.length !== oldLength) {
        console.warn("[Zero-Latency Hack] Stripped NACK and GCC from Remote SDP");
      }
    }

    await super.setRemoteDescription(description);

    // ---> KILL JITTER BUFFER SAFELY <---
    // After remote description is set, receivers are usually created.
    try {
      const receivers = this.getReceivers();
      receivers.forEach(receiver => {
        if ('playoutDelayHint' in receiver) {
          (receiver as any).playoutDelayHint = 0;
          console.warn("[Zero-Latency Hack] Forced playoutDelayHint=0 on existing RTCRtpReceiver");
        }
      });
    } catch (e) {
      console.error("[Zero-Latency Hack] Failed to set playoutDelayHint", e);
    }
  }
}

// Override global object
if (window.RTCPeerConnection.name !== "PatchedRTCPeerConnection") {
  (window as any).RTCPeerConnection = PatchedRTCPeerConnection;
}
// ------------------------------

export class ConnectionController {
  constructor(private rtc: HuoshanRTC) { }

  isSupported(): Promise<boolean> {
    return VERTC.isSupported();
  }

  async createEngine() {
    if (!this.rtc.inputElement) {
      // 若不存在inputElement， 则创建一个隐藏的input输入框

      if (!this.rtc.options.disable) {
        addInputElement(this.rtc as unknown as import('../../core/types').RTCInstance, true);
      }
    }

    // Cấu hình tối ưu độ trễ cho Cloud Gaming/Cloud Phone
    try {
      VERTC.setLogConfig({ logLevel: "none" });
      VERTC.setParameter("LOG_SERVER_URL", "");
      VERTC.setParameter("FORCE_ENABLED_REPORT_CALLBACKS", []);

      // 🚀 EXTREME LOW LATENCY HACKS (Bypass Volcengine safety limits)
      // 1. Force hardware decoding/encoding
      VERTC.setParameter("H264_HW_ENCODER" as any, true);

      // 2. Kill A/V Sync entirely. Render frames the exact millisecond they arrive.
      VERTC.setParameter("JITTER_STEPPER_MAX_AV_SYNC_DIFF" as any, 0);
      VERTC.setParameter("JITTER_STEPPER_MAX_SET_DIFF" as any, 0);

      // 3. Make Jitter Stepper hyper-aggressive (check every 16ms ~ 60fps)
      VERTC.setParameter("JITTER_STEPPER_INTERVAL_MS" as any, 16);
      VERTC.setParameter("JITTER_STEPPER_STEP_SIZE_MS" as any, 16);
      VERTC.setParameter("JITTER_STEPPER_MAX_DIFF_EXCEED_COUNT" as any, 1);

      // 4. Force browser playout delay hint
      VERTC.setParameter("rtc.video.playout_delay_hint" as any, 0);
      VERTC.setParameter("rtc.audio.playout_delay_hint" as any, 0);
      VERTC.setParameter("rtc.video.enable_webcodec" as any, true);

      // 5. Enable aggressive stall detection and disable autoplay workaround buffering
      VERTC.setParameter("VIDEO_STALL_300MS" as any, true);
      VERTC.setParameter("AUTOPLAY_WORKAROUND" as any, false);
    } catch (e) {
      console.warn("Disable Volc RTC log error:", e);
    }

    // Use createBLWEngine for ultra-low latency cloud phone streaming (ByteDance Low-latency Web Engine)
    this.rtc.engine = VERTC.createBLWEngine(this.rtc.options.appId);

    this.rtc.engine.setRemoteStreamRenderSync(false);
    if (this.rtc.enableMicrophone) {
      this.rtc.engine.setAudioProfile(AudioProfileType.fluent);
    }

    // Modern Video Encoder Configuration (Replaces deprecated setVideoCaptureConfig)
    const widthBase = 768;
    const heightBase = 1024;
    const frameRate = 30;
    const maxKbps = 4000;

    const setVideoEncoderConfig = (width: number, height: number): void => {
      this.rtc.engine?.setVideoEncoderConfig({
        width,
        height,
        frameRate,
        maxKbps
      });
    };

    void setVideoEncoderConfig(widthBase, heightBase);

    this.rtc.engine.on(VERTC.events.onLocalVideoSizeChanged, (e: { info: { width: number; height: number } }) => {
      const { width, height } = e.info;
      if (width === heightBase && height === widthBase) {
        void setVideoEncoderConfig(heightBase, widthBase);
      }
    });

    /** 监听失败回调 */
    this.rtc.engine.on(VERTC.events.onError, (error) => {
      this.rtc.addReportInfo({
        describe: "当SDK内部发生不可逆转错误时触发该回调",
        error,
      });
      this.rtc.sendEventReport("error");
      this.rtc.callbacks.onErrorMessage(error);
    });

    /** 监听播放失败回调 */
    this.rtc.engine.on(VERTC.events.onAutoplayFailed, (e) => {
      this.rtc.callbacks.onAutoplayFailed(e);
    });

    /** 用户订阅的远端音/视频流统计信息以及网络状况，统计周期为 2s */
    this.rtc.engine.on(VERTC.events.onRemoteStreamStats, (e) => {
      // Logic to extract advanced latency metrics including hidden fields
      const stats = e as any;
      const videoStats = stats.videoStats;
      const audioStats = stats.audioStats;

      const latencyInfo = {
        rtt: videoStats?.rtt ?? audioStats?.rtt ?? 0,
        totalRtt: videoStats?.totalRtt ?? audioStats?.totalRtt ?? 0,
        e2eDelay: videoStats?.e2eDelay ?? audioStats?.e2eDelay ?? 0,
        statsInterval: videoStats?.statsInterval ?? audioStats?.statsInterval ?? 2000,
        jitterBufferDelay: audioStats?.jitterBufferDelay ?? 0,
      };

      // 🚀 Auto-Tuning Jitter Stepper based on RTT
      try {
        if (latencyInfo.rtt > 0) {
          if (latencyInfo.rtt < 50) {
            VERTC.setParameter("JITTER_STEPPER_INTERVAL_MS" as any, 16);
            VERTC.setParameter("JITTER_STEPPER_MAX_DIFF_EXCEED_COUNT" as any, 1);
          } else if (latencyInfo.rtt >= 50 && latencyInfo.rtt < 100) {
            VERTC.setParameter("JITTER_STEPPER_INTERVAL_MS" as any, 33);
            VERTC.setParameter("JITTER_STEPPER_MAX_DIFF_EXCEED_COUNT" as any, 2);
          } else {
            VERTC.setParameter("JITTER_STEPPER_INTERVAL_MS" as any, 60);
            VERTC.setParameter("JITTER_STEPPER_MAX_DIFF_EXCEED_COUNT" as any, 5);
          }
        }
      } catch (e) {
        // Ignored
      }

      this.rtc.callbacks.onRunInformation({
        ...e,
        latencyInfo,
      });
    });

    /** 加入房间后，会以每2秒一次的频率，收到本端上行及下行的网络质量信息。 */
    this.rtc.engine.on(
      VERTC.events.onNetworkQuality,
      (uplinkNetworkQuality: number, downlinkNetworkQuality: number) => {
        this.rtc.callbacks.onNetworkQuality(
          uplinkNetworkQuality,
          downlinkNetworkQuality
        );
      }
    );
  }

  async createGroupEngine(pads: string[] = [], config?: Partial<RTCOptions>): Promise<void> {
    this.rtc.groupRtc = new huoshanGroupRtc(
      { ...this.rtc.options, ...config } as RTCOptions,
      pads,
      this.rtc.callbacks
    );
    try {
      const example = await this.rtc.groupRtc.getEngine();
      this.rtc.groupEngine = example.engine;
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      this.rtc.callbacks.onGroupControlError({
        code: err.code,
        msg: err.message,
      });
    }
  }

  destroyEngine() {
    if (this.rtc.engine) VERTC.destroyEngine(this.rtc.engine);
    if (this.rtc.groupEngine) VERTC.destroyEngine(this.rtc.groupEngine);
  }

  start(isGroupControl = false, pads: string[] = []): void {

    this.rtc.isGroupControl = isGroupControl;
    this.rtc.addReportInfo({ describe: "开始加入房间" });
    const config = {
      appId: this.rtc.options.appId,
      roomId: this.rtc.options.roomCode,
      uid: this.rtc.options.userId,
      token: this.rtc.options.roomToken,
    };
    this.rtc.setLogTime("joinRoom");
    this.rtc.engine!
      .joinRoom(config.token, config.roomId, { userId: config.uid }, {
        isAutoPublish: false,
        isAutoSubscribeAudio: false,
        isAutoSubscribeVideo: false,
      })
      .then(async (res: unknown) => {
        const arr = pads?.filter((v: string) => v !== this.rtc.remoteUserId);
        if (isGroupControl && arr.length) this.rtc.createGroupEngine(arr);
        this.rtc.setLogTime("wsJoinRoom");
        this.rtc.addReportInfo({ describe: "加入房间成功", res });

        const videoDom = document.getElementById(this.rtc.videoDomId);
        if (videoDom) {
          videoDom.style.width = "100%";
          videoDom.style.height = "100%";

          this.rtc.updateDomCache();
          const resizeObserver = new ResizeObserver(() => { this.rtc.updateDomCache(); });
          resizeObserver.observe(videoDom);

          this.rtc.touchInputHandler.bindEvents(videoDom);

          // 监听广播消息
          this.rtc.onRoomMessageReceived();
          this.rtc.onUserMessageReceived();
          this.rtc.onUserJoined();
          this.rtc.onUserLeave();
          this.rtc.onRemoteVideoFirstFrame();

          // 远端摄像头/麦克风采集音视频流的回调
          this.rtc.onUserPublishStream();

          this.rtc.callbacks.onConnectSuccess();
        }

        this.rtc.engine?.on(
          VERTC.events.onConnectionStateChanged,
          (e: unknown) => {
            this.rtc.callbacks.onConnectionStateChanged(e);
          }
        );
      })
      .catch((error: Error & { code?: number }) => {
        this.rtc.addReportInfo({ describe: "加入房间失败", error });
        this.rtc.sendEventReport("error");
        console.log("进房错误", error);
        this.rtc.callbacks.onConnectFail({ code: error.code, msg: error.message });
      });

  }

  async stop() {
    try {
      clearTimeout(this.rtc.autoRecoveryTimer ?? undefined);
      const { clientId, mediaType } = this.rtc.options;
      const promises = [
        this.rtc.engine?.unsubscribeStream(clientId, mediaType),
        this.rtc.engine?.stopAudioCapture(),
        this.rtc.engine?.stopVideoCapture(),
        this.rtc.engine?.leaveRoom(),
        this.rtc.groupEngine?.leaveRoom(),
      ];
      await Promise.allSettled(promises);
      this.rtc.destroyEngine();

      this.rtc.groupRtc?.close();
      this.rtc.screenShotInstance?.destroy();

      const videoDomElement = document.getElementById(this.rtc.videoDomId);
      if (videoDomElement && videoDomElement.parentNode) {
        videoDomElement.parentNode.removeChild(videoDomElement);
      }
      this.rtc.inputElement?.remove();
      this.rtc.sendEventReport("error");
      this.rtc.groupEngine = undefined;
      this.rtc.groupRtc = undefined;
      this.rtc.screenShotInstance = null!;
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
