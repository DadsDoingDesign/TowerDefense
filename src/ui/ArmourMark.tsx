import type { IconKey } from './channels'
import { Icon } from './Icon'

/**
 * The damage mark a modifier's goblins shrug off, in a "no" sign
 * (`.mn-armour-mark`), or Swift's speed, unstruck. The same `phys` / `magic`
 * marks a hero's card shows for the damage it deals, so "this fight stops what
 * that hero does" reads off the two pictures. The run map's armour tab and the
 * home notice's armour chip both draw it.
 */
const MOD_MARK: Record<string, IconKey> = { plated: 'phys', warded: 'magic', swift: 'haste' }
export const ArmourMark = ({ mod }: { mod: string }) => (
  <span className={`mn-armour-mark ${mod}`} aria-hidden="true">
    <Icon name={MOD_MARK[mod] ?? 'warn'} />
  </span>
)
