import { GlyphallLayoutEngine } from './layout'
import { buildScrambleTargets, getGlyphMotion, getScrambleOffset, getScrambleRotation } from './motion'
import { getEntryOffset, inferRotationFromSensor, inferViewportRotation, normalizeAngleDelta } from './orientation'
import type { GlyphallController, GlyphallElements, GlyphallOptions, GlyphallResolvedOptions, LayoutState, RotationMode } from './types'
import { resolveOptions, splitDropCapText } from './utils'

export function createGlyphall(elements: GlyphallElements, options: GlyphallOptions): GlyphallController {
  const glyphall = new Glyphall(elements, options)
  return {
    ready: glyphall.ready,
    destroy: () => glyphall.destroy(),
    relayout: () => glyphall.relayout(),
    setText: text => glyphall.setText(text),
    setRotation: rotation => glyphall.setRotation(rotation),
    getRotation: () => glyphall.getRotation(),
  }
}

class Glyphall {
  readonly ready: Promise<void>

  private readonly viewport: HTMLDivElement
  private readonly pageFrame: HTMLDivElement
  private readonly page: HTMLDivElement
  private readonly sensorToggle: HTMLButtonElement | null
  private readonly layoutEngine: GlyphallLayoutEngine

  private options: GlyphallResolvedOptions
  private currentState: LayoutState | null = null
  private readonly glyphElements = new Map<string, HTMLSpanElement>()
  private resizeTimer = 0
  private activeRotation: RotationMode = inferViewportRotation()
  private pendingRotation: RotationMode | null = null
  private pendingRotationSince = 0
  private sensorListenerStarted = false
  private sensorEventsSeen = false
  private sensorFallbackTimer = 0
  private motionEpoch = 0
  private settleTimer = 0
  private renderToken = 0
  private destroyed = false

  constructor(elements: GlyphallElements, options: GlyphallOptions) {
    this.viewport = elements.viewport
    this.pageFrame = elements.pageFrame
    this.page = elements.page
    this.sensorToggle = elements.sensorToggle ?? null
    this.options = resolveOptions(options)
    this.layoutEngine = new GlyphallLayoutEngine(
      this.options,
      splitDropCapText(this.options.text, this.options.dropCap.enabled),
    )
    this.ready = this.init()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    window.clearTimeout(this.resizeTimer)
    window.clearTimeout(this.sensorFallbackTimer)
    window.clearTimeout(this.settleTimer)
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('orientationchange', this.handleViewportOrientationChange)
    window.removeEventListener('deviceorientation', this.handleDeviceOrientation as EventListener)
    for (const [, element] of this.glyphElements) {
      element.remove()
    }
    this.glyphElements.clear()
  }

  relayout(): void {
    if (this.destroyed) return
    this.queueLayout(false)
  }

  setText(text: string): void {
    this.options = {
      ...this.options,
      text,
    }
    this.layoutEngine.update(this.options, splitDropCapText(text, this.options.dropCap.enabled))
    this.currentState = null
    this.queueLayout(true)
  }

  setRotation(rotation: RotationMode): void {
    this.activeRotation = rotation
    this.pendingRotation = null
    this.queueLayout(false)
  }

  getRotation(): RotationMode {
    return this.activeRotation
  }

  private async init(): Promise<void> {
    await (document.fonts?.ready ?? Promise.resolve())
    if (this.destroyed) return
    this.setupSensorAccess()
    window.addEventListener('resize', this.handleResize)
    window.addEventListener('orientationchange', this.handleViewportOrientationChange)
    this.queueLayout(true)
  }

  private readonly handleResize = (): void => {
    window.clearTimeout(this.resizeTimer)
    this.resizeTimer = window.setTimeout(() => {
      this.queueLayout(false)
    }, 40)
  }

  private readonly handleViewportOrientationChange = (): void => {
    if (this.pendingRotation !== null) return
    this.activeRotation = inferViewportRotation()
    this.queueLayout(false)
  }

  private queueLayout(isInitial: boolean): void {
    const nextState = this.layoutEngine.computeLayout(
      this.activeRotation,
      Math.floor(this.viewport.clientWidth),
      Math.floor(this.viewport.clientHeight),
    )
    if (nextState === null) return

    if (
      this.currentState !== null &&
      this.currentState.rotation === nextState.rotation &&
      this.currentState.width === nextState.width &&
      this.currentState.height === nextState.height &&
      this.currentState.glyphs.length === nextState.glyphs.length &&
      this.currentState.glyphs.every((glyph, index) => glyph.text === nextState.glyphs[index]?.text)
    ) {
      return
    }

    this.renderState(nextState, isInitial)
    this.currentState = nextState
  }

  private renderState(nextState: LayoutState, isInitial: boolean): void {
    if (!isInitial) {
      this.motionEpoch++
    }
    this.renderToken++
    if (this.settleTimer !== 0) {
      window.clearTimeout(this.settleTimer)
      this.settleTimer = 0
    }

    const frameWidth = nextState.width + nextState.padLeft + nextState.padRight
    const frameHeight = Math.max(nextState.height + nextState.padTop + nextState.padBottom, 1)
    const createdKeys = new Set<string>()
    const previousGlyphByKey = new Map(this.currentState?.glyphs.map(glyph => [glyph.key, glyph]) ?? [])
    const previousAngleDeg = this.currentState?.angleDeg ?? nextState.angleDeg
    const angleDeltaDeg = normalizeAngleDelta(nextState.angleDeg - previousAngleDeg)
    const scrambleTargets = buildScrambleTargets(nextState.glyphs, this.motionEpoch)

    this.pageFrame.style.width = `${frameWidth}px`
    this.pageFrame.style.height = `${frameHeight}px`
    this.pageFrame.style.transition = isInitial
      ? 'none'
      : 'transform 720ms cubic-bezier(0.18, 0.84, 0.24, 1), width 420ms ease, height 420ms ease'
    this.pageFrame.style.transform = `translate(-50%, -50%) rotate(${nextState.angleDeg}deg)`
    this.page.style.width = `${frameWidth}px`
    this.page.style.height = `${frameHeight}px`

    const liveKeys = new Set<string>()
    for (const glyph of nextState.glyphs) {
      liveKeys.add(glyph.key)
      let element = this.glyphElements.get(glyph.key)
      if (!element) {
        element = document.createElement('span')
        element.className = 'glyphall-glyph'
        element.dataset.key = glyph.key
        element.textContent = glyph.text
        element.style.position = 'absolute'
        element.style.left = `${nextState.padLeft}px`
        element.style.top = `${nextState.padTop}px`
        element.style.display = 'inline-block'
        element.style.whiteSpace = 'pre'
        element.style.color = 'inherit'
        element.style.willChange = 'transform, opacity'
        element.style.pointerEvents = 'none'
        this.page.appendChild(element)
        this.glyphElements.set(glyph.key, element)
        createdKeys.add(glyph.key)
        this.configureGlyphTransition(element, glyph.key, true)
        element.style.opacity = '0'
        const entryOffset = getEntryOffset(nextState.rotation)
        element.style.transform = `translate(${glyph.x + entryOffset.x}px, ${glyph.y + entryOffset.y}px) rotate(0deg)`
      }

      const glyphFontSizePx = glyph.fontSizePx ?? nextState.fontSizePx
      const glyphLineHeightPx = glyph.lineHeightPx ?? nextState.lineHeightPx
      element.style.font = `${glyphFontSizePx}px/${glyphLineHeightPx}px ${this.options.fontFamily}`
      element.style.width = `${Math.max(1, Math.ceil(glyph.width) + 1)}px`
      this.configureGlyphTransition(element, glyph.key, isInitial)
    }

    for (const [key, element] of this.glyphElements) {
      if (liveKeys.has(key)) continue
      element.style.transition = 'opacity 180ms ease'
      element.style.opacity = '0'
      window.setTimeout(() => {
        element.remove()
        this.glyphElements.delete(key)
      }, 220)
    }

    if (isInitial) {
      requestAnimationFrame(() => {
        for (const glyph of nextState.glyphs) {
          const element = this.glyphElements.get(glyph.key)
          if (!element) continue
          element.style.opacity = '1'
          element.style.transform = `translate(${glyph.x}px, ${glyph.y}px) rotate(0deg)`
        }
      })
      return
    }

    requestAnimationFrame(() => {
      const settlingKeys = new Set<string>()
      for (const glyph of nextState.glyphs) {
        const element = this.glyphElements.get(glyph.key)
        if (!element) continue

        element.style.opacity = '1'
        const previousGlyph = previousGlyphByKey.get(glyph.key)
        const deltaX = previousGlyph ? glyph.x - previousGlyph.x : glyph.width
        const deltaY = previousGlyph ? glyph.y - previousGlyph.y : nextState.lineHeightPx
        const scrambleTarget = scrambleTargets.get(glyph.key) ?? glyph
        const scrambleOffset = getScrambleOffset(nextState.rotation, glyph.key, deltaX, deltaY, this.motionEpoch)
        const scrambleRotation = getScrambleRotation(glyph.key, angleDeltaDeg, deltaX, deltaY, this.motionEpoch)
        settlingKeys.add(glyph.key)
        element.style.transform = `translate(${scrambleTarget.x + scrambleOffset.x}px, ${scrambleTarget.y + scrambleOffset.y}px) rotate(${scrambleRotation}deg)`
      }

      if (settlingKeys.size > 0) {
        const token = this.renderToken
        this.settleTimer = window.setTimeout(() => {
          if (token !== this.renderToken) return
          for (const key of settlingKeys) {
            const glyph = nextState.glyphs.find(item => item.key === key)
            const element = glyph && this.glyphElements.get(key)
            if (!glyph || !element) continue
            element.style.transform = `translate(${glyph.x}px, ${glyph.y}px) rotate(0deg)`
          }
        }, 170)
      }
    })
  }

  private configureGlyphTransition(element: HTMLSpanElement, key: string, isInitial: boolean): void {
    const motion = getGlyphMotion(key, this.motionEpoch)
    element.style.transition = isInitial
      ? `transform ${280 + motion.durationMs * 0.22}ms ease-out ${motion.delayMs * 0.35}ms, opacity 180ms ease-out ${motion.delayMs * 0.2}ms`
      : `transform ${640 + motion.durationMs}ms cubic-bezier(0.12, 0.9, 0.22, 1) ${motion.delayMs}ms, opacity 180ms ease-out ${Math.min(motion.delayMs, 120)}ms`
  }

  private setupSensorAccess(): void {
    if (!this.options.sensors || !('DeviceOrientationEvent' in window)) return

    const orientationCtor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }

    if (!window.isSecureContext) {
      if (!this.sensorToggle) return
      this.sensorToggle.hidden = false
      this.sensorToggle.textContent = this.options.motionUnavailableLabel
      this.sensorToggle.disabled = true
      return
    }

    if (typeof orientationCtor.requestPermission === 'function') {
      const toggle = this.sensorToggle
      if (!toggle) return
      toggle.hidden = false
      toggle.addEventListener('click', async () => {
        const result = await orientationCtor.requestPermission?.()
        if (result === 'granted') {
          toggle.hidden = true
          this.startSensorTracking()
        }
      }, { once: true })
      return
    }

    this.startSensorTracking()
    const toggle = this.sensorToggle
    if (!toggle) return
    this.sensorFallbackTimer = window.setTimeout(() => {
      if (this.sensorEventsSeen) return
      toggle.hidden = false
      toggle.textContent = this.options.motionRetryLabel
      toggle.onclick = () => {
        toggle.hidden = true
        this.startSensorTracking()
      }
    }, 1500)
  }

  private startSensorTracking(): void {
    if (this.sensorListenerStarted) return
    this.sensorListenerStarted = true
    window.addEventListener('deviceorientation', this.handleDeviceOrientation as EventListener)
  }

  private readonly handleDeviceOrientation = (event: DeviceOrientationEvent): void => {
    this.sensorEventsSeen = true
    if (this.sensorFallbackTimer !== 0) {
      window.clearTimeout(this.sensorFallbackTimer)
      this.sensorFallbackTimer = 0
    }
    if (this.sensorToggle) {
      this.sensorToggle.hidden = true
    }

    const candidate = inferRotationFromSensor(event.beta, event.gamma, this.activeRotation)
    if (candidate === null) return
    if (candidate === this.activeRotation) {
      this.pendingRotation = null
      return
    }

    const now = performance.now()
    if (this.pendingRotation !== candidate) {
      this.pendingRotation = candidate
      this.pendingRotationSince = now
      return
    }

    if (now - this.pendingRotationSince < this.options.sensorDebounceMs) return

    this.activeRotation = candidate
    this.pendingRotation = null
    this.queueLayout(false)
  }
}
