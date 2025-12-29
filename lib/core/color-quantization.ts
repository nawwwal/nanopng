/**
 * Color Quantization using Modified Median Cut Algorithm
 * Based on TinyPNG's approach for intelligent palette reduction
 */

export interface Color {
  r: number
  g: number
  b: number
  a: number
  count: number
}

interface ColorBox {
  colors: Color[]
  rMin: number
  rMax: number
  gMin: number
  gMax: number
  bMin: number
  bMax: number
}

/**
 * Convert to premultiplied alpha color space
 * This ensures transparent colors are weighted appropriately
 */
function toPremultiplied(color: Color): Color {
  const alpha = color.a / 255
  return {
    r: Math.round(color.r * alpha),
    g: Math.round(color.g * alpha),
    b: Math.round(color.b * alpha),
    a: color.a,
    count: color.count,
  }
}

/**
 * Convert from premultiplied alpha back to straight alpha
 */
function fromPremultiplied(color: Color): Color {
  if (color.a === 0) return { r: 0, g: 0, b: 0, a: 0, count: color.count }
  const alpha = color.a / 255
  return {
    r: Math.round(color.r / alpha),
    g: Math.round(color.g / alpha),
    b: Math.round(color.b / alpha),
    a: color.a,
    count: color.count,
  }
}

/**
 * Build color histogram from image data
 */
export function buildHistogram(imageData: ImageData): Color[] {
  const colorMap = new Map<string, Color>()
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    // Convert to premultiplied alpha
    const alpha = a / 255
    const pr = Math.round(r * alpha)
    const pg = Math.round(g * alpha)
    const pb = Math.round(b * alpha)

    const key = `${pr},${pg},${pb},${a}`
    const existing = colorMap.get(key)

    if (existing) {
      existing.count++
    } else {
      colorMap.set(key, { r: pr, g: pg, b: pb, a, count: 1 })
    }
  }

  return Array.from(colorMap.values())
}

/**
 * Calculate the volume of a color box
 */
function getBoxVolume(box: ColorBox): number {
  return (box.rMax - box.rMin + 1) * (box.gMax - box.gMin + 1) * (box.bMax - box.bMin + 1)
}

/**
 * Calculate the population (total pixel count) of a color box
 */
function getBoxPopulation(box: ColorBox): number {
  return box.colors.reduce((sum, color) => sum + color.count, 0)
}

/**
 * Find the longest dimension of a color box
 */
function getLongestDimension(box: ColorBox): "r" | "g" | "b" {
  const rRange = box.rMax - box.rMin
  const gRange = box.gMax - box.gMin
  const bRange = box.bMax - box.bMin

  if (rRange >= gRange && rRange >= bRange) return "r"
  if (gRange >= bRange) return "g"
  return "b"
}

/**
 * Split a color box along its longest dimension
 */
function splitBox(box: ColorBox): [ColorBox, ColorBox] {
  const dimension = getLongestDimension(box)
  const colors = [...box.colors].sort((a, b) => a[dimension] - b[dimension])

  // Find median by population
  const totalPopulation = getBoxPopulation(box)
  let populationSum = 0
  let medianIndex = 0

  for (let i = 0; i < colors.length; i++) {
    populationSum += colors[i].count
    if (populationSum >= totalPopulation / 2) {
      medianIndex = i
      break
    }
  }

  // Ensure both sides have at least one color to avoid empty boxes
  // Adjust median index if it would create an empty box
  if (medianIndex === colors.length - 1 && colors.length > 1) {
    medianIndex = colors.length - 2
  } else if (medianIndex === 0 && colors.length > 1) {
    medianIndex = 1
  }

  // Split at median
  const leftColors = colors.slice(0, medianIndex + 1)
  const rightColors = colors.slice(medianIndex + 1)

  const createBox = (boxColors: Color[]): ColorBox => {
    if (boxColors.length === 0) {
      return {
        colors: [],
        rMin: 0,
        rMax: 0,
        gMin: 0,
        gMax: 0,
        bMin: 0,
        bMax: 0,
      }
    }

    return {
      colors: boxColors,
      rMin: Math.min(...boxColors.map((c) => c.r)),
      rMax: Math.max(...boxColors.map((c) => c.r)),
      gMin: Math.min(...boxColors.map((c) => c.g)),
      gMax: Math.max(...boxColors.map((c) => c.g)),
      bMin: Math.min(...boxColors.map((c) => c.b)),
      bMax: Math.max(...boxColors.map((c) => c.b)),
    }
  }

  return [createBox(leftColors), createBox(rightColors)]
}

/**
 * Modified Median Cut Algorithm
 * Implements TinyPNG's variance-minimizing approach
 */
export function medianCut(colors: Color[], maxColors: number): Color[] {
  if (colors.length <= maxColors) {
    return colors
  }

  // Initialize with one box containing all colors
  const boxes: ColorBox[] = [
    {
      colors,
      rMin: Math.min(...colors.map((c) => c.r)),
      rMax: Math.max(...colors.map((c) => c.r)),
      gMin: Math.min(...colors.map((c) => c.g)),
      gMax: Math.max(...colors.map((c) => c.g)),
      bMin: Math.min(...colors.map((c) => c.b)),
      bMax: Math.max(...colors.map((c) => c.b)),
    },
  ]

  // Split boxes until we reach desired number
  while (boxes.length < maxColors) {
    // Phase 1: Split by population (first 75% of splits)
    const usePopulation = boxes.length < maxColors * 0.75

    // Find box to split
    let boxToSplit: ColorBox | null = null
    let maxScore = 0

    for (const box of boxes) {
      if (box.colors.length <= 1) continue

      const score = usePopulation ? getBoxPopulation(box) : getBoxVolume(box) * getBoxPopulation(box)

      if (score > maxScore) {
        maxScore = score
        boxToSplit = box
      }
    }

    if (!boxToSplit) break

    // Split the selected box
    const boxIndex = boxes.indexOf(boxToSplit)
    const [box1, box2] = splitBox(boxToSplit)
    boxes.splice(boxIndex, 1, box1, box2)
  }

  // Extract representative color from each box (weighted average)
  return boxes.map((box) => {
    const population = getBoxPopulation(box)
    if (population === 0) return { r: 0, g: 0, b: 0, a: 255, count: 0 }

    let rSum = 0,
      gSum = 0,
      bSum = 0,
      aSum = 0
    for (const color of box.colors) {
      rSum += color.r * color.count
      gSum += color.g * color.count
      bSum += color.b * color.count
      aSum += color.a * color.count
    }

    return {
      r: Math.round(rSum / population),
      g: Math.round(gSum / population),
      b: Math.round(bSum / population),
      a: Math.round(aSum / population),
      count: population,
    }
  })
}

/**
 * K-means clustering refinement (Voronoi iteration)
 * Optimizes the palette to minimize quantization error
 */
export function kmeansRefinement(colors: Color[], palette: Color[], maxIterations = 5): Color[] {
  const currentPalette = [...palette]

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each color to nearest palette color
    const clusters: Color[][] = Array.from({ length: currentPalette.length }, () => [])

    for (const color of colors) {
      let minDist = Number.POSITIVE_INFINITY
      let nearestIndex = 0

      for (let i = 0; i < currentPalette.length; i++) {
        const dist = colorDistance(color, currentPalette[i])
        if (dist < minDist) {
          minDist = dist
          nearestIndex = i
        }
      }

      clusters[nearestIndex].push(color)
    }

    // Update palette colors to cluster centroids
    let changed = false
    for (let i = 0; i < currentPalette.length; i++) {
      if (clusters[i].length === 0) continue

      const totalCount = clusters[i].reduce((sum, c) => sum + c.count, 0)
      const newColor = {
        r: Math.round(clusters[i].reduce((sum, c) => sum + c.r * c.count, 0) / totalCount),
        g: Math.round(clusters[i].reduce((sum, c) => sum + c.g * c.count, 0) / totalCount),
        b: Math.round(clusters[i].reduce((sum, c) => sum + c.b * c.count, 0) / totalCount),
        a: Math.round(clusters[i].reduce((sum, c) => sum + c.a * c.count, 0) / totalCount),
        count: totalCount,
      }

      if (
        newColor.r !== currentPalette[i].r ||
        newColor.g !== currentPalette[i].g ||
        newColor.b !== currentPalette[i].b ||
        newColor.a !== currentPalette[i].a
      ) {
        changed = true
        currentPalette[i] = newColor
      }
    }

    // Converged if no changes
    if (!changed) break
  }

  // Return palette in premultiplied alpha space (consistent with buildHistogram)
  // findNearestColor expects premultiplied colors, so we keep them in this space
  return currentPalette
}

/**
 * Calculate color distance in premultiplied alpha space
 */
function colorDistance(c1: Color, c2: Color): number {
  const dr = c1.r - c2.r
  const dg = c1.g - c2.g
  const db = c1.b - c2.b
  const da = c1.a - c2.a
  return dr * dr + dg * dg + db * db + da * da
}

/**
 * Find nearest palette color for a given color
 * Both color and palette are expected to be in premultiplied alpha space
 */
export function findNearestColor(color: Color, palette: Color[]): number {
  let minDist = Number.POSITIVE_INFINITY
  let nearestIndex = 0

  // Convert input color to premultiplied if it's not already
  // (palette from kmeansRefinement is already in premultiplied space)
  const premultColor = toPremultiplied(color)

  for (let i = 0; i < palette.length; i++) {
    // Palette colors are already in premultiplied space from kmeansRefinement
    const dist = colorDistance(premultColor, palette[i])
    if (dist < minDist) {
      minDist = dist
      nearestIndex = i
    }
  }

  return nearestIndex
}

