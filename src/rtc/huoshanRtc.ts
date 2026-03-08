
import type { IRTCEngine } from "../vendor/volcengine-rtc";
import huoshanGroupRtc from "./huoshanGroupRtc";
import { LOG_TYPE } from "../core/constants";
import type { CallbackArg, CustomDefinition, RTCOptions, SDKCallbacks, LogTime, RoomMessage, ReportEntry, RTCResult } from "../core/types";
import type { MediaType } from "../vendor/volcengine-rtc";
import ScreenshotOverlay from "../features/screenshot";
import { DeviceController } from "./controllers/DeviceController";
import { StreamController } from "./controllers/StreamController";
import { InputController } from "./controllers/InputController";
import { TouchInputHandler } from "./handlers/TouchInputHandler";
import { UIController } from "./controllers/UIController";
import { MessageController } from "./controllers/MessageController";
import { ConnectionController } from "./controllers/ConnectionController";
import { VideoElement } from "../ui/videoElement";

class HuoshanRTC {
  // 初始外部H5传入DomId
  public initDomId = "";
  // video容器id
  public videoDomId = "";
  // Video element manager
  public videoElement: VideoElement;
  // 鼠标、触摸事件时是否按下
  public hasPushDown = false;
  public enableMicrophone = true;
  public enableCamera = true;
  public screenShotInstance: ScreenshotOverlay | null = null;
  public isFirstRotate = false;
  public videoDomRect?: DOMRect;
  public videoDomWidth = 0;
  public videoDomHeight = 0;
  public resizeObserver: ResizeObserver | null = null;
  private lastTimerResetTime = 0;
  public remoteResolution = {
    width: 0,
    height: 0,
  };

  public options: RTCOptions;
  public engine: IRTCEngine | undefined;
  public groupEngine: IRTCEngine | undefined;
  public groupRtc: huoshanGroupRtc | undefined;
  public inputElement: HTMLInputElement | undefined;

  public roomMessage: RoomMessage = {};

  // 回收时间定时器
  public autoRecoveryTimer: ReturnType<typeof setTimeout> | null = null;

  public errorInfo: ReportEntry[] = [];

  public isFirstFrame = false;
  public isStarted = false;

  public firstFrameCount = 0;
  public rotation = 0;

  // 是否群控
  public isGroupControl = false;
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
  public remoteUserId = "";
  public rotateType!: number;
  public videoDeviceId!: string;
  public audioDeviceId!: string;

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

    // 获取外部容器div元素
    const h5Dom = document.getElementById(this.initDomId);
    
    // Initialize VideoElement
    this.videoElement = new VideoElement(masterIdPrefix, padCode);
    this.videoDomId = this.videoElement.getVideoDomId();
    const videoDom = this.videoElement.createElements();
    
    // 将div元素添加到外部容器中
    h5Dom?.appendChild(videoDom);

    this.deviceController = new DeviceController(this);
    this.streamController = new StreamController(this);
    this.inputController = new InputController(this);
    this.touchInputHandler = new TouchInputHandler(this);
    this.uiController = new UIController(this);
    this.messageController = new MessageController(this);
    this.connectionController = new ConnectionController(this);

    // 创建引擎对象
    this.createEngine();
  }

  /** 浏览器是否支持 */
  isSupported(): Promise<boolean> {
      return this.connectionController.isSupported();
  }

  setLogTime(key: string): void {
    this.logTime[key] = new Date().getTime();
  }
  addReportInfo(info: { describe: string; error?: CallbackArg; res?: CallbackArg; e?: CallbackArg; msg?: CallbackArg; user?: CallbackArg }): void {
    if (!this.options.isLog) return; // Tối ưu hóa cực đoan: Không cấp phát bộ nhớ nếu không bật log
    const time = new Date().getTime();
    this.errorInfo.push({
      type: "WebVolcanoRtc",
      time,
      timeDiff: time - (this.logTime.joinRoom ?? 0),
      info,
    });
  }
  setMicrophone(val: boolean): void {
    this.enableMicrophone = val;
  }
  setCamera(val: boolean): void {
    this.enableCamera = val;
  }
  setVideoDeviceId(val: string): void {
    this.videoDeviceId = val;
  }
  setAudioDeviceId(val: string): void {
    this.audioDeviceId = val;
  }
  sendEventReport(operation: string): void {
    if (!this.options.isLog) {
      return;
    }
    const request = (_type: number, _data: CallbackArg): void => {
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
  triggerRecoveryTimeCallback(): void {
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
      void this.stop();
      this.callbacks.onAutoRecoveryTime();
    }, this.options.autoRecoveryTime * 1000);
  }

  /** 调用 createEngine 创建一个本地 Engine 引擎对象 */
  createEngine(): void {
      this.connectionController.createEngine();
  }

  // 创建群控实例
  async createGroupEngine(pads: string[] = [], config?: Partial<RTCOptions>): Promise<void> {
      return this.connectionController.createGroupEngine(pads, config);
  }

  /** 手动销毁通过 createEngine 所创建的引擎对象 */
  destroyEngine(): void {
      this.connectionController.destroyEngine();
  }

  /**
   * 静音
   */
  muted(): void {
      this.streamController.muted();
  }

  /**
   * 取消静音
   */
  unmuted(): void {
      this.streamController.unmuted();
  }
  /** 按顺序发送文本框 */
  public sendGroupInputString(pads: string[], strs: string[]): void {
      this.inputController.sendGroupInputString(pads, strs);
  }
  /**  群控剪切板  */
  public sendGroupInputClipper(pads: string[], strs: string[]): void {
      this.inputController.sendGroupInputClipper(pads, strs);
  }
  /** 手动开启音视频流播放 */
  startPlay(): void {
      this.streamController.startPlay();
  }
  /** 群控房间信息 */
  async sendGroupRoomMessage(message: string): Promise<RTCResult> {
        return await this.groupRtc?.sendRoomMessage(message);
  }
  getMsgTemplate(touchType: string, content: object): string {
    return JSON.stringify({
      touchType,
      content: JSON.stringify(content),
    });
  }

  /** 获取应用信息 */
  getEquipmentInfo(type: "app" | "attr"): void {
      this.deviceController.getEquipmentInfo(type);
  }

  /** 应用卸载 */
  appUnInstall(pkgNames: string[]): void {
      this.deviceController.appUnInstall(pkgNames);
  }

  /** 发送消息 */
  async sendUserMessage(
    userId: string,
    message: string,
    notSendInGroups?: boolean
  ): Promise<RTCResult> {
    // Wisebite: Throttled recovery timer reset
    const now = Date.now();
    if (now - this.lastTimerResetTime > 1000) {
      this.triggerRecoveryTimeCallback();
      this.lastTimerResetTime = now;
    }

    try {
      if (this.isGroupControl && !notSendInGroups) {
        return await this.sendGroupRoomMessage(message);
      }
      const result = await this.engine?.sendUserMessage(userId, message);
      return typeof result === "object" && result !== null ? result : undefined;
    } catch {
      const sendError = new Error("Send user message failed");
            this.callbacks.onSendUserError(sendError);
      return Promise.reject(sendError);
    }
  }
  /** 群控退出房间 */
  public kickItOutRoom(pads: string[]): void {
    void this.sendGroupRoomMessage(
      JSON.stringify({
        touchType: "kickOutUser",
        content: JSON.stringify(pads),
      })
    );
  }
  /** 群控加入房间 */
  public joinGroupRoom(pads: string[]): void {
        const arr = pads.filter((v: string) => v !== this.remoteUserId);
    if (!arr.length || !this.isGroupControl) return;

        if (!this.groupRtc) {
      void this.createGroupEngine(arr);
      return;
    }
    void this.groupRtc.joinRoom(arr);
  }

  /** 进入 RTC 房间 */
  start(isGroupControl = false, pads: string[] = []): void {
      this.connectionController.start(isGroupControl, pads);
  }
  /** 远端用户离开房间 */
  onUserLeave(): void {
      this.messageController.onUserLeave();
  }
  setViewSize(width: number, height: number, rotateType: 0 | 1 = 0): void {
      this.uiController.setViewSize(width, height, rotateType);
  }
  async updateUiH5(): Promise<void> {
      return this.uiController.updateUiH5();
  }
  /** 远端可见用户加入房间 */
  onUserJoined(): void {
      this.messageController.onUserJoined();
  }

  /** 视频首帧渲染 */
  onRemoteVideoFirstFrame(): void {
      this.messageController.onRemoteVideoFirstFrame();
  }

  /** 离开 RTC 房间 */
  async stop(): Promise<void> {
      return this.connectionController.stop();
  }

  /** 房间内新增远端摄像头/麦克风采集音视频流的回调 */
  onUserPublishStream(): void {
      this.messageController.onUserPublishStream();
  }

  /**
   * 发送摇一摇信息
   */
  sendShakeInfo(time: number): void {
      this.deviceController.sendShakeInfo(time);
  }

  checkInputState(msg: { data: string }): void {
      this.messageController.checkInputState(msg);
  }

  /** 监听 onRoomMessageReceived 事件 */
  onRoomMessageReceived(): void {
      this.messageController.onRoomMessageReceived();
  }

  /** 监听 onUserMessageReceived 事件 */
  onUserMessageReceived(): void {
      this.messageController.onUserMessageReceived();
  }

  /**
   * 将字符串发送到云手机的粘贴板中
   * @param inputStr 需要发送的字符串
   */
  async sendInputClipper(inputStr: string): Promise<void> {
      return this.inputController.sendInputClipper(inputStr);
  }

  /**
   * 当云手机处于输入状态时，将字符串直接发送到云手机，完成输入
   * @param inputStr 需要发送的字符串
   */
  async sendInputString(inputStr: string): Promise<void> {
      return this.inputController.sendInputString(inputStr);
  }

  /** 清晰度切换 */
  setStreamConfig(config: CustomDefinition): void {
      this.streamController.setStreamConfig(config);
  }

  /**
   * 暂停接收来自远端的媒体流
   * 该方法仅暂停远端流的接收，并不影响远端流的采集和发送。
   * @param mediaType 1 只控制音频; 2 只控制视频; 3 同时控制音频和视频
   */
  pauseAllSubscribedStream(mediaType = 3): Promise<void> | undefined {
      return this.streamController.pauseAllSubscribedStream(mediaType);
  }

  /**
   * 恢复接收来自远端的媒体流
   * 该方法仅恢复远端流的接收，并不影响远端流的采集和发送。
   * @param mediaType 1 只控制音频; 2 只控制视频; 3 同时控制音频和视频
   */
  resumeAllSubscribedStream(mediaType = 3): Promise<void> | undefined {
      return this.streamController.resumeAllSubscribedStream(mediaType);
  }
  setRemoteVideoRotation(rotation: number): Promise<void> {
      this.uiController.setRemoteVideoRotation(rotation);
      return Promise.resolve();
  }
  /**
   * 订阅房间内指定的通过摄像头/麦克风采集的媒体流。
   */
  async subscribeStream(mediaType: MediaType): Promise<void> {
      return this.streamController.subscribeStream(mediaType);
  }
  /** 旋转VIDEO 容器 1 横屏 0 竖屏 */
  rotateContainerVideo(type: 0 | 1 = 0): void {
      this.uiController.rotateContainerVideo(type);
  }
  /** 旋转截图 */
  setScreenshotRotation(rotation = 0): void {
      this.uiController.setScreenshotRotation(rotation);
  }
  /** 生成封面图 */
  takeScreenshot(rotation = 0): void {
      this.uiController.takeScreenshot(rotation);
  }
  /** 重新设置大小 */
  resizeScreenshot(width: number, height: number): void {
      this.uiController.resizeScreenshot(width, height);
  }
  /** 显示封面图 */
  showScreenShot(): void {
      this.uiController.showScreenShot();
  }
  /** 显示封面图 */
  hideScreenShot(): void {
      this.uiController.hideScreenShot();
  }

  /** 清空封面图 */
  clearScreenShot(): void {
      this.uiController.clearScreenShot();
  }
  /**
   * 取消订阅房间内指定的通过摄像头/麦克风采集的媒体流。
   */
  unsubscribeStream(mediaType: MediaType): Promise<void> {
      return this.streamController.unsubscribeStream(mediaType);
  }
  /** 截图-保存到本地 */
  saveScreenShotToLocal(): Promise<ImageData | undefined> {
      return this.uiController.saveScreenShotToLocal();
  }

  /** 截图-保存到云机 */
  saveScreenShotToRemote(): void {
      this.uiController.saveScreenShotToRemote();
  }

  /**
   * 手动横竖屏：0竖屏，1横屏
   * 对标百度API
   */
  setPhoneRotation(type: number): void {
      this.uiController.setPhoneRotation(type);
  }

  /**
   * 旋转屏幕
   * @param type 横竖屏：0竖屏，1横屏
   */
  async rotateScreen(type: number): Promise<void> {
      return this.uiController.rotateScreen(type);
  }

  /** 手动定位 */
  setGPS(longitude: number, latitude: number): void {
      this.deviceController.setGPS(longitude, latitude);
  }
  executeAdbCommand(command: string): void {
      this.deviceController.executeAdbCommand(command);
  }
  /** 云机/本地键盘切换(false-云机键盘，true-本地键盘) */
  setKeyboardStyle(keyBoardType: "pad" | "local"): void {
      this.inputController.setKeyboardStyle(keyBoardType);
  }

  /** 查询输入状态 */
  async onCheckInputState(): Promise<void> {
      return this.inputController.onCheckInputState();
  }

  /**
   * 设置无操作回收时间
   * @param second 秒 默认300s,最大7200s
   */
  setAutoRecycleTime(second: number): void {
    // 设置过期时间，单位为毫秒
    this.options.autoRecoveryTime = second;
    // 定时器，当指定时间内无操作时执行离开房间操作
    this.triggerRecoveryTimeCallback();
  }

  /** 获取无操作回收时间 */
  getAutoRecycleTime(): number {
    return this.options.autoRecoveryTime;
  }

  /** 底部栏操作按键 */
  sendCommand(command: string): void {
      this.deviceController.sendCommand(command);
  }

  /** 返回按键事件 */
  goAppUpPage(): void {
      this.deviceController.goAppUpPage();
  }

  /** 主页按键事件 */
  goAppHome(): void {
      this.deviceController.goAppHome();
  }

  /** 菜单按键事件 */
  goAppMenu(): void {
      this.deviceController.goAppMenu();
  }
  /**  注入视频到相机 */
  injectVideoStream(
    type: "startVideoInjection" | "stopVideoInjection",
    options?: { fileUrl?: string; isLoop?: boolean; fileName?: string }
  ): void {
      this.streamController.injectVideoStream(type, options);
  }
  /** 音量增加按键事件 */
  increaseVolume(): void {
      this.deviceController.increaseVolume();
  }

  /** 音量减少按键事件 */
  decreaseVolume(): void {
      this.deviceController.decreaseVolume();
  }

  /**
   * 是否接收粘贴板内容回调
   * @param flag true:接收 false:不接收
   */
  saveCloudClipboard(flag: boolean): void {
      this.inputController.saveCloudClipboard(flag);
  }

    deviceController!: DeviceController;
    streamController!: StreamController;
    inputController!: InputController;

    updateDomCache(): void {

            const videoDom = document.getElementById(this.videoDomId);
            if (videoDom) {
              this.videoDomRect = videoDom.getBoundingClientRect();
              this.videoDomWidth = videoDom.clientWidth;
              this.videoDomHeight = videoDom.clientHeight;
            }
          
    }

    touchInputHandler!: TouchInputHandler;
    public uiController!: UIController;
    public messageController!: MessageController;
    public connectionController!: ConnectionController;
}

export default HuoshanRTC;



