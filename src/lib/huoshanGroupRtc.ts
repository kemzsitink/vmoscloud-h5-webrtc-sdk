import VERTC, { type IRTCEngine } from '@volcengine/rtc'
import type { RTCOptions, SDKCallbacks } from './type'

interface GroupEngineOptions {
    roomCode: string
    roomToken: string
    userId: string
    resolve: (value: { engine: IRTCEngine; result: unknown }) => void
    reject: (reason?: unknown) => void
}

interface UserInfo {
    userId?: string
}

class huoshanGroupRtc {
    private engine: IRTCEngine | null = null
    private params: RTCOptions
    private pads: Array<string> = []
    private callbacks: SDKCallbacks
    private abortControllers: AbortController[] = []

    constructor(params: RTCOptions, pads: Array<string>, callbacks: SDKCallbacks) {
        this.params = params
        this.pads = pads
        this.callbacks = callbacks
    }

    // 关闭 WebSocket 连接
    close(): void {
        this.abortControllers?.forEach((v: AbortController) => {
            v.abort()
        })
        this.abortControllers = []
    }

    joinRoom(pads: string[]): Promise<unknown> {
        const controller = new AbortController() // 创建一个取消令牌
        this.abortControllers.push(controller)
        return new Promise<unknown>((resolve, reject) => {
            const { baseUrl } = this.params

            const base = baseUrl
                ? `${baseUrl}/rtc/open/room/sdk/share/applyToken`
                : `https://openapi.armcloud.net/rtc/open/room/sdk/share/applyToken`
            const { userId, uuid, token, manageToken } = this.params
            const url = manageToken ? '/manage/rtc/room/share/applyToken' : base
            const tok = manageToken || token
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(manageToken ? { Authorization: tok } : { token: tok }),
                },
                body: JSON.stringify({
                    userId,
                    uuid,
                    terminal: 'h5',
                    expire: 360000,
                    pushPublicStream: false,
                    pads: pads?.map((v: string) => {
                        return {
                            padCode: v,
                            videoStream: {
                                resolution: 7, // 分辨率
                                frameRate: 5, // 帧率
                                bitrate: 13, // 码率
                            },
                            userId,
                        }
                    }),
                }),
                signal: controller.signal,
            })
                .then((response) => response.json())
                .then((data) => {
                    resolve({ data })
                })
                .catch((error: Error) => {
                    if (error.name === 'AbortError') {
                        return
                    }
                    reject(error)
                })
        })
    }

    async getEngine(): Promise<{ engine: IRTCEngine; result: unknown }> {
        return new Promise<{ engine: IRTCEngine; result: unknown }>((resolve, reject) => {
            this.joinRoom(this.pads)
                .then((res: unknown) => {
                    const { userId } = this.params
                    const resData = res as { data: { data: { appId: string; roomCode: string; roomToken: string } } }
                    const { appId, roomCode, roomToken } = resData?.data?.data || {}
                    this.engine = VERTC.createEngine(appId)

                    this.createEngine({
                        roomCode,
                        roomToken,
                        userId,
                        resolve,
                        reject,
                    })
                })
                .catch((_err: unknown) => {
                    const error = new Error('Get Token Error') as Error & { code: string }
                    error.code = 'TOKEN_ERR'
                    reject(error)
                })
        })
    }

    async sendUserMessage(userId: string, message?: string): Promise<unknown> {
        return await this?.engine?.sendUserMessage(userId, message ?? '')
    }

    async sendRoomMessage(message: string): Promise<unknown> {
        return await this?.engine?.sendRoomMessage(message)
    }

    getMsgTemplate(touchType: string, content: object): string {
        return JSON.stringify({
            touchType,
            content: JSON.stringify(content),
        })
    }

    /** 远端可见用户加入房间 */
    onUserJoined(): void {
        this?.engine?.on(VERTC.events.onUserJoined, (user: { userInfo?: UserInfo }) => {
            this.callbacks.onUserLeaveOrJoin({
                type: 'join',
                userInfo: user?.userInfo,
            })
        })
    }

    /** 监听 onUserMessageReceived 事件 */
    onUserMessageReceived(): void {
        const onUserMessageReceived = (e: { userId: string; message: string }) => {
            if (e.message) {
                const msg = JSON.parse(e.message)
                if (msg.key === 'userjoin') {
                    this.sendRoomMessage(
                        this.getMsgTemplate('openGroupControl', {
                            pads: this.pads,
                        })
                    )
                    this.sendUserMessage(
                        e.userId,
                        this.getMsgTemplate('openGroupControl', { isOpen: true })
                    )
                }
            }
        }
        this.engine?.on(VERTC.events.onUserMessageReceived, onUserMessageReceived)
    }

    /** 远端可见用户加离开房间 */
    onUserLeave(): void {
        this?.engine?.on(VERTC.events.onUserLeave, (user: { userInfo?: UserInfo }) => {
            this.callbacks.onUserLeaveOrJoin({
                type: 'leave',
                userInfo: user?.userInfo,
            })
        })
    }

    async createEngine(options: GroupEngineOptions): Promise<void> {
        const { roomToken, roomCode, userId, resolve, reject } = options
        try {
            const res = await this.engine?.joinRoom(
                roomToken,
                roomCode,
                {
                    userId,
                },
                {
                    isAutoPublish: false,
                    isAutoSubscribeAudio: false,
                    isAutoSubscribeVideo: false,
                }
            )
            this.onUserJoined()
            this.onUserLeave()
            this.onUserMessageReceived()
            this.sendRoomMessage(
                this.getMsgTemplate('openGroupControl', {
                    pads: this.pads,
                })
            )

            resolve({
                engine: this.engine!,
                result: res,
            })
        } catch (error) {
            reject(error)
        }
    }
}
export default huoshanGroupRtc
