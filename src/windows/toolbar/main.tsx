import { createRoot } from 'react-dom/client'
import { Toolbar } from './Toolbar'
import './toolbar.css'

const params = new URLSearchParams(location.search)
const hasCam = params.get('cam') === '1'
const initialFlip = params.get('flip') !== '0'

createRoot(document.getElementById('root')!).render(<Toolbar hasCam={hasCam} initialFlip={initialFlip} />)
