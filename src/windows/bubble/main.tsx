import { createRoot } from 'react-dom/client'
import { Bubble } from './Bubble'
import './bubble.css'

const params = new URLSearchParams(location.search)
const frame = {
  zoom: Number(params.get('zoom') ?? 1) || 1,
  panX: Number(params.get('panX') ?? 0.5),
  panY: Number(params.get('panY') ?? 0.5)
}

createRoot(document.getElementById('root')!).render(
  <Bubble deviceId={params.get('cam') ?? undefined} frame={frame} />
)
