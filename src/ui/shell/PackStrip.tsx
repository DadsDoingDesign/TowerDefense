import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { RARITY } from '../../game/data/items'
import { useGameStore } from '../../state/gameStore'
import { archetypeVar, itemIcon, itemName, RARITY_INITIAL, rarityVar } from '../channels'
import { Icon } from '../Icon'
import { heroArt } from './offers'

/**
 * The pack and the company, in one strip under an event page's title
 * (Phase 2, finding 5).
 *
 * Rule three says the pack is permanent — buying an item means watching it
 * land. The event pages (merchant, shrine, recruit, the Crossroads, the
 * endless rooms, the spoils) are pages rather than bands, so the pack column
 * was simply gone from all of them: gold left the purse and nothing on screen
 * said where the thing went. This strip is the pack and the company at a
 * glance, and whatever just arrived pulses once.
 *
 * Read-only. Managing gear is the Detail band's job, one tap away on the map.
 */
export function PackStrip() {
  const inventory = useGameStore((s) => s.inventory)
  const roster = useGameStore((s) => s.roster)
  const fresh = useFresh(inventory.map((i) => i.id).concat(roster.map((h) => h.id)))
  const shown = inventory.slice(-8)
  return (
    <div className="pg-strip" aria-label={`Pack: ${inventory.length} ${inventory.length === 1 ? 'item' : 'items'}. Company: ${roster.map((h) => h.name).join(', ')}.`} role="group">
      <span className="pg-strip-label" aria-hidden="true">
        Pack {inventory.length}
      </span>
      <span className="pg-strip-items" aria-hidden="true">
        {inventory.length > shown.length && <span className="pg-strip-more">+{inventory.length - shown.length}</span>}
        {shown.map((i) => (
          <span
            key={i.id}
            className={`pg-strip-tile ${fresh.has(i.id) ? 'fresh' : ''}`}
            style={{ '--rail': rarityVar(i.rarity) } as CSSProperties}
            title={`${itemName(i)} · ${RARITY[i.rarity].label}`}
          >
            <Icon name={itemIcon(i)} />
            <span className="pg-strip-rar">{RARITY_INITIAL[i.rarity]}</span>
          </span>
        ))}
        {inventory.length === 0 && <span className="pg-strip-empty">empty</span>}
      </span>
      <span className="pg-strip-heroes" aria-hidden="true">
        {roster.map((h) => (
          <span
            key={h.id}
            className={`pg-strip-hero ${fresh.has(h.id) ? 'fresh' : ''}`}
            style={{ background: archetypeVar(h.archetype) }}
          >
            <img src={heroArt(h.archetype)} alt="" />
          </span>
        ))}
      </span>
    </div>
  )
}

/** Ids that appeared since the last render, held for a moment. */
function useFresh(ids: string[]): Set<string> {
  const known = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const key = ids.join('|')
  useEffect(() => {
    if (!known.current) {
      known.current = new Set(ids)
      return
    }
    const added = ids.filter((id) => !known.current!.has(id))
    known.current = new Set(ids)
    if (added.length === 0) return
    setFresh(new Set(added))
    const t = setTimeout(() => setFresh(new Set()), 1400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return fresh
}

/**
 * The receipt, said where the eye is (Phase 2): "Axe added to your pack",
 * "Sable joined the company". Derived from the store, not from the button that
 * caused it, so every path that adds an item or a hero is covered — a purchase,
 * a shrine's gift, a recruit, a Crossroads hire, a spoils card.
 *
 * The one polite announcement for it; the in-body receipt line it replaces
 * used to be below the fold on a small phone.
 */
export function ReceiptToast() {
  const [msg, setMsg] = useState<{ text: string; key: number; hold?: number; notice?: boolean } | null>(null)
  useEffect(() => {
    /*
     * Round 3 (Q5): a resumed save's off-hand item moved back to the pack.
     * Said once: the notice is spent (cleared from the store) when its toast
     * has been on screen for its whole hold — not when it is first shown,
     * because the resume swaps the page shell for the run shell and the toast
     * that caught it is unmounted a frame later. The one that mounts next
     * reads the still-pending notice and says it.
     */
    const sayNotice = (n: { text: string; at: number }) => setMsg({ text: n.text, key: n.at, hold: 6000, notice: true })
    const pending = useGameStore.getState().gearNotice
    if (pending) sayNotice(pending)
    let prev = useGameStore.getState()
    return useGameStore.subscribe((s) => {
      if (s.gearNotice && s.gearNotice !== prev.gearNotice) {
        prev = s
        sayNotice(s.gearNotice)
        return
      }
      if (s.runPhase !== 'active') {
        prev = s
        return
      }
      // Every item the company owns, loose or worn — an arrival is an id that
      // was nowhere before. (An unequip or a swap moves an id; it adds none.)
      const owned = (st: typeof s) => [
        ...st.inventory.map((i) => ({ item: i, wearer: null as string | null })),
        ...st.roster.flatMap((h) =>
          Object.values(h.equipment)
            .filter(Boolean)
            .map((i) => ({ item: i!, wearer: h.name })),
        ),
      ]
      const had = new Set(owned(prev).map((o) => o.item.id))
      const arrived = owned(s).filter((o) => !had.has(o.item.id))
      const knownHeroes = new Set(prev.roster.map((h) => h.id))
      const addedHeroes = s.roster.filter((h) => !knownHeroes.has(h.id))
      const parts: string[] = []
      // A new hero's starting kit is theirs, not news.
      const fromNewHero = new Set(addedHeroes.map((h) => h.name))
      const items = arrived.filter((o) => !o.wearer || !fromNewHero.has(o.wearer))
      if (items.length === 1) {
        const o = items[0]
        parts.push(o.wearer ? `${itemName(o.item)} added — ${o.wearer} wears it` : `${itemName(o.item)} added to your pack`)
      } else if (items.length > 1) parts.push(`${items.length} items added`)
      for (const h of addedHeroes) parts.push(`${h.name} joined the company`)
      prev = s
      if (parts.length) setMsg({ text: parts.join(' · '), key: Date.now() })
    })
  }, [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => {
      setMsg((m) => (m?.key === msg.key ? null : m))
      // Seen in full: spend the load's notice (above) so it is said once.
      if (msg.notice && useGameStore.getState().gearNotice?.at === msg.key) useGameStore.setState({ gearNotice: null })
    }, msg.hold ?? 2400)
    return () => clearTimeout(t)
  }, [msg])
  return (
    <div className="pg-toast-wrap" role="status" aria-live="polite">
      {msg && (
        <p className="pg-toast" key={msg.key}>
          <Icon name={msg.notice ? 'back' : 'boon'} /> {msg.text}
        </p>
      )}
    </div>
  )
}
