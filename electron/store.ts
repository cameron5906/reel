import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const file = () => join(app.getPath('userData'), 'reel-config.json')

function readAll(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(file(), 'utf-8'))
  } catch {
    return {}
  }
}

export const store = {
  get<T>(key: string): T | undefined {
    return readAll()[key] as T | undefined
  },
  set(key: string, value: unknown) {
    const all = readAll()
    all[key] = value
    try {
      mkdirSync(dirname(file()), { recursive: true })
      writeFileSync(file(), JSON.stringify(all, null, 2))
    } catch {
      /* best-effort persistence */
    }
  }
}
