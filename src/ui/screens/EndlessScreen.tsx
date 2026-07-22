import { canUpgrade, reforgeDust, upgradeDust } from '../../game/data/items'
import { ARCHETYPES } from '../../game/data/sentinels'
import { buildName } from '../../game/engine/leveling'
import { ENDLESS_LIVES, MAX_ROSTER, useGameStore } from '../../state/gameStore'
import { ItemCard } from '../components/ItemCard'

const GLYPH: Record<string, string> = { fighter: '⚔', rogue: '✦', mystic: '❋' }

export function EndlessScreen() {
  const round = useGameStore((s) => s.round)
  const wins = useGameStore((s) => s.wins)
  const lives = useGameStore((s) => s.lives)
  const gold = useGameStore((s) => s.gold)
  const dust = useGameStore((s) => s.dust)
  const roster = useGameStore((s) => s.roster)
  const evolutionQueue = useGameStore((s) => s.evolutionQueue)
  const openRoom = useGameStore((s) => s.endlessOpenRoom)
  const beginWave = useGameStore((s) => s.endlessBeginWave)
  const openDetail = useGameStore((s) => s.openDetail)

  return (
    <div className="endless-screen">
      <header className="endless-header">
        <div className="mh-left">
          <span className="brand">ENDLESS WATCH</span>
          <span className="wave-chip">Wave {round}</span>
        </div>
        <div className="endless-stats">
          <span className="es-lives" title="Lives">
            {Array.from({ length: ENDLESS_LIVES }, (_, i) => (
              <span key={i} className={i < lives ? 'heart on' : 'heart'}>
                ♥
              </span>
            ))}
          </span>
          <span className="es-wins">🏆 {wins}</span>
        </div>
      </header>

      <div className="endless-purse">
        <span className="gold-chip">⟡ {gold} Gold</span>
        <span className="dust-chip">◈ {dust} Dust</span>
      </div>

      <div className="endless-body">
        <p className="hub-note">Between waves, visit the Rooms to prepare — then take the next wave.</p>
        <div className="rooms-grid">
          <RoomButton icon="⟡" name="Merchant" desc="Buy items with Gold" onClick={() => openRoom('merchant')} />
          <RoomButton icon="⚒" name="Forge" desc="Reforge / upgrade with Dust" onClick={() => openRoom('forge')} />
          <RoomButton icon="❖" name="Shrine" desc="Risky stat trade" onClick={() => openRoom('shrine')} />
          <RoomButton icon="＋" name="Recruit" desc="Hire a Sentinel" onClick={() => openRoom('recruit')} />
        </div>

        <div className="map-roster endless-roster">
          <div className="mr-scroll">
            {roster.map((s) => (
              <button key={s.id} className="mr-chip" onClick={() => openDetail(s.id)} style={{ borderColor: s.color }}>
                <span className="mr-glyph" style={{ background: s.color }}>
                  {GLYPH[s.archetype]}
                </span>
                <span className="mr-text">
                  <span className="mr-name">
                    {s.name}
                    {evolutionQueue.includes(s.id) && <span className="evolve-dot"> ★</span>}
                  </span>
                  <span className="mr-build">
                    {buildName(s)} · Lv {s.level}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="hub-footer">
        <button className="start-run-btn" onClick={beginWave}>
          Begin Wave {round} ▶
        </button>
      </footer>

      <RoomModals />
    </div>
  )
}

function RoomButton({ icon, name, desc, onClick }: { icon: string; name: string; desc: string; onClick: () => void }) {
  return (
    <button className="room-btn" onClick={onClick}>
      <span className="rb-icon">{icon}</span>
      <span className="rb-name">{name}</span>
      <span className="rb-desc">{desc}</span>
    </button>
  )
}

function RoomModals() {
  const room = useGameStore((s) => s.endlessRoom)
  if (!room) return null
  if (room === 'merchant') return <EndlessMerchant />
  if (room === 'forge') return <EndlessForge />
  if (room === 'shrine') return <EndlessShrine />
  return <EndlessRecruit />
}

function EndlessMerchant() {
  const merchant = useGameStore((s) => s.merchant)
  const gold = useGameStore((s) => s.gold)
  const buy = useGameStore((s) => s.endlessBuyItem)
  const close = useGameStore((s) => s.endlessCloseRoom)
  if (!merchant) return null
  return (
    <div className="overlay-scrim">
      <div className="event-modal">
        <div className="event-head">
          <h2>⟡ Merchant</h2>
          <span className="equip-gold">⟡ {gold}</span>
        </div>
        <div className="merchant-list">
          {merchant.items.map(({ item, price }) => (
            <ItemCard
              key={item.id}
              item={item}
              footer={
                <button className="buy-btn" disabled={gold < price} onClick={() => buy(item.id)}>
                  Buy ⟡{price}
                </button>
              }
            />
          ))}
          {merchant.items.length === 0 && <p className="ds-empty">Sold out.</p>}
        </div>
        <button className="overlay-btn" onClick={close}>
          Leave
        </button>
      </div>
    </div>
  )
}

function EndlessForge() {
  const inventory = useGameStore((s) => s.inventory)
  const roster = useGameStore((s) => s.roster)
  const dust = useGameStore((s) => s.dust)
  const reforge = useGameStore((s) => s.endlessForgeReforge)
  const upgrade = useGameStore((s) => s.endlessForgeUpgrade)
  const close = useGameStore((s) => s.endlessCloseRoom)

  const equipped = roster.flatMap((s) => [s.equipment.weapon, s.equipment.armor, s.equipment.trinket]).filter(Boolean)
  const all = [...inventory, ...(equipped as NonNullable<(typeof equipped)[number]>[])]

  return (
    <div className="overlay-scrim">
      <div className="event-modal">
        <div className="event-head">
          <h2>⚒ Forge</h2>
          <span className="dust-chip">◈ {dust} Dust</span>
        </div>
        <p className="event-sub">Reroll or upgrade any item with Dust.</p>
        <div className="merchant-list">
          {all.length === 0 && <p className="ds-empty">No items to forge.</p>}
          {all.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              footer={
                <div className="forge-actions" style={{ marginLeft: 0 }}>
                  <button className="forge-btn" disabled={dust < reforgeDust(item)} onClick={() => reforge(item.id)}>
                    Reforge ◈{reforgeDust(item)}
                  </button>
                  {canUpgrade(item) && (
                    <button className="forge-btn upgrade" disabled={dust < upgradeDust(item)} onClick={() => upgrade(item.id)}>
                      Upgrade ◈{upgradeDust(item)}
                    </button>
                  )}
                </div>
              }
            />
          ))}
        </div>
        <button className="overlay-btn" onClick={close}>
          Leave
        </button>
      </div>
    </div>
  )
}

function EndlessShrine() {
  const offer = useGameStore((s) => s.shrineOffer)
  const accept = useGameStore((s) => s.endlessShrineAccept)
  const close = useGameStore((s) => s.endlessCloseRoom)
  if (!offer) return null
  return (
    <div className="overlay-scrim">
      <div className="event-modal shrine">
        <div className="event-head">
          <h2>❖ {offer.title}</h2>
        </div>
        <div className="shrine-offer">
          <div className="shrine-line boon">
            <span className="sl-tag">Boon</span>
            <span>{offer.boon}</span>
          </div>
          <div className="shrine-line curse">
            <span className="sl-tag">Price</span>
            <span>{offer.curse}</span>
          </div>
        </div>
        <div className="shrine-actions">
          <button className="overlay-btn ghost" onClick={close}>
            Walk Away
          </button>
          <button className="overlay-btn" onClick={accept}>
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}

function EndlessRecruit() {
  const cost = useGameStore((s) => s.endlessRecruitCost)
  const gold = useGameStore((s) => s.gold)
  const roster = useGameStore((s) => s.roster)
  const options = useGameStore((s) => s.recruitOptions)
  const recruit = useGameStore((s) => s.endlessRecruit)
  const close = useGameStore((s) => s.endlessCloseRoom)
  const full = roster.length >= MAX_ROSTER
  const cand = options[0]

  return (
    <div className="overlay-scrim">
      <div className="event-modal recruit">
        <div className="event-head">
          <h2>＋ Recruit</h2>
          <span className="equip-gold">⟡ {gold}</span>
        </div>
        <p className="event-sub">
          {full ? `Roster full (${MAX_ROSTER}/${MAX_ROSTER}).` : `Hire a Sentinel — the cost rises each time.`}
        </p>
        {!full && cand && (
          <div className="merchant-recruit" style={{ borderLeftColor: cand.color }}>
            <div className="mr-info">
              <strong>{cand.name}</strong>
              <span>{ARCHETYPES[cand.archetype].name}</span>
            </div>
            <button className="buy-btn" disabled={gold < cost} onClick={recruit}>
              Recruit ⟡{cost}
            </button>
          </div>
        )}
        <button className="overlay-btn" onClick={close} style={{ marginTop: 14 }}>
          Leave
        </button>
      </div>
    </div>
  )
}
