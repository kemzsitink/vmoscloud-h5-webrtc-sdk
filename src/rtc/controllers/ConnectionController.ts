import type HuoshanRTC from "../huoshanRtc";
import VERTC, { AudioProfileType, StreamIndex } from "../../vendor/volcengine-rtc";
import huoshanGroupRtc from "../huoshanGroupRtc";
import { addInputElement } from "../../features/input";
import type { RTCInstance, RTCOptions } from "../../core/types";
import type { RemoteStreamStats } from "../../vendor/volcengine-rtc";

export class ConnectionController {
  private latencyTargetMs = 0;
  private lastLatencyTuneAt = 0;
  private latencyGoodStreak = 0;
  private latencyBadStreak = 0;
  private lastJitterStepperIntervalMs: number | null = null;
  private lastJitterStepperMaxDiffCount: number | null = null;

  constructor(private rtc: HuoshanRTC) {}

  isSupported(): Promise<boolean> {
    return VERTC.isSupported();
  }

  private updateJitterStepper(intervalMs: number, maxDiffCount: number): void {
    if (
      this.lastJitterStepperIntervalMs === intervalMs &&
      this.lastJitterStepperMaxDiffCount === maxDiffCount
    ) {
      return;
    }

    VERTC.setParameter("JITTER_STEPPER_INTERVAL_MS", intervalMs);
    VERTC.setParameter("JITTER_STEPPER_MAX_DIFF_EXCEED_COUNT", maxDiffCount);

    this.lastJitterStepperIntervalMs = intervalMs;
    this.lastJitterStepperMaxDiffCount = maxDiffCount;
  }

  private tuneJitterTarget(event: RemoteStreamStats): void {
    if (!this.rtc.engine) return;
    if (event.userId !== this.rtc.options.clientId) return;

    const now = Date.now();
    if (now - this.lastLatencyTuneAt < 1800) return;
    this.lastLatencyTuneAt = now;

    const { audioStats, videoStats } = event;
    const lossRate = Math.max(audioStats.audioLossRate ?? 0, videoStats.videoLossRate ?? 0);
    const stallCount = (audioStats.stallCount ?? 0) + (videoStats.stallCount ?? 0);
    const stallDuration = (audioStats.stallDuration ?? 0) + (videoStats.stallDuration ?? 0);
    const jitterDelay = audioStats.jitterBufferDelay ?? 0;

    const severe = lossRate >= 0.08 || stallDuration >= 300 || stallCount >= 2;
    const bad =
      severe ||
      lossRate >= 0.03 ||
      stallDuration >= 120 ||
      stallCount >= 1 ||
      jitterDelay > this.latencyTargetMs + 12;
    const good =
      lossRate <= 0.005 &&
      stallCount === 0 &&
      stallDuration === 0 &&
      jitterDelay <= this.latencyTargetMs + 6;

    if (bad) {
      this.latencyBadStreak += 1;
      this.latencyGoodStreak = 0;
    } else if (good) {
      this.latencyGoodStreak += 1;
      this.latencyBadStreak = 0;
    } else {
      this.latencyBadStreak = 0;
      this.latencyGoodStreak = 0;
    }

    const userFloor = this.rtc.options.latencyTarget ?? 0;
    const minTarget = Math.max(0, userFloor);
    const stabilityFloor = userFloor === 0 ? 10 : userFloor;
    const maxTarget = Math.max(minTarget, 50);

    let target = this.latencyTargetMs;

    if (this.latencyBadStreak >= 1) {
      target += severe ? 10 : 5;
      this.latencyBadStreak = 0;
    } else if (this.latencyGoodStreak >= 3 && target > minTarget) {
      const floor = this.latencyGoodStreak >= 6 ? minTarget : stabilityFloor;
      target = Math.max(floor, target - 5);
      this.latencyGoodStreak = 0;
    }

    if (target < minTarget) target = minTarget;
    if (target > maxTarget) target = maxTarget;

    if (target !== this.latencyTargetMs) {
      this.latencyTargetMs = target;
      const streamIndex = event.isScreen ? StreamIndex.STREAM_INDEX_SCREEN : StreamIndex.STREAM_INDEX_MAIN;
      this.rtc.engine.setJitterBufferTarget(event.userId, streamIndex, target, true);
    }
  }

  createEngine(): void {
    if (!this.rtc.inputElement && !this.rtc.options.disable) {
      addInputElement(this.rtc as RTCInstance);
    }

    try {
      VERTC.setLogConfig({ logLevel: "none" });
      VERTC.setParameter("LOG_SERVER_URL", "");
      VERTC.setParameter("FORCE_ENABLED_REPORT_CALLBACKS", []);
      VERTC.setParameter("PRE_ICE", true);
      VERTC.setParameter("SEND_MESSAGE_SYNC", true);
      VERTC.setParameter("SDK_CODEC_NEGOTIATION", false);
      VERTC.setParameter("H264_HW_ENCODER", true);
      VERTC.setParameter("SKIP_SEI_FILTER", true);
      VERTC.setParameter("JITTER_STEPPER_INTERVAL_MS", 4);
      VERTC.setParameter("JITTER_STEPPER_STEP_SIZE_MS", 4);
      VERTC.setParameter("JITTER_STEPPER_MAX_AV_SYNC_DIFF", 0);
      VERTC.setParameter("JITTER_STEPPER_MAX_SET_DIFF", 0);
      VERTC.setParameter("JITTER_STEPPER_MAX_DIFF_EXCEED_COUNT", 1);
      VERTC.setParameter("VIDEO_STALL_100MS", true);
      VERTC.setParameter("VIDEO_STALL_DATA", 100);
      VERTC.setParameter("AUDIO_STALL_DATA", 100);
      VERTC.setParameter("AUTOPLAY_WORKAROUND", false);
      VERTC.setParameter("DISABLE_IOS_MUTE_WORKAROUND", true);
    } catch (error) {
      console.warn("Artistic Latency Config Error:", error);
    }
    this.latencyTargetMs = this.rtc.options.latencyTarget ?? 0;

    this.rtc.engine = VERTC.createBLWEngine(this.rtc.options.appId);
    void this.rtc.engine.setRemoteStreamRenderSync(false);

    if (this.rtc.enableMicrophone) {
      void this.rtc.engine.setAudioProfile(AudioProfileType.fluent);
    }

    const widthBase = 768;
    const heightBase = 1024;
    const frameRate = 30;
    const maxKbps = 4000;

    const setVideoEncoderConfig = (width: number, height: number): void => {
      void this.rtc.engine?.setVideoEncoderConfig({
        width,
        height,
        frameRate,
        maxKbps,
      });
    };

    setVideoEncoderConfig(widthBase, heightBase);

    this.rtc.engine.on(VERTC.events.onLocalVideoSizeChanged, (event: { info: { width: number; height: number } }) => {
      const { width, height } = event.info;
      if (width === heightBase && height === widthBase) {
        setVideoEncoderConfig(heightBase, widthBase);
      }
    });

    this.rtc.engine.on(VERTC.events.onError, (error) => {
      this.rtc.addReportInfo({
        describe: "当SDK内部发生不可逆转错误时触发该回调",
        error,
      });
      this.rtc.sendEventReport("error");
      this.rtc.callbacks.onErrorMessage(error);
    });

    this.rtc.engine.on(VERTC.events.onAutoplayFailed, (event) => {
      this.rtc.callbacks.onAutoplayFailed(event);
    });

    this.rtc.engine.on(VERTC.events.onRemoteStreamStats, (event) => {
      const { videoStats, audioStats } = event;
      const latencyInfo = {
        rtt: videoStats.rtt,
        e2eDelay: videoStats.e2eDelay,
        jitterBufferDelay: audioStats.jitterBufferDelay,
        target: this.latencyTargetMs,
      };

      try {
        if (latencyInfo.rtt > 0) {
          if (latencyInfo.rtt < 50) {
            this.updateJitterStepper(16, 1);
          } else if (latencyInfo.rtt < 100) {
            this.updateJitterStepper(33, 2);
          } else {
            this.updateJitterStepper(60, 5);
          }
        }
      } catch {
        // ignore dynamic tuning failure
      }

      this.tuneJitterTarget(event);

      latencyInfo.target = this.latencyTargetMs;

      this.rtc.callbacks.onRunInformation({
        ...event,
        latencyInfo,
      });
    });

    this.rtc.engine.on(
      VERTC.events.onNetworkQuality,
      (uplinkNetworkQuality: number, downlinkNetworkQuality: number) => {
        this.rtc.callbacks.onNetworkQuality(uplinkNetworkQuality, downlinkNetworkQuality);
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
    } catch (error) {
      const err = error as Error & { code?: string };
      this.rtc.callbacks.onGroupControlError({
        code: err.code,
        msg: err.message,
      });
    }
  }

  destroyEngine(): void {
    this.rtc.resizeObserver?.disconnect();
    this.rtc.resizeObserver = null;
    this.rtc.touchInputHandler.unbindEvents();
    this.rtc.hasPushDown = false;
    this.rtc.isStarted = false;

    if (this.rtc.engine) {
      this.rtc.engine.removeAllListeners();
      VERTC.destroyEngine(this.rtc.engine);
      this.rtc.engine = undefined;
    }
    if (this.rtc.groupEngine) {
      this.rtc.groupEngine.removeAllListeners();
      VERTC.destroyEngine(this.rtc.groupEngine);
      this.rtc.groupEngine = undefined;
    }
  }

  start(isGroupControl = false, pads: string[] = []): void {
    if (this.rtc.engine === undefined || this.rtc.isStarted) return;

    this.rtc.isGroupControl = isGroupControl;
    this.rtc.addReportInfo({ describe: "开始加入房间" });
    const config = {
      appId: this.rtc.options.appId,
      roomId: this.rtc.options.roomCode,
      uid: this.rtc.options.userId,
      token: this.rtc.options.roomToken,
    };

    this.rtc.setLogTime("joinRoom");

    void (async (): Promise<void> => {
      try {
        await this.rtc.engine?.joinRoom(config.token, config.roomId, { userId: config.uid }, {
          isAutoPublish: false,
          isAutoSubscribeAudio: false,
          isAutoSubscribeVideo: false,
        });

        const arr = pads.filter((v: string) => v !== this.rtc.remoteUserId);
        if (isGroupControl && arr.length) {
          void this.rtc.createGroupEngine(arr);
        }

        this.rtc.setLogTime("wsJoinRoom");
        this.rtc.addReportInfo({ describe: "加入房间成功" });

        const videoDom = document.getElementById(this.rtc.videoDomId);
        if (videoDom) {
          videoDom.style.width = "100%";
          videoDom.style.height = "100%";

          this.rtc.updateDomCache();
          this.rtc.resizeObserver?.disconnect();
          this.rtc.resizeObserver = new ResizeObserver(() => {
            this.rtc.updateDomCache();
          });
          this.rtc.resizeObserver.observe(videoDom);

          this.rtc.touchInputHandler.bindEvents(videoDom);
          this.rtc.onRoomMessageReceived();
          this.rtc.onUserMessageReceived();
          this.rtc.onUserJoined();
          this.rtc.onUserLeave();
          this.rtc.onRemoteVideoFirstFrame();
          this.rtc.onUserPublishStream();

          this.rtc.isStarted = true;
          this.rtc.callbacks.onConnectSuccess();
        }

        this.rtc.engine?.on(VERTC.events.onConnectionStateChanged, (event: object) => {
          this.rtc.callbacks.onConnectionStateChanged(event);
        });
      } catch (error) {
        this.rtc.isStarted = false;
        const err = error instanceof Error ? error : new Error("Join room failed");
        this.rtc.addReportInfo({ describe: "加入房间失败", error: err });
        this.rtc.sendEventReport("error");
        this.rtc.callbacks.onConnectFail({ code: (err as Error & { code?: number }).code, msg: err.message });
      }
    })();
  }

  async stop(): Promise<void> {
    try {
      clearTimeout(this.rtc.autoRecoveryTimer ?? undefined);
      this.rtc.autoRecoveryTimer = null;
      const { clientId, mediaType } = this.rtc.options;
      const promises: Promise<void>[] = [
        Promise.resolve(this.rtc.engine?.unsubscribeStream(clientId, mediaType)).then(() => undefined),
        Promise.resolve(this.rtc.engine?.stopAudioCapture()).then(() => undefined),
        Promise.resolve(this.rtc.engine?.stopVideoCapture()).then(() => undefined),
        Promise.resolve(this.rtc.engine?.leaveRoom()).then(() => undefined),
        Promise.resolve(this.rtc.groupEngine?.leaveRoom()).then(() => undefined),
      ];

      await Promise.allSettled(promises);
      this.rtc.destroyEngine();
      this.rtc.resizeObserver?.disconnect();
      this.rtc.resizeObserver = null;

      this.rtc.groupRtc?.close();
      this.rtc.screenShotInstance?.destroy();
      this.rtc.videoElement.destroy();
      this.rtc.touchInputHandler.unbindEvents();

      this.rtc.inputElement?.remove();
      this.rtc.sendEventReport("error");
      this.rtc.groupRtc = undefined;
      this.rtc.screenShotInstance = null;
      this.rtc.hasPushDown = false;
      this.rtc.isStarted = false;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Stop connection failed");
      return Promise.reject(err);
    }
  }
}







