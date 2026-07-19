import { LOOP_TIERS } from '../constants.js';

const REF_PADDING = 40;
const REF_SLOT_OFFSET = 24;

export class LoopManager {
  constructor() {
    this.tierIndex = 0;
    this.extraSlots = 0;
    this.cx = 0;
    this.cy = 0;
    this.scale = 1;
  }

  setTierIndex(tierIndex) {
    this.tierIndex = Math.max(0, Math.min(LOOP_TIERS.length - 1, tierIndex));
  }

  setExtraSlots(extraSlots) {
    this.extraSlots = extraSlots;
  }

  getCurrentTier() {
    return LOOP_TIERS[this.tierIndex];
  }

  getSlotCount() {
    return this.getCurrentTier().slotCount + this.extraSlots;
  }

  hasNextTier() {
    return this.tierIndex < LOOP_TIERS.length - 1;
  }

  getNextTier() {
    return this.hasNextTier() ? LOOP_TIERS[this.tierIndex + 1] : null;
  }

  expandTier() {
    if (this.hasNextTier()) this.tierIndex += 1;
  }

  resize(width, height) {
    const maxRefRadius = LOOP_TIERS[LOOP_TIERS.length - 1].radius + REF_SLOT_OFFSET;
    const available = Math.min(width, height) / 2 - REF_PADDING;
    this.scale = Math.max(0.35, Math.min(1, available / maxRefRadius));
    this.cx = width / 2;
    this.cy = height / 2;
  }

  getRadius() {
    return this.getCurrentTier().radius * this.scale;
  }

  getCircumference() {
    return 2 * Math.PI * this.getRadius();
  }

  angleForProgress(progress) {
    return -Math.PI / 2 + progress * Math.PI * 2;
  }

  getPositionForProgress(progress) {
    const angle = this.angleForProgress(progress);
    const r = this.getRadius();
    return { x: this.cx + r * Math.cos(angle), y: this.cy + r * Math.sin(angle) };
  }

  getSlotPosition(slotIndex) {
    const slotCount = this.getSlotCount();
    const progress = slotIndex / slotCount;
    const angle = this.angleForProgress(progress);
    const r = this.getRadius() + REF_SLOT_OFFSET * this.scale;
    return { x: this.cx + r * Math.cos(angle), y: this.cy + r * Math.sin(angle) };
  }

  /** Returns the nearest slot index (empty or occupied) within a click tolerance, or null. */
  findNearestSlot(x, y) {
    const slotCount = this.getSlotCount();
    const tolerance = 20 * this.scale + 12;
    let best = null;
    let bestDistSq = tolerance * tolerance;
    for (let i = 0; i < slotCount; i++) {
      const pos = this.getSlotPosition(i);
      const dx = pos.x - x;
      const dy = pos.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = i;
      }
    }
    return best;
  }
}
