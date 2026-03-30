import type { RotationMode } from './types'

export function inferRotationFromSensor(
  beta: number | null,
  gamma: number | null,
  fallback: RotationMode,
): RotationMode | null {
  if (beta === null || gamma === null) return null

  if (Math.abs(gamma) > 42) {
    return gamma > 0 ? 'landscape-right' : 'landscape-left'
  }

  if (Math.abs(beta) > 42) {
    return beta > 0 ? 'portrait' : 'portrait-upside-down'
  }

  return fallback
}

export function inferViewportRotation(): RotationMode {
  return window.innerWidth > window.innerHeight ? 'landscape-right' : 'portrait'
}

export function rotationToAngle(rotation: RotationMode): number {
  switch (rotation) {
    case 'portrait':
      return 0
    case 'landscape-left':
      return 90
    case 'portrait-upside-down':
      return 180
    case 'landscape-right':
      return -90
  }
}

export function normalizeAngleDelta(delta: number): number {
  let normalized = delta
  while (normalized > 180) normalized -= 360
  while (normalized < -180) normalized += 360
  return normalized
}

export function getEntryOffset(rotation: RotationMode): { x: number, y: number } {
  switch (rotation) {
    case 'landscape-left':
      return { x: 24, y: -12 }
    case 'landscape-right':
      return { x: -24, y: -12 }
    case 'portrait-upside-down':
      return { x: 0, y: 22 }
    case 'portrait':
      return { x: 0, y: -22 }
  }
}
