import { Pact } from "./pact";

export type FrameDecodedCallback = (frame: VideoFrame) => void;

let onFrameDecoded: FrameDecodedCallback | null = null;
let globalUseWebCodecs = false;

interface RTCRtpReceiverWithStreams extends RTCRtpReceiver {
    __webcodecsSetupDone?: boolean;
    createEncodedStreams?: () => { readable: ReadableStream; writable: WritableStream };
}

interface RTCEncodedVideoFrame {
    type: 'key' | 'delta' | 'empty';
    timestamp: number;
    data: ArrayBuffer;
}

export const setWebCodecsFrameCallback = (cb: FrameDecodedCallback | null) => {
    onFrameDecoded = cb;
};

export const enableWebCodecsPipeline = () => {
    globalUseWebCodecs = true;
};

/**
 * MASTER PROTOTYPE PATCH
 * Ghi đè ở cấp độ thấp nhất của trình duyệt để đảm bảo "hứng" được luồng 
 * ngay cả khi SDK của bên thứ 3 (Volcengine) gọi trước.
 */
if (typeof window !== 'undefined' && window.RTCRtpReceiver && !((window.RTCRtpReceiver.prototype as any).__isMonkeyPatched)) {
    const proto = window.RTCRtpReceiver.prototype as any;
    const originalCreateEncodedStreams = proto.createEncodedStreams;

    if (typeof originalCreateEncodedStreams === 'function') {
        proto.createEncodedStreams = function() {
            const originalStreams = originalCreateEncodedStreams.apply(this, arguments);
            
            // Nếu không phải video hoặc không bật WebCodecs, trả về nguyên bản
            if (!globalUseWebCodecs || this.track?.kind !== 'video') {
                return originalStreams;
            }

            // Kỹ thuật Phân thân luồng (Teeing):
            // Nhân bản readable stream thành 2 nhánh độc lập để tránh lỗi "Locked Stream"
            const [sdkStream, myStream] = originalStreams.readable.tee();
            
            setupWebCodecsDecoderWithStreams(this, { 
                readable: myStream, 
                writable: originalStreams.writable 
            });

            // Trả về nhánh sdkStream cho Volcengine SDK
            return {
                readable: sdkStream,
                writable: originalStreams.writable
            };
        };
    }
    proto.__isMonkeyPatched = true;
    console.log("[WebCodecs] RTCRtpReceiver Prototype patched.");
}

// Patch RTCPeerConnection để kích hoạt tính năng Insertable Streams
if (typeof window !== 'undefined' && window.RTCPeerConnection && !((window.RTCPeerConnection as any).__isMonkeyPatched)) {
    const OriginalPC = window.RTCPeerConnection;
    const CustomPC = function(config: any) {
        if (config) config.encodedInsertableStreams = true;
        else config = { encodedInsertableStreams: true };
        return new OriginalPC(config);
    } as any;
    CustomPC.prototype = OriginalPC.prototype;
    Object.assign(CustomPC, OriginalPC);
    window.RTCPeerConnection = CustomPC;
    (window.RTCPeerConnection as any).__isMonkeyPatched = true;
}

function setupWebCodecsDecoderWithStreams(receiver: any, streams: { readable: ReadableStream, writable: WritableStream }) {
    if (receiver.__webcodecsSetupDone) return;
    receiver.__webcodecsSetupDone = true;

    // Khởi tạo Decode Worker (Thread Offloading)
    const decodeWorkerCode = `
        let decoder = null;
        let dropUntilKeyframe = false;
        let nullWaitCount = 0;
        const FPS_THRESHOLD = 15;

        self.onmessage = (event) => {
            const { type, payload } = event.data;
            if (type === 'init') {
                decoder = new VideoDecoder({
                    output: (frame) => {
                        self.postMessage({ type: 'frame', frame }, [frame]);
                        // Giai đoạn Nâng (Step Up): Theo dõi nhịp rỗng
                        if (decoder.decodeQueueSize === 0) {
                            nullWaitCount++;
                            if (nullWaitCount > FPS_THRESHOLD) {
                                self.postMessage({ type: 'trend', status: 'IDLE' });
                                nullWaitCount = 0;
                            }
                        } else {
                            nullWaitCount = 0;
                        }
                    },
                    error: (e) => console.error("[Worker] Decode error:", e)
                });
                decoder.configure({ codec: 'avc1.42E01F', hardwareAcceleration: 'prefer-hardware' });
            } else if (type === 'chunk') {
                if (!decoder) return;
                
                // Giai đoạn Hạ (Step Down): Phát hiện bùng nổ độ trễ
                if (decoder.decodeQueueSize >= FPS_THRESHOLD) {
                    self.postMessage({ type: 'trend', status: 'STRESS' });
                    decoder.reset();
                    decoder.configure({ codec: 'avc1.42E01F', hardwareAcceleration: 'prefer-hardware' });
                    dropUntilKeyframe = true;
                }
                
                if (dropUntilKeyframe) {
                    if (payload.type === 'key') dropUntilKeyframe = false;
                    else return;
                }
                decoder.decode(new EncodedVideoChunk({
                    type: payload.type,
                    timestamp: payload.timestamp,
                    data: payload.data
                }));
            }
        };
    `;

    const worker = new Worker(URL.createObjectURL(new Blob([decodeWorkerCode], { type: 'application/javascript' })));
    worker.postMessage({ type: 'init' });
    worker.onmessage = (e) => {
        if (e.data.type === 'frame' && onFrameDecoded) {
            onFrameDecoded(e.data.frame);
        } else if (e.data.type === 'trend') {
            // Chuyển tín hiệu xu hướng về Main Thread để thực hiện jumpFrameProc
            if ((window as any).__jumpFrameProc) {
                (window as any).__jumpFrameProc(e.data.status);
            }
        } else if (e.data.frame) {
            e.data.frame.close();
        }
    };

    // Đọc luồng dữ liệu thô và ném vào Worker
    const reader = streams.readable.getReader();
    const readLoop = async () => {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const buffer = value.data.slice(0);
                worker.postMessage({
                    type: 'chunk',
                    payload: { type: value.type, timestamp: value.timestamp, data: buffer }
                }, [buffer]);
            }
        } catch (e) { console.error("[WebCodecs] Read error:", e); }
    };
    readLoop();
}
