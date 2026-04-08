// ============================================================
// CONSTANTS — all game tuning numbers in one place
// Edit here to rebalance the game; never hardcode in logic files
// ============================================================

export const GRID_COLS = 20;
export const GRID_ROWS = 14;

// Economy
export const STARTING_GOLD  = 150;
export const STARTING_LIVES = 20;
export const WAVE_END_BONUS_BASE  = 25;  // + wave * 5
export const WAVE_END_BONUS_SCALE = 5;

// Wave progression
export const WAVE_BASE_COUNT    = 8;
export const WAVE_COUNT_SCALE   = 1.3;
export const WAVE_HP_SCALE      = 1.2;
export const WAVE_SPEED_SCALE   = 1.05;
export const WAVE_SPAWN_BASE    = 1.0;   // seconds between spawns
export const WAVE_SPAWN_MIN     = 0.3;   // minimum seconds between spawns
export const WAVE_SPAWN_DEC     = 0.05;  // reduction per wave

// Object pool limits
export const MAX_PROJECTILES = 200;
export const MAX_ENEMIES     = 100;

// Delta-time safety cap (prevents spiral of death on tab switch)
export const MAX_DELTA = 0.1;

// Animation durations (seconds)
export const ANIM_TOWER_SPAWN = 0.2;
export const ANIM_ENEMY_DEATH = 0.25;

// ============================================================
// TOWER DEFINITIONS
// ============================================================
export const TOWERS = {
  arrow: {
    cost:            50,
    damage:          18,
    range:           3.0,
    fireRate:        1.5,
    projectileSpeed: 280,
    projectileSize:  4,
    splashRadius:    0,
    slowFactor:      1.0,
    slowDuration:    0,
    color:           '#3b82f6',
    displayName:     'Pulse',
    description:     'High-freq interceptor. Single-target.',
  },
  cannon: {
    cost:            100,
    damage:          55,
    range:           2.5,
    fireRate:        0.5,
    projectileSpeed: 200,
    projectileSize:  6,
    splashRadius:    1.2,
    slowFactor:      1.0,
    slowDuration:    0,
    color:           '#f59e0b',
    displayName:     'Burst',
    description:     'Broadcast disruptor. Area effect.',
  },
  frost: {
    cost:            75,
    damage:          8,
    range:           2.8,
    fireRate:        1.2,
    projectileSpeed: 220,
    projectileSize:  4,
    splashRadius:    0,
    slowFactor:      0.45,
    slowDuration:    1.8,
    color:           '#a855f7',
    displayName:     'Throttle',
    description:     'Bandwidth limiter. Slows threats.',
  },
  laser: {
    cost:            150,
    damage:          35,
    range:           3.5,
    fireRate:        3.0,
    projectileSpeed: 600,
    projectileSize:  3,
    splashRadius:    0,
    slowFactor:      1.0,
    slowDuration:    0,
    color:           '#ef4444',
    displayName:     'Scan',
    description:     'Deep packet inspection. High DPS.',
  },
};

// ============================================================
// TOWER UPGRADES (applied as multipliers at level 2)
// cost = additional gold to upgrade; stat fields are multipliers on base
// ============================================================
export const UPGRADES = {
  arrow:  { cost: 40,  damageX: 1.6, rangeX: 1.1,  fireRateX: 1.3, label: 'Pulse amplifier — +60% throughput, +30% fire rate' },
  cannon: { cost: 80,  damageX: 1.7, rangeX: 1.1,  fireRateX: 1.2, label: 'Burst array — +70% damage, +20% fire rate' },
  frost:  { cost: 60,  damageX: 1.5, rangeX: 1.15, slowFactor: 0.3, slowDuration: 2.5, label: 'Deep throttle — 30% velocity cap, extended suppression' },
  laser:  { cost: 120, damageX: 1.8, rangeX: 1.15, fireRateX: 1.3, label: 'Turbo scan — +80% DPS, +30% fire rate' },
};

export const SELL_RATE = 0.75;

// ============================================================
// DIFFICULTY PRESETS
// ============================================================
export const DIFFICULTIES = {
  easy: {
    label:        'Staging',
    startGold:    200,
    startLives:   25,
    enemyHpMult:  0.75,
    enemySpdMult: 0.9,
    description:  'Reduced threat load. Extended credit allocation.',
  },
  normal: {
    label:        'Production',
    startGold:    150,
    startLives:   20,
    enemyHpMult:  1.0,
    enemySpdMult: 1.0,
    description:  'Standard deployment parameters.',
  },
  hard: {
    label:        'Incident',
    startGold:    100,
    startLives:   15,
    enemyHpMult:  1.35,
    enemySpdMult: 1.15,
    description:  'Active breach scenario. Critical resources.',
  },
};

// Game speed options
export const SPEED_OPTIONS = [1, 2]; // multipliers (toggles 1× ↔ 2×)

// ============================================================
// ENEMY DEFINITIONS
// ============================================================
export const ENEMIES = {
  basic: {
    hp:           60,
    speed:        1.8,
    reward:       10,
    size:         0.45,
    color:        '#71717a',
    label:        'Bot',
    armor:        0,
    isBoss:       false,
  },
  fast: {
    hp:           30,
    speed:        3.5,
    reward:       7,
    size:         0.35,
    color:        '#22c55e',
    label:        'Script',
    armor:        0,
    isBoss:       false,
  },
  tank: {
    hp:           240,
    speed:        0.9,
    reward:       25,
    size:         0.60,
    color:        '#ef4444',
    label:        'Flood',
    armor:        0,
    isBoss:       false,
  },
  armored: {
    hp:           120,
    speed:        1.4,
    reward:       18,
    size:         0.50,
    color:        '#94a3b8',  // slate-400 — metallic
    label:        'APT',
    armor:        8,           // reduce each hit by 8 (min 1 dmg)
    isBoss:       false,
  },
  boss: {
    hp:           800,
    speed:        0.7,
    reward:       60,
    size:         0.75,
    color:        '#dc2626',  // deep red
    label:        'Zero-Day',
    armor:        5,
    isBoss:       true,
  },
};

// ============================================================
// MAPS — multiple path layouts (all on 20×14 grid)
// ============================================================
export const MAPS = [
  {
    id:          'alpha',
    name:        'Alpha — Gateway',
    description: 'Z-shaped routing. Balanced chokepoints.',
    waypoints: [
      { col: 0,  row: 6  },
      { col: 6,  row: 6  },
      { col: 6,  row: 11 },
      { col: 13, row: 11 },
      { col: 13, row: 2  },
      { col: 19, row: 2  },
    ],
  },
  {
    id:          'beta',
    name:        'Beta — Backbone',
    description: 'Core backbone. Serpentine topology.',
    waypoints: [
      { col: 0,  row: 1  },
      { col: 16, row: 1  },
      { col: 16, row: 6  },
      { col: 3,  row: 6  },
      { col: 3,  row: 11 },
      { col: 19, row: 11 },
    ],
  },
  {
    id:          'gamma',
    name:        'Gamma — DMZ',
    description: 'DMZ segment. Exposed center lane.',
    waypoints: [
      { col: 0,  row: 3  },
      { col: 9,  row: 3  },
      { col: 9,  row: 10 },
      { col: 19, row: 10 },
    ],
  },
];

// Keep legacy export pointing at alpha for code that hasn't migrated
export const PATH_WAYPOINTS = MAPS[0].waypoints;

// ============================================================
// COLORS (for canvas rendering — mirrors CSS vars)
// ============================================================
export const COLORS = {
  bgBase:         '#09090f',
  bgSurface:      '#13132a',
  bgElevated:     '#1d1d40',
  border:         '#2e2e58',
  textPrimary:    '#f1f5f9',
  textSecondary:  '#94a3b8',
  accentBlue:     '#6366f1',
  accentGreen:    '#10b981',
  accentRed:      '#f43f5e',
  accentAmber:    '#f59e0b',
  accentPurple:   '#8b5cf6',
  pathFill:       '#17173a',
  pathBorder:     '#2e2e58',
  gridLine:       'rgba(255,255,255,0.03)',
  tileHover:      'rgba(99,102,241,0.20)',
  tileInvalid:    'rgba(244,63,94,0.20)',
  hpBarBg:        'rgba(255,255,255,0.09)',
  rangeRing:      'rgba(255,255,255,0.08)',
  rangeRingSelected: 'rgba(99,102,241,0.25)',
  slowTint:       'rgba(139,92,246,0.38)',
};
