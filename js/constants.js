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
    displayName:     'Arrow',
    description:     'Fast, cheap. Single-target.',
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
    displayName:     'Cannon',
    description:     'Slow, heavy. Area damage.',
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
    displayName:     'Frost',
    description:     'Slows enemies. Low damage.',
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
    displayName:     'Laser',
    description:     'High DPS. Single-target.',
  },
};

// ============================================================
// ENEMY DEFINITIONS
// ============================================================
export const ENEMIES = {
  basic: {
    hp:           60,
    speed:        1.8,   // tiles/sec
    reward:       10,    // gold on kill
    size:         0.45,  // fraction of tile width
    color:        '#71717a',
    label:        'Basic',
  },
  fast: {
    hp:           30,
    speed:        3.5,
    reward:       7,
    size:         0.35,
    color:        '#22c55e',
    label:        'Fast',
  },
  tank: {
    hp:           240,
    speed:        0.9,
    reward:       25,
    size:         0.60,
    color:        '#ef4444',
    label:        'Tank',
  },
};

// ============================================================
// MAP PATH — ordered waypoints [{col, row}, ...]
// Z-shaped path on a 20×14 grid
// Entry: left edge row 6, Exit: right edge row 2
// ============================================================
export const PATH_WAYPOINTS = [
  { col: 0,  row: 6  },  // entry (left edge)
  { col: 6,  row: 6  },
  { col: 6,  row: 11 },
  { col: 13, row: 11 },
  { col: 13, row: 2  },
  { col: 19, row: 2  },  // exit (right edge)
];

// ============================================================
// COLORS (for canvas rendering — mirrors CSS vars)
// ============================================================
export const COLORS = {
  bgBase:         '#0a0a0b',
  bgSurface:      '#111113',
  bgElevated:     '#1a1a1f',
  border:         '#2a2a30',
  textPrimary:    '#f4f4f5',
  textSecondary:  '#71717a',
  accentBlue:     '#3b82f6',
  accentGreen:    '#22c55e',
  accentRed:      '#ef4444',
  accentAmber:    '#f59e0b',
  accentPurple:   '#a855f7',
  pathFill:       '#1e1e24',
  pathBorder:     '#2a2a30',
  gridLine:       'rgba(255,255,255,0.03)',
  tileHover:      'rgba(59,130,246,0.18)',
  tileInvalid:    'rgba(239,68,68,0.18)',
  hpBarBg:        'rgba(255,255,255,0.08)',
  rangeRing:      'rgba(255,255,255,0.08)',
  rangeRingSelected: 'rgba(59,130,246,0.2)',
  slowTint:       'rgba(168,85,247,0.35)',
};
