import { COLORS, TOWERS } from '../constants.js';
import { Projectile } from '../entities/Projectile.js';

/**
 * Renders the dynamic game layer every frame:
 * towers, enemies, projectiles, hover overlay, range rings.
 */
export class GameRenderer {
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.grid   = grid;

    // Set by main each frame
    this.hoverCell      = null;  // {col, row} | null
    this.selectedTower  = null;  // string type | null
    this.placingTower   = null;  // string type | null (selected in HUD)
  }

  draw(towers, enemies, projectiles) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawHoverOverlay();
    this._drawTowers(towers);
    this._drawProjectiles(projectiles);
    this._drawEnemies(enemies);
  }

  // ----------------------------------------------------------------
  // Hover overlay
  // ----------------------------------------------------------------

  _drawHoverOverlay() {
    if (!this.hoverCell || !this.placingTower) return;
    const { col, row } = this.hoverCell;
    const { grid, ctx } = this;
    const canPlace = grid.canPlaceTower(col, row);

    const tl = grid.gridToScreenTopLeft(col, row);
    ctx.fillStyle = canPlace ? COLORS.tileHover : COLORS.tileInvalid;
    ctx.fillRect(tl.x, tl.y, grid.tileSize, grid.tileSize);

    if (canPlace && this.placingTower) {
      // Draw range preview ring
      const center = grid.gridToScreen(col, row);
      const range  = TOWERS[this.placingTower].range * grid.tileSize;
      ctx.save();
      ctx.strokeStyle = TOWERS[this.placingTower].color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------
  // Towers
  // ----------------------------------------------------------------

  _drawTowers(towers) {
    for (const tower of towers) {
      this._drawTower(tower);
    }
  }

  _drawTower(tower) {
    const { ctx, grid } = this;
    const s = tower.scale;
    const ts = grid.tileSize;
    const pad = ts * 0.14;
    const size = (ts - pad * 2) * s;

    ctx.save();
    ctx.translate(tower.x, tower.y);
    ctx.scale(s, s);

    // Tower base (rounded square)
    const half = size / 2;
    const r = size * 0.18;
    ctx.fillStyle = COLORS.bgElevated;
    ctx.strokeStyle = tower.color;
    ctx.lineWidth = Math.max(1.5, ts * 0.06);
    this._roundRect(ctx, -half, -half, size, size, r);
    ctx.fill();
    ctx.stroke();

    // Tower icon
    this._drawTowerIcon(ctx, tower.type, size);

    ctx.restore();
  }

  _drawTowerIcon(ctx, type, size) {
    const h = size * 0.45;
    ctx.save();
    ctx.fillStyle = TOWERS[type].color;

    switch (type) {
      case 'arrow': {
        // Arrow pointing right
        ctx.beginPath();
        ctx.moveTo(-h * 0.5, -h * 0.28);
        ctx.lineTo( h * 0.1, -h * 0.28);
        ctx.lineTo( h * 0.1, -h * 0.55);
        ctx.lineTo( h * 0.55, 0);
        ctx.lineTo( h * 0.1,  h * 0.55);
        ctx.lineTo( h * 0.1,  h * 0.28);
        ctx.lineTo(-h * 0.5,  h * 0.28);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'cannon': {
        // Circle body + barrel
        ctx.beginPath();
        ctx.arc(0, 0, h * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(h * 0.2, -h * 0.14, h * 0.5, h * 0.28);
        break;
      }
      case 'frost': {
        // Snowflake — 6 lines + dots
        ctx.lineWidth = Math.max(1.5, h * 0.2);
        ctx.strokeStyle = TOWERS[type].color;
        for (let i = 0; i < 6; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 3);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -h * 0.55);
          ctx.stroke();
          // Crossbar
          ctx.beginPath();
          ctx.moveTo(-h * 0.2, -h * 0.35);
          ctx.lineTo( h * 0.2, -h * 0.35);
          ctx.stroke();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(0, 0, h * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'laser': {
        // Diamond
        ctx.beginPath();
        ctx.moveTo(0,    -h * 0.6);
        ctx.lineTo(h * 0.55, 0);
        ctx.lineTo(0,     h * 0.6);
        ctx.lineTo(-h * 0.55, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Enemies
  // ----------------------------------------------------------------

  _drawEnemies(enemies) {
    for (const e of enemies) {
      if (!e.active && !e.dying) continue;
      this._drawEnemy(e);
    }
  }

  _drawEnemy(enemy) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = enemy.opacity;

    const r = enemy.size / 2;

    // Slow/frost tint
    if (enemy.isFrozen) {
      ctx.save();
      ctx.fillStyle = COLORS.slowTint;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, r * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Enemy body
    ctx.fillStyle = enemy.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // HP bar
    if (!enemy.dying) {
      this._drawHpBar(enemy, r);
    }

    ctx.restore();
  }

  _drawHpBar(enemy, r) {
    const { ctx } = this;
    const bw = r * 2.2;
    const bh = Math.max(2, r * 0.35);
    const bx = enemy.x - bw / 2;
    const by = enemy.y - r - bh - 3;

    // Background
    ctx.fillStyle = COLORS.hpBarBg;
    ctx.fillRect(bx, by, bw, bh);

    // Fill — color transitions green→amber→red
    const frac = enemy.hpFraction;
    const fillColor = frac > 0.6
      ? COLORS.accentGreen
      : frac > 0.3
        ? COLORS.accentAmber
        : COLORS.accentRed;

    ctx.fillStyle = fillColor;
    ctx.fillRect(bx, by, bw * frac, bh);
  }

  // ----------------------------------------------------------------
  // Projectiles
  // ----------------------------------------------------------------

  _drawProjectiles(projectiles) {
    for (const p of projectiles) {
      if (!p.active) continue;
      this._drawProjectile(p);
    }
  }

  _drawProjectile(p) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = p.size * 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Utility
  // ----------------------------------------------------------------

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
