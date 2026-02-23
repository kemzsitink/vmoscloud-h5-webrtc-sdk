const keyCodeMap: Record<string, number> = {
  ArrowUp: 19,
  ArrowDown: 20,
  ArrowLeft: 21,
  ArrowRight: 22,
  Enter: 66,
  Backspace: 67,
};

const jsToAndroidKeyCodeMap: Record<number, number> = {
  8: 67, // Backspace
  9: 61, // Tab
  13: 66, // Enter
  16: 59, // Shift (Left Shift Key)
  17: 57, // Control (Left Control Key)
  18: 56, // Alt (Left Alt Key)
  19: 121, // Pause/Break
  20: 115, // Caps Lock
  27: 111, // Escape
  32: 62, // Space
  37: 21, // Left Arrow
  38: 19, // Up Arrow
  39: 22, // Right Arrow
  40: 20, // Down Arrow
  45: 124, // Insert
  46: 112, // Delete
  48: 7, // 0
  49: 8, // 1
  50: 9, // 2
  51: 10, // 3
  52: 11, // 4
  53: 12, // 5
  54: 13, // 6
  55: 14, // 7
  56: 15, // 8
  57: 16, // 9
  65: 29, // A
  66: 30, // B
  67: 31, // C
  68: 32, // D
  69: 33, // E
  70: 34, // F
  71: 35, // G
  72: 36, // H
  73: 37, // I
  74: 38, // J
  75: 39, // K
  76: 40, // L
  77: 41, // M
  78: 42, // N
  79: 43, // O
  80: 44, // P
  81: 45, // Q
  82: 46, // R
  83: 47, // S
  84: 48, // T
  85: 49, // U
  86: 50, // V
  87: 51, // W
  88: 52, // X
  89: 53, // Y
  90: 54, // Z
  91: 117, // Windows/Meta
  93: 82, // Context Menu
  96: 144, // Numpad 0
  97: 145, // Numpad 1
  98: 146, // Numpad 2
  99: 147, // Numpad 3
  100: 148, // Numpad 4
  101: 149, // Numpad 5
  102: 150, // Numpad 6
  103: 151, // Numpad 7
  104: 152, // Numpad 8
  105: 153, // Numpad 9
  106: 155, // Multiply
  107: 157, // Add
  109: 156, // Subtract
  110: 158, // Decimal
  111: 154, // Divide
  112: 131, // F1
  113: 132, // F2
  114: 133, // F3
  115: 134, // F4
  116: 135, // F5
  117: 136, // F6
  118: 137, // F7
  119: 138, // F8
  120: 139, // F9
  121: 140, // F10
  122: 141, // F11
  123: 142, // F12
  144: 143, // Num Lock
  145: 116, // Scroll Lock
};

/** 添加input输入框 */
export const addInputElement = (rtc: any, isP2p: boolean) => {
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
  rtc.inputElement.addEventListener("compositionend", (e: any) => {
    compositionstart = false;
    const messageObj = {
      action: 1,
      touchType: "inputBox",
      keyCode: 1,
      text: e.target.value,
    };
    const userId = rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    rtc.inputElement.value = "";
    isP2p ? rtc.sendUserMessage(message) : rtc.sendUserMessage(userId, message);
  });
  rtc.inputElement.addEventListener("input", (e: any) => {
    if (compositionstart) return;
    const messageObj = {
      action: 1,
      touchType: "inputBox",
      keyCode: 1,
      text: e.target.value,
    };
    const userId = rtc.options.clientId;
    const message = JSON.stringify(messageObj);
    rtc.inputElement.value = "";
    isP2p ? rtc.sendUserMessage(message) : rtc.sendUserMessage(userId, message);
  });
  rtc.inputElement.addEventListener("keydown", (e: any) => {
    const keyCode = keyCodeMap[e.key];
    if (keyCode != undefined) {
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
      if (e.key == "Enter") {
        // 失去焦点
        rtc.inputElement.blur();
      }
      // 按下
      isP2p
        ? rtc.sendUserMessage(message)
        : rtc.sendUserMessage(userId, message);
      // 抬起
      isP2p
        ? rtc.sendUserMessage(message2)
        : rtc.sendUserMessage(userId, message2);
    }
  });
  // 将input元素添加到页面中的指定容器中
  h5Dom?.appendChild(rtc.inputElement);
};
