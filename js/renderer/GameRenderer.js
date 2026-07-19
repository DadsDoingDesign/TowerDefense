import { COLORS } from '../constants.js';

const SHOT_LIFE = 0.15;
const TEXT_LIFE = 0.7;

export class GameRenderer {
  constructor() {
    this.fx = [];
  }

  addShotEvents(shotEvents) {
    for (const shot of shotEvents) {
      this.fx.push({ type: 'shot', from: shot.from, to: shot.to, isCrit: shot.isCrit, life: SHOT_LIFE, maxLife: SHOT_LIFE });
    }
  }

  addKillEvents(killEvents, loopManager) {
    for (const { enemy, value } of killEvents) {
      const pos = enemy.positionOn(loopManager);
      this.fx.push({ type: 'text', x: pos.x, y: pos.y, text: `+${Math.round(value)}`, color: COLORS.gold, life: TEXT_LIFE, maxLife: TEXT_LIFE });
    }
  }

  addLeashEvents(leashEvents, loopManager) {
    for (const enemy of leashEvents) {
      const pos = enemy.positionOn(loopManager);
      this.fx.push({ type: 'text', x: pos.x, y: pos.y, text: `-${enemy.def.leashDamage} base`, color: COLORS.danger, life: TEXT_LIFE, maxLife: TEXT_LIFE });
    }
  }

  update(dt) {
    for (const fx of this.fx) {
      fx.life -= dt;
      if (fx.type === 'text') fx.y -= dt * 24;
    }
    this.fx = this.fx.filter((fx) => fx.life > 0);
  }

  draw(ctx, canvas, runState, loopManager, hoverSlot, selectedSlot) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this._drawCore(ctx, runState, loopManager);
    this._drawTowers(ctx, runState, loopManager);
    if (hoverSlot != null && hoverSlot !== selectedSlot) this._drawHoverHighlight(ctx, loopManager, hoverSlot);
    if (selectedSlot != null) this._drawSelectedHighlight(ctx, loopManager, selectedSlot);
    this._drawEnemies(ctx, runState, loopManager);
    this._drawFx(ctx);
  }

  _drawCore(ctx, runState, loopManager) {
    const hpFrac = runState.baseMaxHP > 0 ? runState.baseHP / runState.baseMaxHP : 0;
    const size = 16 * loopManager.scale + 6;
    ctx.save();
    ctx.translate(loopManager.cx, loopManager.cy);
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.bgAlt;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = hpFrac > 0.3 ? COLORS.hpBar : COLORS.hpBarLow;
    ctx.beginPath();
    ctx.arc(0, 0, size, -Math.PI / 2, -Math.PI / 2 + hpFrac * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawTowers(ctx, runState, loopManager) {
    for (const tower of runState.towers) {
      const pos = loopManager.getSlotPosition(tower.slotIndex);
      const size = 9 * loopManager.scale + 3;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = tower.def.color;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  _drawHoverHighlight(ctx, loopManager, slotIndex) {
    const pos = loopManager.getSlotPosition(slotIndex);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 12 * loopManager.scale + 4, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawSelectedHighlight(ctx, loopManager, slotIndex) {
    const pos = loopManager.getSlotPosition(slotIndex);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 13 * loopManager.scale + 5, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  _drawEnemies(ctx, runState, loopManager) {
    for (const enemy of runState.enemies) {
      const pos = enemy.positionOn(loopManager);
      const r = enemy.def.radius * Math.max(0.7, loopManager.scale);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = enemy.def.color;
      ctx.fill();

      if (enemy.hp < enemy.maxHp) {
        const barW = r * 2.2;
        const frac = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(pos.x - barW / 2, pos.y - r - 6, barW, 3);
        ctx.fillStyle = COLORS.hpBar;
        ctx.fillRect(pos.x - barW / 2, pos.y - r - 6, barW * frac, 3);
      }
    }
  }

  _drawFx(ctx) {
    for (const fx of this.fx) {
      const alpha = Math.max(0, fx.life / fx.maxLife);
      if (fx.type === 'shot') {
        ctx.strokeStyle = fx.isCrit ? COLORS.danger : COLORS.shot;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = fx.isCrit ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(fx.from.x, fx.from.y);
        ctx.lineTo(fx.to.x, fx.to.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (fx.type === 'text') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fx.color;
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(fx.text, fx.x, fx.y);
        ctx.globalAlpha = 1;
      }
    }
  }
}
