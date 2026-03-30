import { createGlyphall } from '../src/index'

const sampleText = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non nibh sed ipsum facilisis interdum. Integer feugiat, nunc a luctus convallis, tortor mauris tincidunt arcu, vitae volutpat nulla nibh vitae arcu. Praesent luctus, lorem ac vulputate consequat, sem mauris pharetra nisi, id feugiat augue odio ut erat. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Morbi in augue id eros tincidunt ultricies. Quisque accumsan, mauris et luctus viverra, risus sapien vulputate turpis, et aliquam nisl arcu vitae mi. Nulla facilisi. Donec dignissim, justo non aliquet suscipit, ligula turpis posuere turpis, et bibendum metus sem vel lacus. Curabitur id posuere tortor. Vivamus venenatis massa ac nunc cursus, sed dapibus augue pretium.',
].join('')

const viewport = document.querySelector<HTMLDivElement>('#viewport')
const pageFrame = document.querySelector<HTMLDivElement>('#page-frame')
const page = document.querySelector<HTMLDivElement>('#page')
const sensorToggle = document.querySelector<HTMLButtonElement>('#sensor-toggle')

if (!viewport || !pageFrame || !page || !sensorToggle) {
  throw new Error('Demo DOM nodes are missing.')
}

createGlyphall(
  {
    viewport,
    pageFrame,
    page,
    sensorToggle,
  },
  {
    text: sampleText,
    fontFamily: 'Georgia, serif',
    maxFontSizePx: 18,
    minFontSizePx: 14,
    lineHeightRatio: 1.58,
    pagePadX: 28,
    pagePadY: 24,
    sensors: true,
    dropCap: {
      enabled: true,
      lines: 3,
      scale: 3.4,
      gapRatio: 0.4,
      topLiftRatio: 0.24,
    },
  },
)
