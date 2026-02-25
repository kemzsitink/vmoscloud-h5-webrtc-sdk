/**
 * Pact - A synchronous, eager Promise implementation (State Machine).
 * 
 * Unlike native Promises which always defer `.then()` and `.catch()` callbacks 
 * to the microtask queue (even if already resolved), Pact executes callbacks 
 * synchronously and immediately if the value is already available.
 * 
 * This drastically reduces jitter and latency in high-frequency streams
 * like FPS mouse movements, WebCodecs frames, and WebRTC DataChannels.
 */
export class Pact<T> {
  private state: 'pending' | 'fulfilled' | 'rejected' = 'pending';
  private value?: T;
  private error?: unknown;
  private handlers: Array<{
      onFulfilled?: (value: T) => unknown;
      onRejected?: (error: unknown) => unknown;
      resolve: (value: any) => void;
      reject: (error: any) => void;
  }> = [];

  constructor(executor: (resolve: (value: T | PromiseLike<T> | Pact<T>) => void, reject: (reason?: unknown) => void) => void) {
      const resolve = (value: T | PromiseLike<T> | Pact<T>) => {
          if (this.state !== 'pending') return;
          
          if (value && (typeof value === 'object' || typeof value === 'function') && 'then' in value) {
              (value as PromiseLike<T>).then(resolve, reject);
              return;
          }
          
          this.state = 'fulfilled';
          this.value = value as T;
          this.executeHandlers();
      };

      const reject = (error: unknown) => {
          if (this.state !== 'pending') return;
          this.state = 'rejected';
          this.error = error;
          this.executeHandlers();
      };

      try {
          executor(resolve, reject);
      } catch (e) {
          reject(e);
      }
  }

  private executeHandlers() {
      if (this.state === 'pending') return;
      
      while (this.handlers.length > 0) {
          const handler = this.handlers.shift()!;
          try {
              if (this.state === 'fulfilled') {
                  if (handler.onFulfilled) {
                      const result = handler.onFulfilled(this.value!);
                      handler.resolve(result);
                  } else {
                      handler.resolve(this.value);
                  }
              } else {
                  if (handler.onRejected) {
                      const result = handler.onRejected(this.error);
                      handler.resolve(result);
                  } else {
                      handler.reject(this.error);
                  }
              }
          } catch (e) {
              handler.reject(e);
          }
      }
  }

  then<TResult1 = T, TResult2 = never>(
      onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1> | Pact<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2> | Pact<TResult2>) | null
  ): Pact<TResult1 | TResult2> {
      return new Pact<TResult1 | TResult2>((resolve, reject) => {
          this.handlers.push({
              onFulfilled: onFulfilled || undefined,
              onRejected: onRejected || undefined,
              resolve,
              reject
          });
          this.executeHandlers();
      });
  }

  catch<TResult = never>(
      onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult> | Pact<TResult>) | null
  ): Pact<T | TResult> {
      return this.then(undefined, onRejected);
  }
  
  static resolve<T>(value: T | PromiseLike<T> | Pact<T>): Pact<T> {
      return new Pact((resolve) => resolve(value));
  }
  
  static reject<T = never>(reason: unknown): Pact<T> {
      return new Pact((_, reject) => reject(reason));
  }
}
