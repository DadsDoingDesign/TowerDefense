import { fieldIdOf } from '../../game/data/maps'
import { fieldName, groundFor } from '../../game/run/fields'
import { ACT_LAYERS } from '../../game/run/threat'
import { useGameStore } from '../../state/gameStore'

/**
 * The next act's ground, under the city page's route rail: "New ground ahead:
 * The Kiln Road". The road changes country at every city (`run/fields`), so the
 * player sees the change coming before the caravan rolls on (the arrival note
 * in the next fight's setup says the rest: post your heroes). Nothing when the next act
 * keeps the field (a single-field build) or there is no next act.
 */
export function NextGround({ city }: { city: number }) {
  const runSeed = useGameStore((s) => s.runSeed)
  const fieldId = useGameStore((s) => fieldIdOf(s.battleMap))
  const fieldAct = useGameStore((s) => s.fieldAct)
  // The first layer past this city's act boss is the next act's.
  const next = groundFor(runSeed, { fieldId, fieldAct }, (city + 1) * ACT_LAYERS + 1)
  if (!next.fresh) return null
  return (
    <p className="ct-left ct-next-ground">
      New ground ahead: <b>{fieldName(next.fieldId)}</b>
    </p>
  )
}
