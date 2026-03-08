import VERTC, { type IRTCEngine } from '../vendor/volcengine-rtc'
import type { RTCOptions, SDKCallbacks } from '../core/types'

interface GroupEngineOptions {
    roomCode: string
    roomToken: string
    userId: string
    resolve: (value: { engine: IRTCEngine; result: object | undefined }) => void
    reject: (reason?: Error) => void
}

interface UserInfo {
    userId?: string
}

interface ShareTokenPayload {
    appId: string
    roomCode: string
    roomToken: string
}

interface ShareTokenResponse {
    data: ShareTokenPayload
}

interface JoinRoomResponse {
    data: ShareTokenResponse
}

interface GroupUserMessage {
    key?: string
}

class huoshanGroupRtc {
    private engine: IRTCEngine | null = null
    private params: RTCOptions
    private pads: string[] = []
    private callbacks: SDKCallbacks
    private abortControllers: AbortController[] = []

    constructor(params: RTCOptions, pads: string[], callbacks: SDKCallbacks) {
        this.params = params
        this.pads = pads
        this.callbacks = callbacks
    }

    close(): void {
        this.abortControllers.forEach((v: AbortController) => {
            v.abort()
        })
        this.abortControllers = []
    }

    async joinRoom(pads: string[]): Promise<JoinRoomResponse> {
        const controller = new AbortController()
        this.abortControllers.push(controller)

        const { baseUrl } = this.params
        const base = baseUrl
            ? `${baseUrl}/rtc/open/room/sdk/share/applyToken`
            : `https://openapi.armcloud.net/rtc/open/room/sdk/share/applyToken`

        const { userId, uuid, token, manageToken } = this.params
        const url = manageToken ? '/manage/rtc/room/share/applyToken' : base
        const tok = manageToken || token

        try {
            const response = await fetch(url, {
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
                    pads: pads.map((v: string) => {
                        return {
                            padCode: v,
                            videoStream: {
                                resolution: 7,
                                frameRate: 5,
                                bitrate: 13,
                            },
                            userId,
                        }
                    }),
                }),
                signal: controller.signal,
            })
            const data = (await response.json()) as ShareTokenResponse
            return { data }
        } catch (error) {
            if (error instanceof Error) {
                throw error
            }
            throw new Error('Join group room failed')
        }
    }

    async getEngine(): Promise<{ engine: IRTCEngine; result: object | undefined }> {
        return new Promise<{ engine: IRTCEngine; result: object | undefined }>((resolve, reject) => {
            this.joinRoom(this.pads)
                .then((res: JoinRoomResponse) => {
                    const { userId } = this.params
                    const { appId, roomCode, roomToken } = res.data.data
                    this.engine = VERTC.createEngine(appId)

                    void this.createEngine({
                        roomCode,
                        roomToken,
                        userId,
                        resolve,
                        reject,
                    })
                })
                .catch(() => {
                    const error = new Error('Get Token Error') as Error & { code: string }
                    error.code = 'TOKEN_ERR'
                    reject(error)
                })
        })
    }

    async sendUserMessage(userId: string, message?: string): Promise<object | undefined> {
        const result = await this.engine?.sendUserMessage(userId, message ?? '')
        return typeof result === 'object' && result !== null ? result : undefined
    }

    async sendRoomMessage(message: string): Promise<object | undefined> {
        const result = (await this.engine?.sendRoomMessage(message)) as object | undefined
        return typeof result === 'object' ? result : undefined
    }

    getMsgTemplate(touchType: string, content: object): string {
        return JSON.stringify({
            touchType,
            content: JSON.stringify(content),
        })
    }

    onUserJoined(): void {
        this.engine?.on(VERTC.events.onUserJoined, (user: { userInfo?: UserInfo }) => {
            this.callbacks.onUserLeaveOrJoin({
                type: 'join',
                userInfo: user.userInfo,
            })
        })
    }

    onUserMessageReceived(): void {
        const onUserMessageReceived = (e: { userId: string; message: string }): void => {
            if (!e.message) return
            const msg = JSON.parse(e.message) as GroupUserMessage
            if (msg.key === 'userjoin') {
                void this.sendRoomMessage(
                    this.getMsgTemplate('openGroupControl', {
                        pads: this.pads,
                    })
                )
                void this.sendUserMessage(
                    e.userId,
                    this.getMsgTemplate('openGroupControl', { isOpen: true })
                )
            }
        }
        this.engine?.on(VERTC.events.onUserMessageReceived, onUserMessageReceived)
    }

    onUserLeave(): void {
        this.engine?.on(VERTC.events.onUserLeave, (user: { userInfo?: UserInfo }) => {
            this.callbacks.onUserLeaveOrJoin({
                type: 'leave',
                userInfo: user.userInfo,
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
            void this.sendRoomMessage(
                this.getMsgTemplate('openGroupControl', {
                    pads: this.pads,
                })
            )

            if (!this.engine) {
                reject(new Error('Group engine not initialized'))
                return
            }

            resolve({
                engine: this.engine,
                result: typeof res === 'object' ? res : undefined,
            })
        } catch (error) {
            reject(error instanceof Error ? error : new Error('Create group engine failed'))
        }
    }
}
export default huoshanGroupRtc
