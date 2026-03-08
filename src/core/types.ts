export interface CloudCoreConfig {
    appId: string;
    roomCode: string;
    roomToken: string;
    clientId: string;
    userId: string;
    expirationTime?: number;
    selfAdaption?: string | number;
    mediaType?: string | number;
    rotateType?: number | undefined;
    definition?: string | number;
    useLocalKeyboard?: boolean;
    allowCopyRemoteToLocal?: boolean;
}

export interface TouchConfig {
    action: number | string;
    widthPixels: number;
    heightPixels: number;
    pointCount: number;
    touchType: string;
    properties: PropertiesInfo[];
    coords: CoordsInfo[];
}

interface PropertiesInfo {
    id: number;
    toolType: number;
}

export interface CoordsInfo {
    mPackedAxisValues?: number[];
    orientation?: number;
    pressure: number;
    size: number;
    x: number;
    y: number;
}

export interface CustomDefinition {
    definitionId: number | null;
    framerateId: number | null;
    bitrateId: number | null;
}

export interface PositionOption {
    accuracy?: number | null;
    altitude?: number | null;
    latitude: number | null;
    longitude: number | null;
    speed?: number | null;
    time?: number | null;
}

export type CallbackArg = string | number | boolean | null | undefined | object;
export type RTCResult = undefined | string | number | boolean | null | object;
export type RTCRecord = Record<string, CallbackArg>;

// ========== SDK Interfaces ==========

/** Video stream config */
export interface VideoStreamConfig {
    resolution: number;
    frameRate: number;
    bitrate: number;
}

/** Device info from user init params */
export interface DeviceInfo {
    padCode: string;
    userId: string;
    videoStream?: Partial<VideoStreamConfig>;
    allowLocalIMEInCloud?: boolean;
    autoRecoveryTime?: number;
    isFullScreen?: number;
    mediaType?: number;
    rotateType?: number | undefined;
    keyboard?: string;
    disableContextMenu?: boolean;
    saveCloudClipboard?: boolean;
    videoDeviceId?: string;
    audioDeviceId?: string;
}

/** SDK initialization parameters from user */
export interface SDKInitParams {
    baseUrl: string;
    token: string;
    viewId: string;
    deviceInfo: DeviceInfo;
    callbacks: Partial<SDKCallbacks>;
    enableMicrophone?: boolean;
    enableCamera?: boolean;
    videoDeviceId?: string;
    audioDeviceId?: string;
    mediaType?: number;
    rotateType?: number | undefined;
    disable?: boolean;
    autoRecoveryTime?: number;
    disableContextMenu?: boolean;
    customDefinition?: CustomDefinition;
    selfAdaption?: string | number;
    keyboard?: string;
    allowLocalIMEInCloud?: boolean;
    allowCopyRemoteToLocal?: boolean;
    masterIdPrefix?: string;
    retryCount?: number;
    retryTime?: number;
    isLog?: boolean;
    isWsProxy?: string;
    manageToken?: string;
    latencyTarget?: number;
}

/** RTC connection options passed to HuoshanRTC */
export interface RTCOptions {
    uuid: string;
    appId: string;
    roomCode: string;
    roomToken: string;
    userId: string;
    clientId: string;
    padCode: string;
    masterIdPrefix: string;
    mediaType: number;
    baseUrl: string;
    isLog: boolean;
    disable: boolean;
    autoRecoveryTime: number;
    enableMicrophone: boolean;
    enableCamera: boolean;
    videoDeviceId: string;
    audioDeviceId: string;
    disableContextMenu: boolean;
    allowLocalIMEInCloud: boolean;
    keyboard: string;
    signalServer?: string;
    stuns?: string;
    turns?: string;
    token: string;
    retryCount: number;
    retryTime: number;
    isWsProxy: boolean;
    manageToken: string;
    videoStream: VideoStreamConfig;
    isFullScreen: number;
    rotateType?: number | undefined;
    saveCloudClipboard: boolean;
    latencyTarget?: number;
}

/** Log time tracking */
export interface LogTime {
    tokenResStart: number | null;
    tokenResEnd: number | null;
    joinRoom: number | null;
    wsSuccess: number | null;
    receivedOffer: number | null;
    sendAnswer: number | null;
    wsJoinRoom: number | null;
    rtcSuccess: number | null;
    reconnectSuccess: number | null;
    videoTrack: number | null;
    [key: string]: number | null;
}

/** SDK callback functions */
export interface SDKCallbacks {
    onInit: (...args: CallbackArg[]) => void;
    onConnectSuccess: (...args: CallbackArg[]) => void;
    onConnectFail: (...args: CallbackArg[]) => void;
    onConnectionStateChanged: (...args: CallbackArg[]) => void;
    onAutoplayFailed: (...args: CallbackArg[]) => void;
    onRunInformation: (...args: CallbackArg[]) => void;
    onNetworkQuality: (...args: CallbackArg[]) => void;
    onAutoRecoveryTime: (...args: CallbackArg[]) => void;
    onErrorMessage: (...args: CallbackArg[]) => void;
    onUserLeave: (...args: CallbackArg[]) => void;
    onSendUserError: (...args: CallbackArg[]) => void;
    onGroupControlError: (...args: CallbackArg[]) => void;
    onChangeResolution: (...args: CallbackArg[]) => void;
    onChangeRotate: (...args: CallbackArg[]) => void;
    onTransparentMsg: (...args: CallbackArg[]) => void;
    onOutputClipper: (...args: CallbackArg[]) => void;
    onRenderedFirstFrame: (...args: CallbackArg[]) => void;
    onVideoInit: (...args: CallbackArg[]) => void;
    onVideoError: (...args: CallbackArg[]) => void;
    onAudioInit: (...args: CallbackArg[]) => void;
    onAudioError: (...args: CallbackArg[]) => void;
    onProgress: (...args: CallbackArg[]) => void;
    onSocketCallback: (...args: CallbackArg[]) => void;
    onUserLeaveOrJoin: (...args: CallbackArg[]) => void;
    onEquipmentInfo: (...args: CallbackArg[]) => void;
    onAdbOutput: (...args: CallbackArg[]) => void;
    onInjectVideoResult: (...args: CallbackArg[]) => void;
    onMessage: (...args: CallbackArg[]) => void;
    onRotationChanged: (...args: CallbackArg[]) => void;
    onRemoteVideoSizeChanged: (...args: CallbackArg[]) => void;
    onFirstFrame: (...args: CallbackArg[]) => void;
    [key: string]: ((...args: CallbackArg[]) => void) | undefined;
}

/** Room message data */
export interface RoomMessage {
    inputStateIsOpen?: boolean;
    [key: string]: CallbackArg;
}

/** Report error info entry */
export interface ReportEntry {
    type: string;
    time: number;
    timeDiff: number;
    info: { describe: string; error?: CallbackArg; res?: CallbackArg };
}

/** Interface for RTC instance consumed by textInput */
export interface RTCInstance {
    initDomId: string;
    inputElement: HTMLInputElement | undefined;
    options: RTCOptions;
    remoteUserId: string;
    roomMessage: RoomMessage;
    masterIdPrefix?: string;
    sendUserMessage: (userId: string, message: string, notSendInGroups?: boolean) => Promise<RTCResult>;
}
