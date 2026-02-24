export interface CloudCoreConfig {
    appId: string;
    roomCode: string;
    roomToken: string;
    clientId: string;
    userId: string;
    expirationTime?: number;
    selfAdaption?: string | number;
    mediaType?: string | number;
    rotateType?: number;
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
    rotateType?: number;
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
    rotateType?: number;
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
    rotateType?: number;
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
    onInit: (...args: unknown[]) => void;
    onConnectSuccess: (...args: unknown[]) => void;
    onConnectFail: (...args: unknown[]) => void;
    onConnectionStateChanged: (...args: unknown[]) => void;
    onAutoplayFailed: (...args: unknown[]) => void;
    onRunInformation: (...args: unknown[]) => void;
    onNetworkQuality: (...args: unknown[]) => void;
    onAutoRecoveryTime: (...args: unknown[]) => void;
    onErrorMessage: (...args: unknown[]) => void;
    onUserLeave: (...args: unknown[]) => void;
    onSendUserError: (...args: unknown[]) => void;
    onGroupControlError: (...args: unknown[]) => void;
    onChangeResolution: (...args: unknown[]) => void;
    onChangeRotate: (...args: unknown[]) => void;
    onTransparentMsg: (...args: unknown[]) => void;
    onOutputClipper: (...args: unknown[]) => void;
    onRenderedFirstFrame: (...args: unknown[]) => void;
    onVideoInit: (...args: unknown[]) => void;
    onVideoError: (...args: unknown[]) => void;
    onAudioInit: (...args: unknown[]) => void;
    onAudioError: (...args: unknown[]) => void;
    onProgress: (...args: unknown[]) => void;
    onSocketCallback: (...args: unknown[]) => void;
    onUserLeaveOrJoin: (...args: unknown[]) => void;
    onEquipmentInfo: (...args: unknown[]) => void;
    onAdbOutput: (...args: unknown[]) => void;
    onInjectVideoResult: (...args: unknown[]) => void;
    onMessage: (...args: unknown[]) => void;
    onRotationChanged: (...args: unknown[]) => void;
    onRemoteVideoSizeChanged: (...args: unknown[]) => void;
    onFirstFrame: (...args: unknown[]) => void;
    [key: string]: ((...args: unknown[]) => void) | undefined;
}

/** Room message data */
export interface RoomMessage {
    inputStateIsOpen?: boolean;
    [key: string]: unknown;
}

/** Report error info entry */
export interface ReportEntry {
    type: string;
    time: number;
    timeDiff: number;
    info: { describe: string; error?: unknown; res?: unknown };
}

/** Interface for RTC instance consumed by textInput */
export interface RTCInstance {
    initDomId: string;
    inputElement: HTMLInputElement | undefined;
    options: RTCOptions;
    remoteUserId: string;
    roomMessage: RoomMessage;
    masterIdPrefix?: string;
    sendUserMessage: (userId: string, message: string, notSendInGroups?: boolean) => Promise<unknown>;
}
