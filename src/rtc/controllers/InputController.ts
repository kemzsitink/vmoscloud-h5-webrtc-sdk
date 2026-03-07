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
      const message = JSON.stringify({
        text: s,
        pads: [pads[i]],
        touchType: "inputBox",
      });
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
      const message = JSON.stringify({
        text: s,
        pads: [pads[i]],
        touchType: "clipboard",
      });
      rtc.groupRtc?.sendRoomMessage(message);
    }
  }

  async sendInputClipper(inputStr: string) {
    const userId = this.rtc.options.clientId;
    const message = JSON.stringify({
      text: inputStr,
      touchType: "clipboard",
    });
    await this.rtc.sendUserMessage(userId, message);
  }

  async sendInputString(inputStr: string) {
    const userId = this.rtc.options.clientId;
    const message = JSON.stringify({
      text: inputStr,
      touchType: "inputBox",
    });
    await this.rtc.sendUserMessage(userId, message);
  }

  setKeyboardStyle(keyBoardType: "pad" | "local") {
    const contentObj = {
      type: "keyBoardType",
      isLocalKeyBoard: keyBoardType === "local",
    };
    const messageObj = {
      touchType: "eventSdk",
      content: JSON.stringify(contentObj),
    };
    const userId = this.rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    this.rtc.options.keyboard = keyBoardType;
    this.rtc.sendUserMessage(userId, message);
  }

  async onCheckInputState() {
    const userId = this.rtc.options.clientId;
    const message = JSON.stringify({
      touchType: "inputState",
    });
    await this.rtc.sendUserMessage(userId, message);
  }

  saveCloudClipboard(flag: boolean) {
    this.rtc.options.saveCloudClipboard = flag;
  }
}
