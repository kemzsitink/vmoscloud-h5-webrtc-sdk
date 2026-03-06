import type HuoshanRTC from "../huoshanRtc";
import VERTC, { AudioProfileType } from "../../vendor/volcengine-rtc";
import huoshanGroupRtc from "../huoshanGroupRtc";
import { addInputElement } from "../../features/input";
import type { RTCOptions } from "../../core/types";

export class ConnectionController {
  constructor(private rtc: HuoshanRTC) {}

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

    // Tắt các tính năng report tracking của Volcengine RTC
    try {
      VERTC.setLogConfig({ logLevel: "none" });
      VERTC.setParameter("LOG_SERVER_URL", "");
      VERTC.setParameter("FORCE_ENABLED_REPORT_CALLBACKS", []);
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
