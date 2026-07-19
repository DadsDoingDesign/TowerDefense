// Central tuning hub — every balance number and content definition lives here.

export const SAVE_KEYS = {
  RUN: 'loopward_run_v1',
  META: 'loopward_meta_v1',
};

export const MAX_DELTA = 0.1; // seconds, clamps RAF dt spikes (tab-throttle, breakpoints, etc.)

export const COLORS = {
  bg: '#0b0f14',
  bgAlt: '#111823',
  ring: '#1c2733',
  ringSlotEmpty: '#2a3a4a',
  ringSlotFilled: '#3a4f63',
  gold: '#f2c14e',
  cores: '#a78bfa',
  hpBar: '#3ecf8e',
  hpBarLow: '#e8544a',
  danger: '#e8544a',
  text: '#e7edf3',
  textDim: '#8ea0b3',
  grunt: '#6fb3e0',
  scout: '#5fe0b0',
  brute: '#e0925f',
  buffer: '#c77dee',
  towerSpike: '#4fa8e8',
  towerPulse: '#e85fa0',
  shot: '#f2f6fa',
};

// --- Loop tiers -------------------------------------------------------

export const LOOP_TIERS = [
  { id: 0, name: 'Ring I', radius: 130, slotCount: 4, unlockThreshold: 0 },
  { id: 1, name: 'Ring II', radius: 190, slotCount: 6, unlockThreshold: 5000 },
  { id: 2, name: 'Ring III', radius: 250, slotCount: 8, unlockThreshold: 25000 },
  { id: 3, name: 'Ring IV', radius: 320, slotCount: 11, unlockThreshold: 100000 },
];

// --- Enemies ------------------------------------------------------------

export const ENEMIES = {
  grunt: {
    id: 'grunt',
    label: 'Grunt',
    kind: 'auto',
    hp: 20,
    speed: 40,
    cost: 0,
    killValue: 2,
    leashDamage: 1,
    color: COLORS.grunt,
    radius: 5,
  },
  scout: {
    id: 'scout',
    label: 'Scout',
    kind: 'troop',
    hp: 35,
    speed: 70,
    cost: 15,
    killValue: 40,
    leashDamage: 3,
    color: COLORS.scout,
    radius: 6,
  },
  brute: {
    id: 'brute',
    label: 'Brute',
    kind: 'troop',
    hp: 140,
    speed: 25,
    cost: 40,
    killValue: 110,
    leashDamage: 8,
    color: COLORS.brute,
    radius: 8,
  },
  buffer: {
    id: 'buffer',
    label: 'Signal Booster',
    kind: 'buffer',
    hp: 90,
    speed: 30,
    cost: 60,
    killValue: 150,
    leashDamage: 6,
    color: COLORS.buffer,
    radius: 7,
    buffSpeedMult: 1.5,
    buffDamageTakenMult: 0.7,
  },
};

export const GRUNT_SPAWN_INTERVAL = (tierIndex) => Math.max(0.6, 2.2 - tierIndex * 0.3);

// --- Towers ---------------------------------------------------------------

export const TOWERS = {
  spike: {
    id: 'spike',
    label: 'Spike',
    cost: 50,
    damage: 12,
    range: 90,
    fireRate: 1.0,
    color: COLORS.towerSpike,
    lockedAtStart: false,
  },
  pulse: {
    id: 'pulse',
    label: 'Pulse',
    cost: 120,
    damage: 30,
    range: 110,
    fireRate: 0.6,
    color: COLORS.towerPulse,
    lockedAtStart: true,
  },
};

// --- In-run roguelite upgrade cards ----------------------------------------

export const KILLS_PER_CARD_OFFER = 20;
export const CARD_CHOICES_OFFERED = 3;

export const UPGRADE_CARDS = [
  {
    id: 'overclock',
    label: 'Overclock',
    description: '+15% tower damage',
    weight: 20,
    effect: { damageMult: 1.15 },
  },
  {
    id: 'rapid_cycle',
    label: 'Rapid Cycle',
    description: '+15% tower fire rate',
    weight: 20,
    effect: { fireRateMult: 1.15 },
  },
  {
    id: 'reinforced_core',
    label: 'Reinforced Core',
    description: '+25 max & current base HP',
    weight: 15,
    effect: { baseMaxHPAdd: 25, baseHPAdd: 25 },
  },
  {
    id: 'long_leash',
    label: 'Long Leash',
    description: '+1 leash lap before enemies breach',
    weight: 12,
    effect: { leashLapsAdd: 1 },
  },
  {
    id: 'bargain_contracts',
    label: 'Bargain Contracts',
    description: '-15% troop send cost',
    weight: 12,
    effect: { troopCostMult: 0.85 },
  },
  {
    id: 'bounty_network',
    label: 'Bounty Network',
    description: '+20% troop kill value',
    weight: 12,
    effect: { troopValueMult: 1.20 },
  },
  {
    id: 'overclocked_spawners',
    label: 'Overclocked Spawners',
    description: '-15% grunt spawn interval (more idle volume, more risk)',
    weight: 10,
    effect: { gruntIntervalMult: 0.85 },
  },
  {
    id: 'critical_targeting',
    label: 'Critical Targeting',
    description: '+10% crit chance (cap 50%), crits deal x2',
    weight: 12,
    effect: { critChanceAdd: 0.10 },
  },
  {
    id: 'split_shot',
    label: 'Split Shot',
    description: 'Towers hit one extra target at 50% damage',
    weight: 8,
    effect: { extraTargets: 1 },
    metaGated: true, // only enters the pool once unlocked via Card Vault
  },
  {
    id: 'blueprint_pulse',
    label: 'Blueprint: Pulse Cannon',
    description: 'Unlocks the Pulse tower for this run',
    weight: 10,
    effect: { unlockTower: 'pulse' },
    onlyIfLocked: 'pulse', // only offered while pulse is still locked
  },
];

// --- Cross-run meta progression --------------------------------------------

export const META_UPGRADES = [
  {
    id: 'head_start_capital',
    label: 'Head Start Capital',
    description: '+20 starting gold per level',
    maxLevel: 5,
    costs: [10, 15, 25, 40, 60],
    bonusPerLevel: { startGold: 20 },
  },
  {
    id: 'reinforced_foundation',
    label: 'Reinforced Foundation',
    description: '+25 starting base HP per level',
    maxLevel: 5,
    costs: [10, 15, 25, 40, 60],
    bonusPerLevel: { startBaseHP: 25 },
  },
  {
    id: 'extra_anchor_slot',
    label: 'Extra Anchor Slot',
    description: '+1 tower slot on every ring tier',
    maxLevel: 3,
    costs: [30, 60, 120],
    bonusPerLevel: { extraSlots: 1 },
  },
  {
    id: 'efficient_contracts',
    label: 'Efficient Contracts',
    description: '-5% troop send cost, permanently',
    maxLevel: 4,
    costs: [20, 35, 55, 80],
    bonusPerLevel: { troopCostMult: -0.05 },
  },
  {
    id: 'veteran_bounty',
    label: 'Veteran Bounty',
    description: '+10% troop kill value, permanently',
    maxLevel: 4,
    costs: [20, 35, 55, 80],
    bonusPerLevel: { troopValueMult: 0.10 },
  },
  {
    id: 'idle_efficiency',
    label: 'Idle Efficiency',
    description: '+10pp offline efficiency (base 50%)',
    maxLevel: 4,
    costs: [25, 45, 70, 100],
    bonusPerLevel: { offlineEfficiencyAdd: 0.10 },
  },
  {
    id: 'extended_cache',
    label: 'Extended Cache',
    description: '+2h offline cap (base 4h)',
    maxLevel: 4,
    costs: [25, 45, 70, 100],
    bonusPerLevel: { offlineCapHoursAdd: 2 },
  },
  {
    id: 'card_vault_split_shot',
    label: 'Card Vault: Split Shot',
    description: 'Unlocks the Split Shot card into the in-run upgrade pool',
    maxLevel: 1,
    costs: [50],
    bonusPerLevel: { unlockCard: 'split_shot' },
  },
];

// --- Economy / offline base values -----------------------------------------

export const ECONOMY = {
  startGold: 80,
  startBaseHP: 100,
  startLeashLaps: 3,
};

export const OFFLINE = {
  baseCapHours: 4,
  baseEfficiency: 0.5,
  silentThresholdSeconds: 30,
  idleWindowSeconds: 60,
};

export const CORES_REWARD = (lifetimeGoldEarned, loopTierIndex, runSeconds) => {
  const base = Math.floor(lifetimeGoldEarned / 400) + loopTierIndex * 15 + Math.floor(runSeconds / 60) * 4;
  return runSeconds > 60 ? Math.max(1, base) : Math.max(0, base);
};
