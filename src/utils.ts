import type { GlyphallOptions, GlyphallResolvedOptions } from './types'
import { DEFAULT_OPTIONS } from './types'

export function resolveOptions(options: GlyphallOptions): GlyphallResolvedOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    dropCap: {
      ...DEFAULT_OPTIONS.dropCap,
      ...options.dropCap,
    },
  }
}

export function splitDropCapText(text: string, useDropCap: boolean): { head: string, body: string } {
  if (!useDropCap) {
    return { head: '', body: text }
  }

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const iterator = segmenter.segment(text)[Symbol.iterator]()
  const first = iterator.next()
  if (first.done) return { head: '', body: '' }
  const head = first.value.segment
  return {
    head,
    body: text.slice(head.length).trimStart(),
  }
}

export function countSpaces(text: string): number {
  let count = 0
  for (let index = 0; index < text.length; index++) {
    if (text[index] === ' ') count++
  }
  return count
}

export function hashKey(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function randomFromSeed(seed: number): number {
  let value = seed >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  return (value >>> 0) / 4294967295
}
