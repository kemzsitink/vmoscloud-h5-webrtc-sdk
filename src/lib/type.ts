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
interface CoordsInfo {
    mPackedAxisValues?: any;
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
export {};
