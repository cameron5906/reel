export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').replace(/[. ]+$/, '')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function defaultRecordingName(date: Date): string {
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const t = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  return `Reel-${d}_${t}`
}
