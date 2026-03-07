import type { RTCInstance } from "../core/types";

const keyCodeMap: Record<string, number> = {
  ArrowUp: 19,
  ArrowDown: 20,
  ArrowLeft: 21,
  ArrowRight: 22,
  Enter: 66,
  Backspace: 67,
};

/** 添加input输入框 */
export const addInputElement = (rtc: RTCInstance): void => {
  const h5Dom = document.getElementById(rtc.initDomId);
  rtc.inputElement = document.createElement("input");
  rtc.inputElement.setAttribute("type", "text");
  rtc.inputElement.setAttribute("autocomplete", "off");
  rtc.inputElement.setAttribute("id", `${rtc.masterIdPrefix || ""}_${rtc.remoteUserId}_inputEle`);
  rtc.inputElement.setAttribute("class", "play-text-input");
  rtc.inputElement.setAttribute(
    "style",
    "position: absolute; top: 0px;left: 0px;pointer-events: none; opacity: 0.01;width: 100%;max-width: 95%;"
  );

  let compositionstart = false;

  rtc.inputElement.addEventListener("compositionstart", () => {
    compositionstart = true;
  });

  const sendInputMessage = (text: string) => {
    // Wisebite: Manual String Building cho Input
    const escapedText = text.replace(/"/g, '\\"');
    const message = `{"action":1,"touchType":"inputBox","keyCode":1,"text":"${escapedText}"}`;
    rtc.sendUserMessage(rtc.options.clientId, message);
    if (rtc.inputElement) rtc.inputElement.value = "";
  };

  rtc.inputElement.addEventListener("compositionend", (e: CompositionEvent) => {
    compositionstart = false;
    const target = e.target as HTMLInputElement;
    if (target.value) sendInputMessage(target.value);
  });

  rtc.inputElement.addEventListener("input", (e: Event) => {
    if (compositionstart) return;
    const target = e.target as HTMLInputElement;
    if (target.value) sendInputMessage(target.value);
  });

  rtc.inputElement.addEventListener("keydown", (e: KeyboardEvent) => {
    const keyCode = keyCodeMap[e.key];
    if (keyCode !== undefined) {
      if (e.key === "Enter") rtc.inputElement?.blur();
      
      const userId = rtc.options.clientId;
      // Wisebite: Template Literals cho phím bấm
      const messageDown = `{"action":1,"touchType":"input","keyCode":${keyCode},"text":""}`;
      const messageUp = `{"action":0,"touchType":"input","keyCode":${keyCode},"text":""}`;
      
      rtc.sendUserMessage(userId, messageDown);
      rtc.sendUserMessage(userId, messageUp);
    }
  });

  h5Dom?.appendChild(rtc.inputElement);
};
