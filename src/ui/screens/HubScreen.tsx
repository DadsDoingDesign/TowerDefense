import { useState } from 'react'
import { sfx } from '../../audio/audio'
import { useGameStore } from '../../state/gameStore'
import { UPGRADES, useMetaStore } from '../../state/metaStore'
import { useSettingsStore } from '../../state/settingsStore'

type MenuView = 'menu' | 'perks' | 'settings'

export function HubScreen() {
  const [view, setView] = useState<MenuView>('menu')

  return (
    <div className="menu-screen">
      {view === 'menu' && <MainMenu go={setView} />}
      {view === 'perks' && <PerksView back={() => setView('menu')} />}
      {view === 'settings' && <SettingsView back={() => setView('menu')} />}
    </div>
  )
}

/* ---------------------------------------------------------------- Main menu */
function MainMenu({ go }: { go: (v: MenuView) => void }) {
  const watchMarks = useMetaStore((s) => s.watchMarks)
  const newRun = useGameStore((s) => s.newRun)
  const startEndless = useGameStore((s) => s.startEndless)

  return (
    <div className="menu-main">
      <div className="menu-brand">
        <h1 className="menu-title">FIELDWATCH</h1>
        <span className="menu-tag">Hold the meadow against the goblin horde</span>
      </div>

      <div className="menu-actions">
        <button className="menu-btn primary" data-sfx="confirm" onClick={newRun}>
          <span className="menu-btn-icon">▶</span>
          <span className="menu-btn-text">
            <strong>Start a Run</strong>
            <span>Begin a new campaign</span>
          </span>
        </button>
        <button className="menu-btn" onClick={() => go('perks')}>
          <span className="menu-btn-icon">✦</span>
          <span className="menu-btn-text">
            <strong>Upgrade Perks</strong>
            <span>Spend Watch Marks on permanent bonuses</span>
          </span>
          <span className="menu-btn-badge">✦ {watchMarks}</span>
        </button>
        <button className="menu-btn" onClick={() => go('settings')}>
          <span className="menu-btn-icon">⚙</span>
          <span className="menu-btn-text">
            <strong>Settings</strong>
            <span>Options &amp; progress</span>
          </span>
        </button>
      </div>

      <button className="menu-endless" onClick={startEndless}>
        Endless Watch ∞
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------- Perks */
function PerksView({ back }: { back: () => void }) {
  const watchMarks = useMetaStore((s) => s.watchMarks)
  const stats = useMetaStore((s) => s.stats)
  const sacrificeTier = useMetaStore((s) => s.sacrificeTier)

  return (
    <div className="submenu">
      <header className="submenu-head">
        <button className="submenu-back" onClick={back}>
          ← Menu
        </button>
        <h2>Upgrade Perks</h2>
        <span className="marks-chip">✦ {watchMarks} Marks</span>
      </header>

      <div className="submenu-body">
        <section className="hub-stats">
          <StatCard label="Best Depth" v={stats.bestDepth} />
          <StatCard label="Enemies Defeated" v={stats.totalKills} />
          <StatCard label="Sentinels Lost" v={stats.sentinelsLost} />
          <StatCard label="Runs Completed" v={stats.runsCompleted} />
          <StatCard label="Runs Won" v={stats.runsWon} />
          <StatCard label="Sacrifice Tier" v={sacrificeTier} accent />
        </section>

        <section className="hub-section">
          <h3 className="submenu-h3">Watchtower Upgrades</h3>
          <p className="hub-note">Permanent bonuses applied to every future run.</p>
          <div className="upgrade-list">
            {UPGRADES.map((u) => (
              <UpgradeRow key={u.id} id={u.id} />
            ))}
          </div>
        </section>

        <section className="hub-section">
          <h3 className="submenu-h3">Dark Sacrifice</h3>
          <SacrificePanel />
        </section>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Settings */
function SettingsView({ back }: { back: () => void }) {
  const resetMeta = useMetaStore((s) => s.resetMeta)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="submenu">
      <header className="submenu-head">
        <button className="submenu-back" onClick={back}>
          ← Menu
        </button>
        <h2>Settings</h2>
        <span />
      </header>

      <div className="submenu-body">
        <AudioSettings />
        <AccessibilitySettings />

        <section className="settings-card">
          <div className="settings-row">
            <div className="settings-info">
              <strong>Art direction</strong>
              <span>Tiny Swords — Pixel Frog (CC0). The one and only look.</span>
            </div>
          </div>
        </section>

        <section className="settings-card danger">
          <div className="settings-row">
            <div className="settings-info">
              <strong>Reset progress</strong>
              <span>Wipe all Watch Marks, upgrades, sacrifice tiers, and records. This can&apos;t be undone.</span>
            </div>
            <button
              className="settings-reset"
              onClick={() => {
                if (confirming) {
                  resetMeta()
                  setConfirming(false)
                } else {
                  setConfirming(true)
                }
              }}
              onBlur={() => setConfirming(false)}
            >
              {confirming ? 'Confirm reset?' : 'Reset'}
            </button>
          </div>
        </section>

        <p className="settings-foot">Fieldwatch · a roguelite tower-defense autobattler</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ audio settings */
function AudioSettings() {
  const audio = useSettingsStore((s) => s.audio)
  const setAudio = useSettingsStore((s) => s.setAudio)
  const toggleMute = useSettingsStore((s) => s.toggleMute)

  return (
    <section className="settings-card">
      <div className="settings-row">
        <div className="settings-info">
          <strong>Audio</strong>
          <span>Separate volumes for game sound and interface sound.</span>
        </div>
        <Toggle on={!audio.muted} onLabel="On" offLabel="Muted" onToggle={toggleMute} sfxOnToggle={false} />
      </div>
      <div className="settings-sliders">
        <VolumeSlider label="Master" value={audio.master} onChange={(v) => setAudio({ master: v })} preview="click" />
        <VolumeSlider label="Game" value={audio.game} onChange={(v) => setAudio({ game: v })} preview="coin" />
        <VolumeSlider label="Interface" value={audio.ui} onChange={(v) => setAudio({ ui: v })} preview="select" />
      </div>
    </section>
  )
}

function VolumeSlider({
  label,
  value,
  onChange,
  preview,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  preview: 'click' | 'coin' | 'select'
}) {
  return (
    <label className="vol-slider">
      <span className="vol-label">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={() => sfx(preview)}
        aria-label={`${label} volume`}
      />
      <span className="vol-val">{Math.round(value * 100)}</span>
    </label>
  )
}

/* ---------------------------------------------------- accessibility settings */
function AccessibilitySettings() {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion)
  const highContrast = useSettingsStore((s) => s.highContrast)
  const setReducedMotion = useSettingsStore((s) => s.setReducedMotion)
  const setHighContrast = useSettingsStore((s) => s.setHighContrast)

  return (
    <section className="settings-card">
      <div className="settings-row">
        <div className="settings-info">
          <strong>Reduce motion</strong>
          <span>Turn off pulses, lifts, and slide-in animations.</span>
        </div>
        <Toggle on={reducedMotion} onToggle={() => setReducedMotion(!reducedMotion)} />
      </div>
      <div className="settings-row">
        <div className="settings-info">
          <strong>High contrast</strong>
          <span>Brighter text and stronger borders for readability.</span>
        </div>
        <Toggle on={highContrast} onToggle={() => setHighContrast(!highContrast)} />
      </div>
    </section>
  )
}

function Toggle({
  on,
  onToggle,
  onLabel = 'On',
  offLabel = 'Off',
  sfxOnToggle = true,
}: {
  on: boolean
  onToggle: () => void
  onLabel?: string
  offLabel?: string
  sfxOnToggle?: boolean
}) {
  return (
    <button
      className={`toggle ${on ? 'on' : ''}`}
      data-sfx={sfxOnToggle ? 'toggle' : 'none'}
      role="switch"
      aria-checked={on}
      onClick={onToggle}
    >
      <span className="toggle-knob" />
      <span className="toggle-text">{on ? onLabel : offLabel}</span>
    </button>
  )
}

/* --------------------------------------------------------------- shared bits */
function StatCard({ label, v, accent }: { label: string; v: number; accent?: boolean }) {
  return (
    <div className={`hub-stat ${accent ? 'accent' : ''}`}>
      <span className="hs-val">{v}</span>
      <span className="hs-label">{label}</span>
    </div>
  )
}

function UpgradeRow({ id }: { id: string }) {
  const u = UPGRADES.find((x) => x.id === id)!
  const level = useMetaStore((s) => s.upgrades[id] ?? 0)
  const watchMarks = useMetaStore((s) => s.watchMarks)
  const cost = useMetaStore((s) => s.upgradeCost(id))
  const buy = useMetaStore((s) => s.buyUpgrade)

  const maxed = level >= u.maxLevel
  const afford = watchMarks >= cost

  return (
    <div className="upgrade-row">
      <div className="ur-info">
        <div className="ur-title">
          <strong>{u.name}</strong>
          <span className="ur-level">
            {level}/{u.maxLevel}
          </span>
        </div>
        <span className="ur-desc">{u.desc}</span>
        <div className="ur-pips">
          {Array.from({ length: u.maxLevel }, (_, i) => (
            <span key={i} className={`ur-pip ${i < level ? 'on' : ''}`} />
          ))}
        </div>
      </div>
      <button className="ur-buy" disabled={maxed || !afford} onClick={() => buy(id)}>
        {maxed ? 'Maxed' : `✦ ${cost}`}
      </button>
    </div>
  )
}

function SacrificePanel() {
  const tier = useMetaStore((s) => s.sacrificeTier)
  const cost = useMetaStore((s) => s.sacrificeCost())
  const watchMarks = useMetaStore((s) => s.watchMarks)
  const doSacrifice = useMetaStore((s) => s.doSacrifice)

  return (
    <div className="sacrifice-panel">
      <p className="hub-note">
        Trade this run&apos;s safety for greater power. Each tier permanently grants{' '}
        <strong>+1 to all starting stats</strong> and <strong>+10% Watch Marks</strong>, but every
        future enemy gains <strong>+15% HP</strong>.
      </p>
      <div className="sacrifice-row">
        <div className="sr-tier">
          <span className="srt-val">Tier {tier}</span>
          <span className="srt-label">
            +{tier} stats · +{tier * 10}% marks · +{tier * 15}% enemy HP
          </span>
        </div>
        <button className="sacrifice-btn" disabled={watchMarks < cost} onClick={doSacrifice}>
          Sacrifice ✦ {cost}
        </button>
      </div>
    </div>
  )
}
