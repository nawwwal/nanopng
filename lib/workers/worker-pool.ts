import * as Comlink from "comlink"
import type { ProcessorAPI } from "./processor.worker"

interface QueuedTask {
  id: string
  resolve: (api: Comlink.Remote<ProcessorAPI>) => void
}

class WorkerPool {
  private workers: Worker[] = []
  private apis: Comlink.Remote<ProcessorAPI>[] = []
  private available: Set<number> = new Set()
  private queue: QueuedTask[] = []
  private initialized = false
  private initializing: Promise<void> | null = null
  private poolSize: number

  constructor() {
    // Dynamic pool size based on CPU cores (75%, min 2, max 8)
    this.poolSize = typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? Math.max(2, Math.min(8, Math.floor(navigator.hardwareConcurrency * 0.75)))
      : 4
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return
    if (this.initializing) return this.initializing

    this.initializing = (async () => {
      for (let i = 0; i < this.poolSize; i++) {
        const worker = new Worker(
          new URL("./processor.worker.ts", import.meta.url),
          { type: "module" }
        )
        const api = Comlink.wrap<ProcessorAPI>(worker)

        this.workers.push(worker)
        this.apis.push(api)
        this.available.add(i)
      }

      this.initialized = true
      console.log(`Worker pool initialized with ${this.poolSize} workers`)
    })()

    return this.initializing
  }

  async acquire(): Promise<{ api: Comlink.Remote<ProcessorAPI>; release: () => void }> {
    await this.initialize()

    // Check if any worker is available
    if (this.available.size > 0) {
      const index = this.available.values().next().value as number
      this.available.delete(index)

      return {
        api: this.apis[index]!,
        release: () => {
          this.available.add(index)
          this.processQueue()
        }
      }
    }

    // No worker available, wait in queue
    return new Promise((resolve) => {
      this.queue.push({
        id: Math.random().toString(36).slice(2),
        resolve: (api) => {
          // Find which index this api belongs to
          const index = this.apis.indexOf(api)
          resolve({
            api,
            release: () => {
              this.available.add(index)
              this.processQueue()
            }
          })
        }
      })
    })
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.available.size === 0) return

    const task = this.queue.shift()!
    const index = this.available.values().next().value as number
    this.available.delete(index)

    task.resolve(this.apis[index]!)
  }

  async execute<T>(
    task: (api: Comlink.Remote<ProcessorAPI>) => Promise<T>
  ): Promise<T> {
    const { api, release } = await this.acquire()

    try {
      return await task(api)
    } finally {
      release()
    }
  }

  terminate(): void {
    this.workers.forEach(w => w.terminate())
    this.workers = []
    this.apis = []
    this.available.clear()
    this.queue = []
    this.initialized = false
    this.initializing = null
  }

  getPoolSize(): number {
    return this.poolSize
  }
}

// Singleton instance
let workerPoolInstance: WorkerPool | null = null

export function getWorkerPool(): WorkerPool {
  if (!workerPoolInstance) {
    workerPoolInstance = new WorkerPool()
  }
  return workerPoolInstance
}

export { WorkerPool }
