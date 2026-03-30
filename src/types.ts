export type RotationMode = 'portrait' | 'landscape-left' | 'portrait-upside-down' | 'landscape-right'

export type GlyphallElements = {
  viewport: HTMLDivElement
  pageFrame: HTMLDivElement
  page: HTMLDivElement
  sensorToggle?: HTMLButtonElement | null
}

export type GlyphallDropCapOptions = {
  enabled?: boolean
  lines?: number
  scale?: number
  gapRatio?: number
  topLiftRatio?: number
}

export type GlyphallOptions = {
  text: string
  fontFamily?: string
  maxFontSizePx?: number
  minFontSizePx?: number
  lineHeightRatio?: number
  pagePadX?: number
  pagePadY?: number
  sensors?: boolean
  sensorDebounceMs?: number
  motionUnavailableLabel?: string
  motionRetryLabel?: string
  dropCap?: GlyphallDropCapOptions
}

export type GlyphallController = {
  ready: Promise<void>
  destroy(): void
  relayout(): void
  setText(text: string): void
  setRotation(rotation: RotationMode): void
  getRotation(): RotationMode
}

export type RenderGlyph = {
  key: string
  text: string
  x: number
  y: number
  width: number
  fontSizePx?: number
  lineHeightPx?: number
}

export type FlowLine = {
  text: string
  width: number
  x: number
  y: number
}

export type LayoutState = {
  rotation: RotationMode
  angleDeg: number
  font: string
  fontSizePx: number
  lineHeightPx: number
  padTop: number
  padRight: number
  padBottom: number
  padLeft: number
  width: number
  height: number
  glyphs: RenderGlyph[]
}

export type GlyphallResolvedOptions = {
  text: string
  fontFamily: string
  maxFontSizePx: number
  minFontSizePx: number
  lineHeightRatio: number
  pagePadX: number
  pagePadY: number
  sensors: boolean
  sensorDebounceMs: number
  motionUnavailableLabel: string
  motionRetryLabel: string
  dropCap: Required<GlyphallDropCapOptions>
}

export const DEFAULT_OPTIONS: GlyphallResolvedOptions = {
  text: '',
  fontFamily: 'Georgia, serif',
  maxFontSizePx: 18,
  minFontSizePx: 14,
  lineHeightRatio: 1.58,
  pagePadX: 28,
  pagePadY: 24,
  sensors: true,
  sensorDebounceMs: 140,
  motionUnavailableLabel: 'Motion needs HTTPS in Chrome',
  motionRetryLabel: 'Retry motion',
  dropCap: {
    enabled: true,
    lines: 3,
    scale: 3.4,
    gapRatio: 0.4,
    topLiftRatio: 0.24,
  },
}
