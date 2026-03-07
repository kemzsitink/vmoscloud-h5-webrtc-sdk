import type HuoshanRTC from "../huoshanRtc";
import Shake from "../../features/shake";

export class DeviceController {
  constructor(private rtc: HuoshanRTC) {}

  getEquipmentInfo(type: "app" | "attr") {
    this.rtc.sendUserMessage(
      this.rtc.options.clientId,
      this.rtc.getMsgTemplate("equipmentInfo", { type }),
      true
    );
  }

  appUnInstall(pkgNames: string[]) {
    this.rtc.sendUserMessage(
      this.rtc.options.clientId,
      this.rtc.getMsgTemplate("appUnInstall", pkgNames),
      true
    );
  }

  sendShakeInfo(time: number): void {
    const userId = this.rtc.options.clientId;
    const shake = new Shake();
    shake.startShakeSimulation(time, (content: any) => {
      const getOptions = (sensorType: string): string => {
        return JSON.stringify({
          coords: [],
          heightPixels: 0,
          isOpenScreenFollowRotation: false,
          keyCode: 0,
          pointCount: 0,
          properties: [],
          text: "",
          touchType: "eventSdk",
          widthPixels: 0,
          action: 0,
          content: JSON.stringify({
            ...content,
            type: "sdkSensor",
            sensorType,
          }),
        });
      };
      this.rtc.sendUserMessage(userId, getOptions("gyroscope"));
      this.rtc.sendUserMessage(userId, getOptions("gravity"));
      this.rtc.sendUserMessage(userId, getOptions("acceleration"));
    });
  }

  setGPS(longitude: number, latitude: number) {
    const contentObj1 = {
      latitude,
      longitude,
      time: new Date().getTime(),
    };
    const contentObj2 = {
      type: "sdkLocation",
      content: JSON.stringify(contentObj1),
    };
    const messageObj = {
      touchType: "eventSdk",
      content: JSON.stringify(contentObj2),
    };
    const userId = this.rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    this.rtc.sendUserMessage(userId, message);
  }

  executeAdbCommand(command: string) {
    const userId = this.rtc.options.clientId;
    const message = JSON.stringify({
      touchType: "eventSdk",
      content: JSON.stringify({
        type: "inputAdb",
        content: command,
      }),
    });
    this.rtc.sendUserMessage(userId, message);
  }

  sendCommand(command: string) {
    switch (command) {
      case "back":
        this.goAppUpPage();
        break;
      case "home":
        this.goAppHome();
        break;
      case "menu":
        this.goAppMenu();
        break;
      default:
        break;
    }
  }

  goAppUpPage() {
    const messageObj2 = {
      action: 0,
      touchType: "keystroke",
      keyCode: 4,
      text: "",
    };
    const userId = this.rtc.options.clientId;
    const message2 = JSON.stringify(messageObj2);
    if (userId) {
      this.rtc.sendUserMessage(userId, message2);
    }
  }

  goAppHome() {
    const messageObj = {
      action: 1,
      touchType: "keystroke",
      keyCode: 3,
      text: "",
    };
    const userId = this.rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    if (userId) {
      this.rtc.sendUserMessage(userId, message);
    }
  }

  goAppMenu() {
    const messageObj = {
      action: 1,
      touchType: "keystroke",
      keyCode: 187,
      text: "",
    };

    const userId = this.rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    if (userId) {
      this.rtc.sendUserMessage(userId, message);
    }
  }

  increaseVolume() {
    this.rtc.startPlay();
    const messageObj = {
      action: 1,
      touchType: "keystroke",
      keyCode: 24,
      text: "",
    };
    const userId = this.rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    if (userId) {
      this.rtc.sendUserMessage(userId, message, true);
    }
  }

  decreaseVolume() {
    this.rtc.startPlay();
    const messageObj = {
      action: 1,
      touchType: "keystroke",
      keyCode: 25,
      text: "",
    };
    const userId = this.rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    if (userId) {
      this.rtc.sendUserMessage(userId, message, true);
    }
  }
}
