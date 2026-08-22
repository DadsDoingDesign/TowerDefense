/**
 * ⚠️ NON-FUNCTIONAL AS CHECKED IN — `npm run ui-audit` will not run here.
 * ─────────────────────────────────────────────────────────────────────────────
 * Two things are missing, both of them environmental:
 *
 *   1. `playwright-core` is **not a dependency** of this project (check
 *      `package.json`). The import below fails with MODULE_NOT_FOUND.
 *   2. `PW_CHROMIUM` defaults to a **Linux** Chromium path baked into the
 *      container this script was written in. This repo is developed on Windows,
 *      where that path does not exist.
 *
 * To actually run it:
 *
 *   npm i -D playwright-core            # or `playwright`, which bundles browsers
 *   npx playwright install chromium     # if you used the bundled variant
 *   set PW_CHROMIUM=<path to chrome>    # only needed for playwright-core
 *   npx vite --port 5188 --strictPort &
 *   node scripts/ui-audit.mjs
 *
 * Nothing else in the project depends on this script, and no CI step runs it.
 * It is kept because the shot list below is the only written inventory of every
 * screen, modal and component state the app can be in. Treat it as a spec that
 * happens to be executable, not as a test that passes.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * What it does when it *is* wired up: drives the real app in a headless browser
 * and captures a labelled screenshot of every screen, modal, and component state.
 *
 * Output: docs/ui-audit/<NN-flow>/<NN-step>.<viewport>.png
 *
 * States are driven through the real Zustand store (`window.__game`, exposed in
 * dev) and the real data factories (imported live off the Vite dev server), so
 * every shot is the actual render path — never a mock.
 */
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.UI_AUDIT_BASE ?? 'http://localhost:5188/'
const OUT = path.resolve('docs/ui-audit')
/** Chromium binary for `playwright-core`. Unset when using the bundled `playwright`. */
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

/**
 * Resolve Playwright at run time so the missing dependency produces an actionable
 * message instead of a MODULE_NOT_FOUND stack from a bare top-level import.
 */
const loadChromium = async () => {
  for (const pkg of ['playwright', 'playwright-core']) {
    try {
      return (await import(pkg)).chromium
    } catch {
      /* try the next one */
    }
  }
  console.error(
    [
      'ui-audit: Playwright is not installed, so this script cannot run.',
      '',
      '  npm i -D playwright        # bundles its own browsers (simplest)',
      '  npx playwright install chromium',
      '',
      'Or, with playwright-core, point PW_CHROMIUM at a Chromium/Chrome binary.',
      'See the header of scripts/ui-audit.mjs.',
    ].join('\n'),
  )
  process.exit(1)
}

const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  { id: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
]

/* ------------------------------------------------------------------ helpers */
// Installed into the page after every navigation. Everything a shot needs to
// build deterministic state lives here so shot bodies stay one-liners.
const INSTALL = async () => {
  const [items, sentinels, mutations, rng, upgradeTree] = await Promise.all([
    import('/src/game/data/items.ts'),
    import('/src/game/data/sentinels.ts'),
    import('/src/game/data/mutations.ts'),
    import('/src/game/core/rng.ts'),
    import('/src/game/data/upgradeTree.ts'),
  ])
  const R = new rng.RNG(12345)
  const g = window.__game

  const mk = (rarity, slot) => items.generateItem(new rng.RNG(rarity.length * 977 + (slot ? slot.length : 3)), { rarity, slot })

  window.__h = {
    items, sentinels, mutations, upgradeTree, RNG: rng.RNG, R, g, mk,
    set: (o) => g.setState(o),
    get: () => g.getState(),
    // A roster of three, one per archetype, levelled for interesting cards.
    roster: (levels = [5, 9, 15]) => {
      const archs = ['fighter', 'rogue', 'mystic']
      return archs.map((a, i) => {
        const s = sentinels.createSentinel(a)
        s.level = levels[i]
        s.xp = 0
        return s
      })
    },
    // One item of every rarity plus a cursed and a keepsake example.
    sampleItems: () => {
      const out = items.RARITY_ORDER.map((r) => mk(r, 'oneHand'))
      let cursed = null
      for (let i = 0; i < 400 && !cursed; i++) {
        const it = items.generateItem(new rng.RNG(9000 + i), { rarity: 'legendary' })
        if (it.enchantments.some((e) => e.id.startsWith('cx_'))) cursed = it
      }
      let keep = null
      for (let i = 0; i < 400 && !keep; i++) {
        const it = items.generateItem(new rng.RNG(4000 + i), { keepsakeChance: 1 })
        if (it.keepsake) keep = it
      }
      return { byRarity: out, cursed, keepsake: keep }
    },
  }
}

const shot = async (page, dir, name, vp) => {
  fs.mkdirSync(path.join(OUT, dir), { recursive: true })
  const file = path.join(OUT, dir, `${name}.${vp.id}.png`)
  await page.screenshot({ path: file })
  return file
}

// Element-clipped shot. Skips silently when the element is absent, hidden, or
// zero-sized — several panels are display:none at one breakpoint by design, and
// a hidden element would otherwise hang until the screenshot timeout.
const clip = async (page, selector, dir, name, vp, index = 0) => {
  const el = page.locator(selector).nth(index)
  if ((await el.count()) === 0) return null
  if (!(await el.isVisible().catch(() => false))) return null
  const box = await el.boundingBox().catch(() => null)
  if (!box || box.width < 2 || box.height < 2) return null
  fs.mkdirSync(path.join(OUT, dir), { recursive: true })
  const file = path.join(OUT, dir, `${name}.${vp.id}.png`)
  await el.screenshot({ path: file, timeout: 5000 }).catch(() => null)
  return file
}

// The HUD tab bar only exists at the mobile breakpoint (desktop shows every
// panel at once), so tab-driven steps must no-op rather than fail on desktop.
const clickIfVisible = async (locator) => {
  if ((await locator.count()) === 0) return false
  const first = locator.first()
  if (!(await first.isVisible().catch(() => false))) return false
  await first.click({ timeout: 5000 }).catch(() => null)
  return true
}

const settle = async (page, ms = 320) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.waitForTimeout(ms)
}

/* -------------------------------------------------------------------- shots */
/**
 * Each shot: { flow, name, run(page, vp, ctx) }. `run` sets up state and takes
 * whatever screenshots it needs. Page is freshly reloaded before each shot so
 * state never leaks between them.
 */
const SHOTS = [
  /* ---------------------------------------------------------- 01 hub/menus */
  {
    flow: '01-hub-and-menus', name: '01-main-menu',
    run: async (p, vp) => { await shot(p, '01-hub-and-menus', '01-main-menu', vp) },
  },
  {
    flow: '01-hub-and-menus', name: '02-perks-empty',
    run: async (p, vp) => {
      await p.getByRole('button', { name: /Upgrade Perks/i }).click()
      await settle(p)
      await shot(p, '01-hub-and-menus', '02-perks-no-marks', vp)
    },
  },
  {
    flow: '01-hub-and-menus', name: '03-perks-affordable',
    run: async (p, vp) => {
      await p.evaluate(async () => {
        const m = await import('/src/state/metaStore.ts')
        m.useMetaStore.setState({ watchMarks: 400, upgrades: { u_gold: 2 }, stats: { bestDepth: 7, totalKills: 812, sentinelsLost: 3, runsCompleted: 5, runsWon: 2 } })
      })
      await p.getByRole('button', { name: /Upgrade Perks/i }).click()
      await settle(p)
      await shot(p, '01-hub-and-menus', '03-perks-with-marks', vp)
    },
  },
  {
    flow: '01-hub-and-menus', name: '04-settings',
    run: async (p, vp) => {
      await p.getByRole('button', { name: /Settings/i }).first().click()
      await settle(p)
      await shot(p, '01-hub-and-menus', '04-settings', vp)
    },
  },
  {
    flow: '01-hub-and-menus', name: '05-settings-reset-confirm',
    run: async (p, vp) => {
      await p.getByRole('button', { name: /Settings/i }).first().click()
      await settle(p, 150)
      await p.locator('.settings-reset').click()
      await settle(p)
      await shot(p, '01-hub-and-menus', '05-settings-reset-confirm', vp)
    },
  },
  {
    flow: '01-hub-and-menus', name: '06-settings-high-contrast',
    run: async (p, vp) => {
      await p.evaluate(async () => {
        const s = await import('/src/state/settingsStore.ts')
        s.useSettingsStore.getState().setHighContrast(true)
      })
      await p.getByRole('button', { name: /Settings/i }).first().click()
      await settle(p)
      await shot(p, '01-hub-and-menus', '06-settings-high-contrast-ON', vp)
    },
  },

  /* -------------------------------------------------------- 02 run start */
  {
    flow: '02-run-start', name: '01-hero-pick',
    run: async (p, vp) => {
      await p.evaluate(() => window.__h.get().newRun())
      await settle(p)
      await shot(p, '02-run-start', '01-hero-pick', vp)
      await clip(p, '.hero-pick-card, .archetype-card, .hp-card', '05-components/hero-pick-card', 'archetype-card-fighter', vp, 0)
    },
  },
  {
    flow: '02-run-start', name: '02-run-map',
    run: async (p, vp) => {
      await p.evaluate(() => { const h = window.__h; h.get().newRun(); h.get().pickStartingHero('fighter') })
      await settle(p)
      await shot(p, '02-run-start', '02-run-map-start', vp)
      await clip(p, '.map-header', '05-components/map', 'map-header', vp)
      await clip(p, '.map-roster', '05-components/map', 'map-roster-strip', vp)
    },
  },
  {
    flow: '02-run-start', name: '03-run-map-progressed',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.get().newRun(); h.get().pickStartingHero('fighter')
        const st = h.get()
        const cleared = st.runMap.nodes.slice(0, 5).map((n) => n.id)
        h.set({ roster: h.roster(), clearedNodeIds: cleared, gold: 240, threat: 1.48, baseHp: 13, inventory: h.sampleItems().byRarity })
      })
      await settle(p)
      await shot(p, '02-run-start', '03-run-map-progressed', vp)
    },
  },
  {
    flow: '02-run-start', name: '04-crossroads',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.get().newRun(); h.get().pickStartingHero('fighter')
        h.set({ screen: 'crossroads', roster: h.roster(), crossroads: { recruits: [h.sentinels.createSentinel('rogue'), h.sentinels.createSentinel('mystic')] } })
      })
      await settle(p)
      await shot(p, '02-run-start', '04-crossroads', vp)
    },
  },

  /* ------------------------------------------------------ 03 battle setup */
  {
    flow: '03-battle-setup', name: 'setup-tabs',
    run: async (p, vp) => {
      await p.evaluate(() => window.__h.startBattle())
      await settle(p, 500)
      await shot(p, '03-battle-setup', '01-setup-squad-tab', vp)
      await clip(p, '.hud-tabs', '05-components/hud', 'hud-tabs', vp)
      await clip(p, '.sentinel-card', '05-components/sentinel-card', 'state-reserve', vp, 0)
      await clip(p, '.top-bar, .topbar', '05-components/hud', 'top-bar', vp)
      await clip(p, '.battle-controls', '05-components/hud', 'battle-controls-setup', vp)

      if (await clickIfVisible(p.locator('.hud-tab', { hasText: 'Tactics' }))) {
        await settle(p); await shot(p, '03-battle-setup', '02-setup-tactics-tab', vp)
      }
      await clip(p, '.tactics-panel', '05-components/hud', 'tactics-panel', vp)

      if (await clickIfVisible(p.locator('.hud-tab', { hasText: 'Wave' }))) {
        await settle(p); await shot(p, '03-battle-setup', '03-setup-wave-tab', vp)
      }
      await clip(p, '.wave-preview', '05-components/hud', 'wave-preview', vp)
    },
  },
  {
    flow: '03-battle-setup', name: 'card-states',
    run: async (p, vp) => {
      await p.evaluate(() => window.__h.startBattle())
      await settle(p, 500)
      // selected
      await p.locator('.sentinel-card .sc-main').first().click()
      await settle(p)
      await shot(p, '03-battle-setup', '04-hero-selected', vp)
      await clip(p, '.sentinel-card', '05-components/sentinel-card', 'state-selected', vp, 0)
      // expanded gear
      await p.locator('.sc-gear-btn').first().click()
      await settle(p)
      await shot(p, '03-battle-setup', '05-hero-gear-expanded', vp)
      await clip(p, '.sentinel-card', '05-components/sentinel-card', 'state-gear-expanded', vp, 0)
    },
  },
  {
    flow: '03-battle-setup', name: 'placed',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.startBattle()
        const st = h.get()
        const slot = Object.keys(st.placements)[0]
        h.set({ placements: { ...st.placements, [slot]: st.roster[0].id } })
      })
      await settle(p, 500)
      await shot(p, '03-battle-setup', '06-hero-placed', vp)
      await clip(p, '.sentinel-card', '05-components/sentinel-card', 'state-deployed', vp, 0)
    },
  },
  {
    flow: '03-battle-setup', name: 'evolve-ready',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.startBattle()
        h.set({ evolutionQueue: [h.get().roster[0].id] })
      })
      await settle(p, 400)
      await clip(p, '.sentinel-card', '05-components/sentinel-card', 'state-evolve-ready', vp, 0)
      await shot(p, '03-battle-setup', '07-evolution-ready', vp)
    },
  },

  /* ------------------------------------------------------- 04 battle live */
  {
    flow: '04-battle-live', name: 'live',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.startBattle()
        const st = h.get()
        const slots = Object.keys(st.placements)
        const pl = { ...st.placements }
        st.roster.forEach((s, i) => { if (slots[i]) pl[slots[i]] = s.id })
        h.set({ placements: pl })
      })
      await settle(p, 300)
      await p.evaluate(() => window.__h.get().startWave())
      await p.waitForTimeout(2600)
      await shot(p, '04-battle-live', '01-wave-in-progress', vp)
      await clip(p, '.battle-controls', '05-components/hud', 'battle-controls-live', vp)
      await clip(p, '.sentinel-card', '05-components/sentinel-card', 'state-disabled-live', vp, 0)
    },
  },
  {
    flow: '04-battle-live', name: 'result-victory',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.startBattle()
        h.set({ battlePhase: 'battle', lastResult: { victory: true, goldEarned: 48, kills: 21, leaked: 0, downed: [] }, lastLoot: h.sampleItems().byRarity.slice(0, 2) })
      })
      await settle(p, 400)
      await shot(p, '04-battle-live', '02-result-victory', vp)
    },
  },
  {
    flow: '04-battle-live', name: 'result-defeat',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.startBattle()
        h.set({ battlePhase: 'battle', baseHp: 0, lastResult: { victory: false, goldEarned: 12, kills: 6, leaked: 9, downed: [] }, lastLoot: [] })
      })
      await settle(p, 400)
      await shot(p, '04-battle-live', '03-result-defeat', vp)
    },
  },

  /* ----------------------------------------------------------- 05 modals */
  {
    flow: '06-modals', name: 'sentinel-detail',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.startBattle()
        const st = h.get()
        const hero = { ...st.roster[0] }
        const si = h.sampleItems()
        hero.equipment = { mainHand: si.byRarity[3], offHand: si.byRarity[1], body: null }
        hero.mutations = [h.mutations.allMutations()[0]]
        h.set({ roster: [hero, ...st.roster.slice(1)] })
        h.get().openDetail(hero.id)
      })
      await settle(p, 400)
      await shot(p, '06-modals', '01-sentinel-detail', vp)
    },
  },
  {
    flow: '06-modals', name: 'equip-drawer',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.startBattle()
        h.set({ inventory: h.sampleItems().byRarity })
        h.get().openEquip(h.get().roster[0].id, 'all')
      })
      await settle(p, 400)
      await shot(p, '06-modals', '02-equip-drawer-all', vp)
      await clip(p, '.equip-drawer', '05-components/equip', 'equip-drawer', vp)
      if (await clickIfVisible(p.locator('.eq-tab', { hasText: /Main/i }))) {
        await settle(p); await shot(p, '06-modals', '03-equip-drawer-mainhand-tab', vp)
      }
      // Back to the All tab so the list is populated, then open an item's
      // inspect state (the two-step tap-to-inspect-then-Equip interaction).
      await clickIfVisible(p.locator('.eq-tab', { hasText: /^All$/i }))
      await settle(p, 200)
      if (await clickIfVisible(p.locator('.eq-item .eq-item-card'))) {
        await settle(p)
        await shot(p, '06-modals', '04-equip-drawer-item-inspect', vp)
        await clip(p, '.eq-item.active', '05-components/equip', 'equip-item-row-active', vp)
      }
      await clip(p, '.eq-item', '05-components/equip', 'equip-item-row-idle', vp, 1)
      await clip(p, '.eq-slots', '05-components/equip', 'equip-slots', vp)
    },
  },
  {
    flow: '06-modals', name: 'tower-upgrade',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.startBattle()
        const st = h.get()
        const slot = Object.keys(st.placements)[0]
        h.set({ placements: { ...st.placements, [slot]: st.roster[0].id }, gold: 500, upgradeTarget: st.roster[0].id })
      })
      await settle(p, 400)
      await shot(p, '06-modals', '05-tower-upgrade-fresh', vp)
      await clip(p, '.upgrade-modal', '05-components/upgrade', 'tower-upgrade-modal', vp)
      await clip(p, '.upg-path', '05-components/upgrade', 'upgrade-path-locked', vp, 0)
    },
  },
  {
    flow: '06-modals', name: 'tower-upgrade-owned',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.startBattle()
        const st = h.get()
        const hero = { ...st.roster[0], level: 16, upgrades: { power: 2, tempo: 1 } }
        const slot = Object.keys(st.placements)[0]
        h.set({ roster: [hero, ...st.roster.slice(1)], placements: { ...st.placements, [slot]: hero.id }, gold: 500, upgradeTarget: hero.id })
      })
      await settle(p, 400)
      await shot(p, '06-modals', '06-tower-upgrade-partly-owned', vp)
      await clip(p, '.upg-path', '05-components/upgrade', 'upgrade-path-owned', vp, 0)
    },
  },
  {
    flow: '06-modals', name: 'inventory',
    run: async (p, vp) => {
      await p.evaluate(() => { const h = window.__h; h.startBattle(); h.set({ inventory: [] }); h.get().openInventory() })
      await settle(p, 400)
      await shot(p, '06-modals', '07-inventory-empty', vp)
      await p.evaluate(() => {
        const h = window.__h
        const si = h.sampleItems()
        h.set({ inventory: [...si.byRarity, si.cursed, si.keepsake].filter(Boolean), gold: 320 })
      })
      await settle(p, 300)
      await shot(p, '06-modals', '08-inventory-populated', vp)
      await clip(p, '.inv2', '05-components/inventory', 'inventory-manager', vp)
      await clip(p, '.inv2-slots', '05-components/inventory', 'equipment-slots-empty', vp)
      const tile = p.locator('.inv2-grid .inv-tile').first()
      if (await tile.count()) { await tile.click(); await settle(p); await shot(p, '06-modals', '09-inventory-item-selected', vp) }
      await clip(p, '.inv2-detail', '05-components/inventory', 'inventory-detail-panel', vp)
    },
  },
  {
    flow: '06-modals', name: 'merchant',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.get().newRun(); h.get().pickStartingHero('fighter')
        const si = h.sampleItems()
        const stock = [...si.byRarity, si.cursed, si.keepsake].filter(Boolean).map((item, i) => ({ item, price: 40 + i * 25 }))
        h.set({ roster: h.roster(), gold: 260, event: { kind: 'merchant', nodeId: 'n1' }, merchant: { items: stock, recruit: { sentinel: h.sentinels.createSentinel('mystic'), price: 120 } } })
      })
      await settle(p, 400)
      await shot(p, '06-modals', '10-merchant', vp)
      await clip(p, '.event-modal', '05-components/event', 'merchant-modal', vp)
      // Item cards, one per rarity + curse + keepsake — the real render path.
      const labels = ['common', 'rare', 'epic', 'legendary', 'mythic', 'cursed-legendary', 'keepsake']
      for (let i = 0; i < labels.length; i++) {
        await clip(p, '.merchant-list .item-card', '05-components/item-card', `item-${String(i + 1).padStart(2, '0')}-${labels[i]}`, vp, i)
      }
    },
  },
  {
    flow: '06-modals', name: 'shrine',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.get().newRun(); h.get().pickStartingHero('fighter')
        h.set({ roster: h.roster(), event: { kind: 'shrine', nodeId: 'n1' }, shrineOffer: { title: 'Shrine of the Ember', boon: '+18% attack damage for the rest of the run.', curse: 'Your base begins each battle with 3 less integrity.', mods: [], id: 'sh1' } })
      })
      await settle(p, 400)
      await shot(p, '06-modals', '11-shrine', vp)
      await clip(p, '.event-modal.shrine', '05-components/event', 'shrine-modal', vp)
    },
  },
  {
    flow: '06-modals', name: 'recruit',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.get().newRun(); h.get().pickStartingHero('fighter')
        h.set({ roster: h.roster(), event: { kind: 'recruit', nodeId: 'n1' }, recruitOptions: [h.sentinels.createSentinel('rogue'), h.sentinels.createSentinel('mystic')] })
      })
      await settle(p, 400)
      await shot(p, '06-modals', '12-recruit', vp)
      await clip(p, '.event-modal.recruit', '05-components/event', 'recruit-modal', vp)
    },
  },
  {
    flow: '06-modals', name: 'recruit-full',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.get().newRun(); h.get().pickStartingHero('fighter')
        const full = ['fighter', 'rogue', 'mystic', 'fighter', 'rogue'].map((a) => h.sentinels.createSentinel(a))
        h.set({ roster: full, event: { kind: 'recruit', nodeId: 'n1' }, recruitOptions: [h.sentinels.createSentinel('rogue')] })
      })
      await settle(p, 400)
      await shot(p, '06-modals', '13-recruit-roster-full', vp)
    },
  },
  {
    flow: '06-modals', name: 'run-end',
    run: async (p, vp) => {
      await p.evaluate(() => {
        const h = window.__h
        h.get().newRun(); h.get().pickStartingHero('fighter')
        h.set({ roster: h.roster(), runPhase: 'lost', runKills: 143, marksEarned: 24, runDowns: 4 })
      })
      await settle(p, 400)
      await shot(p, '06-modals', '14-run-end-defeat', vp)
      await p.evaluate(() => window.__h.set({ runPhase: 'won' }))
      await settle(p, 300)
      await shot(p, '06-modals', '15-run-end-victory', vp)
      await clip(p, '.run-end, .overlay-card, .run-end-overlay', '05-components/event', 'run-end-overlay', vp)
    },
  },

  /* ---------------------------------------------------------- 07 endless */
  {
    flow: '07-endless', name: 'endless',
    run: async (p, vp) => {
      await p.evaluate(() => window.__h.get().startEndless())
      await settle(p, 500)
      await shot(p, '07-endless', '01-endless-hub', vp)
      for (const room of ['merchant', 'forge', 'shrine', 'recruit']) {
        await p.evaluate((r) => window.__h.get().endlessOpenRoom(r), room)
        await settle(p, 350)
        await shot(p, '07-endless', `02-room-${room}`, vp)
      }
    },
  },
]

/* --------------------------------------------------------------------- run */
const run = async () => {
  // Resolve the browser BEFORE wiping the output directory: a missing Playwright
  // must not destroy the checked-in screenshot set it cannot regenerate.
  const chromium = await loadChromium()

  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true })
  fs.mkdirSync(OUT, { recursive: true })

  // `playwright` finds its own bundled browser; `playwright-core` needs a path.
  const launchOpts = { args: ['--no-sandbox', '--font-render-hinting=none'] }
  if (fs.existsSync(EXEC)) launchOpts.executablePath = EXEC
  const browser = await chromium.launch(launchOpts)
  const manifest = []
  let failures = 0

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: !!vp.isMobile,
      hasTouch: !!vp.hasTouch,
      reducedMotion: 'reduce',
    })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.error(`  ! page error: ${e.message}`))

    for (const s of SHOTS) {
      try {
        await page.goto(BASE, { waitUntil: 'networkidle' })
        await page.evaluate(() => { localStorage.clear() })
        await page.goto(BASE, { waitUntil: 'networkidle' })
        await page.evaluate(INSTALL)
        // Shared helper that walks a fresh run all the way into battle setup.
        await page.evaluate(() => {
          window.__h.startBattle = () => {
            const h = window.__h
            h.get().newRun()
            h.get().pickStartingHero('fighter')
            h.set({ roster: h.roster() })
            const st = h.get()
            const first = st.reachableNodeIds[0] || st.runMap.nodes[1]?.id || st.runMap.nodes[0].id
            h.get().selectNode(first)
          }
        })
        await settle(page, 200)
        await s.run(page, vp)
        manifest.push({ viewport: vp.id, flow: s.flow, name: s.name, ok: true })
        console.log(`  ✓ [${vp.id}] ${s.flow}/${s.name}`)
      } catch (err) {
        failures++
        manifest.push({ viewport: vp.id, flow: s.flow, name: s.name, ok: false, error: String(err).slice(0, 200) })
        console.error(`  ✗ [${vp.id}] ${s.flow}/${s.name} — ${String(err).split('\n')[0]}`)
      }
    }
    await ctx.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\nDone. ${manifest.filter((m) => m.ok).length}/${manifest.length} shots OK, ${failures} failed.`)
}

run().catch((e) => { console.error(e); process.exit(1) })
