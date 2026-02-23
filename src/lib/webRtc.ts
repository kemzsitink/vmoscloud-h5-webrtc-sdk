// @ts-nocheck
import CryptoJS from "crypto-js";
import axios from "axios";
import Shake from "./shake";
import type { CustomDefinition } from "./type";
import { handleError, handleIceError } from "./error";
import {
  COMMON_CODE,
  MEDIA_CONTROL_TYPE,
  MEDIA_VOICE_TYPE,
  LOG_TYPE,
  PROGRESS_INFO,
  ERROR_CODE,
} from "./constant";
import {
  blobToText,
  arrayBufferToText,
  checkType,
  isMobile,
  isTouchDevice,
} from "./utils";
import webGroupRtc from "./webGroupRtc";
import { VideoElement } from "./videoElement";
import type { TouchInfo } from "./types/webrtcType";
import { generateTouchCoord } from "./mixins";
import { addInputElement } from "./textInput";
import ScreenshotOverlay from "./screenshotOverlay";

class WebRTC {
  private lastPliCount: number = 0;
  private _trigIframeReq() {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const message = JSON.stringify({
        touchType: "eventSdk",
        content: JSON.stringify({
          type: "requestIFrame",
        }),
      });
      this.dataChannel.send(message);
      console.log("[SDK] Detect video artifacts (PLI), triggering I-Frame request...");
    }
  }
  // 初始外部H5传入DomId
  private initDomId: string = "";
  private initDomWidth: number = 0;
  private initDomHeight: number = 0;
  // video容器id
  private videoDomId: string = "";
  private remoteVideoContainerId: string = "";
  private remoteVideoId: string = "";
  private remoteAudioStream: any = null;
  private screenShotInstance: ScreenshotOverlay;
  private remoteVideoStream: any = null;
  private pingTimer: any = null;
  // 鼠标、触摸事件时是否按下
  private hasPushDown: boolean = false;
  // 刷新ui消息次数
  private refreshUiMsgNumber: number = 0;
  private isVideoFirstFrame: boolean = false;
  private enableMicrophone: boolean = true;
  private enableCamera: boolean = true;
  private rotation: number = 0;
  private errorInfo: Array = [];

  private remoteResolution = {
    width: 0,
    height: 0,
  };

  private roomMessage: any = {
    inputStateIsOpen: false,
    isVertical: true,
  };

  private options: any;

  // websocket
  private socket: any;
  private retryCount: number;
  private retryCountBackup: number;
  private retryTime: number;
  private remotePc: any = null;
  private dataChannel: any;
  private remoteUserId: string;
  private inputElement: HTMLInputElement | undefined;
  // 回收时间定时器
  private autoRecoveryTimer: any = null;
  // 运行信息定时器
  private runInfoTimer: any = null;

  // 触摸信息
  private touchConfig: any = {
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

  private socketParams: any;

  // 回调函数集合
  private callbacks: any = {};

  private audioAndVideoStream: any = null;

  private audioAndVideoSender: any = null;

  private logTime: any = null;

  // 是否群控
  private isGroupControl: boolean = false;
  private groupRtc: any = null;
  private groupPads: any = [];
  private masterIdPrefix: string = "";

  private stopOperation: boolean = false;
  private videoElement: VideoElement;

  constructor(viewId: string, params: any, callbacks: any, logTime: any) {
    this.logTime = logTime;
    this.initDomId = viewId;
    this.options = params;
    const whileCallList = ["onAutoRecoveryTime"];
    callbacks &&
      Object.keys(callbacks).forEach((key) => {
        const originalCallback = callbacks[key];
        this.callbacks[key] = (...args) => {
          if (!this.stopOperation || whileCallList.includes(key)) {
            originalCallback(...args);
          }
        };
      });
    this.enableMicrophone = params.enableMicrophone;
    this.enableCamera = params.enableCamera;
    this.remoteUserId = params.padCode;
    this.retryCount = params.retryCount;
    this.retryCountBackup = params.retryCount;
    this.retryTime = params.retryTime;
    this.masterIdPrefix = params.masterIdPrefix;

    // 获取外部容器div元素
    const h5Dom = document.getElementById(this.initDomId);
    this.initDomWidth = h5Dom?.clientWidth ?? 0;
    this.initDomHeight = h5Dom?.clientHeight ?? 0;
    this.videoElement = new VideoElement(
      this.masterIdPrefix,
      this.remoteUserId
    );

    // 获取video元素
    this.videoDomId = this.videoElement?.getVideoDomId();
    this.remoteVideoContainerId = this.videoElement?.getContainerId();
    this.remoteVideoId = this.videoElement?.getRemoteVideoId();
    const videoContainer = this.videoElement?.createElements();
    // 将div元素添加到外部容器中
    h5Dom?.appendChild(videoContainer);

    if (!this.options.disable) {
      addInputElement(this, true);
    }
    // 解密-ws地址
    const signalServer = this.decryptAES(
      this.options.signalServer,
      this.options.padCode
    );
    // const wsUrl = `ws://47.92.204.33:5000/${this.options.roomToken}`;
    const { isWsProxy } = this.options;

    let wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${
      location.host
    }/sdk-ws/${this.options.roomToken}`;
    if (!isWsProxy) {
      wsUrl = `${signalServer}/${this.options.roomToken}`;
    }

    // stuns地址
    const stuns = this.decryptAES(this.options.stuns, this.options.padCode);
    const stunsArr = JSON.parse(stuns);
    // turns地址
    const turns = this.decryptAES(this.options.turns, this.options.padCode);
    const turnsArr = JSON.parse(turns);

    // 信令服务器
    const rtcConfig = {
      iceServers: [
        {
          urls: [stunsArr?.[0]?.uri],
        },
        {
          urls: [turnsArr[0].uri],
          username: turnsArr[0].username,
          credential: turnsArr[0].pwd,
        },
      ],
    };

    const audioElement = document.createElement("audio");
    audioElement.id = `${this.masterIdPrefix}_${this.remoteUserId}_remoteAudio`;
    audioElement.style.display = "none";
    audioElement.setAttribute("playsinline", "");
    audioElement.setAttribute("webkit-playsinline", "");
    audioElement.setAttribute("x5-playsinline", "");
    audioElement.setAttribute("x5-video-player-type", "h5");
    h5Dom?.appendChild(audioElement);

    this.socketParams = {
      wsUrl,
      rtcConfig,
      remoteVideo: this.videoElement?.getRemoteVideo(),
      remoteAudio: audioElement,
    };

    // 初始化当前视频
    this.remotePc = new RTCPeerConnection({
      ...this.socketParams.rtcConfig,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require"
    });
  }

  private setLogTime(key) {
    this.logTime[key] = new Date().getTime();
  }
  // 事件上报
  private sendEventReport(operation) {
    return;
    if (!this.options.isLog) {
      return;
    }
    const request = (type, data) => {
      const { baseUrl } = this.options;
      const url = baseUrl
        ? `${baseUrl}/openapi/open/clientException/sendInfo`
        : "https://openapi.armcloud.net/openapi/open/clientException/sendInfo";
      axios
        .post(url, {
          padCode: this.remoteUserId,
          errorJson: JSON.stringify(data),
          type,
        })
        .finally(() => {
          this.errorInfo = [];
        });
    };

    if (!operation && !this.isFirstFrameSuccess() && this.errorInfo?.length) {
      request(LOG_TYPE.FAIL, this.errorInfo);
      return;
    }
    const time = new Date().getTime();
    if (operation === "init") {
      const {
        wsSuccess,
        joinRoom,
        rtcSuccess,
        tokenResStart,
        tokenResEnd,
        wsJoinRoom,
        receivedOffer,
        sendAnswer,
        videoTrack,
      } = this.logTime;
      request(LOG_TYPE.SUCCESS, {
        rtcLinkTime: rtcSuccess - wsJoinRoom,
        wsSuccessTime: wsSuccess - joinRoom,
        joinRoomTime: wsJoinRoom - wsSuccess,
        totalTime: time - tokenResStart,
        receivedOffer: receivedOffer - wsJoinRoom,
        sendAnswer: sendAnswer - receivedOffer,
        questServerTime: tokenResEnd - tokenResStart,
        token: tokenResEnd,
        createTime: tokenResStart,
        wsJoinRoom,
        wsSuccess,
        rtcSuccess,
        videoTrack,
        videoRender: time,
        type: "Web",
      });
    }
    if (operation === "token") {
      request(LOG_TYPE.SUCCESS, {
        type: "Web",
        time,
        token: this.options.roomToken,
      });
    }
  }

  private addReportInfo(info) {
    const time = new Date().getTime();
    this.errorInfo.push({
      type: "Web",
      time,
      timeDiff: time - this.logTime.joinRoom,
      info,
    });
  }
  /**
   * AES 解密方法
   * @param {*} encryptData 加密数据
   * @param {*} key 秘钥
   * @returns 解密后数据
   */
  private decryptAES(encryptData: string, key: string) {
    try {
      const ciphertext = CryptoJS.enc.Base64.parse(encryptData); // Base64解密
      const stringEncryptData = CryptoJS.format.Hex.parse(
        ciphertext.toString()
      );
      const keyFormat = key.padEnd(16, "0");
      const keyValue = CryptoJS.enc.Utf8.parse(keyFormat); // 密钥
      const decrypt = CryptoJS.AES.decrypt(stringEncryptData, keyValue, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
      });
      // 将解密后的结果转换为字符串，并解析为JSON对象
      const source = CryptoJS.enc.Utf8.stringify(decrypt);
      return source;
    } catch (error) {
      return null; // 返回 null 或其他自定义的错误标识
    }
  }
  // 暂停音视频轨道
  public pauseAudioAndVideoMedia() {
    if (this.audioAndVideoStream) {
      this.audioAndVideoStream.getTracks().forEach((track) => {
        track.stop(); // 停止轨道
        this.audioAndVideoStream.removeTrack(track);
      });

      // 移除轨道
      if (this.audioAndVideoSender) {
        this.remotePc.removeTrack(this.audioAndVideoSender);
      }

      // 清除音频流和发送器
      this.audioAndVideoStream = null;
      this.audioAndVideoSender = null;
    }
  }

  private getMsgTemplate(touchType: string, content: object) {
    return JSON.stringify({
      touchType,
      content: JSON.stringify(content),
    });
  }
  /** 获取应用信息 */
  public getEquipmentInfo(type: "app" | "attr") {
    if (this.stopOperation) return;
    this.sendUserMessage(
      this.getMsgTemplate("equipmentInfo", {
        type,
      })
    );
  }
  /** 应用卸载 */
  public appUnInstall(pkgNames: Array<string>) {
    if (this.stopOperation) return;
    this.sendUserMessage(this.getMsgTemplate("appUnInstall", pkgNames));
  }
  /** 旋转截图 */
  public setScreenshotRotation(rotation: number = 0) {
    this.screenShotInstance?.setScreenshotRotation(rotation);
  }
  /** 生成封面图 */
  public takeScreenshot(rotation: number = 0) {
    this.screenShotInstance?.takeScreenshot(rotation);
  }
  /** 重新设置大小 */
  public resizeScreenshot(width: number, height: number) {
    this.screenShotInstance?.resizeScreenshot(width, height);
  }
  /** 显示封面图 */
  public showScreenShot() {
    this.screenShotInstance?.showScreenShot();
  }
  /** 显示封面图 */
  public hideScreenShot() {
    this.screenShotInstance?.hideScreenShot();
  }

  /** 清空封面图 */
  public clearScreenShot() {
    this.screenShotInstance?.clearScreenShot();
  }
  public setViewSize(width: number, height: number, rotateType: 0 | 1 = 0) {
    const videoDom = document.getElementById(this.videoDomId)!;
    const remoteVideoContainerDom = document.getElementById(
      this.remoteVideoContainerId
    )! as HTMLDivElement;
    const remoteVideo = document.getElementById(
      this.remoteVideoId
    )! as HTMLDivElement;
    if (videoDom && remoteVideo) {
      const setDimensions = (
        element: HTMLElement,
        width: number,
        height: number
      ) => {
        element.style.width = width + "px";
        element.style.height = height + "px";
      };

      // 设置宽高
      setDimensions(videoDom, width, height);

      // 设置宽高
      setDimensions(remoteVideoContainerDom, width, height);
      if (rotateType == 1) {
        setDimensions(remoteVideo, height, width);
        return;
      }
      setDimensions(remoteVideo, width, height);
    }
  }
  private async captureAudioAndVideo() {
    if (!this.enableMicrophone && !this.enableCamera) return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      this.callbacks.onAudioError({
        code: COMMON_CODE.FAIL,
        msg: "API_NOT_AVAILABLE",
      });
      return;
    }
    try {
      this.audioAndVideoStream = await navigator.mediaDevices.getUserMedia({
        audio: this.enableMicrophone,
        video: this.enableCamera,
      });
      this.audioAndVideoStream.getTracks().forEach((track) => {
        try {
          this.audioAndVideoSender = this.remotePc.addTrack(
            track,
            this.audioAndVideoStream
          );
        } catch (error) {
          console.error(`添加音视频轨道失败: ${error}`);
        }
      });
      this.callbacks.onAudioInit({ code: COMMON_CODE.SUCCESS });
      this.addReportInfo({
        describe: "音视频流已捕获",
      });
    } catch (error) {
      this.callbacks.onAudioError({
        code: COMMON_CODE.FAIL,
        msg: error.message || error.name,
      });
      this.addReportInfo({
        describe: "获取麦克风音频流失败",
        error: handleError(error),
      });
    }
  }
  private startHeartbeat() {
    this.pingTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            event: "ping",
          })
        );
        return;
      }
      clearInterval(this.pingTimer);
    }, 5000);
  }
  /** 初始化ws */
  private initWebSocket() {
    let isGetSdp = false;
    const iceCandidataArr = [];

    this.callbacks.onProgress(PROGRESS_INFO.WS_CONNECT);
    // 连接websocket
    this.socket = new WebSocket(this.socketParams?.wsUrl);
    // ws连接成功回调
    this.socket.onopen = () => {
      this.setLogTime("wsSuccess");
      this.retryCount = this.retryCountBackup;

      this.addReportInfo({
        describe: "ws连接成功",
      });
      this.callbacks.onSocketCallback({
        code: COMMON_CODE.SUCCESS,
      });
      this.callbacks.onProgress(PROGRESS_INFO.WS_SUCCESS);

      this.sendEventReport("token");

      this.isGroupControl && this.createWebGroupRtc(this.groupPads);
      this.startHeartbeat();
    };
    // ws连接关闭回调
    this.socket.onclose = (event) => {
      console.log(
        "WebSocket closed. Code: ",
        event.code,
        " Reason: ",
        event.reason
      );

      this.addReportInfo({
        describe: "ws连接关闭",
      });
      if (this.retryCount === this.retryCountBackup) {
        this.callbacks.onSocketCallback({
          code: COMMON_CODE.CLOSE,
        });
        this.callbacks.onProgress(PROGRESS_INFO.WS_CLOSE);
        this.sendEventReport();
      }
    };
    // ws连接错误回调
    this.socket.onerror = (error) => {
      this.addReportInfo({
        describe: "ws连接失败",
      });

      this.retryCount--;
      if (this.retryCount > 0) {
        setTimeout(() => {
          this.initWebSocket();
        }, this.retryTime);
        this.callbacks.onProgress(PROGRESS_INFO.WS_RETRY);
      } else {
        this.callbacks.onSocketCallback({
          code: COMMON_CODE.FAIL,
        });
        this.callbacks.onProgress(PROGRESS_INFO.WS_ERROR);
        this.sendEventReport();
        this.stopOperations();
      }
    };

    const setIce = (item) => {
      this.remotePc
        ?.addIceCandidate({
          candidate: item.candidate,
          sdpMLiineIndex: item.label,
          sdpMid: item.id,
        })
        .then(() => {
          this.addReportInfo({
            describe: "添加发送方Candidate信息成功",
            item,
          });
          this.callbacks.onProgress(PROGRESS_INFO.RECEIVE_ICE);
        })
        .catch((error) => {
          this.addReportInfo({
            describe: "添加发送方Candidate信息失败",
            error: handleError(error),
          });
          this.callbacks.onProgress(PROGRESS_INFO.RECEIVE_ICE_ERR);
        });
    };

    // ws收到消息回调
    this.socket.onmessage = async (event) => {
      const messageObj = JSON.parse(event.data);
      this.addReportInfo({
        describe: "ws收到消息",
        ...messageObj,
      });

      if (messageObj.event === "specifiedMsg") {
        const msgDataObj = JSON.parse(messageObj.data);

        if (msgDataObj.key === "re_answer") {
          this.receiveAnswer(messageObj.sdp);
        }
        if (msgDataObj.key === "offer") {
          const msgValueOPbj = JSON.parse(msgDataObj.value);

          // 接收offer
          await this.receiveOffer(msgValueOPbj.sdp);
          // 发送Answer
          await this.sendAnswer();

          // 已发送sdp相关信息
          isGetSdp = true;
          // console.log("iceCandidataArr", iceCandidataArr)
          for (const item of iceCandidataArr) {
            setIce(item);
          }
        }

        if (msgDataObj.key === "ice_candidate") {
          const msgValueOPbj = JSON.parse(msgDataObj.value);
          !isGetSdp ? iceCandidataArr.push(msgValueOPbj) : setIce(msgValueOPbj);
        }
      } else if (messageObj.event === "ownJoinRoom") {
        this.setLogTime("wsJoinRoom");
        this.callbacks.onProgress(PROGRESS_INFO.OWN_JOIN_ROOM);
      }
    };
  }

  /**
   * 静音
   */
  public muted() {
    if (this.stopOperation) return;
    this.handleMediaPlay(MEDIA_CONTROL_TYPE.AUDIO_ONLY, false);
  }

  /**
   * 取消静音
   */
  public unmuted() {
    if (this.stopOperation) return;
    const mediaType = Number(this.options.mediaType);
    const { remoteAudio } = this.socketParams;
    this.handleMediaPlay(MEDIA_CONTROL_TYPE.AUDIO_ONLY, true);

    if (mediaType === MEDIA_CONTROL_TYPE.VIDEO_ONLY) {
      remoteAudio.muted = false;
      remoteAudio.play();
    }
  }

  // 火山存在手动播放
  public startPlay() {
    if (this.stopOperation) return;
    const mediaType = Number(this.options.mediaType);
    const { remoteVideo, remoteAudio } = this.socketParams;
    if (
      [MEDIA_CONTROL_TYPE.AUDIO_VIDEO, MEDIA_CONTROL_TYPE.VIDEO_ONLY].includes(
        mediaType
      )
    ) {
      remoteVideo.play();
    }
    if (
      [MEDIA_CONTROL_TYPE.AUDIO_ONLY, MEDIA_CONTROL_TYPE.AUDIO_VIDEO].includes(
        mediaType
      )
    ) {
      remoteAudio.play();
      remoteAudio.muted = false;
    }
  }
  private sendGroupMag(msg: string) {
    this.groupRtc?.sendMessage(
      JSON.stringify({
        event: "broadcastMsg",
        data: msg,
      })
    );
  }
  /** 群控退出房间 */
  public kickItOutRoom(pads: any) {
    if (this.stopOperation) return;
    this.groupRtc?.sendMessage(
      JSON.stringify({
        event: "broadcastMsg",
        data: JSON.stringify({
          touchType: "kickOutUser",
          content: JSON.stringify(pads),
        }),
      })
    );
  }
  /** 群控加入房间 */
  public joinGroupRoom(pads: any) {
    if (this.stopOperation) return;
    const arr = pads?.filter((v: any) => v !== this.remoteUserId);
    arr.length && this.groupRtc?.joinRoom(arr);
  }
  private createWebGroupRtc(pads: any) {
    const arr = pads?.filter((v: any) => v !== this.remoteUserId);
    this.groupRtc = new webGroupRtc(this.options, arr);
  }
  /** 滚轮事件 */
  private handleVideoWheel(videoDom: HTMLVideoElement) {
    this.videoElement.bindDomEvent("wheel", (e: WheelEvent) => {
      if (this.options.disable) return;
      let { offsetX, offsetY, deltaY } = e;
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
      this.sendUserMessage(messageMousedown);
    });
  }
  /** 鼠标移出 */
  private handleVideoMouseleave() {
    this.videoElement.bindDomEvent("mouseleave", (e: MouseEvent) => {
      if (this.options.disable) return;
      // 若未按下时，不发送鼠标移动事件
      if (!this.hasPushDown) {
        return;
      }
      this.touchConfig.action = 1; // 抬起
      const message = JSON.stringify(this.touchConfig);

      this.sendUserMessage(message);
    });
  }
  /** 鼠标按下 */
  private handleVideoMousedown(
    key: string,
    isMobileFlag: boolean,
    videoDom: HTMLVideoElement
  ) {
    this.videoElement.bindDomEvent(key, (e: any) => {
      if (this.options.disable) return;
      this.hasPushDown = true;
      // 处理IOS本机键盘
      if (this.roomMessage?.inputStateIsOpen && this.inputElement) {
        this.inputElement.focus();
      } else {
        this.inputElement?.blur();
      }
      this.touchInfo = generateTouchCoord();
      const videoDomIdRect = videoDom.getBoundingClientRect();
      const distanceToTop = videoDomIdRect.top;
      const distanceToLeft = videoDomIdRect.left;
      // 初始化
      this.touchConfig.properties = [];
      this.touchConfig.coords = [];
      // 计算触摸手指数量
      const touchCount = isMobileFlag ? e?.touches?.length : 1;
      this.touchConfig.action = 0; // 按下操作
      this.touchConfig.pointCount = touchCount;
      // 手指触控节点宽高
      const bigSide =
        videoDom.clientWidth > videoDom.clientHeight
          ? videoDom.clientWidth
          : videoDom.clientHeight;
      const smallSide =
        videoDom.clientWidth > videoDom.clientHeight
          ? videoDom.clientHeight
          : videoDom.clientWidth;

      this.touchConfig.widthPixels =
        this.options.rotateType == 1 ? bigSide : smallSide;
      this.touchConfig.heightPixels =
        this.options.rotateType == 1 ? smallSide : bigSide;

      // 横屏但是远端流是竖屏（用户手动旋转屏幕）
      if (
        this.options.rotateType == 1 &&
        this.remoteResolution.height > this.remoteResolution.width
      ) {
        this.touchConfig.widthPixels = smallSide;
        this.touchConfig.heightPixels = bigSide;
      } else if (
        this.options.rotateType == 0 &&
        this.remoteResolution.width > this.remoteResolution.height
      ) {
        // 竖屏但是远端流是横屏（用户手动旋转屏幕）
        this.touchConfig.widthPixels = bigSide;
        this.touchConfig.heightPixels = smallSide;
      }

      for (let i = 0; i < touchCount; i += 1) {
        const touch = isMobileFlag ? e.touches[i] : e;
        this.touchConfig.properties[i] = {
          id: i,
          toolType: 1,
        };

        let x = touch.offsetX;
        let y = touch.offsetY;
        if (x == undefined) {
          x = touch.clientX - distanceToLeft;
          y = touch.clientY - distanceToTop;

          if (
            this.options.rotateType == 1 &&
            this.remoteResolution.height > this.remoteResolution.width
          ) {
            x = videoDomIdRect.bottom - touch.clientY;
            y = touch.clientX - distanceToLeft;
          } else if (
            this.options.rotateType == 0 &&
            this.remoteResolution.width > this.remoteResolution.height
          ) {
            x = touch.clientY - distanceToTop;
            y = videoDomIdRect.right - touch.clientX;
          }
        }

        this.touchConfig.coords.push({
          ...this.touchInfo,
          orientation: 0.01 * Math.random(),
          x: x,
          y: y,
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
      this.sendUserMessage(message);
    });
  }
  /** 鼠标移动 */
  private handleVideoMousemove(
    key: string,
    isMobileFlag: boolean,
    videoDom: HTMLVideoElement
  ) {
    this.videoElement.bindDomEvent(key, (e: any) => {
      if (this.options.disable) return;
      // 若未按下时，不发送鼠标移动事件
      if (!this.hasPushDown) {
        return;
      }
      const videoDomIdRect = videoDom.getBoundingClientRect();
      const distanceToTop = videoDomIdRect.top;
      const distanceToLeft = videoDomIdRect.left;
      // 计算触摸手指数量
      const touchCount = isMobileFlag ? e?.touches?.length : 1;
      this.touchConfig.action = 2; // 触摸中
      this.touchConfig.pointCount = touchCount;
      this.touchConfig.coords = [];
      const coords = [];
      for (let i = 0; i < touchCount; i += 1) {
        const touch = isMobileFlag ? e.touches[i] : e;
        this.touchConfig.properties[i] = {
          id: i,
          toolType: 1,
        };
        let x = touch.offsetX;
        let y = touch.offsetY;
        if (x == undefined) {
          x = touch.clientX - distanceToLeft;
          y = touch.clientY - distanceToTop;

          if (
            this.options.rotateType == 1 &&
            this.remoteResolution.height > this.remoteResolution.width
          ) {
            x = videoDomIdRect.bottom - touch.clientY;
            y = touch.clientX - distanceToLeft;
          } else if (
            this.options.rotateType == 0 &&
            this.remoteResolution.width > this.remoteResolution.height
          ) {
            x = touch.clientY - distanceToTop;
            y = videoDomIdRect.right - touch.clientX;
          }
        }
        coords.push({
          ...this.touchInfo,
          orientation: 0.01 * Math.random(),
          x: x,
          y: y,
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
      this.sendUserMessage(message);
    });
  }
  /** 鼠标结束 */
  private handleVideoMouseup(key: string, isMobileFlag: boolean) {
    this.videoElement.bindDomEvent(key, (e: any) => {
      if (this.options.disable) return;
      this.hasPushDown = false; // 按下状态重置
      this.touchConfig.action = 1;

      if (!isMobileFlag || (isMobileFlag && e.touches.length === 0)) {
        const message = JSON.stringify(this.touchConfig);
        this.sendUserMessage(message);
      }
    });
  }
  /** 加入房间 */
  public start(isGroupControl = false, pads = []) {
    if (this.stopOperation) return;
    this.isGroupControl = isGroupControl;
    this.groupPads = pads;
    this.setLogTime("joinRoom");
    this.addReportInfo({
      describe: "ws开始连接",
    });
    this.initWebSocket();

    this.remotePc.onicecandidate = (e) => {
      if (e.candidate) {
        const candidateMsg = {
          event: "specifiedMsg",
          targetUserIds: [this.remoteUserId],
          data: JSON.stringify({
            key: "ice_candidate",
            value: JSON.stringify({
              candidate: e.candidate?.candidate,
              label: e.candidate.sdpMLineIndex,
              id: e.candidate.sdpMid,
            }),
          }),
        };
        const candidateMsgStr = JSON.stringify(candidateMsg);
        this.socket.send(candidateMsgStr);
        this.callbacks.onProgress(PROGRESS_INFO.SEND_ICE);
      }
    };

    // const supportsSetCodecPreferences = window.RTCRtpTransceiver && "setCodecPreferences" in window.RTCRtpTransceiver.prototype

    // const sortByMimeTypes = (codecs, preferredOrder) => {
    //   return codecs.sort((a, b) => {
    //     const indexA = preferredOrder.indexOf(a?.mimeType)
    //     const indexB = preferredOrder.indexOf(b?.mimeType)
    //     const orderA = indexA >= 0 ? indexA : Number.MAX_VALUE
    //     const orderB = indexB >= 0 ? indexB : Number.MAX_VALUE
    //     return orderA - orderB
    //   })
    // }

    //  远端接收到流，交给video去播放
    this.remotePc.ontrack = (event) => {
      const { remoteVideo: video, remoteAudio: audio } = this.socketParams;
      const mediaType = Number(this.options.mediaType);
      switch (event?.track?.kind) {
        case "video":
          // Ép trình duyệt KHÔNG ĐƯỢC đệm video. 0 có nghĩa là render ngay lập tức xuống màn hình
          if ('receiver' in event && 'playoutDelayHint' in event.receiver) {
            (event.receiver as any).playoutDelayHint = 0;
          }
          
          // if (supportsSetCodecPreferences) {
          //   const { codecs } = RTCRtpReceiver.getCapabilities("video")
          //   const preferredCodecs = ["video/H264", "video/VP9", "video/VP8"]
          //   const sortedCodecs = sortByMimeTypes(codecs, preferredCodecs)
          //   event.transceiver.setCodecPreferences(sortedCodecs)
          // }
          // 监听事件

          const videoMediaStream = new MediaStream([event?.track]);

          video.srcObject = videoMediaStream;
          video.addEventListener("loadeddata", (event) => {
            video.play().catch((err) => {
              console.error("播放失败:", err);
              this.callbacks.onAutoplayFailed({
                userId: this.options.userId,
                kind: "video",
                message: err,
              });
            });

            this.isVideoFirstFrame = true;

            if (this.refreshUiMsgNumber > 0) {
              this.renderedFirstFrame();
            }
          });

          this.callbacks.onProgress(PROGRESS_INFO.RTC_TRACK_VIDEO);
          this.setLogTime("videoTrack");
          break;
        case "audio":
          const audioMediaStream = new MediaStream([event?.track]);

          audio.srcObject = audioMediaStream;

          audio.addEventListener("loadeddata", (event) => {
            const flag = [
              MEDIA_CONTROL_TYPE.AUDIO_ONLY,
              MEDIA_CONTROL_TYPE.AUDIO_VIDEO,
            ].includes(mediaType);
            audio.muted = !flag;
            if (flag) {
              audio.play().catch((err) => {
                console.error("播放失败:", err);
                this.callbacks.onAutoplayFailed({
                  userId: this.options.userId,
                  kind: "audio",
                  message: err,
                });
              });
            }
          });

          break;
      }
    };

    const second = Number(this.options.autoRecoveryTime);
    // 连接状态，其返回值为以下字符串之一：new、connecting、connected、disconnected、failed 或 closed。
    this.remotePc.addEventListener(
      "connectionstatechange",
      (event) => {
        switch (this.remotePc.connectionState) {
          // 正在连接
          case "new":
          case "connecting":
            this.addReportInfo({
              despise: "rtc connecting",
            });
            this.callbacks.onProgress(PROGRESS_INFO.RTC_CONNECTING);
            break;
          // 连接成功
          case "connected":
            this.addReportInfo({
              despise: "rtc connected",
            });
            this.setLogTime("rtcSuccess");
            this.triggerRecoveryTimeCallback();
            this.callbacks.onConnectSuccess();
            this.callbacks.onProgress(PROGRESS_INFO.RTC_CONNECTED);
            break;
          // 断开连接
          case "disconnected":
            console.log("disconnected", this.remoteUserId);
            this.addReportInfo({
              describe: "rtc disconnected",
            });
            this.callbacks.onConnectFail({
              code: COMMON_CODE.FAIL,
              msg: "云机连接断开",
            });
            this.sendEventReport();
            this.callbacks.onProgress(PROGRESS_INFO.RTC_DISCONNECTED);
            this.stopOperations();
            break;
          // 连接关闭
          case "closed":
            console.log("rtc closed");
            this.addReportInfo({
              describe: "rtc closed",
            });
            this.sendEventReport();
            this.callbacks.onProgress(PROGRESS_INFO.RTC_CLOSE);
            this.stopOperations();
            break;
          // 连接失败
          case "failed":
            console.log("failed", this.remoteUserId);
            this.addReportInfo({
              describe: "rtc failed",
            });
            this.callbacks.onConnectFail({
              code: COMMON_CODE.FAIL,
              msg: "云机连接失败",
            });
            this.sendEventReport();
            this.callbacks.onProgress(PROGRESS_INFO.RTC_FAILED);
            this.stopOperations();
            break;
        }
      },
      false
    );

    this.remotePc.addEventListener(
      "icecandidateerror",
      (error) => {
        error.errorCode == 701 &&
          this.addReportInfo({
            describe: "ICE协商时发生错误",
            error: handleIceError(error),
          });
      },
      false
    );

    // 添加触摸事件
    const videoDom = document.getElementById(this.videoDomId);
    if (videoDom?.style) {
      videoDom.style.width = "0px";
      videoDom.style.height = "0px";
    }

    const isMobileFlag = isTouchDevice() || isMobile();

    let eventTypeStart = "touchstart";
    let eventTypeMove = "touchmove";
    let eventTypeEnd = "touchend";

    if (!isMobileFlag) {
      // console.log("pc操作系统");
      eventTypeStart = "mousedown";
      eventTypeMove = "mousemove";
      eventTypeEnd = "mouseup";
    }

    /** 滚轮事件 */
    this.handleVideoWheel(videoDom);
    // 触摸开始
    this.handleVideoMousedown(eventTypeStart, isMobileFlag, videoDom);
    // 触摸中
    this.handleVideoMousemove(eventTypeMove, isMobileFlag, videoDom);
    // 触摸结束
    this.handleVideoMouseup(eventTypeEnd, isMobileFlag);
    // 触摸离开
    this.handleVideoMouseleave(videoDom);

    // 监听首帧画面的加载
    const videoElement = this.socketParams.remoteVideo;
    // 创建消息通道 (Unordered & Unreliable for low-latency control)
    this.dataChannel = this.remotePc.createDataChannel("dataChannel", {
      ordered: false,
      maxRetransmits: 0
    });
    // 监听通道正常打开
    this.dataChannel.onopen = () => {
      this.handleMediaPlay(this.options.mediaType, true);
      // this.waitForFirstFrameRendered(videoElement)
      // 每隔一段时间获取一次统计信息
      if (this.remotePc) {
        if (this.runInfoTimer) {
          clearInterval(this.runInfoTimer);
          this.runInfoTimer = null;
        }
        if (this.stopOperation) return;
        this.runInfoTimer = setInterval(() => {
          this.getStats();
        }, 1000);
      }

      // 查询输入状态
      this.onCheckInputState();
      this.setKeyboardStyle(this.options.keyboard);

      // 有些情况下用户收取不到UI消息，需手动触发
      const messageObj = {
        touchType: "eventSdk",
        content: JSON.stringify({
          type: "updateUiH5",
        }),
      };
      const message = JSON.stringify(messageObj);
      this.sendUserMessage(message);
      this.callbacks.onProgress(PROGRESS_INFO.RTC_CHANNEL_OPEN);
    };
    // 监听数据通道的状态变化和错误事件
    this.dataChannel.onerror = (error) => {
      console.error(
        "dataChannel error: ",
        error.errorDetail,
        error.message,
        error
      );
      clearInterval(this.runInfoTimer);
      this.addReportInfo({
        time: new Date().getTime(),
        describe: "数据通道发生错误",
        error,
      });
      this.callbacks.onErrorMessage({
        code: ERROR_CODE.DELAY,
        msg: error.message || error.name,
      });
      this.callbacks.onProgress(PROGRESS_INFO.RTC_CHANNEL_ERR);

      this.stopOperations();
    };
    this.onRoomMessageReceived();
  }

  private removeRtxFromSdp(sdp: string) {
    // Loại bỏ payload type dành cho việc truyền lại (RTX) để giảm độ trễ NACK
    let modifiedSdp = sdp.replace(/a=rtpmap:\d+ rtx\/\d+\r\n/g, "");
    modifiedSdp = modifiedSdp.replace(/a=fmtp:\d+ apt=\d+\r\n/g, "");
    return modifiedSdp;
  }

  /** 发送offer */
  private async sendOffer() {
    try {
      const offer = await this.remotePc.createOffer();
      offer.sdp = this.removeRtxFromSdp(offer.sdp);
      await this.remotePc.setLocalDescription(offer);

      this.addReportInfo({
        describe: "获取offer信息成功",
        offer,
      });
      const offerMsg = {
        event: "specifiedMsg",
        targetUserIds: [this.remoteUserId],
        data: JSON.stringify({
          key: "re_offer",
          value: JSON.stringify({
            sdp: offer.sdp,
          }),
        }),
      };
      const offerMsgStr = JSON.stringify(offerMsg);
      this.socket.send(offerMsgStr);
      this.addReportInfo({
        describe: "发送offer信息",
        offerMsg,
      });
    } catch (error) {
      this.addReportInfo({
        describe: "发送offer信息失败",
        error: handleError(error),
      });
    }
  }
  /** 接收webrtc offer */
  private async receiveOffer(offer) {
    // 建立连接，此时就会触发onicecandidate，然后注册ontrack
    const remoteSdp = {
      type: "offer",
      sdp: offer,
    };

    try {
      await this.remotePc.setRemoteDescription(remoteSdp);
      this.addReportInfo({
        describe: "设置offer信息成功",
        offer,
      });
      this.setLogTime("receivedOffer");
      this.callbacks.onProgress(PROGRESS_INFO.RECEIVE_OFFER);
    } catch (error) {
      this.addReportInfo({
        describe: "设置offer信息失败",
        error: handleError(error),
      });
      this.callbacks.onProgress(PROGRESS_INFO.RECEIVE_OFFER_ERR);
    }
  }
  /** 接收webrtc answer */
  private async receiveAnswer(answer) {
    // 建立连接，此时就会触发onicecandidate，然后注册ontrack
    const remoteSdp = {
      type: "answer",
      sdp: answer,
    };
    try {
      await this.remotePc.setRemoteDescription(remoteSdp);
      this.addReportInfo({
        describe: "设置answer信息成功",
        answer,
      });
    } catch (error) {
      this.addReportInfo({
        describe: "设置answer信息失败",
        error: handleError(error),
      });
    }
  }
  /** 发送webrtc answer */
  private async sendAnswer() {
    try {
      const answer = await this.remotePc.createAnswer();
      answer.sdp = this.removeRtxFromSdp(answer.sdp);
      await this.remotePc.setLocalDescription(answer);

      this.addReportInfo({
        describe: "获取Answer信息成功",
        answer,
      });
      const answerMsg = {
        event: "specifiedMsg",
        targetUserIds: [this.remoteUserId],
        data: JSON.stringify({
          key: "answer",
          value: JSON.stringify({
            sdp: answer.sdp,
          }),
        }),
      };
      const answerMsgStr = JSON.stringify(answerMsg);
      this.socket.send(answerMsgStr);
      this.addReportInfo({
        describe: "发送Answer信息",
        answerMsg,
      });
      this.setLogTime("sendAnswer");
      this.callbacks.onProgress(PROGRESS_INFO.SEND_ANSWER);
    } catch (error) {
      this.addReportInfo({
        describe: "发送Answer信息失败",
        error: handleError(error),
      });
      this.callbacks.onProgress(PROGRESS_INFO.SEND_ANSWER_ERR);
    }
  }

  private isFirstFrameSuccess() {
    const videoElement = this.socketParams?.remoteVideo;
    return videoElement && videoElement.currentTime > 0;
  }

  /** 第一帧加载完成 */
  private renderedFirstFrame() {
    if (this.stopOperation) return;
    this.callbacks.onRenderedFirstFrame();
    this.sendEventReport("init");
    this.callbacks.onProgress(PROGRESS_INFO.VIDEO_FIRST_FRAME);
  }
  /**
   * 订阅房间内指定的通过摄像头/麦克风采集的媒体流。
   * @param mediaType
   * @returns
   */
  subscribeStream(mediaType: MediaType) {
    return new Promise<void>((resolve) => {
      this.handleMediaPlay(mediaType, true);

      // this.renderedFirstFrame()

      resolve();
    });
  }
  public executeAdbCommand(command: string) {
    const userId = this.options.clientId;
    const message = JSON.stringify({
      touchType: "eventSdk",
      content: JSON.stringify({
        type: "inputAdb",
        content: command,
      }),
    });
    this.sendUserMessage(message, false);
  }
  /**
   * 取消订阅房间内指定的通过摄像头/麦克风采集的媒体流。
   */
  async unsubscribeStream(mediaType: MediaType) {
    this.handleMediaPlay(mediaType, false);
    return Promise.resolve();
  }
  private handleMediaPlay(mediaType: MEDIA_CONTROL_TYPE, isOpen: boolean) {
    switch (Number(mediaType)) {
      case MEDIA_CONTROL_TYPE.AUDIO_ONLY:
        this.sendUserMessage(
          this.handleSendData({
            type: "openAudio",
            isOpen,
          })
        );
        break;
      case MEDIA_CONTROL_TYPE.VIDEO_ONLY:
        this.sendUserMessage(
          this.handleSendData({
            type: "openVideo",
            isOpen,
          })
        );
        break;
      case MEDIA_CONTROL_TYPE.AUDIO_VIDEO:
        this.sendUserMessage(
          this.handleSendData({
            type: "openAudioAndVideo",
            isOpen,
          })
        );
        break;
    }
  }
  /** 等待视频首帧画面被渲染 */
  private waitForFirstFrameRendered(video) {
    if (this.stopOperation) return;
    // 1 只控制音频; 2 只控制视频; 3 同时控制音频和视频
    if (video.currentTime > 0) {
      // this.handleMediaPlay(this.options.mediaType, true)
      // switch (Number(this.options.mediaType)) {
      //   case MEDIA_CONTROL_TYPE.AUDIO_ONLY:
      //     this.sendUserMessage(
      //       this.handleSendData({
      //         type: "openVideo",
      //         isOpen: false
      //       })
      //     )
      //     this.callbacks.onAutoplayFailed({
      //       userId: this.options.userId,
      //       kind: "audio",
      //       message: "自动播放音频失败"
      //     })
      //     break
      //   case MEDIA_CONTROL_TYPE.VIDEO_ONLY:
      //     this.sendUserMessage(
      //       this.handleSendData({
      //         type: "openAudio",
      //         isOpen: false
      //       })
      //     )
      //     break
      //   case MEDIA_CONTROL_TYPE.AUDIO_VIDEO:
      //     this.callbacks.onAutoplayFailed({
      //       userId: this.options.userId,
      //       kind: "audio",
      //       message: "自动播放音频失败"
      //     })
      //     break
      //   case MEDIA_CONTROL_TYPE.NOT_AUDIO_VIDEO:
      //     this.sendUserMessage(
      //       this.handleSendData({
      //         type: "openAudioAndVideo",
      //         isOpen: false
      //       })
      //     )
      //     break
      // }

      // 首帧画面加载回调
      // this.isVideoFirstFrame = true
      // if (this.isVideoFirstFrame && this.refreshUiMsgNumber > 0) {
      //   this.renderedFirstFrame()
      // }
      if (this.isVideoFirstFrame && this.refreshUiMsgNumber <= 0) {
        this.callbacks.onProgress(PROGRESS_INFO.VIDEO_UI_NUMBER);
      }
    } else {
      // 如果currentTime仍然是0，继续请求下一帧
      !this.stopOperation &&
        requestAnimationFrame(() => {
          this.waitForFirstFrameRendered(video);
        });
    }
  }
  /** 停止所有操作 */
  private stopOperations() {
    this.stopOperation = true;
    clearTimeout(this.autoRecoveryTimer);
    clearInterval(this.runInfoTimer);
    clearInterval(this.pingTimer);
    this.autoRecoveryTimer = null;
    this.runInfoTimer = null;
    this.pingTimer = null;
    this.videoElement?.removeAllEvents();
  }
  /** 关闭所有资源 但不销毁元素 */
  private close() {
    this.stopOperations();
    // 断开webrtc
    if (this.remotePc) {
      this.remotePc
        ?.getSenders()
        ?.forEach((sender) => this.remotePc.removeTrack(sender));
      this.remotePc?.close();
      this.dataChannel?.close();
      this.remotePc = null;
      this.dataChannel = null;
    }

    // 断开ws连接
    this.socket?.close();
    this.groupRtc?.close();
    this.groupRtc = null;
    this.socket = null;

    this.audioAndVideoStream = null; // 清除引用
  }

  /** 销毁 */
  private destroy() {
    this.close();
    this.inputElement?.remove();
    this.videoElement?.destroy();
    this.socketParams?.remoteVideo?.remove();
    this.socketParams?.remoteAudio?.remove();
    this.screenShotInstance?.destroy();
    this.screenShotInstance = null;
    this.videoElement = null;
    this.socketParams = null;
    this.sendEventReport();
  }
  public stop(describe) {
    this.addReportInfo({
      describe: describe || "退出房间",
    });
    this.destroy();
  }

  /** 定期获取统计信息的函数 */
  private async getStats() {
    try {
      const stats = await this.remotePc?.getStats();
      // 丢包率
      let packetLossRate = 0;
      // 延迟
      let rtt = 0;

      stats.forEach((report) => {
        // 帧率
        if (report.type === "inbound-rtp" && report.kind === "video") {
          // Monitor pliCount (Picture Loss Indication)
          const currentPliCount = report.pliCount || 0;
          if (currentPliCount > this.lastPliCount) {
            this._trigIframeReq();
            this.lastPliCount = currentPliCount;
          }

          const framesPerSecond = report.framesPerSecond || 0;
          const message = JSON.stringify({
            content: JSON.stringify({
              framesPerSecond,
              time: new Date().getTime(),
            }),
            touchType: "rtcStats",
          });
          this.sendUserMessage(message, true);
        }

        // 处理RTT（往返时间）统计信息
        if (report.type === "candidate-pair" && report.state === "succeeded") {
          const currentRoundTripTime = report.currentRoundTripTime || 0;
          rtt = (currentRoundTripTime * 1000).toFixed(2);
        }
      });
      const remoteStreamStats = {
        userId: this.options.userId,
        audioStats: null,
        videoStats: {
          videoLossRate: packetLossRate, // 视频丢包率
          rtt, // 客户端到服务端数据传输的往返时延，单位：ms
          statsInterval: 5000, // 统计间隔。此次统计周期的间隔，单位为 ms 。
        },
      };
      this.callbacks.onRunInformation(remoteStreamStats);
    } catch (error) {
      console.error("获取统计信息时出错:", error);
      this.callbacks.onErrorMessage({
        code: ERROR_CODE.DATA_CHANNEL,
        msg: error.message || error.name,
      });
    }
  }

  /** 浏览器是否支持 */
  public isSupported() {
    const support = {
      RTCPeerConnection: typeof RTCPeerConnection !== "undefined",
      RTCDataChannel: typeof RTCDataChannel !== "undefined",
      RTCIceCandidate: typeof RTCIceCandidate !== "undefined",
      RTCSessionDescription: typeof RTCSessionDescription !== "undefined",
    };
    return support.RTCPeerConnection && support.RTCDataChannel;
  }

  /** 触发无操作回收回调函数 */
  private triggerRecoveryTimeCallback() {
    if (this.options.disable || !this.options.autoRecoveryTime) return;
    if (this.autoRecoveryTimer) {
      clearTimeout(this.autoRecoveryTimer);
      this.autoRecoveryTimer = null;
    }
    if (this.stopOperation) return;
    this.autoRecoveryTimer = setTimeout(() => {
      this.addReportInfo({
        describe: "无操作回收",
      });
      this.destroy();
      this.callbacks.onAutoRecoveryTime();
    }, this.options.autoRecoveryTime * 1000);
  }

  /** 发送消息 */
  async sendUserMessage(message: string, notRecycling = false) {
    if (!this.stopOperation) {
      // 重置无操作回收定时器
      if (!notRecycling) {
        this.sendGroupMag(message);
        this.triggerRecoveryTimeCallback();
      }
      if (this.dataChannel) await this.dataChannel?.send(message);
    }
  }
  public setMicrophone(val: boolean) {
    if (this.stopOperation) return;
    this.enableMicrophone = val;
  }
  public setCamera(val: boolean) {
    if (this.stopOperation) return;
    this.enableCamera = val;
  }
  /** 监听广播消息 */
  private onRoomMessageReceived() {
    let soundRecordCount = 0;
    this.remotePc.ondatachannel = (event) => {
      // 成功拿到 RTCDataChannel
      const dataChannel = event.channel;
      const run = (msgString) => {
        const msg = JSON.parse(msgString || "{}");
        if (["videoAndAudioControl", "audioControl"].includes(msg.key)) {
          const { isOpen } = JSON.parse(msg.data) || {};

          if (isOpen) {
            this.captureAudioAndVideo().then(() => {
              !soundRecordCount &&
                this.sendOffer().then(() => {
                  soundRecordCount++;
                });
            });
            return;
          }
          this.pauseAudioAndVideoMedia();
        }
        // 消息透传
        if (msg.key === "message") {
          this.callbacks.onTransparentMsg(0, msg.data);
        }
        if (msg.key === "inputAdb") {
          this.callbacks?.onAdbOutput(JSON.parse(msg.data || {}));
        }
        if (msg.key === "equipmentInfo") {
          this.callbacks?.onEquipmentInfo(JSON.parse(msg.data || []));
        }
        // ui消息
        if (msg.key === "refreshUiType") {
          const msgData = JSON.parse(msg.data);
          // 若宽高没变，则不重新绘制页面
          if (
            msgData.width == this.remoteResolution.width &&
            msgData.height == this.remoteResolution.height
          ) {
            return false;
          }

          if (this.isVideoFirstFrame && this.refreshUiMsgNumber <= 0) {
            this.callbacks.onProgress(PROGRESS_INFO.VIDEO_UI_NUMBER);
          }

          this.roomMessage.isVertical = msgData.isVertical;

          this.callbacks.onChangeResolution(msgData.width, msgData.height);
          // 储存云机分辨率
          this.remoteResolution.width = msgData.width;
          this.remoteResolution.height = msgData.height;

          // 移动端需要强制竖屏
          if (isTouchDevice() || isMobile()) {
            this.options.rotateType = 0;
          }

          const { rotateType } = this.options;
          // 0 为竖屏，1 为横屏
          let targetRotateType;

          // 判断是否为 0 或 1
          if (rotateType == 0 || rotateType == 1) {
            targetRotateType = rotateType;
          } else {
            // 根据宽高自动设置旋转类型，
            targetRotateType = msgData.width > msgData.height ? 1 : 0;
          }

          this.rotateScreen(targetRotateType);

          this.refreshUiMsgNumber++;
          // 只有在初次渲染的ui的时候，才把流交给video去播放
          if (this.isVideoFirstFrame) {
            this.renderedFirstFrame();
          }
        }
        // 云机、本机键盘使用消息
        if (msg.key === "inputState" && this.inputElement) {
          const msgData = JSON.parse(msg.data);
          this.roomMessage.inputStateIsOpen = msgData.isOpen;

          // 设置回车按钮文案
          const enterkeyhintText = this.enterkeyhintObj[msgData.imeOptions];
          this.inputElement.setAttribute("enterkeyhint", enterkeyhintText);
          // 若存在inputElement，则判断当前本机键盘是否打开
          if (!msgData.isOpen) {
            // 若关闭，则失焦
            this.inputElement.blur();
          } else {
            setTimeout(() => {
              this.inputElement.focus();
            }, 0);
          }
        }
        // 将云机内容复制到本机剪切板
        if (msg.key === "clipboard") {
          if (this.options.saveCloudClipboard) {
            const msgData = JSON.parse(msg.data);
            this.callbacks.onOutputClipper(msgData);
          }
        }
      };
      dataChannel.onmessage = (e) => {
        if (e.data) {
          switch (checkType(e.data)) {
            case "ArrayBuffer":
              run(arrayBufferToText(e.data));
              break;
            case "Blob":
              blobToText(e.data).then((res) => {
                run(res);
              });
              break;
            default:
              run(e.data);
              break;
          }
        }
      };
    };
  }

  /**
   * 将字符串发送到云手机的粘贴板中
   * @param inputStr 需要发送的字符串
   */
  public async sendInputClipper(inputStr: string) {
    if (this.stopOperation) return;
    const message = JSON.stringify({
      text: inputStr,
      touchType: "clipboard",
    });
    await this.sendUserMessage(message);
  }
  /** 群控剪切板 */
  public sendGroupInputClipper(pads: any, strs: any) {
    if (this.stopOperation) return;
    strs?.map((v: string, index: number) => {
      const message = JSON.stringify({
        text: v,
        pads: [pads[index]],
        touchType: "clipboard",
      });
      this.groupRtc?.sendMessage(
        JSON.stringify({
          event: "broadcastMsg",
          data: message,
        })
      );
    });
  }
  /** 按顺序发送文本框 */
  public sendGroupInputString(pads: any, strs: any) {
    strs?.map((v: string, index: number) => {
      const message = JSON.stringify({
        text: v,
        pads: [pads[index]],
        touchType: "inputBox",
      });
      this.groupRtc?.sendMessage(
        JSON.stringify({
          event: "broadcastMsg",
          data: message,
        })
      );
    });
  }
  /**
   * 当云手机处于输入状态时，将字符串直接发送到云手机，完成输入
   * @param inputStr 需要发送的字符串
   */
  public async sendInputString(inputStr: string) {
    if (this.stopOperation) return;
    const message = JSON.stringify({
      text: inputStr,
      touchType: "inputBox",
    });
    await this.sendUserMessage(message);
  }

  /**
   * 发送摇一摇信息
   */
  public sendShakeInfo(time) {
    if (this.stopOperation) return;
    const shake = new Shake();
    shake.startShakeSimulation(time, (content) => {
      const getOptions = (sensorType) => {
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
      this.sendUserMessage(getOptions("gyroscope"));
      this.sendUserMessage(getOptions("gravity"));
      this.sendUserMessage(getOptions("acceleration"));
    });
  }
  /** 清晰度切换 */
  public setStreamConfig(config: CustomDefinition) {
    if (this.stopOperation) return;
    const regExp = /^[1-9]\d*$/;
    // 判断字段是否缺失
    if (config.definitionId && config.framerateId && config.bitrateId) {
      const values = Object.values(config);
      // 判断输入值是否为正整数
      if (values.every((value) => regExp.test(value))) {
        if (
          config.definitionId >= 7 &&
          config.definitionId <= 20 &&
          config.framerateId >= 1 &&
          config.framerateId <= 9 &&
          config.bitrateId >= 1 &&
          config.bitrateId <= 15
        ) {
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
          // const userId = this.options.clientId;
          const message = JSON.stringify(messageObj);
          this.sendUserMessage(message);
        }
      }
    }
  }
  private handleSendData(options) {
    const messageObj = {
      touchType: "eventSdk",
      content: JSON.stringify(options),
    };
    return JSON.stringify(messageObj);
  }
  /**
   * 暂停接收来自远端的媒体流
   * 该方法仅暂停远端流的接收，并不影响远端流的采集和发送。
   * @param mediaType 1 只控制音频; 2 只控制视频; 3 同时控制音频和视频
   */
  public pauseAllSubscribedStream(mediaType: number = 3) {
    // 重置无操作回收定时器
    this.triggerRecoveryTimeCallback();
    this.handleMediaPlay(mediaType, false);
  }

  /**
   * 恢复接收来自远端的媒体流
   * 该方法仅恢复远端流的接收，并不影响远端流的采集和发送。
   * @param mediaType 1 只控制音频; 2 只控制视频; 3 同时控制音频和视频
   */
  public resumeAllSubscribedStream(mediaType: number = 3) {
    // 重置无操作回收定时器
    this.triggerRecoveryTimeCallback();
    this.handleMediaPlay(mediaType, true);
  }

  /** 截图-保存到本地 */
  public saveScreenShotToLocal() {
    if (this.stopOperation) return;
    return new Promise((resolve, reject) => {
      try {
        const video = document.getElementById(this.remoteVideoId);
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(imageData);
      } catch (error) {
        reject(error);
      }
    });
  }

  /** 截图-保存到云机 */
  public saveScreenShotToRemote() {
    if (this.stopOperation) return;
    const contentObj = {
      type: "localScreenshot",
    };
    const messageObj = {
      touchType: "eventSdk",
      content: JSON.stringify(contentObj),
    };
    // const userId = this.options.clientId;
    const message = JSON.stringify(messageObj);
    this.sendUserMessage(message);
  }

  /**
   * 手动横竖屏：0竖屏，1横屏
   * 对标百度API
   */
  public setPhoneRotation(type: number) {
    if (this.stopOperation) return;
    this.triggerRecoveryTimeCallback();
    this.rotateScreen(type);
  }

  /**
   * 旋转屏幕
   * @param type 横竖屏：0竖屏，1横屏
   */
  public rotateScreen(type: number) {
    this.options.rotateType = type;
    // 获取父元素（调用方）的原始宽度和高度，这里要重新获取，因为外层的div可能宽高发生变化
    const h5Dom = document.getElementById(this.initDomId)!;
    let parentWidth = h5Dom?.clientWidth;
    let parentHeight = h5Dom?.clientHeight;

    let bigSide = parentHeight;
    let smallSide = parentWidth;
    if (parentWidth > parentHeight) {
      bigSide = parentWidth;
      smallSide = parentHeight;
    }

    if (type == 1) {
      parentWidth = bigSide;
      parentHeight = smallSide;
    } else {
      parentWidth = smallSide;
      parentHeight = bigSide;
    }

    h5Dom.style.width = parentWidth + "px";
    h5Dom.style.height = parentHeight + "px";

    // 判断视频的宽高方向
    // video 是否是横屏
    const videoIsLandscape =
      this.remoteResolution.width > this.remoteResolution.height;

    // 判断当前界面中的video宽高方向
    const videoWrapperDom = document.getElementById(
      this.remoteVideoContainerId
    )! as HTMLDivElement;
    let videoWrapperWidth = videoWrapperDom.clientWidth;
    let videoWrapperHeight = videoWrapperDom.clientHeight;

    // 外层 div
    let armcloudVideoWidth = 0;
    let armcloudVideoHeight = 0;
    // 旋转角度
    let videoWrapperRotate = 0;
    let videoWrapperTop = 0;
    let videoWrapperLeft = 0;

    if (type == 1) {
      // 横屏
      const w = videoIsLandscape
        ? this.remoteResolution.width
        : this.remoteResolution.height;
      const h = videoIsLandscape
        ? this.remoteResolution.height
        : this.remoteResolution.width;

      const scale = Math.min(parentWidth / w, parentHeight / h);
      armcloudVideoWidth = w * scale;
      armcloudVideoHeight = h * scale;

      videoWrapperWidth = armcloudVideoWidth;
      videoWrapperHeight = armcloudVideoHeight;

      // 顺时针旋转视频90度
      if (!videoIsLandscape) {
        videoWrapperRotate = -90;
        videoWrapperTop = (armcloudVideoHeight - armcloudVideoWidth) / 2;
        videoWrapperLeft = (armcloudVideoWidth - armcloudVideoHeight) / 2;
        videoWrapperWidth = armcloudVideoHeight;
        videoWrapperHeight = armcloudVideoWidth;
      } else {
        videoWrapperRotate = 0;
        videoWrapperTop = 0;
        videoWrapperLeft = 0;
      }
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

      videoWrapperWidth = videoIsLandscape
        ? armcloudVideoHeight
        : armcloudVideoWidth;
      videoWrapperHeight = videoIsLandscape
        ? armcloudVideoWidth
        : armcloudVideoHeight;
      videoWrapperRotate = videoIsLandscape ? 90 : 0;
      videoWrapperTop = videoIsLandscape
        ? (armcloudVideoHeight - armcloudVideoWidth) / 2
        : 0;
      videoWrapperLeft = videoIsLandscape
        ? (armcloudVideoWidth - armcloudVideoHeight) / 2
        : 0;
    }

    // armcloudVideo
    const videoDom = document.getElementById(this.videoDomId)!;
    videoDom.style.width = `${armcloudVideoWidth}px`;
    videoDom.style.height = `${armcloudVideoHeight}px`;

    videoWrapperDom.style.width = `${videoWrapperWidth}px`;
    videoWrapperDom.style.height = `${videoWrapperHeight}px`;
    videoWrapperDom.style.top = `${videoWrapperTop}px`;
    videoWrapperDom.style.left = `${videoWrapperLeft}px`;
    videoWrapperDom.style.transform = `rotate(${videoWrapperRotate}deg)`;

    this.callbacks.onChangeRotate(type);
  }

  /** 手动定位 */
  public setGPS(longitude: number, latitude: number) {
    if (this.stopOperation) return;
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
    const message = JSON.stringify(messageObj);
    this.sendUserMessage(message);
  }

  /** 云机/本地键盘切换(false-云机键盘，true-本地键盘) */
  public setKeyboardStyle(keyBoardType: string) {
    if (this.stopOperation) return;
    const contentObj = {
      type: "keyBoardType",
      isLocalKeyBoard: keyBoardType === "local",
    };
    const messageObj = {
      touchType: "eventSdk",
      content: JSON.stringify(contentObj),
    };
    // const userId = this.options.clientId;
    const message = JSON.stringify(messageObj);
    this.sendUserMessage(message);
  }

  /** 查询输入状态 */
  public async onCheckInputState() {
    if (this.stopOperation) return;
    const message = JSON.stringify({
      touchType: "inputState",
    });
    this.sendUserMessage(message);
  }

  /**
   * 设置无操作回收时间
   * @param second 秒 默认300s,最大7200s
   */
  public setAutoRecycleTime(second: number) {
    if (this.stopOperation) return;
    // 设置过期时间，单位为毫秒
    this.options.autoRecoveryTime = second;
    // 定时器，当指定时间内无操作时执行离开房间操作
    this.triggerRecoveryTimeCallback();
  }

  /** 获取无操作回收时间 */
  public getAutoRecycleTime() {
    if (this.stopOperation) return;
    return this.options.autoRecoveryTime;
  }

  /** 底部栏操作按键 */
  public sendCommand(command: string) {
    if (this.stopOperation) return;
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
  private goAppUpPage() {
    const messageObj = {
      action: 1,
      touchType: "keystroke",
      keyCode: 4,
      text: "",
    };
    const userId = this.options.clientId;
    const message = JSON.stringify(messageObj);
    if (userId) {
      // 抬起
      this.sendUserMessage(message);
    }
  }

  /** 主页按键事件 */
  private goAppHome() {
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
      this.sendUserMessage(message);
    }
  }

  /** 菜单按键事件 */
  private goAppMenu() {
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
      this.sendUserMessage(message);
    }
  }

  /** 音量增加按键事件 */
  public increaseVolume() {
    if (this.stopOperation) return;
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
      this.sendUserMessage(message);
    }
  }

  /** 音量减少按键事件 */
  public decreaseVolume() {
    if (this.stopOperation) return;
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
      this.sendUserMessage(message);
    }
  }

  /**
   * 是否接收粘贴板内容回调
   * @param flag true:接收 false:不接收
   */
  public saveCloudClipboard(flag: boolean) {
    if (this.stopOperation) return;
    this.options.saveCloudClipboard = flag;
  }
}

export default WebRTC;
