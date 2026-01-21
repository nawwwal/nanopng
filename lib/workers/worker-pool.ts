import * as Comlink from "comlink"
import type { ProcessorAPI } from "./processor.worker"

interface QueuedTask {
  id: string
  resolve: (api: Comlink.Remote<ProcessorAPI>) => void
  priority: 'normal' | 'high' // High priority for probes
}

/** Size threshold for batching small images (500KB) */
const BATCH_SIZE_THRESHOLD = 500 * 1024

class WorkerPool {
  private workers: Worker[] = []
  private apis: Comlink.Remote<ProcessorAPI>[] = []
  private available: Set<number> = new Set()
  private queue: QueuedTask[] = []
  private initialized = false
  private initializing: Promise<void> | null = null
  private poolSize: number
  private maxPoolSize: number // Full CPU utilization for probes

  constructor() {
    const cores = typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4

    // Default pool size: 75% of cores (min 2, max 8) for full compression
    this.poolSize = Math.max(2, Math.min(8, Math.floor(cores * 0.75)))

    // Max pool size: 100% of cores for lightweight probe operations
    this.maxPoolSize = Math.max(2, Math.min(12, cores))
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

  async acquire(priority: 'normal' | 'high' = 'normal'): Promise<{ api: Comlink.Remote<ProcessorAPI>; release: () => void }> {
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
      const task: QueuedTask = {
        id: Math.random().toString(36).slice(2),
        priority,
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
      }

      // High priority tasks go to front of queue
      if (priority === 'high') {
        this.queue.unshift(task)
      } else {
        this.queue.push(task)
      }
    })
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.available.size === 0) return

    // Process high priority tasks first
    const highPriorityIndex = this.queue.findIndex(t => t.priority === 'high')
    const taskIndex = highPriorityIndex >= 0 ? highPriorityIndex : 0
    const task = this.queue.splice(taskIndex, 1)[0]!

    const index = this.available.values().next().value as number
    this.available.delete(index)

    task.resolve(this.apis[index]!)
  }

  /**
   * Execute a task on the worker pool.
   * @param task - The task function to execute
   * @param priority - Task priority ('high' for probes, 'normal' for full compression)
   */
  async execute<T>(
    task: (api: Comlink.Remote<ProcessorAPI>) => Promise<T>,
    priority: 'normal' | 'high' = 'normal'
  ): Promise<T> {
    const { api, release } = await this.acquire(priority)

    try {
      return await task(api)
    } finally {
      release()
    }
  }

  /**
   * Execute multiple tasks in parallel, useful for batching small images.
   * Tasks are distributed across available workers for maximum throughput.
   *
   * @param tasks - Array of task functions to execute
   * @param priority - Task priority
   * @returns Array of results in the same order as input tasks
   */
  async executeBatch<T>(
    tasks: Array<(api: Comlink.Remote<ProcessorAPI>) => Promise<T>>,
    priority: 'normal' | 'high' = 'normal'
  ): Promise<T[]> {
    return Promise.all(tasks.map(task => this.execute(task, priority)))
  }

  /**
   * Check if an image is small enough to benefit from batching.
   * Small images (<500KB) have less compression overhead and benefit
   * from reduced worker dispatch latency when batched together.
   */
  static shouldBatch(fileSize: number): boolean {
    return fileSize < BATCH_SIZE_THRESHOLD
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

  /**
   * Get maximum pool size (100% CPU utilization).
   * Used for lightweight probe operations that can safely use all cores.
   */
  getMaxPoolSize(): number {
    return this.maxPoolSize
  }

  /**
   * Get number of currently available workers.
   */
  getAvailableWorkers(): number {
    return this.available.size
  }

  /**
   * Get current queue length.
   */
  getQueueLength(): number {
    return this.queue.length
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
