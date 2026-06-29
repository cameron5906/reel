import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { Rect } from '@shared/types'
import { registry } from './registry'

export function createCountdownWindow(bounds: Rect): BrowserWindow {
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true)

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; height: 100%; overflow: hidden; background: rgba(8, 8, 12, .45);
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif; }
    #ring { width: 34vh; height: 34vh; border-radius: 50%;
      background: rgba(20, 20, 26, .72); border: 2px solid rgba(120, 170, 255, .55);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 24px 80px rgba(0, 0, 0, .55); }
    #n { font-size: 20vh; font-weight: 800; color: #fff; line-height: 1;
      text-shadow: 0 6px 30px rgba(0, 0, 0, .6); }
    .pop { animation: pop 1s ease-out; }
    @keyframes pop {
      0% { transform: scale(.35); opacity: 0; }
      18% { opacity: 1; }
      100% { transform: scale(1); opacity: .9; }
    }
  </style></head><body>
    <div id="ring"><div id="n" class="pop">5</div></div>
    <script>
      let n = 5
      const el = document.getElementById('n')
      function step() {
        if (n === 0) { window.reel.countdownDone(); return }
        el.textContent = n
        el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop')
        n--
        setTimeout(step, 1000)
      }
      step()
    </script>
  </body></html>`
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))

  registry.set('countdown', win)
  return win
}
