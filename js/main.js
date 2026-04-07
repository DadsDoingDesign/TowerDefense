import { MAX_DELTA } from './constants.js';
import { Grid } from './grid.js';
import { BackgroundRenderer } from './renderer/BackgroundRenderer.js';
import { GameRenderer } from './renderer/GameRenderer.js';
import { Tower } from './entities/Tower.js';
import { Projectile } from './entities/Projectile.js';
import { WaveManager, WaveState } from './systems/WaveManager.js';
import { EconomyManager } from './systems/EconomyManager.js';
import { InputManager } from './systems/InputManager.js';
import { UIManager } from './ui/UIManager.js';

// ----------------------------------------------------------------
// Total waves before victory
// ----------------------------------------------------------------
const TOTAL_WAVES = 15;

// ----------------------------------------------------------------
// Game state
// ----------------------------------------------------------------
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

const grid        = new Grid();
const bgRenderer  = new BackgroundRenderer(bgCanvas, grid);
const gameRenderer = new GameRenderer(gameCanvas, grid);
const waveManager = new WaveManager(grid);
const economy     = new EconomyManager();
const ui          = new UIManager();

let towers = [];   // Tower[]
let lastTimestamp = null;

// ----------------------------------------------------------------
// Resize handler
// ----------------------------------------------------------------

function resize() {
  const container = document.getElementById('canvas-container');
  const w = container.clientWidth;
  const h = container.clientHeight;

  for (const canvas of [bgCanvas, gameCanvas]) {
    canvas.width  = w;
    canvas.height = h;
  }

  grid.resize(w, h);
  bgRenderer.draw();

  // Update existing tower positions
  for (const t of towers) t.updatePosition();
}

window.addEventListener('resize', resize);
// Also handle iOS orientation change
window.addEventListener('orientationchange', () => setTimeout(resize, 150));

// ----------------------------------------------------------------
// Input
// ----------------------------------------------------------------

const input = new InputManager(gameCanvas, {
  onTap(x, y) {
    if (gameState !== State.PLACING && gameState !== State.WAVE) return;
    if (!gameRenderer.placingTower) return;

    const cell = grid.screenToGrid(x, y);
    if (!cell) return;

    const { col, row } = cell;
    if (!grid.canPlaceTower(col, row)) return;
    if (!economy.canAfford(gameRenderer.placingTower)) return;

    const type = gameRenderer.placingTower;
    economy.spend(type);

    const tower = new Tower(type, col, row, grid);
    grid.placeTower(col, row, tower);
    towers.push(tower);

    ui.updateGold(economy.gold);
    ui.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} tower deployed.`);
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
  gameRenderer.placingTower = type;
});

ui.onStartWave(() => {
  if (gameState !== State.PLACING && gameState !== State.WAVE) return;
  if (!waveManager.isIdle) return;

  waveManager.startNextWave();
  gameState = State.WAVE;
  ui.setStartButtonState(false, `Wave ${waveManager.wave} inbound`);
  ui.updateWave(waveManager.wave);
  ui.showToast(`Wave ${waveManager.wave} inbound.`);
});

// ----------------------------------------------------------------
// Game reset / start
// ----------------------------------------------------------------

function startGame() {
  economy.reset();
  waveManager.reset();
  towers = [];

  // Clear grid towers
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const tile = grid.tiles[r][c];
      if (tile.tower) {
        grid.removeTower(c, r);
      }
    }
  }

  gameRenderer.placingTower = null;
  gameRenderer.hoverCell    = null;
  ui.deselectTower();

  ui.updateGold(economy.gold);
  ui.updateLives(economy.lives);
  ui.updateWave(0);
  ui.updateScore(0);
  ui.setStartButtonState(true, 'Start wave 1');
  ui.hideModal();

  gameState = State.PLACING;
}

// ----------------------------------------------------------------
// Splash damage helper
// ----------------------------------------------------------------

function handleSplash(x, y, radiusPx, damage, slowFactor, slowDuration) {
  for (const e of waveManager.enemies) {
    if (!e.active || e.dying) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy <= radiusPx * radiusPx) {
      e.takeDamage(damage, slowFactor, slowDuration);
    }
  }
}

// ----------------------------------------------------------------
// Main game loop
// ----------------------------------------------------------------

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  const dt = lastTimestamp === null
    ? 0
    : Math.min((timestamp - lastTimestamp) / 1000, MAX_DELTA);
  lastTimestamp = timestamp;

  if (gameState === State.PLACING || gameState === State.WAVE) {
    update(dt);
  }

  // Always render
  const activeProjectiles = Projectile.pool.active;
  gameRenderer.draw(towers, waveManager.enemies, activeProjectiles);
}

function update(dt) {
  if (gameState !== State.WAVE) return;

  // Update towers
  for (const t of towers) {
    t.update(dt, waveManager.enemies);
  }

  // Update projectiles
  for (const p of Projectile.pool._pool) {
    if (p.active) {
      p.update(dt, waveManager.enemies, handleSplash);
    }
  }

  // Drain reached enemies (before waveManager.update cleans them)
  const reached = waveManager.enemies.filter(e => e.reached);
  for (const e of reached) {
    economy.loseLife(1);
    e.active = false;
  }
  if (reached.length > 0) {
    ui.updateLives(economy.lives);
  }

  // Drain killed enemies for gold rewards
  const killed = waveManager.enemies.filter(e => e.dying && e.hp <= 0 && !e._rewarded);
  for (const e of killed) {
    e._rewarded = true;
    economy.earnKill(e.reward);
    // Show float text near enemy position on screen
    ui.showGoldFloat(e.x, e.y - 30, e.reward);
  }
  if (killed.length > 0) {
    ui.updateGold(economy.gold);
    ui.updateScore(economy.score);
  }

  // Wave manager tick
  waveManager.update(dt);

  // Check game over
  if (economy.isDead) {
    gameState = State.GAMEOVER;
    ui.showGameOver(waveManager.wave, economy.score, () => startGame());
    return;
  }

  // Check wave complete
  if (waveManager.state === WaveState.COMPLETE) {
    const bonus = economy.earnWaveBonus(waveManager.wave);
    ui.updateGold(economy.gold);
    ui.updateScore(economy.score);

    if (waveManager.wave >= TOTAL_WAVES) {
      gameState = State.VICTORY;
      ui.showVictory(economy.score, () => startGame());
    } else {
      gameState = State.PLACING;
      ui.setStartButtonState(true, `Start wave ${waveManager.wave + 1}`);
      ui.showWaveComplete(waveManager.wave, bonus, () => {
        // Auto-transition; button also works
      });
    }
  }
}

// ----------------------------------------------------------------
// Boot
// ----------------------------------------------------------------

function boot() {
  resize();

  ui.showStartScreen(() => {
    startGame();
    requestAnimationFrame(gameLoop);
  });
}

boot();
