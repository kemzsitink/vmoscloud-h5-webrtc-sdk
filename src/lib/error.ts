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
export const handleError = (error: unknown): ErrorInfo | Record<string, never> => {
  if (!error) return {};

  if (typeof error === 'string') {
    return {
      name: "StringError",
      message: error,
      stack: "",
      time: new Date().getTime(),
    };
  }

  const err = error as Error;
  return {
    name: err.name || "",
    message: err.message || "",
    stack: err.stack || "",
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
