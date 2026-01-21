export type SvgOptimizationMode = 'safe' | 'aggressive'

export interface SvgOptimizationOptions {
  mode: SvgOptimizationMode
}

export interface SvgOptimizationResult {
  optimizedSvg: string
  originalSize: number
  optimizedSize: number
  savings: number // percentage
}
