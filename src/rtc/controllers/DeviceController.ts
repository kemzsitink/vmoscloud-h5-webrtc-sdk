import type HuoshanRTC from "../huoshanRtc";
import Shake from "../../features/shake";

export class DeviceController {
  constructor(private rtc: HuoshanRTC) {}

  getEquipmentInfo(type: "app" | "attr"): void {
    const msg = `{"touchType":"equipmentInfo","content":"{\\"type\\":\\"${type}\\"}"}`;
    void this.rtc.sendUserMessage(this.rtc.options.clientId, msg, true);
  }

  appUnInstall(pkgNames: string[]): void {
    // Tối ưu hóa: Nối chuỗi mảng pkgNames
    const pkgStr = `["${pkgNames.join('","')}"]`;
    const msg = `{"touchType":"appUnInstall","content":${pkgStr}}`;
    void this.rtc.sendUserMessage(this.rtc.options.clientId, msg, true);
  }

  sendShakeInfo(time: number): void {
    const rtc = this.rtc;
    const userId = rtc.options.clientId;
    const shake = new Shake();
    
    shake.startShakeSimulation(time, (content: { x: number; y: number; z: number }) => {
      // Wisebite: Nối chuỗi cực nhanh cho dữ liệu sensor (tần suất cực cao)
      const buildSensorMsg = (sensorType: string): string => {
        const innerContent = `{\\"x\\":${String(content.x)},\\"y\\":${String(content.y)},\\"z\\":${String(content.z)},\\"type\\":\\"sdkSensor\\",\\"sensorType\\":\\"${sensorType}\\"}`;
        return `{"coords":[],"heightPixels":0,"isOpenScreenFollowRotation":false,"keyCode":0,"pointCount":0,"properties":[],"text":"","touchType":"eventSdk","widthPixels":0,"action":0,"content":"${innerContent}"}`;
      };
      
      void rtc.sendUserMessage(userId, buildSensorMsg("gyroscope"));
      void rtc.sendUserMessage(userId, buildSensorMsg("gravity"));
      void rtc.sendUserMessage(userId, buildSensorMsg("acceleration"));
    });
  }

  setGPS(longitude: number, latitude: number): void {
    const now = Date.now();
    const inner = `{\\"latitude\\":${String(latitude)},\\"longitude\\":${String(longitude)},\\"time\\":${String(now)}}`;
    const msg = `{"touchType":"eventSdk","content":"{\\"type\\":\\"sdkLocation\\",\\"content\\":\\"${inner}\\"}"}`;
    void this.rtc.sendUserMessage(this.rtc.options.clientId, msg);
  }

  executeAdbCommand(command: string): void {
    const cmd = command.replace(/"/g, '\\"');
    const msg = `{"touchType":"eventSdk","content":"{\\"type\\":\\"inputAdb\\",\\"content\\":\\"${cmd}\\"}"}`;
    void this.rtc.sendUserMessage(this.rtc.options.clientId, msg);
  }

  sendCommand(command: string): void {
    if (command === "back") this.goAppUpPage();
    else if (command === "home") this.goAppHome();
    else if (command === "menu") this.goAppMenu();
  }

  goAppUpPage(): void {
    const msg = '{"action":0,"touchType":"keystroke","keyCode":4,"text":""}';
    void this.rtc.sendUserMessage(this.rtc.options.clientId, msg);
  }

  goAppHome(): void {
    const msg = '{"action":1,"touchType":"keystroke","keyCode":3,"text":""}';
    void this.rtc.sendUserMessage(this.rtc.options.clientId, msg);
  }

  goAppMenu(): void {
    const msg = '{"action":1,"touchType":"keystroke","keyCode":187,"text":""}';
    void this.rtc.sendUserMessage(this.rtc.options.clientId, msg);
  }

  increaseVolume(): void {
    this.rtc.startPlay();
    const msg = '{"action":1,"touchType":"keystroke","keyCode":24,"text":""}';
    void this.rtc.sendUserMessage(this.rtc.options.clientId, msg, true);
  }

  decreaseVolume(): void {
    this.rtc.startPlay();
    const msg = '{"action":1,"touchType":"keystroke","keyCode":25,"text":""}';
    void this.rtc.sendUserMessage(this.rtc.options.clientId, msg, true);
  }
}
