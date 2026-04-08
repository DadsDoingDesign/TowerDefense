import {
  WAVE_BASE_COUNT, WAVE_COUNT_SCALE,
  WAVE_SPAWN_BASE, WAVE_SPAWN_MIN, WAVE_SPAWN_DEC,
  ENEMIES,
} from '../constants.js';
import { Enemy } from '../entities/Enemy.js';

export const WaveState = {
  IDLE:     'idle',
  SPAWNING: 'spawning',
  ACTIVE:   'active',
  COMPLETE: 'complete',
};

export class WaveManager {
  constructor(grid) {
    this.grid    = grid;
    this.wave    = 0;
    this.state   = WaveState.IDLE;
    this.enemies = [];

    this._spawnQueue    = [];
    this._spawnTimer    = 0;
    this._spawnInterval = 0;

    // Set by main.js before each wave start
    this.enemyHpMult  = 1;
    this.enemySpdMult = 1;
  }

  reset() {
    this.wave    = 0;
    this.state   = WaveState.IDLE;
    this.enemies = [];
    this._spawnQueue = [];
    this._spawnTimer = 0;
  }

  startNextWave() {
    if (this.state !== WaveState.IDLE && this.state !== WaveState.COMPLETE) return;
    this.wave++;
    this.state          = WaveState.SPAWNING;
    this._spawnQueue    = this._buildSpawnQueue(this.wave);
    this._spawnInterval = Math.max(WAVE_SPAWN_MIN, WAVE_SPAWN_BASE - this.wave * WAVE_SPAWN_DEC);
    this._spawnTimer    = 0;
  }

  update(dt) {
    // Remove inactive enemies in-place — avoids array allocation each frame
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.enemies[i].active) this.enemies.splice(i, 1);
    }

    if (this.state === WaveState.SPAWNING) {
      this._spawnTimer += dt;
      while (this._spawnTimer >= this._spawnInterval && this._spawnQueue.length > 0) {
        this._spawnTimer -= this._spawnInterval;
        const type = this._spawnQueue.shift();
        this.enemies.push(new Enemy(type, this.wave, this.grid.pathPixels, this.grid, this.enemyHpMult, this.enemySpdMult));
      }
      if (this._spawnQueue.length === 0) this.state = WaveState.ACTIVE;
    }

    for (const e of this.enemies) {
      e.update(dt);
    }

    if ((this.state === WaveState.ACTIVE || this.state === WaveState.SPAWNING) &&
        this._spawnQueue.length === 0 &&
        this.enemies.length === 0) {
      this.state = WaveState.COMPLETE;
    }
  }

  _buildSpawnQueue(wave) {
    const count = Math.floor(WAVE_BASE_COUNT * Math.pow(WAVE_COUNT_SCALE, wave - 1));
    const queue = [];
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let type;
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

  /** Returns a summary of what enemies will appear in the NEXT wave. */
  getNextWavePreview() {
    const nextWave = this.wave + 1;
    const count = Math.floor(WAVE_BASE_COUNT * Math.pow(WAVE_COUNT_SCALE, nextWave - 1));
    const counts = { basic: 0, fast: 0, tank: 0 };
    // Replicate composition logic deterministically (rough estimate)
    for (let i = 0; i < count; i++) {
      let type;
      if (nextWave <= 2)      type = 'basic';
      else if (nextWave <= 4) type = i % 10 < 7 ? 'basic' : 'fast';
      else if (nextWave <= 7) type = i % 10 < 5 ? 'basic' : i % 10 < 8 ? 'fast' : 'tank';
      else                    type = i % 20 < 7 ? 'basic' : i % 20 < 13 ? 'fast' : 'tank';
      counts[type]++;
    }
    return counts;
  }
}
