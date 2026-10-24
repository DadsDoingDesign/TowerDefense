import { useMemo } from 'react'
import { flyingMilitia } from '../../game/run/militia'
import { useMetaStore } from '../../state/metaStore'

/** Your militia as the game shows it: none until the Sovereign Route opens (`flyingMilitia`). */
export function useMilitia() {
  const militia = useMetaStore((s) => s.militia)
  const skills = useMetaStore((s) => s.skills)
  const items = useMetaStore((s) => s.items)
  return useMemo(() => flyingMilitia(militia, { skills, items }), [militia, skills, items])
}
