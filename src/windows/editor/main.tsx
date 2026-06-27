import { createRoot } from 'react-dom/client'
import { Editor } from './Editor'
import './editor.css'

const p = new URLSearchParams(location.search)
createRoot(document.getElementById('root')!).render(
  <Editor tempPath={p.get('tempPath')!} duration={Number(p.get('duration') ?? 0)} />
)
