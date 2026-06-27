export interface Rect { x: number; y: number; width: number; height: number }

export interface DisplayInfo {
  id: number
  label: string
  bounds: Rect          // DIPs
  scaleFactor: number
  sourceId: string      // desktopCapturer source id for this display
}
