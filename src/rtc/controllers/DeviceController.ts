import type HuoshanRTC from "../huoshanRtc";
import Shake from "../../features/shake";

export class DeviceController {
  constructor(private rtc: HuoshanRTC) {}

  getEquipmentInfo(type: "app" | "attr") {
    const msg = `{"touchType":"equipmentInfo","content":"{\\"type\\":\\"${type}\\"}"}`;
    this.rtc.sendUserMessage(this.rtc.options.clientId, msg, true);
  }

  appUnInstall(pkgNames: string[]) {
    // Tối ưu hóa: Nối chuỗi mảng pkgNames
    const pkgStr = `["${pkgNames.join('","')}"]`;
    const msg = `{"touchType":"appUnInstall","content":${pkgStr}}`;
    this.rtc.sendUserMessage(this.rtc.options.clientId, msg, true);
  }

  sendShakeInfo(time: number): void {
    const rtc = this.rtc;
    const userId = rtc.options.clientId;
    const shake = new Shake();
    
    shake.startShakeSimulation(time, (content: any) => {
      // Wisebite: Nối chuỗi cực nhanh cho dữ liệu sensor (tần suất cực cao)
      const buildSensorMsg = (sensorType: string) => {
        const innerContent = `{\\"x\\":${content.x},\\"y\\":${content.y},\\"z\\":${content.z},\\"type\\":\\"sdkSensor\\",\\"sensorType\\":\\"${sensorType}\\"}`;
        return `{"coords":[],"heightPixels":0,"isOpenScreenFollowRotation":false,"keyCode":0,"pointCount":0,"properties":[],"text":"","touchType":"eventSdk","widthPixels":0,"action":0,"content":"${innerContent}"}`;
      };
      
      rtc.sendUserMessage(userId, buildSensorMsg("gyroscope"));
      rtc.sendUserMessage(userId, buildSensorMsg("gravity"));
      rtc.sendUserMessage(userId, buildSensorMsg("acceleration"));
    });
  }

  setGPS(longitude: number, latitude: number) {
    const now = Date.now();
    const inner = `{\\"latitude\\":${latitude},\\"longitude\\":${longitude},\\"time\\":${now}}`;
    const msg = `{"touchType":"eventSdk","content":"{\\"type\\":\\"sdkLocation\\",\\"content\\":\\"${inner}\\"}"}`;
    this.rtc.sendUserMessage(this.rtc.options.clientId, msg);
  }

  executeAdbCommand(command: string) {
    const cmd = command.replace(/"/g, '\\"');
    const msg = `{"touchType":"eventSdk","content":"{\\"type\\":\\"inputAdb\\",\\"content\\":\\"${cmd}\\"}"}`;
    this.rtc.sendUserMessage(this.rtc.options.clientId, msg);
  }

  sendCommand(command: string) {
    if (command === "back") this.goAppUpPage();
    else if (command === "home") this.goAppHome();
    else if (command === "menu") this.goAppMenu();
  }

  goAppUpPage() {
    const msg = '{"action":0,"touchType":"keystroke","keyCode":4,"text":""}';
    this.rtc.sendUserMessage(this.rtc.options.clientId, msg);
  }

  goAppHome() {
    const msg = '{"action":1,"touchType":"keystroke","keyCode":3,"text":""}';
    this.rtc.sendUserMessage(this.rtc.options.clientId, msg);
  }

  goAppMenu() {
    const msg = '{"action":1,"touchType":"keystroke","keyCode":187,"text":""}';
    this.rtc.sendUserMessage(this.rtc.options.clientId, msg);
  }

  increaseVolume() {
    this.rtc.startPlay();
    const msg = '{"action":1,"touchType":"keystroke","keyCode":24,"text":""}';
    this.rtc.sendUserMessage(this.rtc.options.clientId, msg, true);
  }

  decreaseVolume() {
    this.rtc.startPlay();
    const msg = '{"action":1,"touchType":"keystroke","keyCode":25,"text":""}';
    this.rtc.sendUserMessage(this.rtc.options.clientId, msg, true);
  }
}
