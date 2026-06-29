export function TitleBar({ maximized }: { maximized: boolean }) {
  return (
    <header className="titlebar">
      <div className="brand">
        <span className="brand-dot" />
        <span className="brand-name">Reel</span>
        <span className="brand-sub">Screen recorder</span>
      </div>
      <div className="win-controls">
        <button className="wc" title="Minimize" aria-label="Minimize" onClick={() => window.reel.minimizeWindow()}>
          <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="5" width="9" height="1" fill="currentColor" /></svg>
        </button>
        <button className="wc" title="Maximize" aria-label="Maximize" onClick={() => window.reel.toggleMaximizeWindow()}>
          {maximized ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor">
              <rect x="1.5" y="3.2" width="6" height="6" /><path d="M3.7 3.2V1.5h6v6H7.7" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor">
              <rect x="1.5" y="1.5" width="8" height="8" />
            </svg>
          )}
        </button>
        <button className="wc close" title="Close" aria-label="Close" onClick={() => window.reel.closeWindow()}>
          <svg width="11" height="11" viewBox="0 0 11 11" stroke="currentColor"><path d="M1.5 1.5l8 8M9.5 1.5l-8 8" /></svg>
        </button>
      </div>
    </header>
  )
}
