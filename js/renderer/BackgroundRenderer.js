import { COLORS } from '../constants.js';

/** Draws the static ring track + slot markers. Redraw only on resize/tier-expand, not per-frame. */
export class BackgroundRenderer {
  draw(ctx, canvas, loopManager, occupiedSlotIndices) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const radius = loopManager.getRadius();
    ctx.beginPath();
    ctx.arc(loopManager.cx, loopManager.cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.ring;
    ctx.lineWidth = Math.max(2, 3 * loopManager.scale);
    ctx.stroke();

    const slotCount = loopManager.getSlotCount();
    for (let i = 0; i < slotCount; i++) {
      const pos = loopManager.getSlotPosition(i);
      const occupied = occupiedSlotIndices.has(i);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 7 * loopManager.scale + 3, 0, Math.PI * 2);
      ctx.fillStyle = occupied ? COLORS.ringSlotFilled : COLORS.ringSlotEmpty;
      ctx.fill();
    }
  }
}
