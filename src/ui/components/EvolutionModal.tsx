import { useEffect, useRef } from 'react'
import { describeGrant } from '../../game/data/describe'
import { branchLabel } from '../../game/engine/leveling'
import { useGameStore } from '../../state/gameStore'
import { useSettingsStore } from '../../state/settingsStore'
import { archetypeVar } from '../channels'
import { Icon } from '../Icon'
import { PerkPicker } from '../shell/PerkPicker'
import { featName, usePerkUnlocks } from '../shell/perkUnlocks'
import { availableEvolutions, lockedEvolutions } from '../../game/run/unlocks'
import { LOCKED_SPECS } from '../../game/data/achievements'

/**
 * Shown after a battle when a Sentinel crossed level 10 or 20 and is owed an
 * evolution choice. Handles the queue one Sentinel at a time.
 *
 * It is the one blocking overlay the shell keeps (rule four — modals are for
 * regret), and it had none of the semantics that go with being one (M27b):
 * no `role="dialog"`, no `aria-modal`, no accessible name, no focus management
 * and no trap. A keyboard or screen-reader user landed on a page that had
 * silently become unusable — the shell behind it was still in the tab ring, and
 * nothing announced that a required decision had appeared.
 *
 * There is deliberately no Escape and no dismiss: the choice is required, and
 * WAI-ARIA's "provide a way to close" applies to dialogs you can decline. The
 * trap therefore cycles between the options rather than releasing focus.
 */
export function EvolutionModal() {
  const queue = useGameStore((s) => s.evolutionQueue)
  const roster = useGameStore((s) => s.roster)
  const choose = useGameStore((s) => s.chooseEvolution)
  const unlocked = usePerkUnlocks()
  // The heads-up the coach strip gives at level 8 is a warning that this is
  // coming. This is the explanation of what it *is*, and it stays until the
  // player has been through one — see `markTaught('evolve')` below.
  const taughtEvolve = useSettingsStore((s) => s.taught.evolve)
  const markTaught = useSettingsStore((s) => s.markTaught)

  const cardRef = useRef<HTMLDivElement>(null)
  const open = queue.length > 0

  /*
   * Focus goes to the card when the dialog opens, and Tab is confined to it.
   *
   * Bound on the document rather than on the card so a Tab pressed while focus
   * is still out in the shell behind is caught too — a `onKeyDown` on the card
   * only fires for keys pressed inside it, which is exactly the case a trap
   * exists to handle.
   */
  useEffect(() => {
    if (!open) return
    const card = cardRef.current
    if (!card) return

    const focusables = () =>
      [...card.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]

    // The card itself takes focus first, so the heading and the explanation are
    // announced before the options are read out one by one.
    card.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      // Anything outside the card — including the card itself on the first Tab
      // — is pulled back to an end of the ring rather than allowed to walk into
      // the shell.
      if (!active || !card.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
        return
      }
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, queue[0]])

  // No evolution owed: the level-up perk choice (Phase 3b) uses this same
  // moment and the same dialog contract — evolutions first, then perks.
  if (!open) return <PerkPicker />
  const sentinel = roster.find((s) => s.id === queue[0])
  if (!sentinel) return null

  // Feat-locked specs (Phase 3b) are left out of the choice and named below it.
  const options = availableEvolutions(sentinel, unlocked)
  const locked = lockedEvolutions(sentinel, unlocked)
  const tier = sentinel.branchPath.length === 1 ? 'Sub-archetype' : 'Specialization'

  return (
    <div className="overlay-scrim">
      <div
        className="overlay-card evolve"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="evolve-title"
        // Only when the description is actually in the DOM — a dangling
        // `aria-describedby` is worse than none.
        aria-describedby={taughtEvolve ? undefined : 'evolve-what'}
        tabIndex={-1}
      >
        <span className="evolve-kicker">
          <Icon name="evolve" /> {tier} unlocked
        </span>
        <h2 id="evolve-title">{sentinel.name} evolves</h2>
        <p className="evolve-branch">{branchLabel(sentinel)}</p>
        {/* One line, the first time only: this modal is otherwise a cold
            blocking choice between three names a new player has never seen. */}
        {!taughtEvolve && (
          <p className="evolve-what" id="evolve-what">
            {sentinel.name} picks a path. It&rsquo;s permanent, and it changes how they fight, not just their
            numbers.
          </p>
        )}
        <div className="evolve-options">
          {options.map((node) => (
            <button
              key={node.id}
              className="evolve-option"
              // The archetype hue through its token rather than the raw hex on
              // the sentinel, so the colour-vision modes reach it too (M34).
              style={{ borderColor: archetypeVar(sentinel.archetype) }}
              onClick={() => {
                markTaught('evolve')
                choose(sentinel.id, node.id)
              }}
            >
              <span className="eo-name">{node.name}</span>
              <span className="eo-ability">{node.ability}</span>
              {node.grant && <span className="eo-grant">{describeGrant(node.grant)}</span>}
            </button>
          ))}
        </div>
        {locked.map((node) => (
          <p className="evolve-more" key={node.id}>
            {node.name} — locked, {featName(LOCKED_SPECS[node.id] ?? '')}.
          </p>
        ))}
        {queue.length > 1 && <p className="evolve-more">{queue.length - 1} more to evolve…</p>}
      </div>
    </div>
  )
}
