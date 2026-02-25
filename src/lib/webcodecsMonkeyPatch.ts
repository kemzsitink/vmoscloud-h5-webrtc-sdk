export type FrameDecodedCallback = (frame: VideoFrame) => void;

let onFrameDecoded: FrameDecodedCallback | null = null;
let globalUseWebCodecs = false;

interface RTCConfigurationWithStreams extends RTCConfiguration {
    encodedInsertableStreams?: boolean;
}

interface RTCRtpReceiverWithStreams extends RTCRtpReceiver {
    createEncodedStreams: () => { readable: ReadableStream; writable: WritableStream };
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

type PatchedRTCPeerConnection = typeof RTCPeerConnection & {
    __isMonkeyPatched?: boolean;
};

// Tự động Monkey-patch ngay khi load file (tránh việc Volcengine SDK cache mất RTCPeerConnection gốc)
if (typeof window !== 'undefined' && window.RTCPeerConnection && !(window.RTCPeerConnection as PatchedRTCPeerConnection).__isMonkeyPatched) {
    const OriginalRTCPeerConnection = window.RTCPeerConnection;
    
    const CustomRTCPeerConnection = function(config?: RTCConfigurationWithStreams) {
        let enhancedConfig = config;
        if (enhancedConfig) {
            enhancedConfig.encodedInsertableStreams = true;
        } else {
            enhancedConfig = { encodedInsertableStreams: true };
        }
        const pc = new OriginalRTCPeerConnection(enhancedConfig);
        
        pc.addEventListener('track', (event: RTCTrackEvent) => {
            if (globalUseWebCodecs && event.track.kind === 'video') {
                setupWebCodecsDecoder(event.receiver as unknown as RTCRtpReceiverWithStreams);
            }
        });
        
        return pc;
    } as unknown as PatchedRTCPeerConnection;
    
    Object.assign(CustomRTCPeerConnection, OriginalRTCPeerConnection);
    CustomRTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
    CustomRTCPeerConnection.__isMonkeyPatched = true;
    
    window.RTCPeerConnection = CustomRTCPeerConnection;
    console.log("[WebCodecs] RTCPeerConnection monkey-patched at load time.");
}

function setupWebCodecsDecoder(receiver: RTCRtpReceiverWithStreams) {
    if (!('VideoDecoder' in window)) {
        console.warn("[WebCodecs] VideoDecoder API is not supported in this browser. Falling back to native WebRTC.");
        return;
    }

    const decoder = new VideoDecoder({
        output: (frame) => {
            if (onFrameDecoded) {
                onFrameDecoded(frame);
            } else {
                frame.close(); // Prevent memory leak if no callback
            }
        },
        error: (e) => {
            console.error("[WebCodecs] Decoding error:", e);
        }
    });

    // Configure for H264. The decoder will adapt based on the SPS/PPS in the bitstream.
    decoder.configure({
        codec: 'avc1.42E01F', // Baseline profile fallback
        hardwareAcceleration: 'prefer-hardware'
    });

    if (typeof receiver.createEncodedStreams !== 'function') {
        console.warn("[WebCodecs] Browser does not support createEncodedStreams on RTCRtpReceiver.");
        return;
    }

    const streams = receiver.createEncodedStreams();
    const reader = streams.readable.getReader();
    
    const readLoop = async () => {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const frameValue = value as RTCEncodedVideoFrame;
                const chunk = new EncodedVideoChunk({
                    type: frameValue.type === 'key' ? 'key' : 'delta',
                    timestamp: frameValue.timestamp,
                    data: frameValue.data
                });
                
                decoder.decode(chunk);
                
                // Note: We deliberately do NOT pipe to streams.writable. 
                // This forces WebCodecs to be the ONLY decoder, bypassing the browser's native `<video>` decoding loop to save CPU/GPU overhead.
            }
        } catch (e) {
            console.error("[WebCodecs] Error reading encoded streams:", e);
        }
    };
    
    readLoop();
}
