import { TOWERS, ANIM_TOWER_SPAWN } from '../constants.js';
import { Projectile } from './Projectile.js';

export class Tower {
  constructor(type, col, row, grid) {
    this._def = TOWERS[type];

    this.type = type;
    this.col  = col;
    this.row  = row;
    this.grid = grid;

    this.damage          = this._def.damage;
    this.fireRate        = this._def.fireRate;
    this.projectileSpeed = this._def.projectileSpeed;
    this.slowFactor      = this._def.slowFactor;
    this.color           = this._def.color;

    // Pixel-scaled values — updated by updatePosition() on resize
    this.range        = 0;
    this.splashRadius = 0;
    this.x = 0;
    this.y = 0;

    this.fireCooldown = 0;
    this.target       = null;

    this.scale     = 0;
    this.animTimer = 0;

    this.updatePosition();
  }

  updatePosition() {
    const center = this.grid.gridToScreen(this.col, this.row);
    this.x = center.x;
    this.y = center.y;
    this.range        = this._def.range        * this.grid.tileSize;
    this.splashRadius = this._def.splashRadius  * this.grid.tileSize;
  }

  update(dt, enemies) {
    if (this.animTimer < ANIM_TOWER_SPAWN) {
      this.animTimer += dt;
      const t = Math.min(this.animTimer / ANIM_TOWER_SPAWN, 1);
      this.scale = t < 0.7 ? (t / 0.7) * 1.1 : 1.1 - ((t - 0.7) / 0.3) * 0.1;
    } else {
      this.scale = 1;
    }

    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    if (this.target && (!this.target.active || !this._inRange(this.target))) {
      this.target = null;
    }

    if (!this.target) this.target = this._acquireTarget(enemies);

    if (this.target && this.fireCooldown <= 0) {
      this._fire();
      this.fireCooldown = 1 / this.fireRate;
    }
  }

  _acquireTarget(enemies) {
    let best = null;
    let bestPathIndex = -1;
    for (const e of enemies) {
      if (!e.active || e.dying) continue;
      if (!this._inRange(e)) continue;
      if (e.pathIndex > bestPathIndex) {
        bestPathIndex = e.pathIndex;
        best = e;
      }
    }
    return best;
  }

  _inRange(enemy) {
    const dx = enemy.x - this.x;
    const dy = enemy.y - this.y;
    return (dx * dx + dy * dy) <= (this.range * this.range);
  }

  _fire() {
    const p = Projectile.pool.acquire();
    p.fire(
      this.x, this.y,
      this.target,
      this.damage,
      this.projectileSpeed,
      this.splashRadius,
      this.slowFactor,
      this._def.slowDuration,
      this.color,
      this._def.projectileSize,
    );
  }
}
