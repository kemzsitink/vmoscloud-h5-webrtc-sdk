import type { RTCInstance } from "./type";

const keyCodeMap: Record<string, number> = {
  ArrowUp: 19,
  ArrowDown: 20,
  ArrowLeft: 21,
  ArrowRight: 22,
  Enter: 66,
  Backspace: 67,
};


/** 添加input输入框 */
export const addInputElement = (rtc: RTCInstance, isP2p: boolean): void => {
  // 获取外部容器div元素
  const h5Dom = document.getElementById(rtc.initDomId);
  // 创建一个input元素
  rtc.inputElement = document.createElement("input");
  // 设置input的类型为文本输入框
  rtc.inputElement.setAttribute("type", "text");
  rtc.inputElement.setAttribute("autocomplete", "off");
  rtc.inputElement.setAttribute(
    "id",
    `${rtc.masterIdPrefix || ""}_${rtc.remoteUserId}_inputEle`
  );
  rtc.inputElement.setAttribute("class", "play-text-input");
  // 设置input的style
  rtc.inputElement.setAttribute(
    "style",
    "position: absolute; top: 0px;left: 0px;pointer-events: none; opacity: 0.01;width: 100%;max-width: 95%;"
  );

  // 输入法输入开始时执行；如果不是输入法输入，不触发
  let compositionstart = false;
  rtc.inputElement.addEventListener("compositionstart", () => {
    compositionstart = true;
  });
  rtc.inputElement.addEventListener("compositionend", (e: CompositionEvent) => {
    compositionstart = false;
    const target = e.target as HTMLInputElement;
    const messageObj = {
      action: 1,
      touchType: "inputBox",
      keyCode: 1,
      text: target.value,
    };
    const userId = rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    if (rtc.inputElement) rtc.inputElement.value = "";
    if (isP2p) {
      rtc.sendUserMessage(message, "");
    } else {
      rtc.sendUserMessage(userId, message);
    }
  });
  rtc.inputElement.addEventListener("input", (e: Event) => {
    if (compositionstart) return;
    const target = e.target as HTMLInputElement;
    const messageObj = {
      action: 1,
      touchType: "inputBox",
      keyCode: 1,
      text: target.value,
    };
    const userId = rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    if (rtc.inputElement) rtc.inputElement.value = "";
    if (isP2p) {
      rtc.sendUserMessage(message, "");
    } else {
      rtc.sendUserMessage(userId, message);
    }
  });
  rtc.inputElement.addEventListener("keydown", (e: KeyboardEvent) => {
    const keyCode = keyCodeMap[e.key];
    if (keyCode !== undefined) {
      const messageObj = {
        action: 1,
        touchType: "input",
        keyCode: keyCode,
        text: "",
      };
      const messageObj2 = {
        action: 0,
        touchType: "input",
        keyCode: keyCode,
        text: "",
      };
      const userId = rtc.options.clientId;
      const message = JSON.stringify(messageObj);
      const message2 = JSON.stringify(messageObj2);
      if (e.key === "Enter") {
        // 失去焦点
        rtc.inputElement?.blur();
      }
      // 按下
      if (isP2p) {
        rtc.sendUserMessage(message, "");
      } else {
        rtc.sendUserMessage(userId, message);
      }
      // 抬起
      if (isP2p) {
        rtc.sendUserMessage(message2, "");
      } else {
        rtc.sendUserMessage(userId, message2);
      }
    }
  });
  // 将input元素添加到页面中的指定容器中
  h5Dom?.appendChild(rtc.inputElement);
};
