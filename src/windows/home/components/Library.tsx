import { useEffect, useState } from 'react'
import type { RecordingMeta } from '@shared/types'

export function Library() {
  const [items, setItems] = useState<RecordingMeta[]>([])
  async function refresh() { setItems(await window.reel.listRecordings()) }
  useEffect(() => { refresh() }, [])

  if (items.length === 0) return <p className="empty">No recordings yet.</p>

  return (
    <ul className="library">
      {items.map((r) => (
        <li key={r.path}>
          {r.thumbnailPath
            ? <img src={`file://${r.thumbnailPath}`} alt="" />
            : <div className="noimg" />}
          <div className="info">
            <strong>{r.name}</strong>
            <span>{new Date(r.createdMs).toLocaleString()} · {(r.sizeBytes / 1e6).toFixed(1)} MB</span>
          </div>
          <div className="actions">
            <button onClick={() => window.reel.revealInExplorer(r.path)}>Reveal</button>
            <button onClick={() => window.reel.copyFile(r.path)}>Copy path</button>
            <button onClick={async () => { await window.reel.deleteRecording(r.path); refresh() }}>Delete</button>
          </div>
        </li>
      ))}
    </ul>
  )
}
