import { createRoot } from 'react-dom/client'
import { Bubble } from './Bubble'
import './bubble.css'

const params = new URLSearchParams(location.search)
createRoot(document.getElementById('root')!).render(
  <Bubble deviceId={params.get('cam') ?? undefined} />
)
