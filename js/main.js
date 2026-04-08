import { MAX_DELTA, DIFFICULTIES, SPEED_OPTIONS, UPGRADES } from './constants.js';
import { Grid } from './grid.js';
import { BackgroundRenderer } from './renderer/BackgroundRenderer.js';
import { GameRenderer } from './renderer/GameRenderer.js';
import { Tower } from './entities/Tower.js';
import { Projectile } from './entities/Projectile.js';
import { WaveManager, WaveState } from './systems/WaveManager.js';
import { EconomyManager } from './systems/EconomyManager.js';
import { InputManager } from './systems/InputManager.js';
import { UIManager } from './ui/UIManager.js';
import { ErrorHandler } from './systems/ErrorHandler.js';
import { DebugOverlay } from './systems/DebugOverlay.js';
import { Leaderboard } from './systems/Leaderboard.js';

const TOTAL_WAVES = 15;

const State = {
  START:    'start',
  PLACING:  'placing',
  WAVE:     'wave',
  GAMEOVER: 'gameover',
  VICTORY:  'victory',
};

let gameState = State.START;

// ----------------------------------------------------------------
// Core objects
// ----------------------------------------------------------------
const bgCanvas   = document.getElementById('bg-canvas');
const gameCanvas = document.getElementById('game-canvas');

const grid         = new Grid();
const bgRenderer   = new BackgroundRenderer(bgCanvas, grid);
const gameRenderer = new GameRenderer(gameCanvas, grid);
const waveManager  = new WaveManager(grid);
const economy      = new EconomyManager();
const ui           = new UIManager();

let towers        = [];
let lastTimestamp = null;
let gameSpeed     = 1;
let difficulty    = DIFFICULTIES.normal;

const debugOverlay = new DebugOverlay(gameCanvas);

// ----------------------------------------------------------------
// Resize
// ----------------------------------------------------------------

function resize() {
  const container = document.getElementById('canvas-container');
  const w = container.clientWidth;
  const h = container.clientHeight;

  bgCanvas.width  = gameCanvas.width  = w;
  bgCanvas.height = gameCanvas.height = h;

  grid.resize(w, h);
  bgRenderer.draw();
  for (const t of towers) t.updatePosition();
  ui.setTileSize(grid.tileSize);
}

let _resizeTimer;
function debouncedResize() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(resize, 100);
}
window.addEventListener('resize', debouncedResize);
window.addEventListener('orientationchange', debouncedResize);

// ----------------------------------------------------------------
// Input
// ----------------------------------------------------------------

const input = new InputManager(gameCanvas, {
  onTap(x, y) {
    if (gameState !== State.PLACING && gameState !== State.WAVE) return;

    const cell = grid.screenToGrid(x, y);
    if (!cell) return;
    const { col, row } = cell;

    // Tap on existing tower → show info panel
    const existing = grid.getTower(col, row);
    if (existing) {
      gameRenderer.selectedTower = existing;
      gameRenderer.placingTower  = null;
      ui.deselectTower();
      ui.setTileSize(grid.tileSize);
      ui.showTowerPanel(existing);
      return;
    }

    // Tap on empty cell while placing → place tower
    if (!gameRenderer.placingTower) return;
    if (!grid.canPlaceTower(col, row)) return;
    if (!economy.canAfford(gameRenderer.placingTower)) return;

    const type = gameRenderer.placingTower;
    economy.spend(type);

    const tower = new Tower(type, col, row, grid);
    grid.placeTower(col, row, tower);
    towers.push(tower);

    ui.updateGold(economy.gold);
    ui.showToast(`${tower._def.displayName} deployed.`);
  },

  onHover(x, y) {
    gameRenderer.hoverCell = grid.screenToGrid(x, y);
  },

  onLeave() {
    gameRenderer.hoverCell = null;
  },
});

// ----------------------------------------------------------------
// UI callbacks
// ----------------------------------------------------------------

ui.onSelectTower(type => {
  gameRenderer.placingTower  = type;
  gameRenderer.selectedTower = null;
  ui.hideTowerPanel();
});

ui.onSellTower(tower => {
  if (!tower) { gameRenderer.selectedTower = null; return; }
  const refund = tower.sellValue;
  economy.gold += refund;
  grid.removeTower(tower.col, tower.row);
  towers = towers.filter(t => t !== tower);
  gameRenderer.selectedTower = null;
  ui.updateGold(economy.gold);
  ui.showToast(`Defense removed. +${refund} cr returned.`);
});

ui.onUpgradeTower((tower, option = 'a') => {
  if (!tower.canUpgrade) return;
  // Resolve the actual upgrade block (a/b for level 1, c for level 2, d for level 3)
  const key = tower.level === 1 ? option : tower.level === 2 ? 'c' : 'd';
  const up  = UPGRADES[tower.type]?.[key];
  if (!up) return;
  if (!economy.canAffordAmount(up.cost)) {
    ui.showToast('Insufficient credits.');
    return;
  }
  economy.gold -= up.cost;
  tower.upgrade(option); // Tower.upgrade() resolves level internally
  ui.updateGold(economy.gold);
  ui.showToast(`${tower._def.displayName}: ${up.displayName} online.`);
});

ui.onStartWave(() => {
  if (gameState !== State.PLACING && gameState !== State.WAVE) return;
  if (!waveManager.isIdle) return;

  waveManager.enemyHpMult  = difficulty.enemyHpMult;
  waveManager.enemySpdMult = difficulty.enemySpdMult;
  waveManager.startNextWave();
  gameState = State.WAVE;
  ui.setStartButtonState(false, `Wave ${waveManager.wave} active`);
  ui.updateWave(waveManager.wave);
  ui.hideWavePreview();
  ui.showToast(`Wave ${waveManager.wave}: threat sequence initiated.`);
});

ui.onSpeedToggle(() => {
  const idx = SPEED_OPTIONS.indexOf(gameSpeed);
  gameSpeed = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
  ui.setSpeed(gameSpeed);
});

// ----------------------------------------------------------------
// Game reset
// ----------------------------------------------------------------

function startGame(chosenDifficulty = DIFFICULTIES.normal, mapIndex = 0) {
  difficulty = chosenDifficulty;
  gameSpeed  = 1;
  ui.setSpeed(1);
  economy.reset(difficulty);
  waveManager.reset();

  // Load selected map and recompute pixel-space path for enemies
  grid.loadMap(mapIndex);
  if (grid.tileSize > 0) {
    grid.resize(bgCanvas.width, bgCanvas.height); // re-bake pathPixels for new waypoints
    bgRenderer.draw();
    waveManager.grid = grid; // re-point in case grid ref changed
  }
  Projectile.pool.resetAll();

  towers = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (grid.tiles[r][c].tower) grid.removeTower(c, r);
    }
  }

  gameRenderer.placingTower  = null;
  gameRenderer.hoverCell     = null;
  gameRenderer.selectedTower = null;
  ui.deselectTower();
  ui.hideTowerPanel();
  ui.updateGold(economy.gold);
  ui.updateLives(economy.lives);
  ui.updateWave(0);
  ui.updateScore(0);
  ui.setStartButtonState(true, 'Deploy wave 1');
  ui.hideModal();

  gameState = State.PLACING;
}

// ----------------------------------------------------------------
// Splash damage
// ----------------------------------------------------------------

function handleSplash(x, y, radiusPx, damage, slowFactor, slowDuration) {
  const r2 = radiusPx * radiusPx;
  for (const e of waveManager.enemies) {
    if (!e.active || e.dying) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy <= r2) {
      e.takeDamage(damage, slowFactor, slowDuration);
    }
  }
}

// ----------------------------------------------------------------
// Game loop
// ----------------------------------------------------------------

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  const rawDt = lastTimestamp === null
    ? 0
    : Math.min((timestamp - lastTimestamp) / 1000, MAX_DELTA);
  lastTimestamp = timestamp;
  const dt = rawDt * gameSpeed;

  debugOverlay.tick(dt);

  if (gameState === State.PLACING || gameState === State.WAVE) {
    update(dt);
  }

  gameRenderer.draw(towers, waveManager.enemies);

  if (debugOverlay.visible) {
    debugOverlay.draw({
      towers:     towers.length,
      enemies:    waveManager.enemies.length,
      poolSize:   Projectile.pool.size,
      poolActive: Projectile.pool.countActive(),
      wave:       waveManager.wave,
      gameSpeed,
    });
  }
}

function update(dt) {
  // Always tick tower animations (spawn scale-in) — pass empty array during
  // PLACING so towers are visible but don't acquire targets or fire.
  const activeEnemies = gameState === State.WAVE ? waveManager.enemies : [];
  for (const t of towers) t.update(dt, activeEnemies);

  if (gameState !== State.WAVE) return;

  Projectile.pool.forEachActive(p => p.update(dt, waveManager.enemies, handleSplash));

  // Single-pass: process reached and killed enemies without allocating filter arrays
  let livesLost  = 0;
  let goldChanged = false;

  for (const e of waveManager.enemies) {
    if (e.reached) {
      economy.loseLife(1);
      e.active = false;
      livesLost++;
    } else if (e.dying && e.hp <= 0 && !e._rewarded) {
      e._rewarded = true;
      economy.earnKill(e.reward);
      ui.showGoldFloat(e.x, e.y - 30, e.reward);
      goldChanged = true;
    }
  }

  if (livesLost  > 0) ui.updateLives(economy.lives);
  if (goldChanged)    { ui.updateGold(economy.gold); ui.updateScore(economy.score); }

  waveManager.update(dt);

  if (economy.isDead) {
    gameState = State.GAMEOVER;
    submitAndShowEnd((rank, top) => ui.showGameOver(waveManager.wave, economy.score, difficulty.label, rank, top, startGame));
    return;
  }

  if (waveManager.state === WaveState.COMPLETE) {
    const bonus = economy.earnWaveBonus(waveManager.wave);
    ui.updateGold(economy.gold);
    ui.updateScore(economy.score);

    if (waveManager.wave >= TOTAL_WAVES) {
      gameState = State.VICTORY;
      submitAndShowEnd((rank, top) => ui.showVictory(economy.score, rank, top, startGame));
    } else {
      gameState = State.PLACING;
      ui.setStartButtonState(true, `Deploy wave ${waveManager.wave + 1}`);
      // Show next wave preview
      const preview = waveManager.getNextWavePreview();
      ui.updateWavePreview(preview);
      ui.showWaveComplete(waveManager.wave, bonus, () => {});
    }
  }
}

// ----------------------------------------------------------------
// Leaderboard helper
// ----------------------------------------------------------------

function submitAndShowEnd(showFn) {
  const rank = Leaderboard.submit(difficulty.label, economy.score, waveManager.wave);
  showFn(rank, Leaderboard.getTop(difficulty.label));
}

// ----------------------------------------------------------------
// Boot
// ----------------------------------------------------------------

function boot() {
  ErrorHandler.init(ui);
  resize();
  ui.showStartScreen((chosenDifficulty, mapIndex) => {
    startGame(chosenDifficulty, mapIndex);
    requestAnimationFrame(gameLoop);
  });
}

boot();
