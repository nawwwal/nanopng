import * as Comlink from 'comlink'
import type { SvgOptimizerAPI } from '@/lib/workers/svg-optimizer.worker'
import type { SvgOptimizationMode, SvgOptimizationResult } from '@/lib/types/svg'

export class SvgService {
  private static instance: SvgService
  private worker: Worker | null = null
  private api: Comlink.Remote<SvgOptimizerAPI> | null = null

  private constructor() {}

  static getInstance(): SvgService {
    if (!SvgService.instance) {
      SvgService.instance = new SvgService()
    }
    return SvgService.instance
  }

  private async initialize(): Promise<Comlink.Remote<SvgOptimizerAPI>> {
    if (!this.api) {
      this.worker = new Worker(
        new URL('../workers/svg-optimizer.worker.ts', import.meta.url),
        { type: 'module' }
      )
      this.api = Comlink.wrap<SvgOptimizerAPI>(this.worker)
    }
    return this.api
  }

  async optimize(
    file: File,
    mode: SvgOptimizationMode = 'safe'
  ): Promise<SvgOptimizationResult> {
    const api = await this.initialize()
    const svgString = await file.text()
    const originalSize = svgString.length

    const result = await api.optimize(svgString, mode)
    const optimizedSize = result.data.length
    const savings = ((originalSize - optimizedSize) / originalSize) * 100

    return {
      optimizedSvg: result.data,
      originalSize,
      optimizedSize,
      savings: Math.max(0, savings)
    }
  }

  terminate(): void {
    this.worker?.terminate()
    this.worker = null
    this.api = null
  }
}
