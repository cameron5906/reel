import { screen } from 'electron'
import type { CursorFollow } from '@shared/types'
import { registry } from '../windows/registry'

type FlipFn = (value: boolean) => void

let config: CursorFollow = { smoothing: 0.2, offset: 48, autoFlip: true }
let active = false
let loop: NodeJS.Timeout | null = null
let returning: NodeJS.Timeout | null = null
let origin: { x: number; y: number } | null = null
const center = { x: 0, y: 0 }
let savedFlip = true
let lastFlip: boolean | null = null
let flipFn: FlipFn = () => {}

export function setFollowConfig(c: CursorFollow) {
  config = c
}

export function isFollowing() {
  return active
}

export function setFollow(on: boolean, currentFlip: boolean, fn: FlipFn) {
  if (on === active) return
  if (on) start(currentFlip, fn)
  else stop()
  registry.broadcast('follow:changed', active)
}

export function toggleFollow(currentFlip: boolean, fn: FlipFn) {
  setFollow(!active, currentFlip, fn)
}

export function stopFollow() {
  if (!active && !loop) return
  stop()
  registry.broadcast('follow:changed', false)
}

function start(currentFlip: boolean, fn: FlipFn) {
  const bubble = registry.get('bubble')
  if (!bubble || bubble.isDestroyed()) return
  flipFn = fn
  savedFlip = currentFlip
  lastFlip = null
  if (returning) { clearInterval(returning); returning = null }
  const b = bubble.getBounds()
  origin = { x: b.x, y: b.y }
  center.x = b.x + b.width / 2
  center.y = b.y + b.height / 2
  active = true
  loop = setInterval(tick, 16)
}

function tick() {
  const bubble = registry.get('bubble')
  if (!bubble || bubble.isDestroyed()) { stop(); return }
  const b = bubble.getBounds()
  const cursor = screen.getCursorScreenPoint()

  // Keep the bubble on a ring of radius `offset` around the cursor (radial trail).
  let dx = center.x - cursor.x
  let dy = center.y - cursor.y
  const dist = Math.hypot(dx, dy) || 1
  const tx = cursor.x + (dx / dist) * config.offset
  const ty = cursor.y + (dy / dist) * config.offset
  center.x += (tx - center.x) * config.smoothing
  center.y += (ty - center.y) * config.smoothing
  bubble.setPosition(Math.round(center.x - b.width / 2), Math.round(center.y - b.height / 2))

  if (config.autoFlip) {
    const dz = 60
    let want: boolean | null = null
    if (cursor.x < center.x - dz) want = true
    else if (cursor.x > center.x + dz) want = false
    if (want !== null && want !== lastFlip) {
      lastFlip = want
      flipFn(want)
    }
  }
}

function stop() {
  active = false
  if (loop) { clearInterval(loop); loop = null }
  flipFn(savedFlip)
  lastFlip = null
  const bubble = registry.get('bubble')
  if (!bubble || bubble.isDestroyed() || !origin) return
  const from = bubble.getBounds()
  const to = origin
  const steps = 22
  let i = 0
  returning = setInterval(() => {
    i++
    const t = easeOutCubic(Math.min(1, i / steps))
    const x = Math.round(from.x + (to.x - from.x) * t)
    const y = Math.round(from.y + (to.y - from.y) * t)
    const b = registry.get('bubble')
    if (b && !b.isDestroyed()) b.setPosition(x, y)
    if (i >= steps) { clearInterval(returning!); returning = null }
  }, 16)
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}
