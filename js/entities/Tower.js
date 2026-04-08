import { TOWERS, UPGRADES, SELL_RATE, ANIM_TOWER_SPAWN } from '../constants.js';
import { Projectile } from './Projectile.js';

export class Tower {
  constructor(type, col, row, grid) {
    this._def = TOWERS[type];

    this.type  = type;
    this.col   = col;
    this.row   = row;
    this.grid  = grid;
    this.level = 1;

    // Mutable stats (upgrade modifies these in place)
    this.damage          = this._def.damage;
    this.fireRate        = this._def.fireRate;
    this.projectileSpeed = this._def.projectileSpeed;
    this.slowFactor      = this._def.slowFactor;
    this.slowDuration    = this._def.slowDuration;
    this.color           = this._def.color;

    // Pixel-scaled — set by updatePosition()
    this.range        = 0;
    this.splashRadius = 0;
    this.x = 0;
    this.y = 0;

    this.fireCooldown = 0;
    this.target       = null;

    this.scale     = 0;
    this.animTimer = 0;

    // Economy tracking for sell calculation
    this._totalSpent = this._def.cost;

    this.updatePosition();
  }

  updatePosition() {
    const center = this.grid.gridToScreen(this.col, this.row);
    this.x = center.x;
    this.y = center.y;
    this.range        = this._def.range        * this.grid.tileSize;
    this.splashRadius = this._def.splashRadius  * this.grid.tileSize;
    // Re-scale if upgraded
    if (this._upgradeRangeX) this.range *= this._upgradeRangeX;
    if (this._upgradeSplashX) this.splashRadius *= this._upgradeSplashX;
  }

  upgrade(option = 'a') {
    if (!this.canUpgrade) return false;
    const up = UPGRADES[this.type][option];
    if (!up) return false;

    this.damage    *= up.damageX   ?? 1;
    this.fireRate  *= up.fireRateX ?? 1;
    if (up.slowFactor   !== undefined) this.slowFactor   = up.slowFactor;
    if (up.slowDuration !== undefined) this.slowDuration  = up.slowDuration;

    // Store range multiplier for updatePosition re-apply
    this._upgradeRangeX = up.rangeX ?? 1;
    this.range *= this._upgradeRangeX;

    // Splash multiplier (amazon drone fleet)
    if (up.splashX) {
      this._upgradeSplashX = up.splashX;
      this.splashRadius *= up.splashX;
    }

    this._totalSpent    += up.cost;
    this._chosenUpgrade  = option;
    this.level = 2;

    // Restart placement animation briefly to signal the upgrade
    this.animTimer = 0;
    this.scale     = 0;
    return true;
  }

  get canUpgrade() { return this.level < 2; }
  upgradeCostFor(option) { return UPGRADES[this.type]?.[option]?.cost ?? 0; }
  get sellValue()  { return Math.floor(this._totalSpent * SELL_RATE); }

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
      this.slowDuration,
      this.color,
      this._def.projectileSize,
      this.type,
    );
  }
}
