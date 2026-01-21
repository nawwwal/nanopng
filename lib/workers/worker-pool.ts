import * as Comlink from "comlink"
import type { ProcessorAPI } from "./processor.worker"

interface QueuedTask {
  id: string
  resolve: (api: Comlink.Remote<ProcessorAPI>) => void
}

type Priority = 'low' | 'normal' | 'high'

/** Size threshold for batching small images (500KB) */
const BATCH_SIZE_THRESHOLD = 500 * 1024

class WorkerPool {
  private workers: Worker[] = []
  private apis: Comlink.Remote<ProcessorAPI>[] = []
  private available: Set<number> = new Set()
  // O(1) priority queues - separate queue per priority level
  private queues: Record<Priority, QueuedTask[]> = {
    high: [],
    normal: [],
    low: []
  }
  private initialized = false
  private initializing: Promise<void> | null = null
  private poolSize: number
  private normalPoolSize: number
  private maxPoolSize: number // Full CPU utilization for probes

  constructor() {
    const cores = typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4

    // Default pool size: 75% of cores (min 2, max 8) for full compression
    this.normalPoolSize = Math.max(2, Math.min(8, Math.floor(cores * 0.75)))
    this.poolSize = this.normalPoolSize

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

  async acquire(priority: Priority = 'normal'): Promise<{ api: Comlink.Remote<ProcessorAPI>; release: () => void }> {
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

      // O(1) enqueue to appropriate priority queue
      this.queues[priority].push(task)
    })
  }

  private processQueue(): void {
    if (this.available.size === 0) return

    // O(1) dequeue: check queues in priority order
    const task =
      this.queues.high.shift() ||
      this.queues.normal.shift() ||
      this.queues.low.shift()

    if (!task) return

    const index = this.available.values().next().value as number
    this.available.delete(index)

    task.resolve(this.apis[index]!)
  }

  /**
   * Execute a task on the worker pool.
   * @param task - The task function to execute
   * @param priority - Task priority ('high' for probes, 'normal' for full compression, 'low' for background tasks)
   */
  async execute<T>(
    task: (api: Comlink.Remote<ProcessorAPI>) => Promise<T>,
    priority: Priority = 'normal'
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
    priority: Priority = 'normal'
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

  /**
   * Expand pool to target size for lightweight operations.
   * Creates new workers up to maxPoolSize.
   */
  private async expandPool(targetSize: number): Promise<void> {
    const actualTarget = Math.min(targetSize, this.maxPoolSize)

    while (this.workers.length < actualTarget) {
      const worker = new Worker(
        new URL("./processor.worker.ts", import.meta.url),
        { type: "module" }
      )
      const api = Comlink.wrap<ProcessorAPI>(worker)

      const newIndex = this.workers.length
      this.workers.push(worker)
      this.apis.push(api)
      this.available.add(newIndex)
    }

    this.poolSize = this.workers.length
    console.log(`Worker pool expanded to ${this.poolSize} workers`)
  }

  /**
   * Shrink pool back to normal size.
   * Terminates idle workers above normalPoolSize.
   */
  private shrinkPool(): void {
    while (this.workers.length > this.normalPoolSize) {
      // Only shrink if we have idle workers above normal size
      const lastIndex = this.workers.length - 1
      if (!this.available.has(lastIndex)) break

      this.available.delete(lastIndex)
      this.workers[lastIndex].terminate()
      this.workers.pop()
      this.apis.pop()
    }

    this.poolSize = this.workers.length
    if (this.poolSize < this.maxPoolSize) {
      console.log(`Worker pool shrunk to ${this.poolSize} workers`)
    }
  }

  /**
   * Execute a probe task with pool expansion for maximum throughput.
   */
  async executeProbe<T>(
    task: (api: Comlink.Remote<ProcessorAPI>) => Promise<T>
  ): Promise<T> {
    // Expand pool for probe work if there's queued work
    if (this.getQueueLength() > 0 && this.poolSize < this.maxPoolSize) {
      await this.expandPool(this.maxPoolSize)
    }

    return this.execute(task, 'high')
  }

  /**
   * Signal that probe phase is complete, pool can shrink.
   */
  probePhaseComplete(): void {
    this.shrinkPool()
  }

  terminate(): void {
    this.workers.forEach(w => w.terminate())
    this.workers = []
    this.apis = []
    this.available.clear()
    this.queues = { high: [], normal: [], low: [] }
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
    return this.queues.high.length + this.queues.normal.length + this.queues.low.length
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
