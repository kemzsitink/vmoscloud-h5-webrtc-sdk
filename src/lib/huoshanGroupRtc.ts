import VERTC, { type IRTCEngine } from '@volcengine/rtc'
import type { RTCOptions, SDKCallbacks } from './type'

interface UserInfo {
    userId?: string
}

class huoshanGroupRtc {
    private engine: IRTCEngine | null = null
    private params: RTCOptions
    private pads: Array<string> = []
    private callbacks: SDKCallbacks
    private abortControllers: Set<AbortController> = new Set()

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
        this.abortControllers.clear()

        if (this.engine) {
            this.engine.leaveRoom()
            VERTC.destroyEngine(this.engine)
            this.engine = null
        }
    }

    joinRoom(pads: string[]): Promise<unknown> {
        const controller = new AbortController() // 创建一个取消令牌
        this.abortControllers.add(controller)
        return new Promise<unknown>((resolve, reject) => {
            const { baseUrl, userId, uuid, token, manageToken } = this.params

            const baseDomain = baseUrl || 'https://openapi.armcloud.net'
            const path = manageToken ? '/manage/rtc/room/share/applyToken' : '/rtc/open/room/sdk/share/applyToken'
            const url = `${baseDomain}${path}`
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
                            videoStream: this.params.videoStream || {
                                resolution: 7, // 分辨率
                                frameRate: 5, // 帧率 (Enum/ID)
                                bitrate: 13, // 码率 (Enum/ID)
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
                .finally(() => {
                    this.abortControllers.delete(controller)
                })
        })
    }

    async getEngine(): Promise<{ engine: IRTCEngine; result: unknown }> {
        try {
            const res = await this.joinRoom(this.pads)
            const { userId } = this.params
            const resData = res as { data: { data: { appId: string; roomCode: string; roomToken: string } } }
            const { appId, roomCode, roomToken } = resData?.data?.data || {}
            
            this.engine = VERTC.createEngine(appId)

            const result = await this.engine.joinRoom(
                roomToken,
                roomCode,
                { userId },
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

            return { engine: this.engine, result }
        } catch (error: unknown) {
            const err = new Error('Get Token Error') as Error & { code: string }
            err.code = 'TOKEN_ERR'
            throw err
        }
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
                try {
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
                } catch (err) {
                    console.error('Failed to parse user message:', err)
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
}
export default huoshanGroupRtc
