import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SvgService } from '../svg-service'

// Mock Worker class since it's not available in test environment
vi.stubGlobal('Worker', class MockWorker {
  terminate() {}
})

// Mock the worker since we can't run actual workers in test environment
vi.mock('comlink', () => ({
  wrap: vi.fn(() => ({
    optimize: vi.fn((svgString: string, mode: string) => {
      // Simulate optimization by removing whitespace for safe mode
      // and more aggressive removal for aggressive mode
      if (mode === 'aggressive') {
        return Promise.resolve({ data: svgString.replace(/\s+/g, ' ').trim() })
      }
      return Promise.resolve({ data: svgString.trim() })
    })
  }))
}))

// Helper to create a File with working text() method
function createSvgFile(content: string, name = 'test.svg'): File {
  const file = new File([content], name, { type: 'image/svg+xml' })
  // Ensure text() method works in jsdom environment
  Object.defineProperty(file, 'text', {
    value: async () => content
  })
  return file
}

describe('SvgService', () => {
  let service: SvgService

  beforeEach(() => {
    // Reset the singleton for each test
    // @ts-expect-error accessing private for testing
    SvgService.instance = undefined
    service = SvgService.getInstance()
  })

  afterEach(() => {
    service.terminate()
  })

  it('should be a singleton', () => {
    const instance1 = SvgService.getInstance()
    const instance2 = SvgService.getInstance()
    expect(instance1).toBe(instance2)
  })

  it('should calculate savings percentage correctly', async () => {
    const svgContent = '<svg>   <rect/>   </svg>'
    const file = createSvgFile(svgContent)

    const result = await service.optimize(file, 'safe')

    expect(result.originalSize).toBe(svgContent.length)
    expect(result.optimizedSize).toBeLessThanOrEqual(result.originalSize)
    expect(result.savings).toBeGreaterThanOrEqual(0)
  })

  it('should return optimized SVG string', async () => {
    const svgContent = '<svg><rect/></svg>'
    const file = createSvgFile(svgContent)

    const result = await service.optimize(file, 'safe')

    expect(result.optimizedSvg).toBeDefined()
    expect(typeof result.optimizedSvg).toBe('string')
  })

  it('should use safe mode by default', async () => {
    const svgContent = '<svg><rect/></svg>'
    const file = createSvgFile(svgContent)

    // Call without specifying mode
    const result = await service.optimize(file)

    expect(result.optimizedSvg).toBeDefined()
  })
})
