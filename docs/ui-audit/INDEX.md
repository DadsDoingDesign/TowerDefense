# Fieldwatch — UI audit

149 screenshots of every screen, modal, and component state, captured
from the real app (no mocks) at two viewports:

- **desktop** — 1440×900
- **mobile** — 390×844 @2x, touch + coarse pointer

Regenerate: `npx vite --port 5188 --strictPort &` then `node scripts/ui-audit.mjs`
(index: `node scripts/ui-audit-index.mjs`).

Design-token analysis of these states: [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).

---

## Flows

### Hub & menus
`01-hub-and-menus/` — Entry point. Main menu → perks → settings.

| Step | Desktop | Mobile |
|---|---|---|
| `01-main-menu` | [png](01-hub-and-menus/01-main-menu.desktop.png) | [png](01-hub-and-menus/01-main-menu.mobile.png) |
| `02-perks-no-marks` | [png](01-hub-and-menus/02-perks-no-marks.desktop.png) | [png](01-hub-and-menus/02-perks-no-marks.mobile.png) |
| `03-perks-with-marks` | [png](01-hub-and-menus/03-perks-with-marks.desktop.png) | [png](01-hub-and-menus/03-perks-with-marks.mobile.png) |
| `04-settings` | [png](01-hub-and-menus/04-settings.desktop.png) | [png](01-hub-and-menus/04-settings.mobile.png) |
| `05-settings-reset-confirm` | [png](01-hub-and-menus/05-settings-reset-confirm.desktop.png) | [png](01-hub-and-menus/05-settings-reset-confirm.mobile.png) |
| `06-settings-high-contrast-ON` | [png](01-hub-and-menus/06-settings-high-contrast-ON.desktop.png) | [png](01-hub-and-menus/06-settings-high-contrast-ON.mobile.png) |

### Run start
`02-run-start/` — Hero pick → run map → crossroads.

| Step | Desktop | Mobile |
|---|---|---|
| `01-hero-pick` | [png](02-run-start/01-hero-pick.desktop.png) | [png](02-run-start/01-hero-pick.mobile.png) |
| `02-run-map-start` | [png](02-run-start/02-run-map-start.desktop.png) | [png](02-run-start/02-run-map-start.mobile.png) |
| `03-run-map-progressed` | [png](02-run-start/03-run-map-progressed.desktop.png) | [png](02-run-start/03-run-map-progressed.mobile.png) |
| `04-crossroads` | [png](02-run-start/04-crossroads.desktop.png) | [png](02-run-start/04-crossroads.mobile.png) |

### Battle — setup phase
`03-battle-setup/` — Placement, tabs, and every roster-card state.

| Step | Desktop | Mobile |
|---|---|---|
| `01-setup-squad-tab` | [png](03-battle-setup/01-setup-squad-tab.desktop.png) | [png](03-battle-setup/01-setup-squad-tab.mobile.png) |
| `02-setup-tactics-tab` | — | [png](03-battle-setup/02-setup-tactics-tab.mobile.png) |
| `03-setup-wave-tab` | — | [png](03-battle-setup/03-setup-wave-tab.mobile.png) |
| `04-hero-selected` | [png](03-battle-setup/04-hero-selected.desktop.png) | [png](03-battle-setup/04-hero-selected.mobile.png) |
| `05-hero-gear-expanded` | [png](03-battle-setup/05-hero-gear-expanded.desktop.png) | [png](03-battle-setup/05-hero-gear-expanded.mobile.png) |
| `06-hero-placed` | [png](03-battle-setup/06-hero-placed.desktop.png) | [png](03-battle-setup/06-hero-placed.mobile.png) |
| `07-evolution-ready` | [png](03-battle-setup/07-evolution-ready.desktop.png) | [png](03-battle-setup/07-evolution-ready.mobile.png) |

### Battle — live & result
`04-battle-live/` — Wave in progress and the two result overlays.

| Step | Desktop | Mobile |
|---|---|---|
| `01-wave-in-progress` | [png](04-battle-live/01-wave-in-progress.desktop.png) | [png](04-battle-live/01-wave-in-progress.mobile.png) |
| `02-result-victory` | [png](04-battle-live/02-result-victory.desktop.png) | [png](04-battle-live/02-result-victory.mobile.png) |
| `03-result-defeat` | [png](04-battle-live/03-result-defeat.desktop.png) | [png](04-battle-live/03-result-defeat.mobile.png) |

### Modals & overlays
`06-modals/` — Every dialog, drawer, and full-screen overlay.

| Step | Desktop | Mobile |
|---|---|---|
| `01-sentinel-detail` | [png](06-modals/01-sentinel-detail.desktop.png) | [png](06-modals/01-sentinel-detail.mobile.png) |
| `02-equip-drawer-all` | [png](06-modals/02-equip-drawer-all.desktop.png) | [png](06-modals/02-equip-drawer-all.mobile.png) |
| `03-equip-drawer-mainhand-tab` | [png](06-modals/03-equip-drawer-mainhand-tab.desktop.png) | [png](06-modals/03-equip-drawer-mainhand-tab.mobile.png) |
| `04-equip-drawer-item-inspect` | [png](06-modals/04-equip-drawer-item-inspect.desktop.png) | [png](06-modals/04-equip-drawer-item-inspect.mobile.png) |
| `05-tower-upgrade-fresh` | [png](06-modals/05-tower-upgrade-fresh.desktop.png) | [png](06-modals/05-tower-upgrade-fresh.mobile.png) |
| `06-tower-upgrade-partly-owned` | [png](06-modals/06-tower-upgrade-partly-owned.desktop.png) | [png](06-modals/06-tower-upgrade-partly-owned.mobile.png) |
| `07-inventory-empty` | [png](06-modals/07-inventory-empty.desktop.png) | [png](06-modals/07-inventory-empty.mobile.png) |
| `08-inventory-populated` | [png](06-modals/08-inventory-populated.desktop.png) | [png](06-modals/08-inventory-populated.mobile.png) |
| `09-inventory-item-selected` | [png](06-modals/09-inventory-item-selected.desktop.png) | [png](06-modals/09-inventory-item-selected.mobile.png) |
| `10-merchant` | [png](06-modals/10-merchant.desktop.png) | [png](06-modals/10-merchant.mobile.png) |
| `11-shrine` | [png](06-modals/11-shrine.desktop.png) | [png](06-modals/11-shrine.mobile.png) |
| `12-recruit` | [png](06-modals/12-recruit.desktop.png) | [png](06-modals/12-recruit.mobile.png) |
| `13-recruit-roster-full` | [png](06-modals/13-recruit-roster-full.desktop.png) | [png](06-modals/13-recruit-roster-full.mobile.png) |
| `14-run-end-defeat` | [png](06-modals/14-run-end-defeat.desktop.png) | [png](06-modals/14-run-end-defeat.mobile.png) |
| `15-run-end-victory` | [png](06-modals/15-run-end-victory.desktop.png) | [png](06-modals/15-run-end-victory.mobile.png) |

### Endless Watch
`07-endless/` — The endless-mode hub and its four rooms.

| Step | Desktop | Mobile |
|---|---|---|
| `01-endless-hub` | [png](07-endless/01-endless-hub.desktop.png) | [png](07-endless/01-endless-hub.mobile.png) |
| `02-room-forge` | [png](07-endless/02-room-forge.desktop.png) | [png](07-endless/02-room-forge.mobile.png) |
| `02-room-merchant` | [png](07-endless/02-room-merchant.desktop.png) | [png](07-endless/02-room-merchant.mobile.png) |
| `02-room-recruit` | [png](07-endless/02-room-recruit.desktop.png) | [png](07-endless/02-room-recruit.mobile.png) |
| `02-room-shrine` | [png](07-endless/02-room-shrine.desktop.png) | [png](07-endless/02-room-shrine.mobile.png) |

---

## Components

Element-clipped shots — each is the component alone, at both viewports.

### Equip drawer
`05-components/equip/` — Slots, item rows, inspect state.

| Step | Desktop | Mobile |
|---|---|---|
| `equip-drawer` | [png](05-components/equip/equip-drawer.desktop.png) | [png](05-components/equip/equip-drawer.mobile.png) |
| `equip-item-row-active` | [png](05-components/equip/equip-item-row-active.desktop.png) | [png](05-components/equip/equip-item-row-active.mobile.png) |
| `equip-item-row-idle` | [png](05-components/equip/equip-item-row-idle.desktop.png) | [png](05-components/equip/equip-item-row-idle.mobile.png) |
| `equip-slots` | [png](05-components/equip/equip-slots.desktop.png) | [png](05-components/equip/equip-slots.mobile.png) |

### Event modals
`05-components/event/` — Merchant, shrine, recruit, run-end.

| Step | Desktop | Mobile |
|---|---|---|
| `merchant-modal` | [png](05-components/event/merchant-modal.desktop.png) | [png](05-components/event/merchant-modal.mobile.png) |
| `recruit-modal` | [png](05-components/event/recruit-modal.desktop.png) | [png](05-components/event/recruit-modal.mobile.png) |
| `run-end-overlay` | [png](05-components/event/run-end-overlay.desktop.png) | [png](05-components/event/run-end-overlay.mobile.png) |
| `shrine-modal` | [png](05-components/event/shrine-modal.desktop.png) | [png](05-components/event/shrine-modal.mobile.png) |

### Hero pick card
`05-components/hero-pick-card/` — Archetype choice card.

| Step | Desktop | Mobile |
|---|---|---|
| `archetype-card-fighter` | [png](05-components/hero-pick-card/archetype-card-fighter.desktop.png) | [png](05-components/hero-pick-card/archetype-card-fighter.mobile.png) |

### Battle HUD
`05-components/hud/` — Top bar, tabs, tactics, wave preview, controls.

| Step | Desktop | Mobile |
|---|---|---|
| `battle-controls-live` | [png](05-components/hud/battle-controls-live.desktop.png) | [png](05-components/hud/battle-controls-live.mobile.png) |
| `battle-controls-setup` | [png](05-components/hud/battle-controls-setup.desktop.png) | [png](05-components/hud/battle-controls-setup.mobile.png) |
| `hud-tabs` | — | [png](05-components/hud/hud-tabs.mobile.png) |
| `tactics-panel` | [png](05-components/hud/tactics-panel.desktop.png) | [png](05-components/hud/tactics-panel.mobile.png) |
| `top-bar` | [png](05-components/hud/top-bar.desktop.png) | [png](05-components/hud/top-bar.mobile.png) |
| `wave-preview` | [png](05-components/hud/wave-preview.desktop.png) | [png](05-components/hud/wave-preview.mobile.png) |

### Inventory manager
`05-components/inventory/` — Grid, equipment slots, detail panel.

| Step | Desktop | Mobile |
|---|---|---|
| `equipment-slots-empty` | [png](05-components/inventory/equipment-slots-empty.desktop.png) | [png](05-components/inventory/equipment-slots-empty.mobile.png) |
| `inventory-detail-panel` | [png](05-components/inventory/inventory-detail-panel.desktop.png) | [png](05-components/inventory/inventory-detail-panel.mobile.png) |
| `inventory-manager` | [png](05-components/inventory/inventory-manager.desktop.png) | [png](05-components/inventory/inventory-manager.mobile.png) |

### Item card
`05-components/item-card/` — One per rarity, plus cursed and keepsake.

| Step | Desktop | Mobile |
|---|---|---|
| `item-01-common` | [png](05-components/item-card/item-01-common.desktop.png) | [png](05-components/item-card/item-01-common.mobile.png) |
| `item-02-rare` | [png](05-components/item-card/item-02-rare.desktop.png) | [png](05-components/item-card/item-02-rare.mobile.png) |
| `item-03-epic` | [png](05-components/item-card/item-03-epic.desktop.png) | [png](05-components/item-card/item-03-epic.mobile.png) |
| `item-04-legendary` | [png](05-components/item-card/item-04-legendary.desktop.png) | [png](05-components/item-card/item-04-legendary.mobile.png) |
| `item-05-mythic` | [png](05-components/item-card/item-05-mythic.desktop.png) | [png](05-components/item-card/item-05-mythic.mobile.png) |
| `item-06-cursed-legendary` | [png](05-components/item-card/item-06-cursed-legendary.desktop.png) | [png](05-components/item-card/item-06-cursed-legendary.mobile.png) |
| `item-07-keepsake` | [png](05-components/item-card/item-07-keepsake.desktop.png) | [png](05-components/item-card/item-07-keepsake.mobile.png) |

### Run map chrome
`05-components/map/` — Header and roster strip.

| Step | Desktop | Mobile |
|---|---|---|
| `map-header` | [png](05-components/map/map-header.desktop.png) | [png](05-components/map/map-header.mobile.png) |
| `map-roster-strip` | [png](05-components/map/map-roster-strip.desktop.png) | [png](05-components/map/map-roster-strip.mobile.png) |

### Sentinel card
`05-components/sentinel-card/` — Every interactive state of the tower card.

| Step | Desktop | Mobile |
|---|---|---|
| `state-deployed` | [png](05-components/sentinel-card/state-deployed.desktop.png) | [png](05-components/sentinel-card/state-deployed.mobile.png) |
| `state-disabled-live` | [png](05-components/sentinel-card/state-disabled-live.desktop.png) | [png](05-components/sentinel-card/state-disabled-live.mobile.png) |
| `state-evolve-ready` | [png](05-components/sentinel-card/state-evolve-ready.desktop.png) | [png](05-components/sentinel-card/state-evolve-ready.mobile.png) |
| `state-gear-expanded` | [png](05-components/sentinel-card/state-gear-expanded.desktop.png) | [png](05-components/sentinel-card/state-gear-expanded.mobile.png) |
| `state-reserve` | [png](05-components/sentinel-card/state-reserve.desktop.png) | [png](05-components/sentinel-card/state-reserve.mobile.png) |
| `state-selected` | [png](05-components/sentinel-card/state-selected.desktop.png) | [png](05-components/sentinel-card/state-selected.mobile.png) |

### Tower upgrade
`05-components/upgrade/` — Upgrade modal and path states.

| Step | Desktop | Mobile |
|---|---|---|
| `tower-upgrade-modal` | [png](05-components/upgrade/tower-upgrade-modal.desktop.png) | [png](05-components/upgrade/tower-upgrade-modal.mobile.png) |
| `upgrade-path-locked` | [png](05-components/upgrade/upgrade-path-locked.desktop.png) | [png](05-components/upgrade/upgrade-path-locked.mobile.png) |
| `upgrade-path-owned` | [png](05-components/upgrade/upgrade-path-owned.desktop.png) | [png](05-components/upgrade/upgrade-path-owned.mobile.png) |

---

## Coverage notes

- `02-setup-tactics-tab` / `03-setup-wave-tab` are **mobile only** by design —
  desktop shows all three HUD panels at once, so the tab bar does not render.
- Item cards are captured through the merchant list, which is the real
  `ItemCard` render path (not an isolated harness).
- Every state is driven through the live Zustand store, so these are true
  renders of production code.
