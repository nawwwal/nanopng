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
  private static readonly MAX_QUEUE_SIZE = 100
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

  constructor() {
    const cores = typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4

    // Pool size: 75% of cores (min 2, max 8)
    this.poolSize = Math.max(2, Math.min(8, Math.floor(cores * 0.75)))
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
        worker.onerror = (error) => {
          console.error(`Worker ${i} crashed:`, error)
          this.handleWorkerCrash(i)
        }
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

    // Check if queue is full
    if (this.getQueueLength() >= WorkerPool.MAX_QUEUE_SIZE) {
      return Promise.reject(new Error('Worker queue is full'))
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

  private handleWorkerCrash(index: number): void {
    this.available.delete(index)
    // Recreate worker with same pattern as initialize()
    const worker = new Worker(
      new URL('./processor.worker.ts', import.meta.url),
      { type: 'module' }
    )
    worker.onerror = (error) => {
      console.error(`Worker ${index} crashed:`, error)
      this.handleWorkerCrash(index)
    }
    this.workers[index] = worker
    this.apis[index] = Comlink.wrap<ProcessorAPI>(worker)
    this.available.add(index)
    this.processQueue()
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
