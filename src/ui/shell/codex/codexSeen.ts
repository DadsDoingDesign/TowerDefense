/**
 * Which Codex tiles the player has opened (the NEW badges). A UI note, not the
 * save, like the trade map's `fieldwatch-map-seen`: losing it only re-shows a
 * badge. The first visit takes everything already owned as seen, so a badge
 * means "unlocked since you last looked", never "everything".
 */
import { readJson, writeJson } from '../../../state/storage'

const KEY = 'fieldwatch-codex-seen'

export function readCodexSeen(owned: readonly string[]): Set<string> {
  const list = readJson<unknown>(KEY)
  if (Array.isArray(list)) return new Set(list.filter((x): x is string => typeof x === 'string'))
  // Refused in private mode: no badges, nothing breaks.
  writeJson(KEY, owned)
  return new Set(owned)
}

export function markCodexSeen(seen: Set<string>, id: string): Set<string> {
  const next = new Set(seen).add(id)
  writeJson(KEY, [...next])
  return next
}
