export default class ShakeSimulator {
  private isRunning: boolean;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor() {
    this.isRunning = false;
  }

  public startShakeSimulation(duration: number = 1800, callback: (data: { x: number; y: number; z: number }) => void): void {
    // Clear any existing simulation to prevent multiple intervals running concurrently (race condition)
    this.stopShakeSimulation();
    
    this.isRunning = true;
    const startTime = Date.now();

    this.intervalId = setInterval(() => {
      if (!this.isRunning) return;

      // 生成随机加速度值
      const x = this.randomAcceleration();
      const y = this.randomAcceleration();
      const z = this.randomAcceleration();

      callback({
        x,
        y,
        z,
      });
      // 检查时间是否到达指定持续时间
      if (Date.now() - startTime > duration) {
        this.stopShakeSimulation();
      }
    }, 33); // 33ms is ~30fps, much better for performance than 100fps (10ms)
  }

  private randomAcceleration(): number {
    // 随机生成一个模拟的加速度值
    return Math.random() * 25 - 10; // 产生 -10 到 15 之间的随机值
  }

  private stopShakeSimulation(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.isRunning = false;
    }
  }
}
