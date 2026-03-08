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

export interface SDKInitResult {
    code: number;
    msg?: string | undefined;
    streamType?: number | null | undefined;
}

export interface SDKConnectFailResult {
    code?: number | undefined;
    msg: string;
}

export interface SDKGroupControlError {
    code?: string | undefined;
    msg: string;
}

export interface SDKChangeRotateSize {
    width: number;
    height: number;
}

export interface SDKResolution {
    width: number;
    height: number;
}

export interface SDKChangeResolutionResult {
    from: SDKResolution;
    to: SDKResolution;
}

export interface SDKUserLeaveOrJoinResult {
    type: "join" | "leave";
    userInfo?: object | undefined;
}

export interface SDKRunInformation {
    latencyInfo?: {
        rtt?: number;
        e2eDelay?: number;
        jitterBufferDelay?: number;
    };
    [key: string]: CallbackArg;
}

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
    onInit: (result: SDKInitResult) => void;
    onConnectSuccess: () => void;
    onConnectFail: (result: SDKConnectFailResult) => void;
    onConnectionStateChanged: (event: object) => void;
    onAutoplayFailed: (event: object) => void;
    onRunInformation: (info: SDKRunInformation) => void;
    onNetworkQuality: (uplinkNetworkQuality: number, downlinkNetworkQuality: number) => void;
    onAutoRecoveryTime: () => void;
    onErrorMessage: (error: CallbackArg) => void;
    onUserLeave: (result: object) => void;
    onSendUserError: (error: Error) => void;
    onGroupControlError: (result: SDKGroupControlError) => void;
    onChangeResolution: (result: SDKChangeResolutionResult) => void;
    onChangeRotate: (type: number, size: SDKChangeRotateSize) => void;
    onTransparentMsg: (msgType: number, data: string) => void;
    onOutputClipper: (data: object) => void;
    onRenderedFirstFrame: () => void;
    onVideoInit: (result: object) => void;
    onVideoError: (error: Error) => void;
    onAudioInit: (result: object) => void;
    onAudioError: (error: Error) => void;
    onProgress: (data: CallbackArg) => void;
    onSocketCallback: (data: CallbackArg) => void;
    onUserLeaveOrJoin: (result: SDKUserLeaveOrJoinResult) => void;
    onEquipmentInfo: (data: object[]) => void;
    onAdbOutput: (data: object) => void;
    onInjectVideoResult: (type: string, result: object) => void;
    onMessage: (data: CallbackArg) => void;
    onRotationChanged: (data: CallbackArg) => void;
    onRemoteVideoSizeChanged: (data: CallbackArg) => void;
    onFirstFrame: (data: CallbackArg) => void;
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
