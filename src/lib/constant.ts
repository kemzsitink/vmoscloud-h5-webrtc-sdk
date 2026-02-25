export const COMMON_CODE = {
  SUCCESS: 0,
  FAIL: -1,
  CLOSE: 1,
} as const;

export const ERROR_CODE = {
  DATA_CHANNEL: 0, // 通道中断
  DELAY: 1, // 获取统计信息时出错 延迟丢包率
} as const;

export const LOG_TYPE = {
  SUCCESS: 1,
  FAIL: 0,
} as const;

export const MEDIA_CONTROL_TYPE = {
  // 音频
  AUDIO_ONLY: 1,
  // 视频
  VIDEO_ONLY: 2,
  // 音视频
  AUDIO_VIDEO: 3,
} as const;

export const MEDIA_VOICE_TYPE = {
  // 音频
  AUDIO: 1,
  // 视频
  VIDEO: 2,
  // 音视频
  AUDIO_VIDEO: 3,
} as const;

export const PROGRESS_INFO = {
  WS_CONNECT: {
    code: 100,
    msg: "WS开始连接",
  },
  WS_SUCCESS: {
    code: 101,
    msg: "WS连接成功",
  },
  WS_CLOSE: {
    code: 102,
    msg: "WS连接关闭",
  },
  WS_ERROR: {
    code: 103,
    msg: "WS连接出错",
  },
  WS_RETRY: {
    code: 104,
    msg: "WS重连中",
  },
  OWN_JOIN_ROOM: {
    code: 200,
    msg: "收到加入房间信息",
  },
  RTC_CONNECTING: {
    code: 300,
    msg: "RTC正在连接",
  },
  RTC_CONNECTED: {
    code: 301,
    msg: "RTC连接成功",
  },
  RTC_DISCONNECTED: {
    code: 302,
    msg: "RTC断开连接",
  },
  RTC_CLOSE: {
    code: 303,
    msg: "RTC连接关闭",
  },
  RTC_FAILED: {
    code: 304,
    msg: "RTC连接失败",
  },
  RTC_TRACK_VIDEO: {
    code: 305,
    msg: "RTC接收VIDEO流",
  },
  RTC_TRACK_VIDEO_LOAD: {
    code: 306,
    msg: "RTC接收VIDEO流后在VIDEO中加载成功",
  },
  RTC_CHANNEL_OPEN: {
    code: 307,
    msg: "RTC消息通道连接成功",
  },
  RTC_CHANNEL_ERR: {
    code: 308,
    msg: "RTC消息通道连接失败",
  },
  VIDEO_UI_NUMBER: {
    code: 309,
    msg: "VIDEO加载成功但未收到云机的UI信息",
  },
  VIDEO_FIRST_FRAME: {
    code: 310,
    msg: "VIDEO第一帧渲染成功",
  },
  RECOVERY_TIMEOUT: {
    code: 400,
    msg: "无操作超时，已自动回收",
  },
} as const;
