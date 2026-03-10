export class VideoElement {
  private readonly videoDomId: string;
  private readonly containerId: string;
  private mainElement: HTMLDivElement | null = null;
  private eventListeners: {
    type: string;
    listener: EventListener;
    element: HTMLElement;
  }[] = [];
  private observer: MutationObserver | null = null;

  constructor(private masterIdPrefix: string, private remoteUserId: string) {
    this.videoDomId = `${this.masterIdPrefix}_${this.remoteUserId}_armcloudVideo`;
    this.containerId = `${this.masterIdPrefix}_${this.remoteUserId}_remoteVideoContainer`;
  }

  public getVideoDomId(): string {
    return this.videoDomId;
  }

  public getContainerId(): string {
    return this.containerId;
  }

  /**
   * Creates the container structure. 
   * The vendor SDK will inject the actual <video> element into the containerId element.
   * Native <video> is the absolute fastest way to render WebRTC with zero-copy decoding.
   */
  public createElements(): HTMLElement {
    if (this.mainElement) return this.mainElement;

    // Main wrapper
    this.mainElement = document.createElement("div");
    this.mainElement.id = this.videoDomId;
    Object.assign(this.mainElement.style, {
      width: "100%",
      height: "100%",
      position: "relative",
      backgroundColor: "#000",
      touchAction: "none",
      userSelect: "none",
      webkitUserSelect: "none",
      webkitTouchCallout: "none",
    });
    this.mainElement.oncontextmenu = (event: Event): void => {
      event.preventDefault();
    };

    // Dedicated container for the SDK to inject its video element
    const videoContainer = document.createElement("div");
    videoContainer.id = this.containerId;
    Object.assign(videoContainer.style, {
      width: "100%",
      height: "100%",
      position: "absolute",
      top: "0",
      left: "0",
      overflow: "hidden",
    });
    videoContainer.oncontextmenu = (event: Event): void => {
      event.preventDefault();
    };

    this.mainElement.appendChild(videoContainer);

    // MutationObserver to optimize injected video element for zero latency
    this.observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeName.toLowerCase() === "video") {
              const videoElement = node as HTMLVideoElement;
              videoElement.disablePictureInPicture = true;
              videoElement.disableRemotePlayback = true;
              videoElement.controls = false;
              videoElement.playsInline = true;
              videoElement.setAttribute("disablePictureInPicture", "");
              videoElement.setAttribute("disableremoteplayback", "");
              videoElement.setAttribute("playsinline", "");
              videoElement.setAttribute("controlsList", "nodownload noplaybackrate noremoteplayback");
              videoElement.oncontextmenu = (event: Event): void => {
                event.preventDefault();
              };

              // Apply hardware acceleration CSS to push to GPU
              Object.assign(videoElement.style, {
                width: "100%",
                height: "100%",
                transform: "translateZ(0)",
                willChange: "transform",
                backfaceVisibility: "hidden",
                perspective: "1000",
                pointerEvents: "none",
                userSelect: "none",
              });
            }
          });
        }
      }
    });

    this.observer.observe(videoContainer, { childList: true, subtree: true });

    return this.mainElement;
  }

  public bindDomEvent(type: string, listener: EventListener): void {
    const target = this.mainElement ?? document.getElementById(this.videoDomId);
    if (target) {
      const wrappedListener = (event: Event): void => {
        if (type !== "wheel" && type !== "touchstart" && type !== "touchmove") {
          event.preventDefault();
        }
        listener(event);
      };
      
      target.addEventListener(type, wrappedListener);
      this.eventListeners.push({
        type,
        listener: wrappedListener,
        element: target,
      });
    }
  }

  public removeAllEvents(): void {
    this.eventListeners.forEach(({ type, listener, element }) => {
      element.removeEventListener(type, listener);
    });
    this.eventListeners = [];
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.removeAllEvents();

    if (this.mainElement) {
      this.mainElement.remove();
      this.mainElement = null;
    } else {
      const videoDomElement = document.getElementById(this.videoDomId);
      videoDomElement?.remove();
    }

    this.eventListeners = [];
  }
}
