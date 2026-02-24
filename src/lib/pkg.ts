import HuoshanRTC from "./huoshanRtc";
import { COMMON_CODE } from "./constant";
import type { CustomDefinition, SDKInitParams, RTCOptions, LogTime, SDKCallbacks } from "./type";

interface VideoInjectionOptions {
  fileUrl?: string;
  isLoop?: boolean;
  fileName?: string;
}

class ArmcloudEngine {
  // SDK版本号
  version: string = "1.3.0";
  // rtc实例
  rtcInstance: HuoshanRTC | null = null;
  // rtc初始化参数
  rtcOptions: RTCOptions;
  // rtc回调
  callbacks: SDKCallbacks;
  streamType: number | null = null;
  private abortController: AbortController | null = null;

  public logTime: LogTime = {
    // 获取token前
    tokenResStart: null,
    // 获取token成功后
    tokenResEnd: null,
    // 加入房间
    joinRoom: null,
    // ws连接成功
    wsSuccess: null,
    // 收到 offer
    receivedOffer: null,
    // 发送 answer
    sendAnswer: null,
    // 收到加入房间：
    wsJoinRoom: null,
    // rtc连接成功
    rtcSuccess: null,
    // rtc 重连成功
    reconnectSuccess: null,
    // 拿到了video流
    videoTrack: null,
  };

  constructor(params: SDKInitParams) {
    this.abortController = new AbortController(); // 创建一个取消令牌
    // 初始化入参
    this.rtcOptions = {
      appId: "", // 火山rtc参数
      roomCode: "", // 火山rtc参数
      roomToken: "", // 火山rtc参数
      signalServer: "", // ws地址
      stuns: "", // 信令服务
      turns: "", // 信令服务
      token: params.token, // 服务端所给token，用来换取火山rtc信息
      clientId: params.deviceInfo.padCode, // 房间号
      padCode: params.deviceInfo.padCode, // 房间号
      userId: params.deviceInfo.userId, // 用户id
      retryCount: params.retryCount ?? 2, // ws重连次数
      retryTime: params.retryTime ?? 2000, // ws每次重连间隔
      isLog: params.isLog ?? true,
      disable: params.disable ?? false,
      enableMicrophone: params.enableMicrophone ?? true,
      enableCamera: params.enableCamera ?? true,
      baseUrl: params.baseUrl,
      isWsProxy: params.isWsProxy ? JSON.parse(params.isWsProxy) : false,
      manageToken: params.manageToken ?? "",
      masterIdPrefix: params.masterIdPrefix ?? "",
      uuid: "",
      // 视频流信息
      videoStream: {
        resolution: params?.deviceInfo?.videoStream?.resolution ?? 12, // 分辨率
        frameRate: params?.deviceInfo?.videoStream?.frameRate ?? 2, // 帧率
        bitrate: params?.deviceInfo?.videoStream?.bitrate ?? 3, // 码率
      },
      allowLocalIMEInCloud: params.deviceInfo.allowLocalIMEInCloud ?? false, // 云机键盘时能否使用本地输入法
      autoRecoveryTime: params.deviceInfo.autoRecoveryTime ?? 300, // 自动回收时间
      isFullScreen: params.deviceInfo.isFullScreen ?? 0, // 是否全屏
      mediaType: params.deviceInfo.mediaType ?? 2, // 拉流媒体类型
      rotateType: params.deviceInfo.rotateType, // 是否旋转横屏
      keyboard: params.deviceInfo.keyboard ?? "pad", // 键盘模式
      disableContextMenu: params.deviceInfo.disableContextMenu ?? false, // 是否禁用右键菜单
      saveCloudClipboard: params.deviceInfo.saveCloudClipboard ?? true, // 云机剪切板回调开关
      videoDeviceId: params.deviceInfo.videoDeviceId ?? "", // 摄像头ID
      audioDeviceId: params.deviceInfo.audioDeviceId ?? "", // 麦克风ID
      latencyTarget: params.latencyTarget, // 延时目标
    };

    this.callbacks = {
      // 初始化回调
      onInit: params.callbacks.onInit || (() => { }),
      // 连接成功回调
      onConnectSuccess: params.callbacks.onConnectSuccess || (() => { }),
      // 连接失败回调
      onConnectFail: params.callbacks.onConnectFail || (() => { }),
      // 触发自动回收回调
      onAutoRecoveryTime: params.callbacks.onAutoRecoveryTime || (() => { }),
      // 自动播放失败回调
      onAutoplayFailed: params.callbacks.onAutoplayFailed || (() => { }),
      // 运行信息回调
      onRunInformation: params.callbacks.onRunInformation || (() => { }),
      // 分辨率切换回调
      onChangeResolution: params.callbacks.onChangeResolution || (() => { }),
      // 横竖屏切换回调：0 竖屏 1 横屏
      onChangeRotate: params.callbacks?.onChangeRotate || (() => { }),
      // 消息透传回调
      onTransparentMsg: params.callbacks.onTransparentMsg || (() => { }),
      // 连接状态回调
      onConnectionStateChanged:
        params.callbacks.onConnectionStateChanged || (() => { }),
      // 错误回调
      onErrorMessage: params.callbacks.onErrorMessage || (() => { }),
      // 剪切板回调
      onOutputClipper: params.callbacks.onOutputClipper || (() => { }),
      // 首帧画面已加载
      onRenderedFirstFrame: params.callbacks.onRenderedFirstFrame || (() => { }),
      // 视频采集成功
      onVideoInit: params.callbacks?.onVideoInit || (() => { }),
      // 视频采集失败
      onVideoError: params.callbacks?.onVideoError || (() => { }),
      // 音频采集成功
      onAudioInit: params.callbacks?.onAudioInit || (() => { }),
      // 音频采集失败
      onAudioError: params.callbacks?.onAudioError || (() => { }),
      // 加载进度相关回调
      onProgress: params.callbacks?.onProgress || (() => { }),
      // onSocketCallback websocket相关回调
      onSocketCallback: params.callbacks?.onSocketCallback || (() => { }),
      // 用户离开
      onUserLeave: params.callbacks?.onUserLeave || (() => { }),
      // 用户进退出
      onUserLeaveOrJoin: params.callbacks?.onUserLeaveOrJoin || (() => { }),
      // 群控错误相关回调
      onGroupControlError: params.callbacks?.onGroupControlError || (() => { }),
      // 云机信息回调
      onEquipmentInfo: params.callbacks?.onEquipmentInfo || (() => { }),
      // 发送用户错误
      onSendUserError: params.callbacks?.onSendUserError || (() => { }),
      // 执行adb命令后结果回调
      onAdbOutput: params.callbacks?.onAdbOutput || (() => { }),
      // 收到本端上行及下行的网络质量信息。
      onNetworkQuality: params.callbacks?.onNetworkQuality || (() => { }),
      // 视频注入结果
      onInjectVideoResult: params.callbacks?.onInjectVideoResult || (() => { }),
      // 消息回调
      onMessage: params.callbacks?.onMessage || (() => { }),
      // 旋转变化回调
      onRotationChanged: params.callbacks?.onRotationChanged || (() => { }),
      // 远端视频尺寸变化回调
      onRemoteVideoSizeChanged: params.callbacks?.onRemoteVideoSizeChanged || (() => { }),
      // 首帧回调
      onFirstFrame: params.callbacks?.onFirstFrame || (() => { }),
    };
    // 初始化回调
    if (
      params.token &&
      params.deviceInfo &&
      params.deviceInfo.padCode &&
      params.deviceInfo.userId
    ) {
      const uuid = localStorage.getItem("armcloud_uuid") || this.generateUUID();
      localStorage.setItem("armcloud_uuid", uuid || "");

      const url = params?.baseUrl
        ? `${params.baseUrl}/rtc/open/room/applyToken`
        : `https://openapi.armcloud.net/rtc/open/room/applyToken`;
      // 换取火山rtc相关信息
      const tokenParams = {
        sdkTerminal: "h5",
        userId: this.rtcOptions.userId,
        padCode: this.rtcOptions.padCode,
        uuid,
        expire: 86400,
        videoStream: this.rtcOptions.videoStream,
      };
      this.logTime.tokenResStart = new Date().getTime();
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: this.rtcOptions.token,
        },
        body: JSON.stringify(tokenParams),
        signal: this.abortController.signal, // 将取消令牌添加到请求配置中
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.code === 200) {
            this.logTime.tokenResEnd = new Date().getTime();
            this.streamType = data.data.streamType;

            // Always use Volcengine RTC
            this.rtcOptions.uuid = uuid;
            this.rtcOptions.appId = data.data.appId;
            this.rtcOptions.roomCode = data.data.roomCode;
            this.rtcOptions.roomToken = data.data.roomToken;

            // 创建引擎对象 — Volcengine RTC only
            this.rtcInstance = new HuoshanRTC(
              params.viewId,
              this.rtcOptions,
              this.callbacks,
              this.logTime
            );
            this.callbacks.onInit({
              code: COMMON_CODE.SUCCESS,
              msg: "初始化成功",
              streamType: this.streamType,
            });
          } else {
            this.callbacks.onInit({
              code: data?.code || COMMON_CODE.FAIL,
              msg: data?.msg,
              streamType: this.streamType,
            });
          }
        })
        .catch((error: Error) => {
          if (error.name === "AbortError") {
            return;
          }
          console.error("获取初始化配置失败:", error);
          this.callbacks.onInit({
            code: COMMON_CODE.FAIL,
            msg: error.message || error.name,
          });
        });
    } else {
      this.callbacks.onInit({
        code: COMMON_CODE.FAIL,
        msg: "初始化失败，缺少必填参数",
      });
      return;
    }
  }

  /** 生成uuid */
  generateUUID(): string {
    // 生成UUID v4
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      const uuid = v.toString(16);
      return uuid;
    });
  }

  /** 浏览器是否支持webrTC */
  async isSupported(): Promise<boolean | undefined> {
    return await this.rtcInstance?.isSupported();
  }

  /** 销毁引擎 */
  destroyEngine(): void {
    if (this.rtcInstance) this.rtcInstance.destroyEngine();
  }

  /** 是否开启麦克风 */
  setMicrophone(val: boolean): void {
    if (this.rtcInstance) this.rtcInstance.setMicrophone(val);
  }

  /** 是否开启摄像头 */
  setCamera(val: boolean): void {
    if (this.rtcInstance) this.rtcInstance.setCamera(val);
  }

  /** 手动开启音视频流播放 */
  startPlay(): void {
    if (this.rtcInstance) this.rtcInstance.startPlay();
  }

  setViewSize(width: number, height: number, rotateType: 0 | 1 = 0): void {
    if (this.rtcInstance)
      this.rtcInstance.setViewSize(width, height, rotateType);
  }

  /** 加入房间 */
  start(isGroupControl = false, pads: string[] = []): void {
    if (this.rtcInstance) this.rtcInstance.start(isGroupControl, pads);
  }

  /** 群控加入房间 */
  joinGroupRoom(pads: string[] = []): void {
    if (this.rtcInstance) this.rtcInstance.joinGroupRoom(pads);
  }

  /** 踢出群控房间 */
  kickItOutRoom(pads: string[] = []): void {
    if (this.rtcInstance) this.rtcInstance.kickItOutRoom(pads);
  }

  /** 离开房间 */
  async stop(): Promise<void> {
    this.abortController?.abort();
    this.abortController = null;
    return this?.rtcInstance?.stop();
  }

  /** 静音 */
  muted(): void {
    if (this.rtcInstance) this.rtcInstance.muted();
  }

  /** 取消静音 */
  unmuted(): void {
    if (this.rtcInstance) this.rtcInstance.unmuted();
  }

  /** app卸载 */
  appUnInstall(pkgNames: Array<string>): void {
    if (this.rtcInstance) this.rtcInstance.appUnInstall(pkgNames);
  }

  /** 获取云机信息 */
  getEquipmentInfo(type: "app" | "attr"): void {
    if (this.rtcInstance) this.rtcInstance.getEquipmentInfo(type);
  }

  /** 指定摄像头 */
  setVideoDeviceId(val: string): void {
    if (this.rtcInstance) this.rtcInstance.setVideoDeviceId(val);
  }

  /** 指定麦克风 */
  setAudioDeviceId(val: string): void {
    if (this.rtcInstance) this.rtcInstance.setAudioDeviceId(val);
  }

  /** 将字符串发送到云手机的粘贴板中 */
  sendInputClipper(inputStr: string): void {
    if (this.rtcInstance) this.rtcInstance.sendInputClipper(inputStr);
  }

  /** 将字符串 分别发到云机的剪切板中 */
  sendGroupInputClipper(pads: string[], strs: string[]): void {
    if (this.rtcInstance) this.rtcInstance.sendGroupInputClipper(pads, strs);
  }

  /** 将字符串 分别发到云机的输入框中 */
  sendGroupInputString(pads: string[], strs: string[]): void {
    if (this.rtcInstance) this.rtcInstance.sendGroupInputString(pads, strs);
  }

  /** 当云手机处于输入状态时，将字符串直接发送到云手机，完成输入 */
  sendInputString(inputStr: string): void {
    if (this.rtcInstance) this.rtcInstance.sendInputString(inputStr);
  }

  /** 清晰度切换 */
  setStreamConfig(config: CustomDefinition): void {
    if (this.rtcInstance) this.rtcInstance.setStreamConfig(config);
  }

  /**
   * 暂停接收来自远端的媒体流
   * 该方法仅暂停远端流的接收，并不影响远端流的采集和发送。
   * @param mediaType 1 只控制音频; 2 只控制视频; 3 同时控制音频和视频
   */
  pauseAllSubscribedStream(mediaType: number = 3): void {
    if (this.rtcInstance)
      this.rtcInstance.pauseAllSubscribedStream(mediaType);
  }

  /**
   * 恢复接收来自远端的媒体流
   * 该方法仅恢复远端流的接收，并不影响远端流的采集和发送。
   * @param mediaType 1 只控制音频; 2 只控制视频; 3 同时控制音频和视频
   */
  resumeAllSubscribedStream(mediaType: number = 3): void {
    if (this.rtcInstance)
      this.rtcInstance.resumeAllSubscribedStream(mediaType);
  }

  /** 订阅房间内指定的通过摄像头/麦克风采集的媒体流 */
  subscribeStream(mediaType: number = 2): Promise<void> {
    if (!this.rtcInstance) {
      return Promise.reject(
        new Error(
          "RTC instance does not exist and cannot subscribe to the media stream"
        )
      );
    }
    return this.rtcInstance.subscribeStream(mediaType);
  }

  /** 取消订阅房间内指定的通过摄像头/麦克风采集的媒体流 */
  unsubscribeStream(mediaType: number = 2): Promise<void> {
    if (!this.rtcInstance) {
      return Promise.reject(
        new Error(
          "RTC instance does not exist and cannot unsubscribe from media stream"
        )
      );
    }
    return this.rtcInstance!.unsubscribeStream(mediaType);
  }

  async saveScreenShotToLocal(): Promise<ImageData | undefined> {
    if (this.rtcInstance) {
      return await this.rtcInstance.saveScreenShotToLocal();
    }
    return Promise.reject("RTC instance does not exist");
  }

  /** 截图-保存到云机 */
  saveScreenShotToRemote(): void {
    if (this.rtcInstance) this.rtcInstance.saveScreenShotToRemote();
  }

  /** 重新设置大小 */
  resizeScreenshot(width: number, height: number): void {
    this.rtcInstance?.resizeScreenshot(width, height);
  }

  /** 显示封面图 */
  showScreenShot(): void {
    this.rtcInstance?.showScreenShot();
  }

  /** 隐藏封面图 */
  hideScreenShot(): void {
    this.rtcInstance?.hideScreenShot();
  }

  /** 旋转video */
  rotateContainerVideo(type: 0 | 1 = 0): void {
    this.rtcInstance?.rotateContainerVideo(type);
  }

  /** 旋转截图 */
  setScreenshotRotation(rotation: number = 0): void {
    this.rtcInstance?.setScreenshotRotation(rotation);
  }

  /** 生成封面图 */
  takeScreenshot(rotation: number = 0): void {
    this.rtcInstance?.takeScreenshot(rotation);
  }

  /** 清空封面图 */
  clearScreenShot(): void {
    this.rtcInstance?.clearScreenShot();
  }

  /** 手动横竖屏 */
  setPhoneRotation(type: number): void {
    if (this.rtcInstance) this.rtcInstance.setPhoneRotation(type);
  }

  /** 手动定位 */
  setGPS(longitude: number, latitude: number): void {
    if (this.rtcInstance) this.rtcInstance.setGPS(longitude, latitude);
  }

  /** 执行adb命令 */
  executeAdbCommand(command: string): void {
    if (this.rtcInstance) this.rtcInstance?.executeAdbCommand(command);
  }

  /** 云机/本地键盘切换(false-云机键盘，true-本地键盘) */
  setKeyboardStyle(keyBoardType: "pad" | "local"): void {
    if (this.rtcInstance) this.rtcInstance.setKeyboardStyle(keyBoardType);
  }

  /**
   * 设置无操作回收时间
   * @param second 秒 默认300s,最大7200s
   */
  setAutoRecycleTime(second: number): void {
    if (this.rtcInstance) this.rtcInstance.setAutoRecycleTime(second);
  }

  /** 获取无操作回收时间 */
  getAutoRecycleTime(): number | undefined {
    if (this.rtcInstance) return this.rtcInstance.getAutoRecycleTime();
  }

  /** 底部栏操作按键 */
  sendCommand(command: string): void {
    if (this.rtcInstance) this.rtcInstance.sendCommand(command);
  }

  /** 音量增加按键事件 */
  increaseVolume(): void {
    if (this.rtcInstance) this.rtcInstance.increaseVolume();
  }

  /** 音量减少按键事件 */
  decreaseVolume(): void {
    if (this.rtcInstance) this.rtcInstance.decreaseVolume();
  }

  /**
   * 是否接收粘贴板内容回调
   * @param flag true:接收 false:不接收
   */
  saveCloudClipboard(flag: boolean): void {
    if (this.rtcInstance) this.rtcInstance.saveCloudClipboard(flag);
  }

  injectVideoStream(
    type: "startVideoInjection" | "stopVideoInjection",
    options?: VideoInjectionOptions
  ): void {
    if (this.rtcInstance) {
      this.rtcInstance.injectVideoStream(type, options ?? {});
    }
  }

  /** 摇一摇 */
  sendShake(time?: number): void {
    if (this.rtcInstance) this.rtcInstance.sendShakeInfo(time ?? 1500);
  }
}

export default ArmcloudEngine;
