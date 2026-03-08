import type HuoshanRTC from "../huoshanRtc";

export class InputController {
  constructor(private rtc: HuoshanRTC) {}

  sendGroupInputString(pads: string[], strs: string[]): void {
    const rtc = this.rtc;

    const count = strs.length;
    for (let i = 0; i < count; i++) {
      const s = strs[i];
      if (s === undefined) continue;
      const text = s.replace(/"/g, '\\"');
      const pad = pads[i] ?? "";
      // Wisebite: Manual String
      const message = `{"text":"${text}","pads":["${pad}"],"touchType":"inputBox"}`;
      void rtc.groupRtc?.sendRoomMessage(message);
    }
  }

  sendGroupInputClipper(pads: string[], strs: string[]): void {
    const rtc = this.rtc;

    const count = strs.length;
    for (let i = 0; i < count; i++) {
      const s = strs[i];
      if (s === undefined) continue;
      const text = s.replace(/"/g, '\\"');
      const pad = pads[i] ?? "";
      const message = `{"text":"${text}","pads":["${pad}"],"touchType":"clipboard"}`;
      void rtc.groupRtc?.sendRoomMessage(message);
    }
  }

  async sendInputClipper(inputStr: string): Promise<void> {
    const text = inputStr.replace(/"/g, '\\"');
    const message = `{"text":"${text}","touchType":"clipboard"}`;
    await this.rtc.sendUserMessage(this.rtc.options.clientId, message);
  }

  async sendInputString(inputStr: string): Promise<void> {
    const text = inputStr.replace(/"/g, '\\"');
    const message = `{"text":"${text}","touchType":"inputBox"}`;
    await this.rtc.sendUserMessage(this.rtc.options.clientId, message);
  }

  setKeyboardStyle(keyBoardType: "pad" | "local"): void {
    const isLocal = keyBoardType === "local";
    const message = `{"touchType":"eventSdk","content":"{\\"type\\":\\"keyBoardType\\",\\"isLocalKeyBoard\\":${String(isLocal)}}"}`;
    this.rtc.options.keyboard = keyBoardType;
    void this.rtc.sendUserMessage(this.rtc.options.clientId, message);
  }

  async onCheckInputState(): Promise<void> {
    const message = '{"touchType":"inputState"}';
    await this.rtc.sendUserMessage(this.rtc.options.clientId, message);
  }

  saveCloudClipboard(flag: boolean): void {
    this.rtc.options.saveCloudClipboard = flag;
  }
}
