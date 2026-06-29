import { useEffect, useState } from 'react'
import type { RecordingMeta } from '@shared/types'

export function Library() {
  const [items, setItems] = useState<RecordingMeta[]>([])
  async function refresh() { setItems(await window.reel.listRecordings()) }

  useEffect(() => {
    refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <section className="library-section">
      <div className="section-head">
        <h2>Recordings</h2>
        {items.length > 0 && <span className="count">{items.length}</span>}
      </div>

      {items.length === 0 ? (
        <p className="empty">Your recordings will show up here.</p>
      ) : (
        <ul className="library">
          {items.map((r) => (
            <li key={r.path} className="rec-card">
              <div className="rec-thumb">
                {r.thumbnailPath ? (
                  <img src={`file://${r.thumbnailPath}`} alt="" />
                ) : (
                  <div className="noimg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m10 9 5 3-5 3z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="rec-info">
                <strong>{r.name}</strong>
                <span>{new Date(r.createdMs).toLocaleDateString()} · {(r.sizeBytes / 1e6).toFixed(1)} MB</span>
              </div>
              <div className="rec-actions">
                <button onClick={() => window.reel.revealInExplorer(r.path)}>Reveal</button>
                <button onClick={() => window.reel.copyFile(r.path)}>Copy</button>
                <button
                  className="danger"
                  onClick={async () => { await window.reel.deleteRecording(r.path); refresh() }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
