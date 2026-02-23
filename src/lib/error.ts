// @ts-nocheck
// 普通错误
export const handleError = (error) => {
  if (!error) return {}

  return {
    name: error?.name || "",
    message: error?.message || "",
    stack: error?.stack || "",
    time: new Date().getTime()
  }
}

// Ice错误
export const handleIceError = (error) => {
  if (!error) return {}
  const { errorCode, errorText, url, address, port } = error
  return {
    errorCode,
    errorText,
    url,
    address,
    port,
    time: new Date().getTime()
  }
}
