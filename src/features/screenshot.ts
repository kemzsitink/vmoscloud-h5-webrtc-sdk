export default class ScreenshotOverlay {
  private videoContainer: HTMLDivElement | null;
  private video: HTMLVideoElement | null;
  private rotateType: number;
  private canvas: HTMLCanvasElement | null;
  private context: CanvasRenderingContext2D | null;

  constructor(videoContainer: HTMLDivElement, rotateType = 0) {
    this.videoContainer = videoContainer;
    this.video = this.videoContainer.querySelector("video");
    this.rotateType = rotateType;
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!this.video || !this.context) {
      throw new Error("Failed to initialize screenshot overlay.");
    }

    this.initCanvas();
  }

  private initCanvas(): void {
    if (!this.videoContainer || !this.canvas) return;

    this.videoContainer.style.position = "relative";
    Object.assign(this.canvas.style, {
      top: 0,
      left: 0,
      position: "absolute",
      display: "none",
      pointerEvents: "none",
      zIndex: "10",
    });

    this.videoContainer.appendChild(this.canvas);
  }

  private configureCanvas(rotateType: number, width: number, height: number): void {
    if (!this.canvas || !this.context) return;

    if (rotateType === 1) {
      this.canvas.width = height;
      this.canvas.height = width;
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.context.translate(0, this.canvas.height);
      this.context.rotate(-Math.PI / 2);
    } else {
      this.canvas.width = width;
      this.canvas.height = height;
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      if (this.rotateType) {
        [this.canvas.width, this.canvas.height] = [height, width];
      }

      this.context.setTransform(1, 0, 0, 1, 0, 0);
    }

    this.rotateType = rotateType;
  }

  public setScreenshotrotateType(rotateType: 0 | 1 = 0): void {
    if (!this.canvas || !this.context) return;

    const tempCanvas = document.createElement("canvas");
    const tempContext = tempCanvas.getContext("2d");
    if (!tempContext) return;

    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;

    tempContext.drawImage(this.canvas, 0, 0);

    this.configureCanvas(rotateType, tempCanvas.width, tempCanvas.height);
    this.context.drawImage(tempCanvas, 0, 0);

    tempCanvas.width = 0;
    tempCanvas.height = 0;
  }

  public takeScreenshot(rotateType = 0): void {
    if (!this.videoContainer || !this.canvas || !this.context) return;

    this.rotateType = rotateType;
    this.video = this.videoContainer.querySelector("video");

    if (!this.video) {
      return;
    }

    const { offsetTop, offsetLeft, offsetWidth, offsetHeight } = this.video;

    this.canvas.style.top = `${String(offsetTop)}px`;
    this.canvas.style.left = `${String(offsetLeft)}px`;
    this.canvas.width = offsetWidth;
    this.canvas.height = offsetHeight;

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.save();

    this.configureCanvas(rotateType, offsetWidth, offsetHeight);
    this.context.drawImage(this.video, 0, 0, offsetWidth, offsetHeight);
    this.context.restore();
  }

  public resizeScreenshot(width: number, height: number): void {
    if (!this.canvas || !this.context) {
      return;
    }

    const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);

    const tempCanvas = document.createElement("canvas");
    const tempContext = tempCanvas.getContext("2d");
    if (!tempContext) return;

    const aspectRatio = imageData.width / imageData.height;
    let newWidth: number;
    let newHeight: number;

    if (width / height > aspectRatio) {
      newWidth = height * aspectRatio;
      newHeight = height;
    } else {
      newWidth = width;
      newHeight = width / aspectRatio;
    }

    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;

    tempContext.drawImage(
      this.canvas,
      0,
      0,
      imageData.width,
      imageData.height,
      0,
      0,
      newWidth,
      newHeight
    );

    this.canvas.width = width;
    this.canvas.height = height;
    this.context.clearRect(0, 0, width, height);

    this.context.drawImage(tempCanvas, 0, 0, newWidth, newHeight, 0, 0, width, height);
  }

  public clearScreenShot(): void {
    if (!this.context || !this.canvas) return;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public showScreenShot(): void {
    if (!this.canvas) return;
    this.canvas.style.display = "block";
  }

  public hideScreenShot(): void {
    if (!this.canvas) return;
    this.canvas.style.display = "none";
  }

  public destroy(): void {
    this.clearScreenShot();

    if (this.canvas?.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    if (this.videoContainer) {
      this.videoContainer.style.position = "";
    }

    this.videoContainer = null;
    this.video = null;
    this.canvas = null;
    this.context = null;
  }
}
