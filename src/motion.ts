import type { RenderGlyph, RotationMode } from './types'
import { hashKey, randomFromSeed } from './utils'

export function getScrambleOffset(
  rotation: RotationMode,
  key: string,
  deltaX: number,
  deltaY: number,
  motionEpoch: number,
): { x: number, y: number } {
  const motion = getGlyphMotion(key, motionEpoch)
  const travel = Math.hypot(deltaX, deltaY)
  const scrambleBoost = travel < 10 ? 1.5 : travel < 24 ? 1.2 : 1
  switch (rotation) {
    case 'landscape-left':
      return {
        x: (12 + motion.driftX) * scrambleBoost,
        y: (8 + motion.driftY * 0.8) * scrambleBoost,
      }
    case 'landscape-right':
      return {
        x: (-12 + motion.driftX) * scrambleBoost,
        y: (8 + motion.driftY * 0.8) * scrambleBoost,
      }
    case 'portrait-upside-down':
      return {
        x: motion.driftX * scrambleBoost,
        y: (-14 + motion.driftY) * scrambleBoost,
      }
    case 'portrait':
      return {
        x: motion.driftX * scrambleBoost,
        y: (12 + motion.driftY) * scrambleBoost,
      }
  }
}

export function getScrambleRotation(
  key: string,
  angleDeltaDeg: number,
  deltaX: number,
  deltaY: number,
  motionEpoch: number,
): number {
  const motion = getGlyphMotion(key, motionEpoch)
  const travel = Math.hypot(deltaX, deltaY)
  const cancellation = travel < 10 ? 1 : travel < 24 ? 0.86 : 0.72
  return -angleDeltaDeg * cancellation + motion.twistDeg
}

export function getGlyphMotion(
  key: string,
  motionEpoch: number,
): { delayMs: number, durationMs: number, driftX: number, driftY: number, twistDeg: number } {
  const seed = hashKey(`${key}:${motionEpoch}`)
  const delayMs = Math.floor(randomFromSeed(seed) * 170)
  const durationMs = 40 + Math.floor(randomFromSeed(seed + 1) * 180)
  const driftX = (randomFromSeed(seed + 2) - 0.5) * 24
  const driftY = (randomFromSeed(seed + 3) - 0.5) * 24
  const twistDeg = (randomFromSeed(seed + 4) - 0.5) * 24
  return { delayMs, durationMs, driftX, driftY, twistDeg }
}

export function buildScrambleTargets(glyphs: RenderGlyph[], motionEpoch: number): Map<string, RenderGlyph> {
  const targets = new Map<string, RenderGlyph>()
  const length = glyphs.length
  if (length === 0) return targets

  const rawShift = 17 + (motionEpoch % 23)
  const shift = rawShift % length === 0 ? (rawShift + 1) % length || 1 : rawShift % length

  for (let index = 0; index < length; index++) {
    const glyph = glyphs[index]!
    const target = glyphs[(index + shift) % length]!
    targets.set(glyph.key, target)
  }

  return targets
}
