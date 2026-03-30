import { layoutNextLine, prepareWithSegments, type LayoutCursor, type PreparedTextWithSegments } from '@chenglou/pretext'
import type { FlowLine, GlyphallResolvedOptions, LayoutState, RenderGlyph, RotationMode } from './types'
import { countSpaces } from './utils'
import { rotationToAngle } from './orientation'

type TextParts = { head: string, body: string }

export class GlyphallLayoutEngine {
  private readonly preparedByFont = new Map<string, PreparedTextWithSegments>()
  private measureContext: CanvasRenderingContext2D | null = null
  private graphemeSegmenter: Intl.Segmenter | null = null
  private options: GlyphallResolvedOptions
  private textParts: TextParts

  constructor(options: GlyphallResolvedOptions, textParts: TextParts) {
    this.options = options
    this.textParts = textParts
  }

  update(options: GlyphallResolvedOptions, textParts: TextParts): void {
    this.options = options
    this.textParts = textParts
    this.preparedByFont.clear()
  }

  computeLayout(rotation: RotationMode, viewportWidth: number, viewportHeight: number): LayoutState | null {
    const angleDeg = rotationToAngle(rotation)
    const isLandscape = rotation === 'landscape-left' || rotation === 'landscape-right'
    const logicalWidth = isLandscape ? viewportHeight : viewportWidth
    const logicalHeight = isLandscape ? viewportWidth : viewportHeight
    const padTop = this.options.pagePadY
    const padRight = this.options.pagePadX
    const padBottom = this.options.pagePadY
    const padLeft = this.options.pagePadX
    const innerWidth = Math.max(0, Math.floor(logicalWidth - padLeft - padRight))
    const availableHeight = Math.max(0, Math.floor(logicalHeight - padTop - padBottom))

    if (innerWidth <= 0 || availableHeight <= 0) return null

    let fontSizePx = this.options.maxFontSizePx
    let lineHeightPx = Math.round(fontSizePx * this.options.lineHeightRatio)
    let flowLayout = this.buildFlowLayout(fontSizePx, lineHeightPx, innerWidth)

    for (let candidate = this.options.maxFontSizePx; candidate >= this.options.minFontSizePx; candidate -= 1) {
      const candidateLineHeight = Math.round(candidate * this.options.lineHeightRatio)
      const candidateLayout = this.buildFlowLayout(candidate, candidateLineHeight, innerWidth)
      fontSizePx = candidate
      lineHeightPx = candidateLineHeight
      flowLayout = candidateLayout
      if (candidateLayout.height <= availableHeight) break
    }

    const font = `${fontSizePx}px ${this.options.fontFamily}`
    const glyphs = this.buildGlyphLayout(flowLayout.lines, font, fontSizePx, lineHeightPx, innerWidth, flowLayout.dropCap)

    return {
      rotation,
      angleDeg,
      font,
      fontSizePx,
      lineHeightPx,
      padTop,
      padRight,
      padBottom,
      padLeft,
      width: innerWidth,
      height: flowLayout.height,
      glyphs,
    }
  }

  private buildFlowLayout(fontSizePx: number, lineHeightPx: number, innerWidth: number): {
    lines: FlowLine[]
    height: number
    dropCap: RenderGlyph | null
  } {
    const font = `${fontSizePx}px ${this.options.fontFamily}`
    const ctx = this.getMeasureContext()
    ctx.font = font

    const dropCap = this.options.dropCap
    const dropCapFontSizePx = Math.round(fontSizePx * dropCap.scale)
    const dropCapHeight = lineHeightPx * dropCap.lines
    const dropCapTop = Math.round(-fontSizePx * dropCap.topLiftRatio)
    let dropCapGlyph: RenderGlyph | null = null
    let dropCapIndent = 0

    if (dropCap.enabled && this.textParts.head.length > 0) {
      ctx.font = `${dropCapFontSizePx}px ${this.options.fontFamily}`
      const dropCapWidth = ctx.measureText(this.textParts.head).width
      const dropCapGap = Math.round(fontSizePx * dropCap.gapRatio)
      dropCapIndent = Math.min(innerWidth * 0.46, Math.ceil(dropCapWidth + dropCapGap))
      dropCapGlyph = {
        key: 'g0',
        text: this.textParts.head,
        x: 0,
        y: dropCapTop,
        width: dropCapWidth,
        fontSizePx: dropCapFontSizePx,
        lineHeightPx: dropCapHeight,
      }
    }

    const prepared = this.getPrepared(fontSizePx)
    const lines: FlowLine[] = []
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
    let y = 0

    while (true) {
      const useInset = dropCap.enabled && lines.length < dropCap.lines && dropCapIndent > 0
      const width = Math.max(40, useInset ? innerWidth - dropCapIndent : innerWidth)
      const line = layoutNextLine(prepared, cursor, width)
      if (line === null) break
      lines.push({
        text: line.text,
        width: line.width,
        x: useInset ? dropCapIndent : 0,
        y,
      })
      cursor = line.end
      y += lineHeightPx
    }

    return {
      lines,
      height: Math.max(y, dropCapGlyph?.lineHeightPx ?? 0),
      dropCap: dropCapGlyph,
    }
  }

  private buildGlyphLayout(
    lines: FlowLine[],
    font: string,
    fontSizePx: number,
    lineHeightPx: number,
    innerWidth: number,
    dropCap: RenderGlyph | null,
  ): RenderGlyph[] {
    const ctx = this.getMeasureContext()
    ctx.font = font

    const glyphs: RenderGlyph[] = []
    let globalIndex = dropCap ? 1 : 0
    const trackingPx = fontSizePx * 0.02

    if (dropCap) {
      glyphs.push(dropCap)
    }

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]!
      const graphemes = this.segmentGraphemes(line.text)
      const spaceCount = countSpaces(line.text)
      const shouldJustify = lineIndex < lines.length - 1 && spaceCount > 0
      const lineTargetWidth = lineIndex < this.options.dropCap.lines ? innerWidth - line.x : innerWidth
      const extraPerSpace = shouldJustify ? Math.max(0, (Math.max(0, lineTargetWidth - 2) - line.width) / spaceCount) : 0
      let prefix = ''
      let spaceCountBefore = 0

      for (let graphemeIndex = 0; graphemeIndex < graphemes.length; graphemeIndex++) {
        const text = graphemes[graphemeIndex]!
        const advance = ctx.measureText(prefix).width + spaceCountBefore * extraPerSpace
        const x = line.x + advance
        prefix += text
        const nextSpaceCountBefore = spaceCountBefore + (text === ' ' ? 1 : 0)
        const shouldTrack = text !== ' ' && graphemes[graphemeIndex + 1] !== undefined && graphemes[graphemeIndex + 1] !== ' '
        const nextAdvance = ctx.measureText(prefix).width +
          nextSpaceCountBefore * extraPerSpace +
          (shouldTrack ? trackingPx : 0)
        const width = Math.max(0, nextAdvance - advance)
        glyphs.push({
          key: `g${globalIndex}`,
          text,
          x,
          y: line.y,
          width,
        })
        spaceCountBefore = nextSpaceCountBefore
        globalIndex++
      }
    }

    return glyphs
  }

  private getMeasureContext(): CanvasRenderingContext2D {
    if (this.measureContext) return this.measureContext
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context unavailable.')
    this.measureContext = context
    return context
  }

  private segmentGraphemes(text: string): string[] {
    if (!this.graphemeSegmenter) {
      this.graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    }

    const graphemes: string[] = []
    for (const segment of this.graphemeSegmenter.segment(text)) {
      graphemes.push(segment.segment)
    }
    return graphemes
  }

  private getPrepared(fontSizePx: number): PreparedTextWithSegments {
    const font = `${fontSizePx}px ${this.options.fontFamily}`
    const cached = this.preparedByFont.get(font)
    if (cached) return cached

    const prepared = prepareWithSegments(this.textParts.body, font, { whiteSpace: 'pre-wrap' })
    this.preparedByFont.set(font, prepared)
    return prepared
  }
}
