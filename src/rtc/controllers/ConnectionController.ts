import type HuoshanRTC from "../huoshanRtc";
import VERTC, { AudioProfileType } from "../../vendor/volcengine-rtc";
import huoshanGroupRtc from "../huoshanGroupRtc";
import { addInputElement } from "../../features/input";
import type { RTCOptions } from "../../core/types";

export class ConnectionController {
  constructor(private rtc: HuoshanRTC) { }

  isSupported(): Promise<boolean> {
    return VERTC.isSupported();
  }

  async createEngine() {
    if (!this.rtc.inputElement) {
      // 若不存在inputElement， 则创建一个隐藏的input输入框

      if (!this.rtc.options.disable) {
        addInputElement(this.rtc as unknown as import('../../core/types').RTCInstance);
      }
    }

    // Cấu hình tối ưu độ trễ CỰC ĐOAN (Extreme Low Latency) - Tinh chỉnh nghệ thuật
    try {
      VERTC.setLogConfig({ logLevel: "none" });
      VERTC.setParameter("LOG_SERVER_URL", "");
      VERTC.setParameter("FORCE_ENABLED_REPORT_CALLBACKS", []);

      // 🚀 NGHỆ THUẬT TỐI ƯU SIÊU NHỎ
      // 1. Tăng tốc kết nối & Truyền tin
      VERTC.setParameter("PRE_ICE", true); // Thiết lập ICE sớm (Pre-connection)
      VERTC.setParameter("SEND_MESSAGE_SYNC", true); // Gửi tin nhắn đồng bộ (giảm delay event loop)
      VERTC.setParameter("SDK_CODEC_NEGOTIATION", false); // Tắt thương thảo codec (nếu phía server đã cố định H264)
      
      // 2. Ép mã hóa phần cứng & Bỏ qua lọc SEI
      VERTC.setParameter("H264_HW_ENCODER", true);
      VERTC.setParameter("SKIP_SEI_FILTER", true); // Bỏ qua lọc tin nhắn SEI để đẩy khung hình nhanh hơn

      // 3. Jitter Stepper "Zero-Wait"
      VERTC.setParameter("JITTER_STEPPER_INTERVAL_MS", 4); 
      VERTC.setParameter("JITTER_STEPPER_STEP_SIZE_MS", 4);
      VERTC.setParameter("JITTER_STEPPER_MAX_AV_SYNC_DIFF", 0);
      VERTC.setParameter("JITTER_STEPPER_MAX_SET_DIFF", 0);
      VERTC.setParameter("JITTER_STEPPER_MAX_DIFF_EXCEED_COUNT", 1);

      // 4. Stall Detection (Siêu nhạy - 100ms)
      VERTC.setParameter("VIDEO_STALL_100MS", true);
      VERTC.setParameter("VIDEO_STALL_DATA", 100);
      VERTC.setParameter("AUDIO_STALL_DATA", 100);

      // 5. Autoplay & Mute workaround
      VERTC.setParameter("AUTOPLAY_WORKAROUND", false);
      VERTC.setParameter("DISABLE_IOS_MUTE_WORKAROUND", true); // Tắt workaround gây trễ trên iOS nếu không cần thiết
    } catch (e) {
      console.warn("Artistic Latency Config Error:", e);
    }

    // Sử dụng createBLWEngine (ByteDance Low-latency Web Engine)
    this.rtc.engine = VERTC.createBLWEngine(this.rtc.options.appId);

    // Zero-wait Rendering
    this.rtc.engine.setRemoteStreamRenderSync(false);
    
    if (this.rtc.enableMicrophone) {
      this.rtc.engine.setAudioProfile(AudioProfileType.fluent);
    }

    // Cấu hình Encoder video hiện đại
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
      // Trích xuất thông tin độ trễ từ stats định kỳ
      const videoStats = e.videoStats;
      const audioStats = e.audioStats;

      const latencyInfo = {
        rtt: videoStats?.rtt ?? audioStats?.rtt ?? 0,
        e2eDelay: videoStats?.e2eDelay ?? audioStats?.e2eDelay ?? 0,
        jitterBufferDelay: audioStats?.jitterBufferDelay ?? 0,
      };

      // Tự động điều chỉnh Jitter Stepper dựa trên RTT (Round Trip Time) để đảm bảo độ ổn định
      try {
        if (latencyInfo.rtt > 0) {
          if (latencyInfo.rtt < 50) {
            VERTC.setParameter("JITTER_STEPPER_INTERVAL_MS", 16);
            VERTC.setParameter("JITTER_STEPPER_MAX_DIFF_EXCEED_COUNT", 1);
          } else if (latencyInfo.rtt >= 50 && latencyInfo.rtt < 100) {
            VERTC.setParameter("JITTER_STEPPER_INTERVAL_MS", 33);
            VERTC.setParameter("JITTER_STEPPER_MAX_DIFF_EXCEED_COUNT", 2);
          } else {
            VERTC.setParameter("JITTER_STEPPER_INTERVAL_MS", 60);
            VERTC.setParameter("JITTER_STEPPER_MAX_DIFF_EXCEED_COUNT", 5);
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
