// @ts-nocheck
export const blobToText = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result) // 读取结果为文本
    }
    reader.onerror = () => {
      reject(new Error("Failed to read blob as text"))
    }
    reader.readAsText(blob) // 读取 Blob 为文本
  })
}

export const arrayBufferToText = (buffer) => {
  if (typeof TextDecoder !== "undefined") {
    const decoder = new TextDecoder("utf-8")
    return decoder.decode(buffer)
  } else {
    return String.fromCharCode.apply(null, new Uint8Array(buffer))
  }
}

export const checkType = (input) => {
  if (input instanceof ArrayBuffer) {
    return "ArrayBuffer"
  } else if (input instanceof Blob) {
    return "Blob"
  } else {
    return "String"
  }
}
/** 判断是否是手机 */

export const isMobile = () => {
  const flag = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile\//i.test(
    // eslint-disable-next-line comma-dangle
    navigator.userAgent
  )
  return flag
}

export const isTouchDevice = () => !!('ontouchstart' in document.documentElement);
