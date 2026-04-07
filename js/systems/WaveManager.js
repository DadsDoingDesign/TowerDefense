import {
  WAVE_BASE_COUNT, WAVE_COUNT_SCALE,
  WAVE_SPAWN_BASE, WAVE_SPAWN_MIN, WAVE_SPAWN_DEC,
  ENEMIES,
} from '../constants.js';
import { Enemy } from '../entities/Enemy.js';

export const WaveState = {
  IDLE:     'idle',      // pre-game / between waves, waiting for player
  SPAWNING: 'spawning',  // actively spawning enemies
  ACTIVE:   'active',    // all spawned, enemies still alive
  COMPLETE: 'complete',  // all enemies dead, ready for next wave
};

export class WaveManager {
  constructor(grid) {
    this.grid    = grid;
    this.wave    = 0;
    this.state   = WaveState.IDLE;
    this.enemies = [];      // all living enemies

    this._spawnQueue    = [];
    this._spawnTimer    = 0;
    this._spawnInterval = 0;
  }

  reset() {
    this.wave    = 0;
    this.state   = WaveState.IDLE;
    this.enemies = [];
    this._spawnQueue    = [];
    this._spawnTimer    = 0;
  }

  /** Called when player presses Start Wave */
  startNextWave() {
    if (this.state !== WaveState.IDLE && this.state !== WaveState.COMPLETE) return;
    this.wave++;
    this.state          = WaveState.SPAWNING;
    this._spawnQueue    = this._buildSpawnQueue(this.wave);
    this._spawnInterval = Math.max(WAVE_SPAWN_MIN, WAVE_SPAWN_BASE - this.wave * WAVE_SPAWN_DEC);
    this._spawnTimer    = 0;
  }

  update(dt) {
    // Clean up dead/reached enemies
    this.enemies = this.enemies.filter(e => e.active);

    if (this.state === WaveState.SPAWNING) {
      this._spawnTimer += dt;
      while (this._spawnTimer >= this._spawnInterval && this._spawnQueue.length > 0) {
        this._spawnTimer -= this._spawnInterval;
        const type = this._spawnQueue.shift();
        const enemy = new Enemy(type, this.wave, this.grid.pathPixels, this.grid);
        this.enemies.push(enemy);
      }
      if (this._spawnQueue.length === 0) {
        this.state = WaveState.ACTIVE;
      }
    }

    // Update all enemies
    for (const e of this.enemies) {
      e.update(dt);
    }

    // Check wave complete
    if ((this.state === WaveState.ACTIVE || this.state === WaveState.SPAWNING) &&
        this._spawnQueue.length === 0 &&
        this.enemies.length === 0) {
      this.state = WaveState.COMPLETE;
    }
  }

  /** Returns enemies that reached the exit this frame (before we clean them up) */
  drainReached() {
    const reached = this.enemies.filter(e => e.reached);
    for (const e of reached) e.active = false;
    return reached;
  }

  /** Returns enemies killed this frame */
  drainKilled() {
    const killed = this.enemies.filter(e => e.dying && e.hp <= 0 && !e._rewarded);
    for (const e of killed) e._rewarded = true;
    return killed;
  }

  _buildSpawnQueue(wave) {
    const count = Math.floor(WAVE_BASE_COUNT * Math.pow(WAVE_COUNT_SCALE, wave - 1));
    const queue = [];

    const enemyTypes = Object.keys(ENEMIES);

    for (let i = 0; i < count; i++) {
      // Earlier waves: mostly basic. Later waves: mix in fast and tank
      let type;
      const r = Math.random();
      if (wave <= 2) {
        type = 'basic';
      } else if (wave <= 4) {
        type = r < 0.7 ? 'basic' : 'fast';
      } else if (wave <= 7) {
        type = r < 0.5 ? 'basic' : r < 0.8 ? 'fast' : 'tank';
      } else {
        type = r < 0.35 ? 'basic' : r < 0.65 ? 'fast' : 'tank';
      }
      queue.push(type);
    }

    return queue;
  }

  get isIdle() {
    return this.state === WaveState.IDLE || this.state === WaveState.COMPLETE;
  }

  get totalEnemyCount() {
    return Math.floor(WAVE_BASE_COUNT * Math.pow(WAVE_COUNT_SCALE, this.wave - 1));
  }
}
