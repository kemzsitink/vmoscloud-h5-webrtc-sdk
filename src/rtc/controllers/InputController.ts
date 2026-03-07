import type HuoshanRTC from "../huoshanRtc";

export class InputController {
  constructor(private rtc: HuoshanRTC) {}

  sendGroupInputString(pads: string[], strs: string[]): void {
    const rtc = this.rtc;
    if (!strs || !pads) return;
    
    const count = strs.length;
    for (let i = 0; i < count; i++) {
      const s = strs[i];
      if (s === undefined) continue;
      const text = s.replace(/"/g, '\\"');
      const pad = pads[i];
      // Wisebite: Manual String
      const message = `{"text":"${text}","pads":["${pad}"],"touchType":"inputBox"}`;
      rtc.groupRtc?.sendRoomMessage(message);
    }
  }

  sendGroupInputClipper(pads: string[], strs: string[]): void {
    const rtc = this.rtc;
    if (!strs || !pads) return;

    const count = strs.length;
    for (let i = 0; i < count; i++) {
      const s = strs[i];
      if (s === undefined) continue;
      const text = s.replace(/"/g, '\\"');
      const pad = pads[i];
      const message = `{"text":"${text}","pads":["${pad}"],"touchType":"clipboard"}`;
      rtc.groupRtc?.sendRoomMessage(message);
    }
  }

  async sendInputClipper(inputStr: string) {
    const text = inputStr.replace(/"/g, '\\"');
    const message = `{"text":"${text}","touchType":"clipboard"}`;
    await this.rtc.sendUserMessage(this.rtc.options.clientId, message);
  }

  async sendInputString(inputStr: string) {
    const text = inputStr.replace(/"/g, '\\"');
    const message = `{"text":"${text}","touchType":"inputBox"}`;
    await this.rtc.sendUserMessage(this.rtc.options.clientId, message);
  }

  setKeyboardStyle(keyBoardType: "pad" | "local") {
    const isLocal = keyBoardType === "local";
    const message = `{"touchType":"eventSdk","content":"{\\"type\\":\\"keyBoardType\\",\\"isLocalKeyBoard\\":${isLocal}}"}`;
    this.rtc.options.keyboard = keyBoardType;
    this.rtc.sendUserMessage(this.rtc.options.clientId, message);
  }

  async onCheckInputState() {
    const message = '{"touchType":"inputState"}';
    await this.rtc.sendUserMessage(this.rtc.options.clientId, message);
  }

  saveCloudClipboard(flag: boolean) {
    this.rtc.options.saveCloudClipboard = flag;
  }
}
