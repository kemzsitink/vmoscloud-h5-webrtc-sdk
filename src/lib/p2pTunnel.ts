import { Pact } from "./pact";

/**
 * P2P Direct Tunneling (Đục lỗ mạng)
 * 
 * Lớp này quản lý việc thiết lập kết nối trực tiếp giữa Client và Cloud Phone
 * nếu phát hiện cả hai có thể "nhìn thấy" nhau (cùng subnet hoặc STUN thành công).
 * 
 * Bypass SDK: Khi kích hoạt, luồng dữ liệu sẽ bắn thẳng từ Device -> Browser
 * mà không qua các cụm Gateway/Relay của Volcengine.
 */
export default class P2pTunnel {
    private pc: RTCPeerConnection | null = null;
    private isDirect: boolean = false;

    constructor() {
        console.log("[P2P Tunnel] Khởi tạo bộ đục lỗ mạng P2P.");
    }

    /**
     * Kiểm tra khả năng đục lỗ mạng
     * Nếu loại ứng viên ICE là 'host' hoặc 'srflx', chúng ta có một đường P2P.
     */
    public detectP2PCapability(pc: RTCPeerConnection): Pact<boolean> {
        return new Pact((resolve) => {
            pc.getStats().then((stats) => {
                let directPossible = false;
                stats.forEach((report) => {
                    if (report.type === 'remote-candidate') {
                        // host: cùng mạng nội bộ, srflx: STUN thành công (P2P qua NAT)
                        if (report.candidateType === 'host' || report.candidateType === 'srflx') {
                            directPossible = true;
                        }
                    }
                });
                
                if (directPossible && !this.isDirect) {
                    this.isDirect = true;
                    console.log("[P2P Tunnel] Đục lỗ mạng thành công! Đang chuyển sang chế độ Direct Tunneling.");
                }
                resolve(this.isDirect);
            });
        });
    }

    /**
     * Kích hoạt chế độ P2P(t)
     * Khi ở chế độ này, chúng ta có thể cấu hình lại Bitrate và Buffer 
     * ở mức tối giản vì không còn trễ do Relay Server.
     */
    public optimizeForDirectPath(pc: RTCPeerConnection) {
        if (!this.isDirect) return;

        // Tối ưu hoá giới hạn băng thông cho đường truyền trực tiếp
        const senders = pc.getSenders();
        senders.forEach(sender => {
            if (sender.track?.kind === 'video') {
                const parameters = sender.getParameters();
                if (parameters.encodings && parameters.encodings.length > 0) {
                    // P2P cho phép Bitrate cao hơn và không cần bù trễ mạnh
                    parameters.encodings[0].maxBitrate = 8000000; // 8Mbps cho P2P
                    sender.setParameters(parameters);
                }
            }
        });
    }

    public reset() {
        this.isDirect = false;
    }
}
