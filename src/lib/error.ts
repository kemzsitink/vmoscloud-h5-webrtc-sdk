interface ErrorInfo {
  name: string;
  message: string;
  stack: string;
  time: number;
}

interface IceErrorInput {
  errorCode?: number;
  errorText?: string;
  url?: string;
  address?: string;
  port?: number;
}

interface IceErrorInfo {
  errorCode?: number;
  errorText?: string;
  url?: string;
  address?: string;
  port?: number;
  time: number;
}

// 普通错误
export const handleError = (error: Error | null | undefined): ErrorInfo | Record<string, never> => {
  if (!error) return {};

  return {
    name: error?.name || "",
    message: error?.message || "",
    stack: error?.stack || "",
    time: new Date().getTime(),
  };
};

// Ice错误
export const handleIceError = (error: IceErrorInput | null | undefined): IceErrorInfo | Record<string, never> => {
  if (!error) return {};
  const { errorCode, errorText, url, address, port } = error;
  return {
    errorCode,
    errorText,
    url,
    address,
    port,
    time: new Date().getTime(),
  };
};
