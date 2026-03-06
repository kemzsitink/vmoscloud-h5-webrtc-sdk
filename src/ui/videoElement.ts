export class VideoElement {
  private readonly videoDomId: string;
  private readonly containerId: string;
  private mainElement: HTMLDivElement | null = null;
  private eventListeners: {
    type: string;
    listener: EventListener;
    element: HTMLElement;
  }[] = [];

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
    });

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

    this.mainElement.appendChild(videoContainer);
    return this.mainElement;
  }

  public bindDomEvent(type: string, listener: EventListener): void {
    const target = this.mainElement ?? document.getElementById(this.videoDomId);
    if (target) {
      const wrappedListener = (event: Event) => {
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
