import { optimize, Config } from 'svgo/browser'
import * as Comlink from 'comlink'

const safeConfig: Config = {
  plugins: [
    'removeDoctype',
    'removeXMLProcInst',
    'removeComments',
    'removeMetadata',
    'removeEditorsNSData',
    'cleanupAttrs',
    'mergeStyles',
    'inlineStyles',
    'minifyStyles',
    'removeEmptyAttrs',
    'removeEmptyContainers',
    'cleanupIds',
  ]
}

const aggressiveConfig: Config = {
  plugins: [
    ...(safeConfig.plugins as string[]),
    'removeUselessDefs',
    { name: 'cleanupNumericValues', params: { floatPrecision: 2 } },
    'convertColors',
    'removeHiddenElems',
    'convertShapeToPath',
    'convertPathData',
    'mergePaths',
    'collapseGroups',
  ] as Config['plugins']
}

export interface SvgOptimizerAPI {
  optimize(svgString: string, mode: 'safe' | 'aggressive'): Promise<{
    data: string
    error?: string
  }>
}

const api: SvgOptimizerAPI = {
  async optimize(svgString: string, mode: 'safe' | 'aggressive') {
    try {
      const config = mode === 'aggressive' ? aggressiveConfig : safeConfig
      const result = optimize(svgString, config)
      return { data: result.data }
    } catch (error) {
      return { data: svgString, error: String(error) }
    }
  }
}

Comlink.expose(api)
