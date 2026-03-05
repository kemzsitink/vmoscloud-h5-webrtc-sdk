export const blobToText = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error("Failed to read blob as text"));
    };
    reader.readAsText(blob);
  });
};

export const arrayBufferToText = (buffer: ArrayBuffer): string => {
  if (typeof TextDecoder !== "undefined") {
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(buffer);
  } else {
    return String.fromCharCode.apply(null, [...new Uint8Array(buffer)]);
  }
};

export type DataType = "ArrayBuffer" | "Blob" | "String";

export const checkType = (input: unknown): DataType => {
  if (input instanceof ArrayBuffer) {
    return "ArrayBuffer";
  } else if (input instanceof Blob) {
    return "Blob";
  } else {
    return "String";
  }
};

/** 判断是否是手机 */
export const isMobile = (): boolean => {
  const flag = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile\//i.test(
    navigator.userAgent
  );
  return flag;
};

export const isTouchDevice = (): boolean => !!("ontouchstart" in document.documentElement);
