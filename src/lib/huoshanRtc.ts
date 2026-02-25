
import type { IRTCEngine } from "@volcengine/rtc";
import huoshanGroupRtc from "./huoshanGroupRtc";
import VERTC, {
  StreamIndex,
  MediaType,
  AudioProfileType,
  SimulcastStreamType,
} from "@volcengine/rtc";
import Shake from "./shake";
import { LOG_TYPE } from "./constant";
import type { CustomDefinition, RTCOptions, SDKCallbacks, LogTime, RoomMessage, ReportEntry, TouchConfig, CoordsInfo } from "./type";
import type { TouchInfo } from "./types/webrtcType";
import { generateTouchCoord } from "./mixins";
import { isMobile, isTouchDevice } from "./utils";
import { addInputElement } from "./textInput";
import ScreenshotOverlay from "./screenshotOverlay";
import { setWebCodecsFrameCallback } from "./webcodecsMonkeyPatch";
import YUVWebGLCanvas from "./yuvWebGLCanvas";
import { Pact } from "./pact";
import P2pTunnel from "./p2pTunnel";

class HuoshanRTC {
  // 初始外部H5传入DomId
  private initDomId: string = "";
  private initDomWidth: number = 0;
  private initDomHeight: number = 0;
  // video容器id
  private videoDomId: string = "";
  // 鼠标、触摸事件时是否按下
  private hasPushDown: boolean = false;
  private enableMicrophone: boolean = true;
  private enableCamera: boolean = true;
  private screenShotInstance: ScreenshotOverlay | null = null;
  private isFirstRotate: boolean = false;
  private resizeObserver?: ResizeObserver;
  private lastMoveTime: number = 0;
  private videoDomElement: HTMLDivElement | null = null;
  private videoDomRect?: DOMRect;
  private videoDomWidth: number = 0;
  private videoDomHeight: number = 0;
  private lastTimerResetTime: number = 0;
  private remoteResolution = {
    width: 0,
    height: 0,
  };
  private fpsCameraX: number = 0;
  private fpsCameraY: number = 0;

  // 触摸信息
  private touchConfig: TouchConfig = {
    action: 0, // 0 按下 1 抬起 2 触摸中
    widthPixels: document.body.clientWidth,
    heightPixels: document.body.clientHeight,
    pointCount: 1, // 手指操作数量
    touchType: "gesture",
    properties: [], // 手指id， toolType: 1写死
    coords: [], // 操作坐标 pressure: 1.0, size: 1.0,写死
  };
  // 触摸坐标信息
  private touchInfo: TouchInfo = generateTouchCoord();
  private options: RTCOptions;

  private engine: IRTCEngine | undefined;
  private groupEngine: IRTCEngine | undefined;
  private groupRtc: huoshanGroupRtc | undefined;
  private inputElement: HTMLInputElement | undefined;

  public roomMessage: RoomMessage = {};

  // 回收时间定时器
  public autoRecoveryTimer: ReturnType<typeof setTimeout> | null = null;

  public errorInfo: ReportEntry[] = [];

  public isFirstFrame: boolean = false;

  public firstFrameCount: number = 0;
  public rotation: number = 0;

  // 是否群控
  public isGroupControl: boolean = false;
  /**
   * 安卓对应回车值
   * go：前往 2
   * search：搜索 3
   * send：发送 4
   * next：下一个 5
   * done：完成 6
   * previous：上一个 7
   */
  public enterkeyhintObj = {
    2: "go",
    3: "search",
    4: "send",
    5: "next",
    6: "done",
    7: "previous",
  };

  // 回调函数集合
  public callbacks: SDKCallbacks;

  public logTime: LogTime;
  public remoteUserId: string = "";
  private rotateType!: number;
  private videoDeviceId!: string;
  private audioDeviceId!: string;
  private shakeSimulator: Shake;
  public parentDomElement: HTMLElement | null = null;
  private webcodecsCanvas: HTMLCanvasElement | null = null;
  private webglRenderer: YUVWebGLCanvas | null = null;
  private videoTrackGenerator: any | null = null;
  private videoTrackWriter: WritableStreamDefaultWriter<VideoFrame> | null = null;
  private isFirstWebcodecsFrame: boolean = false;
  private currentResolutionLevel: number = 0; // 0: Max, higher is lower resolution
  private lastAdjustmentTime: number = 0;
  private p2pTunnel: P2pTunnel;

  constructor(viewId: string, params: RTCOptions, callbacks: SDKCallbacks, logTime: LogTime) {
    // console.log("HuoshanRTC initialized", params);
    const { masterIdPrefix, padCode } = params;
    this.initDomId = viewId;
    this.options = params;
    this.callbacks = callbacks;
    this.logTime = logTime;
    this.remoteUserId = params.padCode;
    this.enableMicrophone = params.enableMicrophone;
    this.enableCamera = params.enableCamera;
    this.videoDeviceId = params.videoDeviceId;
    this.audioDeviceId = params.audioDeviceId;
    this.shakeSimulator = new Shake();
    this.p2pTunnel = new P2pTunnel();

    // Đăng ký bộ não điều phối băng thông động (jumpFrameProc)
    (window as any).__jumpFrameProc = (status: 'STRESS' | 'IDLE') => {
      this.jumpFrameProc(status);
    };

    // 获取外部容器div元素
    const h5Dom = document.getElementById(this.initDomId);
    this.parentDomElement = h5Dom;
    // 获取 h5Dom 节点宽高
    // console.log('h5Dom节点宽高', h5Dom?.clientWidth, h5Dom?.clientHeight)
    this.initDomWidth = h5Dom?.clientWidth ?? 0;
    this.initDomHeight = h5Dom?.clientHeight ?? 0;
    // 创建一个id为armcloudVideo的新的div元素
    const newDiv = document.createElement("div");
    const divId = `${masterIdPrefix}_${padCode}_armcloudVideo`;
    newDiv.setAttribute("id", divId);
    this.videoDomId = divId;
    this.videoDomElement = newDiv;
    // 将div元素添加到外部容器中
    h5Dom?.appendChild(newDiv);

    // 创建引擎对象
    this.createEngine();
  }

  /** 浏览器是否支持 */
  isSupported(): Promise<boolean> {
    return VERTC.isSupported();
  }

  setLogTime(key: string): void {
    this.logTime[key] = new Date().getTime();
  }
  addReportInfo(info: { describe: string; error?: unknown; res?: unknown; e?: unknown; msg?: unknown; user?: unknown }): void {
    const time = new Date().getTime();
    this.errorInfo.push({
      type: "WebVolcanoRtc",
      time,
      timeDiff: time - (this.logTime.joinRoom ?? 0),
      info,
    });
  }
  setMicrophone(val: boolean) {
    this.enableMicrophone = val;
  }
  setCamera(val: boolean) {
    this.enableCamera = val;
  }
  setVideoDeviceId(val: string) {
    this.videoDeviceId = val;
  }
  setAudioDeviceId(val: string) {
    this.audioDeviceId = val;
  }
  sendEventReport(operation: string): void {
    if (!this.options.isLog) {
      return;
    }
    const request = (_type: number, _data: unknown) => {
      // TODO: Enable when logging endpoint is ready
      // const { baseUrl } = this.options;
      // const url = baseUrl
      //   ? `${baseUrl}/openapi/open/clientException/sendInfo`
      //   : `https://openapi.armcloud.net/openapi/open/clientException/sendInfo`;
      // axios
      //   .post(url, {
      //     padCode: this.remoteUserId,
      //     errorJson: JSON.stringify(_data),
      //     type: _type,
      //   })
      //   .finally(() => {
      //     this.errorInfo = [];
      //   });
    };

    const time = new Date().getTime();
    if (operation === "error" && !this.isFirstFrame && this.errorInfo.length) {
      request(LOG_TYPE.FAIL, this.errorInfo);
      return;
    }

    if (operation === "init") {
      const {
        rtcSuccess,
        reconnectSuccess,
        wsJoinRoom,
        joinRoom,
        tokenResEnd,
        tokenResStart,
      } = this.logTime;
      request(LOG_TYPE.SUCCESS, {
        data: this.errorInfo,
        joinRoomTime: (wsJoinRoom ?? 0) - (joinRoom ?? 0),
        rtcLinkTime: (rtcSuccess ?? reconnectSuccess ?? 0) - (joinRoom ?? 0),
        totalTime: time - (tokenResStart ?? 0),
        questServerTime: (tokenResEnd ?? 0) - (tokenResStart ?? 0),
        type: "WebVolcanoRtc",
      });
    }
  }

  /** 触发无操作回收回调函数 */
  triggerRecoveryTimeCallback() {
    if (this.options.disable || !this.options.autoRecoveryTime) return;

    const now = Date.now();
    // Throttle timer resets to once every 500ms to save CPU
    if (now - this.lastTimerResetTime < 500) return;
    this.lastTimerResetTime = now;

    if (this.autoRecoveryTimer) {
      clearTimeout(this.autoRecoveryTimer);
    }
    this.autoRecoveryTimer = setTimeout(() => {
      console.log("触发无操作回收了");
      this.stop();
      this.callbacks.onAutoRecoveryTime();
    }, this.options.autoRecoveryTime * 1000);
  }

  /** 调用 createEngine 创建一个本地 Engine 引擎对象 */
  async createEngine() {
    if (!this.inputElement) {
      // 若不存在inputElement， 则创建一个隐藏的input输入框

      if (!this.options.disable) {
        addInputElement(this as unknown as import('./type').RTCInstance, true);
      }
    }

    // Global SDK Tuning for Zero Latency
    VERTC.setParameter("SEND_MESSAGE_SYNC", true); // Dispatch messages immediately
    VERTC.setParameter("PRE_ICE", true); // Fast ICE connection setup
    VERTC.setParameter("H264_HW_ENCODER", true); // Force GPU hardware acceleration
    VERTC.setParameter("SIGNAL_CROP_JOINROOM", true); // Optimize join signaling
    VERTC.setParameter("SIGNAL_COMPRESSION", true); // Compress signaling packets
    VERTC.setParameter("SKIP_SEI_FILTER", true); // Reduce SEI processing latency
    
    // WebCodecs requires Insertable Streams (Encoded Transform).
    // Ensure Volcengine SDK does not disable it internally.
    if (this.options.useWebCodecs) {
      VERTC.setParameter("DISABLE_ENCODED_TRANSFORM", false);
    }

    this.engine = VERTC.createEngine(this.options.appId);
    this.engine.setRemoteStreamRenderSync(false);
    if (this.enableMicrophone) {
      this.engine.setAudioProfile(AudioProfileType.fluent);
    }

    // const widthBase: number = 768
    // const heightBase: number = 1024
    // const frameRate: number = 30
    // const maxKbps: number = 4000

    // const setVideoEncoderConfig = (width: number, height: number): void => {
    //   this.engine.setVideoEncoderConfig({
    //     width,
    //     height,
    //     frameRate,
    //     maxKbps
    //   })
    // }

    // setVideoEncoderConfig(widthBase, heightBase)

    // this.engine.on(VERTC.events.onLocalVideoSizeChanged, (e: { info: { width: number; height: number } }) => {
    //   const { width, height } = e.info

    //   if (width === heightBase && height === widthBase) {
    //     setVideoEncoderConfig(heightBase, widthBase)
    //   }
    // })

    /** 监听失败回调 */
    this.engine.on(VERTC.events.onError, (error) => {
      this.addReportInfo({
        describe: "当SDK内部发生不可逆转错误时触发该回调",
        error,
      });
      this.sendEventReport("error");
      this.callbacks.onErrorMessage(error);
    });

    /** 监听播放失败回调 */
    this.engine.on(VERTC.events.onAutoplayFailed, (e) => {
      this.callbacks.onAutoplayFailed(e);
    });

    /** 
     * Cơ chế cưỡng bức khung I-Frame (PliCount Injection)
     * Theo dõi thống kê luồng để phát hiện mất gói tin và ép Server tạo I-Frame ngay lập tức
     */
    this.engine.on(VERTC.events.onRemoteStreamStats, (stats) => {
      const videoStats = (stats as any)[this.options.clientId]?.videoStats;
      if (videoStats && videoStats.packetsLost > 0) {
        // Nếu phát hiện có mất gói tin (packetsLost > 0)
        console.warn(`[PliCount Injection] Packets Lost detected (${videoStats.packetsLost}). Forcing I-Frame request...`);
        this.pushIframeReq();
      }
      
      // Vẫn bắn callback ra ngoài cho user nếu cần
      this.callbacks.onRunInformation(stats);
    });
  }

  /** Ép server tạo ngay một khung I-Frame mới qua DataChannel */
  private pushIframeReq() {
    const userId = this.options.clientId;
    const message = JSON.stringify({
      touchType: "eventSdk",
      content: JSON.stringify({ type: "requestIFrame" }),
    });
    this.sendUserMessage(userId, message);
  }

  // 创建群控实例
  async createGroupEngine(pads: string[] = [], config?: Partial<RTCOptions>): Promise<void> {
    this.groupRtc = new huoshanGroupRtc(
      { ...this.options, ...config } as RTCOptions,
      pads,
      this.callbacks
    );
    try {
      const example = await this.groupRtc.getEngine();
      this.groupEngine = example.engine;
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      this.callbacks.onGroupControlError({
        code: err.code,
        msg: err.message,
      });
    }
  }

  /** 手动销毁通过 createEngine 所创建的引擎对象 */
  destroyEngine() {
    if (this.engine) VERTC.destroyEngine(this.engine);
    if (this.groupEngine) VERTC.destroyEngine(this.groupEngine);
  }

  /**
   * 静音
   */
  muted() {
    this.engine?.unsubscribeStream(this.options.clientId, MediaType.AUDIO);
  }

  /**
   * 取消静音
   */
  unmuted() {
    this.engine?.subscribeStream(this.options.clientId, MediaType.AUDIO);
  }
  /** 按顺序发送文本框 */
  public sendGroupInputString(pads: string[], strs: string[]): void {
    strs?.map((v: string, index: number) => {
      const message = JSON.stringify({
        text: v,
        pads: [pads[index]],
        touchType: "inputBox",
      });
      console.log(message);
      this.groupRtc?.sendRoomMessage(message);
    });
  }
  /**  群控剪切板  */
  public sendGroupInputClipper(pads: string[], strs: string[]): void {
    strs?.map((v: string, index: number) => {
      const message = JSON.stringify({
        text: v,
        pads: [pads[index]],
        touchType: "clipboard",
      });
      this.groupRtc?.sendRoomMessage(message);
    });
  }
  /** 手动开启音视频流播放 */
  startPlay() {
    if (this.engine) this.engine.play(this.options.clientId);
  }
  /** 群控房间信息 */
  sendGroupRoomMessage(message: string): Pact<unknown> {
    return new Pact((resolve) => {
      const res = this.groupRtc?.sendRoomMessage(message);
      resolve(res);
    });
  }
  getMsgTemplate(touchType: string, content: object) {
    return JSON.stringify({
      touchType,
      content: JSON.stringify(content),
    });
  }

  /** 获取应用信息 */
  getEquipmentInfo(type: "app" | "attr") {
    this.sendUserMessage(
      this.options.clientId,
      this.getMsgTemplate("equipmentInfo", {
        type,
      }),
      true
    );
  }

  /** 应用卸载 */
  appUnInstall(pkgNames: Array<string>) {
    this.sendUserMessage(
      this.options.clientId,
      this.getMsgTemplate("appUnInstall", pkgNames),
      true
    );
  }

  /** 发送消息 */
  sendUserMessage(
    userId: string,
    message: string,
    notSendInGroups?: boolean
  ): Pact<unknown> {
    return new Pact((resolve, reject) => {
      try {
        // 重置无操作回收定时器 (Throttled inside the method)
        this.triggerRecoveryTimeCallback();

        // Optimize: Only check group control if it's explicitly enabled to avoid branching overhead
        if (this.isGroupControl && !notSendInGroups) {
          const res = this.sendGroupRoomMessage(message);
          resolve(res);
          return;
        }

        const res = this.engine?.sendUserMessage(userId, message);
        resolve(res);
      } catch (error: unknown) {
        this.callbacks?.onSendUserError(error);
        reject(error);
      }
    });
  }
  /** 群控退出房间 */
  public kickItOutRoom(pads: string[]): void {
    this.sendGroupRoomMessage(
      JSON.stringify({
        touchType: "kickOutUser",
        content: JSON.stringify(pads),
      })
    );
  }
  /** 群控加入房间 */
  public joinGroupRoom(pads: string[]): void {
    const arr = (pads || [])?.filter((v: string) => v !== this.remoteUserId);
    if (!arr.length || !this.isGroupControl) return;

    if (!this.groupRtc && this.isGroupControl) {
      this.createGroupEngine(arr);
      return;
    }
    this.groupRtc?.joinRoom(arr);
  }

  /** 进入 RTC 房间 */
  start(isGroupControl = false, pads: string[] = []): void {
    this.isGroupControl = isGroupControl;
    this.addReportInfo({
      describe: "开始加入房间",
    });
    const config = {
      appId: this.options.appId,
      roomId: this.options.roomCode,
      uid: this.options.userId,
      token: this.options.roomToken,
    };
    this.setLogTime("joinRoom");
    this.engine!
      .joinRoom(
        config.token,
        config.roomId,
        {
          userId: config.uid,
        },
        {
          isAutoPublish: false, // 是否自动发布音视频流，默认为自动发布。
          isAutoSubscribeAudio: false, // 是否自动订阅音频流，默认为自动订阅。
          isAutoSubscribeVideo: false, // 是否自动订阅视频流，默认为自动订阅。
        }
      )
      .then(async (res: unknown) => {
        const arr = (pads || [])?.filter((v: string) => v !== this.remoteUserId);
        if (isGroupControl && arr.length) this.createGroupEngine(arr);
        this.setLogTime("wsJoinRoom");
        this.addReportInfo({
          describe: "加入房间成功",
          res,
        });
        // 加入房间成功
        const { disableContextMenu, clientId: userId, useWebCodecs } = this.options;
        const videoDom = this.videoDomElement;
        if (videoDom) {
          videoDom.style.width = "0px";
          videoDom.style.height = "0px";

          if (useWebCodecs) {
            const hasGenerator = typeof (window as any).MediaStreamTrackGenerator !== "undefined";
            
            if (hasGenerator) {
              console.log("[WebCodecs] Using MediaStreamTrackGenerator for zero-copy native rendering.");
              this.videoTrackGenerator = new (window as any).MediaStreamTrackGenerator({ kind: 'video' });
              this.videoTrackWriter = this.videoTrackGenerator.writable.getWriter();
            } else {
              console.log("[WebCodecs] Falling back to YUVWebGLCanvas (MediaStreamTrackGenerator not supported).");
              this.webcodecsCanvas = document.createElement("canvas");
              this.webcodecsCanvas.style.width = "100%";
              this.webcodecsCanvas.style.height = "100%";
              this.webcodecsCanvas.style.position = "absolute";
              this.webcodecsCanvas.style.top = "0";
              this.webcodecsCanvas.style.left = "0";
              this.webcodecsCanvas.style.objectFit = "fill";
              this.webcodecsCanvas.style.zIndex = "5"; 
              this.webcodecsCanvas.style.pointerEvents = "none";
              this.webglRenderer = new YUVWebGLCanvas(this.webcodecsCanvas);
              videoDom.appendChild(this.webcodecsCanvas);
            }

            setWebCodecsFrameCallback((frame) => {
              if (!this.isFirstWebcodecsFrame) {
                this.isFirstWebcodecsFrame = true;
                console.log("[WebCodecs] 视频首帧渲染回调", frame.displayWidth, frame.displayHeight);
                
                const nativeVideo = videoDom.querySelector("video");
                if (nativeVideo) {
                  if (this.videoTrackGenerator) {
                    // Route decoded frames back into the native video element via MediaStream
                    nativeVideo.srcObject = new MediaStream([this.videoTrackGenerator]);
                    nativeVideo.play().catch(() => {});
                    nativeVideo.style.opacity = "1";
                  } else {
                    // Hide native video when using Canvas fallback
                    nativeVideo.style.opacity = "0";
                  }
                }

                if (!this.isFirstRotate) {
                  this.initRotateScreen(frame.displayWidth, frame.displayHeight).then(() => {
                    this.callbacks.onRenderedFirstFrame();
                  });
                } else {
                  this.callbacks.onRenderedFirstFrame();
                }
              }

              if (this.videoTrackWriter) {
                this.videoTrackWriter.write(frame);
                // VideoFrame is automatically closed by MediaStreamTrackGenerator
              } else if (this.webcodecsCanvas && this.webglRenderer) {
                if (this.webcodecsCanvas.width !== frame.displayWidth || this.webcodecsCanvas.height !== frame.displayHeight) {
                  this.webcodecsCanvas.width = frame.displayWidth;
                  this.webcodecsCanvas.height = frame.displayHeight;
                }
                this.webglRenderer.drawFrame(frame);
                frame.close();
              } else {
                frame.close();
              }
            });
          }

          const updateDomCache = () => {
            this.videoDomRect = videoDom.getBoundingClientRect();
            this.videoDomWidth = videoDom.clientWidth;
            this.videoDomHeight = videoDom.clientHeight;
          };
          updateDomCache();

          // Update cache on resize
          this.resizeObserver = new ResizeObserver(() => {
            updateDomCache();
          });
          this.resizeObserver.observe(videoDom);

          const isMobileFlag = isTouchDevice() || isMobile();
          let eventTypeStart = "touchstart";
          let eventTypeMove = "touchmove";
          let eventTypeEnd = "touchend";

          if (!isMobileFlag) {
            eventTypeStart = "mousedown";
            eventTypeMove = "mousemove";
            eventTypeEnd = "mouseup";
          }
          if (disableContextMenu) {
            videoDom.addEventListener("contextmenu", (e) => {
              e.preventDefault();
            });
          }
          // 监听鼠标滚轮事件
          videoDom.addEventListener("wheel", (e) => {
            // e.preventDefault()
            if (this.options.disable) return;
            const { offsetX, offsetY, deltaY } = e;

            const touchConfigMousedown = {
              coords: [{ pressure: 1.0, size: 1.0, x: offsetX, y: offsetY }],
              widthPixels: videoDom.clientWidth,
              heightPixels: videoDom.clientHeight,
              pointCount: 1,
              properties: [{ id: 0, toolType: 1 }],
              touchType: "gestureSwipe",
              swipe: deltaY > 0 ? -1 : 1,
            };
            const messageMousedown = JSON.stringify(touchConfigMousedown);
            this.sendUserMessage(userId, messageMousedown);
          });

          /** 鼠标移出 */
          videoDom.addEventListener("mouseleave", (e: MouseEvent) => {
            e.preventDefault();
            if (this.options.disable) return;
            // 若未按下时，不发送鼠标移动事件
            if (!this.hasPushDown) {
              return;
            }
            this.touchConfig.action = 1; // 抬起
            const message = JSON.stringify(this.touchConfig);

            this.sendUserMessage(userId, message);
          });

          // 添加触摸事件监听器到新节点
          // 触摸开始
          videoDom.addEventListener(eventTypeStart, (e) => {
            e.preventDefault();

            if (this.options.disable) return;
            this.hasPushDown = true;
            const { allowLocalIMEInCloud, keyboard } = this.options;
            const { inputStateIsOpen } = this.roomMessage;
            // 处理输入框焦点逻辑
            const shouldHandleFocus =
              (allowLocalIMEInCloud && keyboard === "pad") ||
              keyboard === "local";

            if (
              this.inputElement &&
              shouldHandleFocus &&
              typeof inputStateIsOpen === "boolean"
            ) {
              if (inputStateIsOpen) {
                this.inputElement.focus();
              } else {
                this.inputElement.blur();
              }
            }

            this.touchInfo = generateTouchCoord();
            // Get from cache to avoid layout thrashing
            if (!this.videoDomRect) updateDomCache();
            const videoDomIdRect = this.videoDomRect!;
            const distanceToTop = videoDomIdRect.top;
            const distanceToLeft = videoDomIdRect.left;
            // 初始化
            this.touchConfig.properties = [];
            this.touchConfig.coords = [];
            // 计算触摸手指数量
            const touchCount = isMobileFlag ? (e as TouchEvent)?.touches?.length : 1;
            this.touchConfig.action = 0; // 按下操作
            this.touchConfig.pointCount = touchCount;
            // 手指触控节点宽高
            const bigSide =
              this.videoDomWidth > this.videoDomHeight
                ? this.videoDomWidth
                : this.videoDomHeight;
            const smallSide =
              this.videoDomWidth > this.videoDomHeight
                ? this.videoDomHeight
                : this.videoDomWidth;

            this.touchConfig.widthPixels =
              this.rotateType === 1 ? bigSide : smallSide;
            this.touchConfig.heightPixels =
              this.rotateType === 1 ? smallSide : bigSide;

            if (
              this.rotateType === 1 &&
              this.remoteResolution.height > this.remoteResolution.width
            ) {
              this.touchConfig.widthPixels = smallSide;
              this.touchConfig.heightPixels = bigSide;
            } else if (
              this.rotateType === 0 &&
              this.remoteResolution.width > this.remoteResolution.height
            ) {
              // 竖屏但是远端流是横屏（用户手动旋转屏幕）
              this.touchConfig.widthPixels = bigSide;
              this.touchConfig.heightPixels = smallSide;
            }

            for (let i = 0; i < touchCount; i += 1) {
              const touch = isMobileFlag ? (e as TouchEvent).touches[i] : (e as MouseEvent);
              this.touchConfig.properties[i] = {
                id: i,
                toolType: 1,
              };

              let x = 'offsetX' in touch ? touch.offsetX : undefined;
              let y = 'offsetX' in touch ? touch.offsetY : undefined;
              if (x === undefined) {
                x = touch.clientX - distanceToLeft;
                y = touch.clientY - distanceToTop;

                if (
                  this.rotateType === 1 &&
                  this.remoteResolution.height > this.remoteResolution.width
                ) {
                  x = videoDomIdRect.bottom - touch.clientY;
                  y = touch.clientX - distanceToLeft;
                } else if (
                  this.rotateType === 0 &&
                  this.remoteResolution.width > this.remoteResolution.height
                ) {
                  x = touch.clientY - distanceToTop;
                  y = videoDomIdRect.right - touch.clientX;
                }
              }
              
              // Xử lý FPS Camera: Lưu toạ độ ban đầu khi nhấn chuột
              if (!isMobileFlag && document.pointerLockElement === videoDom) {
                this.fpsCameraX = x ?? 0;
                this.fpsCameraY = y ?? 0;
              }

              this.touchConfig.coords.push({
                ...this.touchInfo,
                orientation: 0.01 * Math.random(),
                x: x ?? 0,
                y: y ?? 0,
              });
            }
            const touchConfig = {
              action: touchCount > 1 ? 261 : 0,
              widthPixels: this.touchConfig.widthPixels,
              heightPixels: this.touchConfig.heightPixels,
              pointCount: touchCount,
              touchType: "gesture",
              properties: this.touchConfig.properties,
              coords: this.touchConfig.coords,
            };
            const message = JSON.stringify(touchConfig);
            // console.log('2222触摸开始', message)
            this.sendUserMessage(userId, message);
          });
          // 触摸中
          videoDom.addEventListener(eventTypeMove, (e) => {
            e.preventDefault();
            if (this.options.disable) return;
            // 若未按下时，不发送鼠标移动事件
            if (!this.hasPushDown) {
              return;
            }

            // Xử lý tại chỗ: Không throttle để tối ưu FPS, gửi ngay dữ liệu thô
            // Get from cache to avoid layout thrashing
            if (!this.videoDomRect) updateDomCache();
            const videoDomIdRect = this.videoDomRect!;
            const distanceToTop = videoDomIdRect.top;
            const distanceToLeft = videoDomIdRect.left;
            // 计算触摸手指数量
            const touchCount = isMobileFlag ? (e as TouchEvent)?.touches?.length : 1;
            this.touchConfig.action = 2; // 触摸中
            this.touchConfig.pointCount = touchCount;
            this.touchConfig.coords = [];
            const coords: CoordsInfo[] = [];
            for (let i = 0; i < touchCount; i += 1) {
              const touch = isMobileFlag ? (e as TouchEvent).touches[i] : (e as MouseEvent);
              this.touchConfig.properties[i] = {
                id: i,
                toolType: 1,
              };
              let x = 'offsetX' in touch ? touch.offsetX : undefined;
              let y = 'offsetX' in touch ? touch.offsetY : undefined;
              
              // Xử lý tại chỗ: Tọa độ tính từ movementX/Y (Không qua bộ lọc của trình duyệt, tối ưu FPS game)
              if (!isMobileFlag && document.pointerLockElement === videoDom) {
                const mouseEvent = touch as MouseEvent;
                // Accumulate raw movement bypassing OS acceleration
                let movementX = mouseEvent.movementX || 0;
                let movementY = mouseEvent.movementY || 0;
                
                // Adjust for rotation if needed
                if (this.rotateType === 1 && this.remoteResolution.height > this.remoteResolution.width) {
                   const temp = movementX;
                   movementX = -movementY;
                   movementY = temp;
                } else if (this.rotateType === 0 && this.remoteResolution.width > this.remoteResolution.height) {
                   const temp = movementX;
                   movementX = movementY;
                   movementY = -temp;
                }
                
                this.fpsCameraX += movementX;
                this.fpsCameraY += movementY;
                
                x = this.fpsCameraX;
                y = this.fpsCameraY;
              } else if (x === undefined) {
                x = touch.clientX - distanceToLeft;
                y = touch.clientY - distanceToTop;

                if (
                  this.rotateType === 1 &&
                  this.remoteResolution.height > this.remoteResolution.width
                ) {
                  x = videoDomIdRect.bottom - touch.clientY;
                  y = touch.clientX - distanceToLeft;
                } else if (
                  this.rotateType === 0 &&
                  this.remoteResolution.width > this.remoteResolution.height
                ) {
                  x = touch.clientY - distanceToTop;
                  y = videoDomIdRect.right - touch.clientX;
                }
              }

              coords.push({
                ...this.touchInfo,
                orientation: 0.01 * Math.random(),
                x: x ?? 0,
                y: y ?? 0,
              });
            }
            this.touchConfig.coords = coords;
            const touchConfig = {
              action: 2,
              widthPixels: this.touchConfig.widthPixels,
              heightPixels: this.touchConfig.heightPixels,
              pointCount: touchCount,
              touchType: "gesture",
              properties: this.touchConfig.properties,
              coords: this.touchConfig.coords,
            };
            const message = JSON.stringify(touchConfig);
            // console.log('2222触摸中', message)
            this.sendUserMessage(userId, message);
          });
          // 触摸结束
          videoDom.addEventListener(eventTypeEnd, (e) => {
            e.preventDefault();
            if (this.options.disable) return;
            this.hasPushDown = false; // 按下状态重置
            if (isMobileFlag) {
              if ((e as TouchEvent).touches.length === 0) {
                this.touchConfig.action = 1; // 抬起
                const message = JSON.stringify(this.touchConfig);
                // console.log('触摸结束', message)
                this.sendUserMessage(userId, message);
              }
            } else {
              this.touchConfig.action = 1; // 抬起
              const message = JSON.stringify(this.touchConfig);
              // console.log("触摸结束", message);
              this.sendUserMessage(userId, message);
            }
          });

          // 监听广播消息
          this.onRoomMessageReceived();
          this.onUserMessageReceived();
          this.onUserJoined();
          this.onUserLeave();
          this.onRemoteVideoFirstFrame();

          // 远端摄像头/麦克风采集音视频流的回调
          this.onUserPublishStream();

          this.callbacks.onConnectSuccess();
        }

        /**
         * 监听连接状态的变化
         * @return
         * 0 进行连接前准备，锁定相关资源,
         * 1 连接断开,
         * 2 首次连接，正在连接中,
         * 3 首次连接成功,
         * 4 连接断开后重新连接中,
         * 5 连接断开后重连成功,
         * 6 处于 CONNECTION_STATE_DISCONNECTED 状态超过 10 秒，且期间重连未成功。SDK将继续尝试重连
         */
        this.engine?.on(VERTC.events.onConnectionStateChanged, (e: any) => {
          this.callbacks.onConnectionStateChanged(e);
          
          // Trạng thái 3: 首次连接成功 (First connection success)
          if (e === 3) {
            // Lấy PeerConnection ẩn của Volcengine SDK để kiểm tra P2P (Monkey-patch access)
            const pc = (this.engine as any)._getPeerConnection?.();
            if (pc) {
              this.p2pTunnel.detectP2PCapability(pc).then((isP2P) => {
                if (isP2P) {
                  this.p2pTunnel.optimizeForDirectPath(pc);
                }
              });
            }
          }
        });
      })
      .catch((error: Error & { code?: number }) => {
        this.addReportInfo({
          describe: "加入房间失败",
          error,
        });
        this.sendEventReport("error");
        console.log("进房错误", error);
        this.callbacks.onConnectFail({ code: error.code, msg: error.message });
      });
  }
  /** 远端用户离开房间 */
  onUserLeave() {
    this.engine?.on(VERTC.events.onUserLeave, (res: { userInfo: { userId: string } }) => {
      this.callbacks.onUserLeave(res);
    });
  }
  setViewSize(width: number, height: number, rotateType: 0 | 1 = 0) {
    const h5Dom = this.parentDomElement;
    const videoDom = this.videoDomElement;

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
  async updateUiH5(retryCount = 0) {
    try {
      const userId = this.options.clientId;
      const contentObj = {
        type: "updateUiH5",
      };
      const messageObj = {
        touchType: "eventSdk",
        content: JSON.stringify(contentObj),
      };
      const message = JSON.stringify(messageObj);
      const res = await this.sendUserMessage(userId, message);

      this.addReportInfo({
        describe: "发送updateUiH5信息",
        res,
      });
    } catch {
      this.addReportInfo({
        describe: "发送updateUiH5失败",
      });
      if (retryCount < 3) {
        setTimeout(() => {
          this.updateUiH5(retryCount + 1);
        }, 1000);
      }
    }
  }
  /** 远端可见用户加入房间 */
  onUserJoined() {
    this.engine?.on(VERTC.events.onUserJoined, (user: { userInfo?: { userId: string } }) => {
      if (user.userInfo?.userId === this.options.clientId) {
        this.addReportInfo({
          describe: "远端用户加入房间",
          user,
        });
        setTimeout(() => {
          this.updateUiH5();
          // 查询输入状态
          this.onCheckInputState();
          this.setKeyboardStyle(this.options.keyboard as "pad" | "local");
          this.triggerRecoveryTimeCallback();
        }, 300);
      }
    });
  }

  /** 视频首帧渲染 */
  onRemoteVideoFirstFrame() {
    this.engine?.on(VERTC.events.onRemoteVideoFirstFrame, async (event: { width: number; height: number }) => {
      console.log("视频首帧渲染回调", event);
      try {
        if (!this.isFirstRotate) {
          await this.initRotateScreen(event.width, event.height);
        }
      } finally {
        this.callbacks.onRenderedFirstFrame();
      }
    });
  }

  /** 离开 RTC 房间 */
  async stop() {
    try {
      clearTimeout(this.autoRecoveryTimer ?? undefined);
      const { clientId, mediaType } = this.options;
      const promises = [
        this.engine?.unsubscribeStream(clientId, mediaType),
        this.engine?.stopAudioCapture(),
        this.engine?.stopVideoCapture(),
        this.engine?.leaveRoom(),
        this.groupEngine?.leaveRoom(),
      ];
      await Promise.allSettled(promises);
      this.destroyEngine();

      this.groupRtc?.close();
      this.screenShotInstance?.destroy();
      this.resizeObserver?.disconnect();
      this.resizeObserver = undefined;

      if (this.options.useWebCodecs) {
        setWebCodecsFrameCallback(null);
        if (this.videoTrackWriter) {
          this.videoTrackWriter.releaseLock();
          this.videoTrackWriter = null;
        }
        if (this.videoTrackGenerator) {
          this.videoTrackGenerator.stop();
          this.videoTrackGenerator = null;
        }
        if (this.webglRenderer) {
          this.webglRenderer.destroy();
          this.webglRenderer = null;
        }
        if (this.webcodecsCanvas && this.webcodecsCanvas.parentNode) {
          this.webcodecsCanvas.parentNode.removeChild(this.webcodecsCanvas);
        }
        this.webcodecsCanvas = null;
        this.isFirstWebcodecsFrame = false;
      }

      const videoDomElement = this.videoDomElement;
      if (videoDomElement && videoDomElement.parentNode) {
        videoDomElement.parentNode.removeChild(videoDomElement);
      }
      this.inputElement?.remove();
      this.sendEventReport("error");
      this.groupEngine = undefined;
      this.groupRtc = undefined;
      this.screenShotInstance = null;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /** 房间内新增远端摄像头/麦克风采集音视频流的回调 */
  onUserPublishStream(): void {
    const handleUserPublishStream = async (e: {
      userId: string;
      mediaType: MediaType;
    }) => {
      if (e.userId === this.options.clientId) {
        const player = this.videoDomElement as HTMLDivElement;

        this.addReportInfo({
          describe: "订阅和播放房间内的音视频流",
          e,
        });
        await this.setRemoteVideoRotation(this.rotation);

        await this.engine?.subscribeStream(
          this.options.clientId,
          this.options.mediaType
        );

        if (this.engine) {
          // Force high quality stream for cloud gaming
          this.engine.setRemoteSimulcastStreamType(
            this.options.clientId,
            SimulcastStreamType.VIDEO_STREAM_HIGH
          );

          this.engine.setJitterBufferTarget(
            this.options.clientId,
            StreamIndex.STREAM_INDEX_MAIN,
            this.options.latencyTarget ?? 15,
            false // Non-progressive adjustment for extreme low latency
          );
        }

        if (!this.screenShotInstance) {
          this.screenShotInstance = new ScreenshotOverlay(
            player,
            this.rotation
          );
        }
      }
    };
    this.engine?.on(VERTC.events.onUserPublishStream, handleUserPublishStream);
  }

  /**
   * 发送摇一摇信息
   */
  sendShakeInfo(time: number): void {
    const userId = this.options.clientId;
    this.shakeSimulator.startShakeSimulation(time, (content) => {
      const getOptions = (sensorType: string): string => {
        return JSON.stringify({
          coords: [],
          heightPixels: 0,
          isOpenScreenFollowRotation: false,
          keyCode: 0,
          pointCount: 0,
          properties: [],
          text: "",
          touchType: "eventSdk",
          widthPixels: 0,
          action: 0,
          content: JSON.stringify({
            ...content,
            type: "sdkSensor",
            sensorType,
          }),
        });
      };
      this.sendUserMessage(userId, getOptions("gyroscope"));
      this.sendUserMessage(userId, getOptions("gravity"));
      this.sendUserMessage(userId, getOptions("acceleration"));
    });
  }

  checkInputState(msg: { data: string }): void {
    const { allowLocalIMEInCloud, keyboard } = this.options;
    const msgData = JSON.parse(msg.data);

    this.roomMessage.inputStateIsOpen = msgData.isOpen;
    // 仅在 enterkeyhint 存在时设置属性
    const enterkeyhintText = this.enterkeyhintObj[msgData.imeOptions as keyof typeof this.enterkeyhintObj];
    if (enterkeyhintText) {
      this.inputElement?.setAttribute("enterkeyhint", enterkeyhintText);
    }
    // 处理输入框焦点逻辑
    const shouldHandleFocus =
      (allowLocalIMEInCloud && keyboard === "pad") || keyboard === "local";

    if (shouldHandleFocus && typeof msgData.isOpen === "boolean") {
      if (msgData.isOpen) { this.inputElement?.focus(); } else { this.inputElement?.blur(); }
    }
  }

  /** 监听 onRoomMessageReceived 事件 */
  onRoomMessageReceived() {
    const onRoomMessageReceived = async (e: {
      userId: string;
      message: string;
    }) => {
      if (e.message) {
        const msg = JSON.parse(e.message);
        this.addReportInfo({
          describe: "接收到房间内广播消息的回调",
          msg,
        });
        // 消息透传
        if (msg.key === "message") {
          this.callbacks.onTransparentMsg(0, msg.data);
        }
        // ui消息
        if (msg.key === "refreshUiType") {
          const msgData = JSON.parse(msg.data);
          this.roomMessage.isVertical = msgData.isVertical;
          // 若宽高没变，则不重新绘制页面
          if (
            msgData.width === this.remoteResolution.width &&
            msgData.height === this.remoteResolution.height
          ) {
            console.log("宽高没变，不重新绘制页面", this.remoteUserId);
            return false;
          }

          this.initRotateScreen(msgData.width, msgData.height);
        }
        // 云机、本机键盘使用消息
        if (msg.key === "inputState" && this.inputElement) {
          this.checkInputState(msg);
        }
        // 将云机内容复制到本机剪切板
        if (msg.key === "clipboard") {
          if (this.options.saveCloudClipboard) {
            const msgData = JSON.parse(msg.data);
            this.callbacks.onOutputClipper(msgData);
          }
        }
      }
    };
    this.engine?.on(VERTC.events.onRoomMessageReceived, onRoomMessageReceived);
  }

  /** 监听 onUserMessageReceived 事件 */
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
        this.addReportInfo({
          describe:
            "收到来自房间中其他用户通过 sendUserMessage 发来的点对点文本消息",
          msg,
        });
        if (msg.key === "callBack") {
          const callData = JSON.parse(msg.data);
          const result = JSON.parse(callData.data);
          switch (callData.type) {
            case "definition":
              this.callbacks.onChangeResolution({
                from: parseResolution(result.from),
                to: parseResolution(result.to),
              });
              break;
            case "startVideoInjection":
            case "stopVideoInjection":
              this.callbacks?.onInjectVideoResult(callData.type, result);
              break;
          }
        }

        if (msg.key === "equipmentInfo") {
          this.callbacks?.onEquipmentInfo(JSON.parse(msg.data || []));
        }
        if (msg.key === "inputAdb") {
          this.callbacks?.onAdbOutput(JSON.parse(msg.data || {}));
        }
        // 音视频采集
        if (msg.key === "videoAndAudioControl") {
          if (!this.enableMicrophone && !this.enableCamera) {
            return;
          }
          const msgData = JSON.parse(msg.data);

          const pushType =
            this.enableMicrophone && this.enableCamera
              ? MediaType.AUDIO_AND_VIDEO
              : this.enableCamera
                ? MediaType.VIDEO
                : MediaType.AUDIO;
          if (msgData.isOpen) {
            if (this.enableCamera) {
              const videoDeviceId =
                this.videoDeviceId ||
                (msgData.isFront ? "user" : "environment");

              await this.engine?.setVideoCaptureDevice(videoDeviceId);

              await this.engine
                ?.startVideoCapture()
                .then((res: unknown) => {
                  this.callbacks.onVideoInit(res);
                  this.engine?.publishStream(MediaType.VIDEO);
                })
                .catch((err: unknown) => {
                  this.callbacks.onVideoError(err);
                });
            }

            if (this.enableMicrophone) {
              if (this.audioDeviceId) {
                await this.engine?.setAudioCaptureDevice(this.audioDeviceId);
              }
              await this.engine
                ?.startAudioCapture()
                .then((res: unknown) => {
                  this.callbacks.onAudioInit(res);
                  this.engine?.publishStream(MediaType.AUDIO);
                })
                .catch((err: unknown) => {
                  this.callbacks.onAudioError(err);
                });
            }
          } else {
            await this.engine?.stopAudioCapture();
            await this.engine?.stopVideoCapture();
            await this.engine?.unpublishStream(pushType);
          }
        }
        // 云机、本机键盘使用消息
        if (msg.key === "inputState" && this.inputElement) {
          this.checkInputState(msg);
        }
        // 音频采集
        if (msg.key === "audioControl" && this.enableMicrophone) {
          const msgData = JSON.parse(msg.data);
          if (msgData.isOpen) {
            this.engine
              ?.startAudioCapture()
              .then((res: unknown) => {
                this.callbacks.onAudioInit(res);
                this.engine?.publishStream(MediaType.AUDIO);
              })
              .catch((error: unknown) => {
                this.callbacks.onAudioError(error);
              });
          } else {
            this.engine?.stopAudioCapture();
            this.engine?.unpublishStream(MediaType.AUDIO);
          }
        }
      }
    };
    this.engine?.on(VERTC.events.onUserMessageReceived, onUserMessageReceived);
  }

  /**
   * 将字符串发送到云手机的粘贴板中
   * @param inputStr 需要发送的字符串
   */
  async sendInputClipper(inputStr: string) {
    const userId = this.options.clientId;
    const message = JSON.stringify({
      text: inputStr,
      touchType: "clipboard",
    });
    await this.sendUserMessage(userId, message);
  }

  /**
   * 当云手机处于输入状态时，将字符串直接发送到云手机，完成输入
   * @param inputStr 需要发送的字符串
   */
  async sendInputString(inputStr: string) {
    const userId = this.options.clientId;
    const message = JSON.stringify({
      text: inputStr,
      touchType: "inputBox",
    });
    await this.sendUserMessage(userId, message);
  }

  /** 清晰度切换 */
  setStreamConfig(config: CustomDefinition) {
    const regExp = /^[1-9]\d*$/;
    // 判断字段是否缺失
    if (config.definitionId && config.framerateId && config.bitrateId) {
      const values = Object.values(config);
      // 判断输入值是否为正整数
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
        const userId = this.options.clientId;
        const message = JSON.stringify(messageObj);
        this.sendUserMessage(userId, message, true);
      }
    }
  }

  /**
   * 暂停接收来自远端的媒体流
   * 该方法仅暂停远端流的接收，并不影响远端流的采集和发送。
   * @param mediaType 1 只控制音频; 2 只控制视频; 3 同时控制音频和视频
   */
  pauseAllSubscribedStream(mediaType: number = 3) {
    // 重置无操作回收定时器
    this.triggerRecoveryTimeCallback();

    const contentObj = {
      type: "openAudioAndVideo",
      isOpen: false,
    };
    const messageObj = {
      touchType: "eventSdk",
      content: JSON.stringify(contentObj),
    };
    const userId = this.options.clientId;
    const message = JSON.stringify(messageObj);
    this.engine?.sendUserMessage(userId, message);
    return this.engine?.pauseAllSubscribedStream(mediaType);
  }

  /**
   * 恢复接收来自远端的媒体流
   * 该方法仅恢复远端流的接收，并不影响远端流的采集和发送。
   * @param mediaType 1 只控制音频; 2 只控制视频; 3 同时控制音频和视频
   */
  resumeAllSubscribedStream(mediaType: number = 3) {
    // 重置无操作回收定时器
    this.triggerRecoveryTimeCallback();

    // 防止用户在自动拉取音视频流失败时，没手动开启
    this.startPlay();

    if (mediaType !== 3) {
      return this.engine?.resumeAllSubscribedStream(mediaType);
    }
    const contentObj = {
      type: "openAudioAndVideo",
      isOpen: true,
    };
    const messageObj = {
      touchType: "eventSdk",
      content: JSON.stringify(contentObj),
    };
    const userId = this.options.clientId;
    const message = JSON.stringify(messageObj);
    this.sendUserMessage(userId, message);
    return this.engine?.resumeAllSubscribedStream(mediaType);
  }
  async setRemoteVideoRotation(rotation: number) {
    const player = this.videoDomElement as HTMLElement;
    await this.engine?.setRemoteVideoPlayer(StreamIndex.STREAM_INDEX_MAIN, {
      userId: this.options.clientId,
      renderDom: player,
      renderMode: 2,
      rotation,
    });
    
    if (this.options.useWebCodecs) {
      if (this.webcodecsCanvas) {
        this.webcodecsCanvas.style.transform = `rotate(${rotation}deg)`;
      }
      // Apply rotation to the native video as well if it's acting as our sink
      const nativeVideo = this.videoDomElement?.querySelector("video") as HTMLElement;
      if (nativeVideo && this.videoTrackGenerator) {
        nativeVideo.style.transform = `rotate(${rotation}deg)`;
      }
    }
  }
  /**
   * 订阅房间内指定的通过摄像头/麦克风采集的媒体流。
   */
  async subscribeStream(mediaType: MediaType) {
    return await this.engine?.subscribeStream(this.options.clientId, mediaType);
  }
  /** 旋转VIDEO 容器 1 横屏 0 竖屏 */
  rotateContainerVideo(type: 0 | 1 = 0) {
    const player = this.videoDomElement?.querySelector("div") as HTMLElement | null;
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
      this.options.rotateType = type;
      this.rotateType = type;
    }
  }
  /** 旋转截图 */
  setScreenshotRotation(rotation: number = 0) {
    this.screenShotInstance?.setScreenshotrotateType(rotation as 0 | 1);
  }
  /** 生成封面图 */
  takeScreenshot(rotation: number = 0) {
    console.log("生成封面图", this.remoteUserId);
    this.screenShotInstance?.takeScreenshot(rotation);
  }
  /** 重新设置大小 */
  resizeScreenshot(width: number, height: number) {
    this.screenShotInstance?.resizeScreenshot(width, height);
  }
  /** 显示封面图 */
  showScreenShot() {
    this.screenShotInstance?.showScreenShot();
  }
  /** 显示封面图 */
  hideScreenShot() {
    this.screenShotInstance?.hideScreenShot();
  }

  /** 清空封面图 */
  clearScreenShot() {
    this.screenShotInstance?.clearScreenShot();
  }
  /**
   * 取消订阅房间内指定的通过摄像头/麦克风采集的媒体流。
   */
  unsubscribeStream(mediaType: MediaType): Promise<void> {
    return this.engine
      ? this.engine.unsubscribeStream(this.options.clientId, mediaType)
      : Promise.resolve();
  }
  /** 截图-保存到本地 */
  saveScreenShotToLocal(): Promise<ImageData | undefined> {
    const userId = this.options.clientId;
    return this.engine ? this.engine.takeRemoteSnapshot(userId, 0) : Promise.resolve(undefined);
  }

  /** 截图-保存到云机 */
  saveScreenShotToRemote() {
    const contentObj = {
      type: "localScreenshot",
    };
    const messageObj = {
      touchType: "eventSdk",
      content: JSON.stringify(contentObj),
    };
    const userId = this.options.clientId;
    const message = JSON.stringify(messageObj);
    this.sendUserMessage(userId, message);
  }

  /**
   * 手动横竖屏：0竖屏，1横屏
   * 对标百度API
   */
  setPhoneRotation(type: number) {
    this.triggerRecoveryTimeCallback();
    this.rotateScreen(type);
  }

  private async initRotateScreen(width: number, height: number) {
    // 移动端需要强制竖屏
    if (isTouchDevice() || isMobile()) {
      this.options.rotateType = 0;
    }

    const { rotateType } = this.options;
    if (rotateType && this.isFirstRotate) {
      return;
    }

    /** 是否首次旋转 */
    if (!this.isFirstRotate) {
      this.isFirstRotate = true;
    }

    // 存储云机分辨率
    Object.assign(this.remoteResolution, {
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

    await this.rotateScreen(targetRotateType);
  }
  /**
   * Native Browser Congestion Control Override
   * Chủ động gửi mã điều khiển (bitrate_mode) nhị phân 8-bit lên Server
   * @param mode Mã điều khiển 8-bit (0-255)
   */
  public changeBitrateModel(mode: number): Pact<unknown> {
    return new Pact((resolve, reject) => {
      try {
        const userId = this.options.clientId;
        const buffer = new Uint8Array([mode & 0xFF]).buffer; // Chế 8-bit nhị phân
        
        const res = this.engine?.sendUserBinaryMessage(userId, buffer);
        console.log(`[Bitrate Override] Đã gửi mã điều khiển: 0x${mode.toString(16).toUpperCase()}`);
        resolve(res);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Thuật toán jumpFrameProc - Xử lý bùng nổ độ trễ (Latency Burst)
   * Đây là "bộ não" điều phối băng thông động.
   */
  private jumpFrameProc(status: 'STRESS' | 'IDLE') {
    const now = Date.now();
    // Khống chế tần suất điều chỉnh (tối thiểu 2 giây một lần để tránh dao động quá nhanh)
    if (now - this.lastAdjustmentTime < 2000) return;

    if (status === 'STRESS') {
      // Giai đoạn Hạ (Step Down): Mạng nghẽn
      if (this.currentResolutionLevel < 3) { // Giả sử có tối đa 4 mức (0, 1, 2, 3)
        this.currentResolutionLevel++;
        console.warn(`[jumpFrameProc] Mạng nghẽn! Hạ xuống Level ${this.currentResolutionLevel}`);
        this.applyDynamicQuality();
        
        // Ghi đè trình duyệt: Ép Server dùng model Bitrate thấp (Ví dụ mã 0x05)
        this.changeBitrateModel(0x05); 
        
        this.lastAdjustmentTime = now;
      }
    } else if (status === 'IDLE') {
      // Giai đoạn Nâng (Step Up): Mạng nhàn rỗi
      if (this.currentResolutionLevel > 0) {
        this.currentResolutionLevel--;
        console.log(`[jumpFrameProc] Mạng ổn định. Nâng lên Level ${this.currentResolutionLevel}`);
        this.applyDynamicQuality();
        
        // Khôi phục model Bitrate tiêu chuẩn (Ví dụ mã 0x01)
        this.changeBitrateModel(0x01);
        
        this.lastAdjustmentTime = now;
      }
    }
  }

  private applyDynamicQuality() {
    /**
     * Bản đồ chất lượng thích ứng (Enterprise Mapping)
     * Level 0: 720p (ID 15), 60fps (ID 4), 4Mbps (ID 7)
     * Level 1: 540p (ID 12), 30fps (ID 3), 3Mbps (ID 5)
     * Level 2: 360p (ID 10), 20fps (ID 1), 1Mbps (ID 1)
     * Level 3: 216p (ID 8),  15fps (ID 8), 400kbps (ID 14)
     */
    const qualityLevels: Record<number, CustomDefinition> = {
      0: { definitionId: 15, framerateId: 4, bitrateId: 7 },
      1: { definitionId: 12, framerateId: 3, bitrateId: 5 },
      2: { definitionId: 10, framerateId: 1, bitrateId: 1 },
      3: { definitionId: 8,  framerateId: 8, bitrateId: 14 },
    };

    const targetConfig = qualityLevels[this.currentResolutionLevel];
    if (targetConfig) {
      console.log(`[jumpFrameProc] Điều phối mạng: Level ${this.currentResolutionLevel} (Res ID:${targetConfig.definitionId}, FPS ID:${targetConfig.framerateId}, Bitrate ID:${targetConfig.bitrateId})`);
      this.setStreamConfig(targetConfig);
    }
  }

  /**
   * 旋转屏幕
   * @param type 横竖屏：0竖屏，1横屏
   */
  async rotateScreen(type: number) {
    // console.log(1111, `type=${type}`)
    // 获取父元素（调用方）的原始宽度和高度，这里要重新获取，因为外层的div可能宽高发生变化
    const h5Dom = this.parentDomElement;
    if (!h5Dom) return;
    this.rotateType = type;

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
      this.remoteResolution.width > this.remoteResolution.height;

    // 外层 div
    let armcloudVideoWidth = 0;
    let armcloudVideoHeight = 0;
    // 旋转角度
    let videoWrapperRotate = 0;

    const videoDom = this.videoDomElement as HTMLDivElement;

    if (type === 1) {
      const w = videoIsLandscape
        ? this.remoteResolution.width
        : this.remoteResolution.height;
      const h = videoIsLandscape
        ? this.remoteResolution.height
        : this.remoteResolution.width;

      const scale = Math.min(parentWidth / w, parentHeight / h);
      armcloudVideoWidth = w * scale;
      armcloudVideoHeight = h * scale;
      videoWrapperRotate = videoIsLandscape ? 0 : 270;
    } else {
      // 竖屏处理
      const w = videoIsLandscape
        ? this.remoteResolution.height
        : this.remoteResolution.width;
      const h = videoIsLandscape
        ? this.remoteResolution.width
        : this.remoteResolution.height;

      const scale = Math.min(parentWidth / w, parentHeight / h);
      armcloudVideoWidth = w * scale;
      armcloudVideoHeight = h * scale;
      videoWrapperRotate = videoIsLandscape ? 90 : 0;
    }

    this.rotation = videoWrapperRotate;
    // armcloudVideo
    videoDom.style.width = `${armcloudVideoWidth}px`;
    videoDom.style.height = `${armcloudVideoHeight}px`;

    await this.setRemoteVideoRotation(videoWrapperRotate);

    this.callbacks.onChangeRotate(type, {
      width: armcloudVideoWidth,
      height: armcloudVideoHeight,
    });
  }

  /** 手动定位 */
  setGPS(longitude: number, latitude: number) {
    const contentObj1 = {
      latitude,
      longitude,
      time: new Date().getTime(),
    };
    const contentObj2 = {
      type: "sdkLocation",
      content: JSON.stringify(contentObj1),
    };
    const messageObj = {
      touchType: "eventSdk",
      content: JSON.stringify(contentObj2),
    };
    const userId = this.options.clientId;
    const message = JSON.stringify(messageObj);
    console.log("手动传入经纬度", message);
    this.sendUserMessage(userId, message);
  }
  executeAdbCommand(command: string) {
    const userId = this.options.clientId;
    const message = JSON.stringify({
      touchType: "eventSdk",
      content: JSON.stringify({
        type: "inputAdb",
        content: command,
      }),
    });
    this.sendUserMessage(userId, message);
  }
  /** 云机/本地键盘切换(false-云机键盘，true-本地键盘) */
  setKeyboardStyle(keyBoardType: "pad" | "local") {
    const contentObj = {
      type: "keyBoardType",
      isLocalKeyBoard: keyBoardType === "local",
    };
    const messageObj = {
      touchType: "eventSdk",
      content: JSON.stringify(contentObj),
    };
    const userId = this.options.clientId;
    const message = JSON.stringify(messageObj);
    this.options.keyboard = keyBoardType;
    this.sendUserMessage(userId, message);
  }

  /** 查询输入状态 */
  async onCheckInputState() {
    const userId = this.options.clientId;
    const message = JSON.stringify({
      touchType: "inputState",
    });
    await this.sendUserMessage(userId, message);
  }

  /**
   * 设置无操作回收时间
   * @param second 秒 默认300s,最大7200s
   */
  setAutoRecycleTime(second: number) {
    // 设置过期时间，单位为毫秒
    this.options.autoRecoveryTime = second;
    // 定时器，当指定时间内无操作时执行离开房间操作
    this.triggerRecoveryTimeCallback();
  }

  /** 获取无操作回收时间 */
  getAutoRecycleTime() {
    return this.options.autoRecoveryTime;
  }

  /** 底部栏操作按键 */
  sendCommand(command: string) {
    switch (command) {
      case "back":
        this.goAppUpPage();
        break;
      case "home":
        this.goAppHome();
        break;
      case "menu":
        this.goAppMenu();
        break;
      default:
        break;
    }
  }

  /** 返回按键事件 */
  goAppUpPage() {
    const messageObj2 = {
      action: 0,
      touchType: "keystroke",
      keyCode: 4,
      text: "",
    };
    const userId = this.options.clientId;
    const message2 = JSON.stringify(messageObj2);
    if (userId) {
      // 抬起
      this.sendUserMessage(userId, message2);
    }
  }

  /** 主页按键事件 */
  goAppHome() {
    const messageObj = {
      action: 1,
      touchType: "keystroke",
      keyCode: 3,
      text: "",
    };
    const userId = this.options.clientId;
    const message = JSON.stringify(messageObj);
    if (userId) {
      // 按下
      this.sendUserMessage(userId, message);
    }
  }

  /** 菜单按键事件 */
  goAppMenu() {
    const messageObj = {
      action: 1,
      touchType: "keystroke",
      keyCode: 187,
      text: "",
    };

    const userId = this.options.clientId;
    const message = JSON.stringify(messageObj);
    if (userId) {
      // 按下
      this.sendUserMessage(userId, message);
    }
  }
  /**  注入视频到相机 */
  injectVideoStream(
    type: "startVideoInjection" | "stopVideoInjection",
    options?: { fileUrl?: string; isLoop?: boolean; fileName?: string }
  ) {
    const userId = this.options.clientId;
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
    this.sendUserMessage(userId, message);
  }
  /** 音量增加按键事件 */
  increaseVolume() {
    // 防止用户在自动拉取音视频流失败时，没手动开启
    this.startPlay();

    const messageObj = {
      action: 1,
      touchType: "keystroke",
      keyCode: 24,
      text: "",
    };
    const userId = this.options.clientId;
    const message = JSON.stringify(messageObj);
    if (userId) {
      // 按下
      this.sendUserMessage(userId, message, true);
    }
  }

  /** 音量减少按键事件 */
  decreaseVolume() {
    // 防止用户在自动拉取音视频流失败时，没手动开启
    this.startPlay();

    const messageObj = {
      action: 1,
      touchType: "keystroke",
      keyCode: 25,
      text: "",
    };
    const userId = this.options.clientId;
    const message = JSON.stringify(messageObj);
    if (userId) {
      // 按下
      this.sendUserMessage(userId, message, true);
    }
  }

  /**
   * 是否接收粘贴板内容回调
   * @param flag true:接收 false:不接收
   */
  saveCloudClipboard(flag: boolean) {
    this.options.saveCloudClipboard = flag;
  }
}

export default HuoshanRTC;
