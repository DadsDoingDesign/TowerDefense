import { MAX_DELTA, TOWERS } from './constants.js';
import { RunState } from './state/RunState.js';
import { Tower } from './entities/Tower.js';
import { LoopManager } from './systems/LoopManager.js';
import { SpawnManager } from './systems/SpawnManager.js';
import { CombatManager } from './systems/CombatManager.js';
import { MilestoneManager } from './systems/MilestoneManager.js';
import { UpgradeManager } from './systems/UpgradeManager.js';
import { MetaProgressionManager } from './systems/MetaProgressionManager.js';
import { OfflineManager } from './systems/OfflineManager.js';
import { SaveManager } from './systems/SaveManager.js';
import { InputManager } from './systems/InputManager.js';
import { BackgroundRenderer } from './renderer/BackgroundRenderer.js';
import { GameRenderer } from './renderer/GameRenderer.js';
import { UIManager } from './ui/UIManager.js';

const bgCanvas = document.getElementById('bg-canvas');
const gameCanvas = document.getElementById('game-canvas');
const canvasWrap = document.getElementById('canvas-wrap');
const bgCtx = bgCanvas.getContext('2d');
const gameCtx = gameCanvas.getContext('2d');

const loopManager = new LoopManager();
const spawnManager = new SpawnManager();
const combatManager = new CombatManager();
const backgroundRenderer = new BackgroundRenderer();
const gameRenderer = new GameRenderer();
const uiManager = new UIManager();
const inputManager = new InputManager(gameCanvas);
const offlineManager = new OfflineManager();

const metaState = SaveManager.loadMeta();
let upgradeManager = new UpgradeManager();
let runState = null;
let paused = false;
let selectedSlot = null;
let hoverSlot = null;
let runFinished = false;

function occupiedSlotsSet(rs) {
  return new Set(rs.towers.map((t) => t.slotIndex));
}

function drawBackground() {
  if (!runState) return;
  backgroundRenderer.draw(bgCtx, bgCanvas, loopManager, occupiedSlotsSet(runState));
}

function resizeCanvases() {
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;
  bgCanvas.width = w;
  bgCanvas.height = h;
  gameCanvas.width = w;
  gameCanvas.height = h;
  loopManager.resize(w, h);
  drawBackground();
}

function syncLoopManagerToRun() {
  loopManager.setTierIndex(runState.loopTierIndex);
  loopManager.setExtraSlots(runState.extraSlots);
}

function startNewRun() {
  runFinished = false;
  runState = RunState.create(metaState.getBonuses());
  syncLoopManagerToRun();
  upgradeManager = new UpgradeManager();
  gameRenderer.fx = [];
  selectedSlot = null;
  hoverSlot = null;
  uiManager.clearSlotSelection();
  uiManager.hideAllModals();
  resizeCanvases();
  SaveManager.saveRun(runState);
}

function finishRun() {
  if (runFinished || !runState) return;
  runFinished = true;
  const cores = MetaProgressionManager.finalizeRun(runState, metaState);
  SaveManager.saveMeta(metaState);
  SaveManager.clearRun();
  uiManager.showRunEndModal(
    {
      goldEarned: runState.lifetimeGoldEarned,
      tierName: loopManager.getCurrentTier().name,
      kills: runState.killCount,
      runSeconds: runState.runSeconds(),
    },
    cores
  );
}

function openUpgradeModal() {
  paused = true;
  const choices = upgradeManager.drawChoices(runState);
  uiManager.showUpgradeModal(choices, (card) => {
    upgradeManager.applyChoice(card, runState);
    uiManager.hideAllModals();
    paused = false;
  });
}

uiManager.bindHandlers({
  onBuildAtSlot: (slotIndex, typeId) => {
    if (!runState) return;
    const def = TOWERS[typeId];
    const occupied = runState.towers.some((t) => t.slotIndex === slotIndex);
    if (occupied || !runState.unlockedTowerTypes.includes(typeId) || runState.gold < def.cost) return;
    runState.gold -= def.cost;
    runState.towers.push(new Tower(typeId, slotIndex));
    selectedSlot = null;
    uiManager.clearSlotSelection();
    drawBackground();
  },
  onDeselectSlot: () => {
    selectedSlot = null;
    uiManager.clearSlotSelection();
  },
  onSelectTroop: (typeId) => {
    if (runState) spawnManager.sendTroop(typeId, runState);
  },
  onCashOut: () => finishRun(),
  onExpandTier: () => {
    if (runState && MilestoneManager.expand(runState, loopManager)) {
      uiManager.hideTierBanner();
      drawBackground();
    }
  },
  onStartNewRun: () => startNewRun(),
  onOpenMetaShop: () => uiManager.showMetaShopModal(metaState),
  onPurchaseMeta: (id) => {
    if (metaState.purchase(id)) {
      SaveManager.saveMeta(metaState);
      uiManager.showMetaShopModal(metaState);
    }
  },
  onDismissOffline: () => uiManager.hideAllModals(),
});

inputManager.onTap((x, y) => {
  if (!runState) return;
  const slotIndex = loopManager.findNearestSlot(x, y);
  if (slotIndex == null || slotIndex === selectedSlot) {
    selectedSlot = null;
    uiManager.clearSlotSelection();
    return;
  }
  selectedSlot = slotIndex;
  const tower = runState.towers.find((t) => t.slotIndex === slotIndex) ?? null;
  uiManager.selectSlot(slotIndex, !!tower, tower);
});

inputManager.onHover((x, y) => {
  if (!runState) {
    hoverSlot = null;
    return;
  }
  hoverSlot = loopManager.findNearestSlot(x, y);
});

inputManager.onLeave(() => {
  hoverSlot = null;
});

window.addEventListener('resize', resizeCanvases);

offlineManager.startAutosave(() => {
  if (runState && !runFinished) SaveManager.saveRun(runState);
});

// --- Boot ------------------------------------------------------------

const existingRun = SaveManager.loadRun();
if (existingRun && !existingRun.gameOver) {
  runState = existingRun;
  syncLoopManagerToRun();
  resizeCanvases();
  const offlineResult = offlineManager.computeOfflineEarnings(runState);
  if (!offlineResult.silent) {
    offlineManager.applyOfflineEarnings(runState, offlineResult);
    uiManager.showOfflineModal(offlineResult);
  } else {
    uiManager.hideAllModals();
  }
  runState.lastSaveTimestamp = Date.now();
} else {
  resizeCanvases();
  uiManager.showStartModal(metaState);
}

let lastTs = null;
function frame(ts) {
  if (lastTs == null) lastTs = ts;
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  dt = Math.min(dt, MAX_DELTA);

  if (runState && !paused && !runFinished) {
    spawnManager.tick(dt, runState);
    const events = combatManager.update(dt, runState, loopManager);
    gameRenderer.addShotEvents(events.shotEvents);
    gameRenderer.addKillEvents(events.killEvents, loopManager);
    gameRenderer.addLeashEvents(events.leashEvents, loopManager);
    upgradeManager.checkThreshold(runState);

    if (runState.gameOver) finishRun();
  }

  gameRenderer.update(dt);

  if (runState) {
    uiManager.updateHUD(runState, metaState, loopManager);

    if (!paused && !runFinished && MilestoneManager.isNextTierAvailable(runState, loopManager)) {
      uiManager.showTierBanner(loopManager.getNextTier());
    } else {
      uiManager.hideTierBanner();
    }

    if (!paused && !runFinished && upgradeManager.hasPendingOffer()) {
      openUpgradeModal();
    }

    gameRenderer.draw(gameCtx, gameCanvas, runState, loopManager, hoverSlot, selectedSlot);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
