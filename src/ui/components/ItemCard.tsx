import type { ReactNode } from 'react'
import { describeEnchant } from '../../game/data/describe'
import { describeBase, KIND_LABEL, RARITY } from '../../game/data/items'
import type { Item } from '../../game/types'

/** A compact item panel: rarity-colored name, base stats, and enchantments. */
export function ItemCard({
  item,
  footer,
  compact,
}: {
  item: Item
  footer?: ReactNode
  compact?: boolean
}) {
  const rar = RARITY[item.rarity]
  return (
    <div className={`item-card rar-${item.rarity} ${compact ? 'compact' : ''}`}>
      <div className="ic-head">
        <span className="ic-name" style={{ color: rar.color }}>
          {item.name}
        </span>
        <span className="ic-tag">{item.keepsake ? 'Keepsake' : KIND_LABEL[item.slot]}</span>
      </div>
      {!compact && (
        <>
          <div className="ic-base">
            {describeBase(item).map((line, i) => (
              <span key={i} className="ic-base-line">
                {line}
              </span>
            ))}
            {describeBase(item).length === 0 && item.keepsake && (
              <span className="ic-base-line dim">Team-wide effect</span>
            )}
          </div>
          {item.enchantments.length > 0 && (
            <div className="ic-ench">
              {item.enchantments.map((e, i) => (
                <span key={i} className="ic-ench-line">
                  <strong>{e.label}</strong> — {describeEnchant(e)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
      {footer && <div className="ic-footer">{footer}</div>}
    </div>
  )
}
