// ============================================================
// CONSTANTS — all game tuning numbers in one place
// ============================================================

export const GRID_COLS = 20;
export const GRID_ROWS = 14;

// Economy
export const STARTING_GOLD  = 150;
export const STARTING_LIVES = 20;
export const WAVE_END_BONUS_BASE  = 25;
export const WAVE_END_BONUS_SCALE = 5;

// Wave progression
export const WAVE_BASE_COUNT    = 8;
export const WAVE_COUNT_SCALE   = 1.3;
export const WAVE_HP_SCALE      = 1.2;
export const WAVE_SPEED_SCALE   = 1.05;
export const WAVE_SPAWN_BASE    = 1.0;
export const WAVE_SPAWN_MIN     = 0.3;
export const WAVE_SPAWN_DEC     = 0.05;

// Object pool limits
export const MAX_PROJECTILES = 200;
export const MAX_ENEMIES     = 100;

// Delta-time safety cap
export const MAX_DELTA = 0.1;

// Animation durations (seconds)
export const ANIM_TOWER_SPAWN = 0.2;
export const ANIM_ENEMY_DEATH = 0.25;

// ============================================================
// TOWER DEFINITIONS — Big Tech Edition™
// ============================================================
export const TOWERS = {
  meta: {
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
    displayName:     'Meta',
    description:     'Data harvester. Single-target, always watching.',
  },
  amazon: {
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
    displayName:     'Amazon',
    description:     'Warehouse coverage. Ships area damage.',
  },
  uber: {
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
    displayName:     'Uber',
    description:     'Surge pricing enforcer. Slows all threats.',
  },
  tesla: {
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
    displayName:     'Tesla',
    description:     'Visionary disruptor. High DPS, longest range.',
  },
};

// ============================================================
// TOWER UPGRADES — Corporate Vice Edition™
// Two branching paths per tower. Pick one.
// ============================================================
export const UPGRADES = {
  meta: {
    // Level 1 → 2 (choose one)
    a: {
      cost:        40,
      displayName: 'Harvest User Data',
      lore:        '+60% dmg, +15% range — "We already have it, tbh"',
      damageX:     1.6,
      rangeX:      1.15,
      fireRateX:   1.0,
    },
    b: {
      cost:        40,
      displayName: 'Disable Privacy Settings',
      lore:        '+40% range, +25% rate — "Opt-out? Buried in settings"',
      damageX:     1.1,
      rangeX:      1.4,
      fireRateX:   1.25,
    },
    // Level 2 → 3 (mechanical)
    c: {
      cost:        100,
      displayName: 'Behavioral Targeting',
      lore:        'Fires at 2 targets simultaneously — "We know what you want before you do"',
      multiTarget: 2,
    },
    // Level 3 → 4 (mechanical)
    d: {
      cost:        160,
      displayName: 'Shadow Profile',
      lore:        'Tracks 3 targets + packets chain on impact — "Your data. Everywhere. Forever."',
      multiTarget: 3,
      chainDamage: 1,
    },
  },
  amazon: {
    a: {
      cost:        80,
      displayName: 'Remove Bathroom Breaks',
      lore:        '+70% dmg, +20% rate — "Productivity score updated"',
      damageX:     1.7,
      rangeX:      1.1,
      fireRateX:   1.2,
    },
    b: {
      cost:        80,
      displayName: 'Prime Drone Fleet',
      lore:        '+60% splash radius — "Arriving in 30 mins (probably)"',
      damageX:     1.3,
      rangeX:      1.1,
      fireRateX:   1.0,
      splashX:     1.6,
    },
    c: {
      cost:        140,
      displayName: 'Warehouse Automation',
      lore:        'Fires 3-box burst per trigger — "The robots replaced them all"',
      burstShots:  3,
    },
    d: {
      cost:        200,
      displayName: 'Monopoly Protocol',
      lore:        'Fires 2-box burst at 2 targets — "Competitors? What competitors?"',
      multiTarget: 2,
      burstShots:  2,
    },
  },
  uber: {
    a: {
      cost:        60,
      displayName: 'Surge Pricing',
      lore:        '75% velocity cap — "Nobody can afford to move right now"',
      damageX:     1.2,
      rangeX:      1.0,
      fireRateX:   1.1,
      slowFactor:  0.25,
    },
    b: {
      cost:        60,
      displayName: 'Misclassify Contractors',
      lore:        '3.5s slow duration — "You\'re not employed. Just... stuck."',
      damageX:     1.3,
      rangeX:      1.1,
      fireRateX:   1.2,
      slowDuration: 3.5,
    },
    c: {
      cost:        110,
      displayName: 'Platform Lock-In',
      lore:        'Slow spreads to nearby threats on hit — "You can\'t opt out"',
      slowSpread:  1.8,
    },
    d: {
      cost:        160,
      displayName: 'Ghost Mode',
      lore:        'Targets ALL enemies in range simultaneously — "Surge. Everywhere."',
      multiTarget: 99,
    },
  },
  tesla: {
    a: {
      cost:        120,
      displayName: 'Full Self-Driving Beta™',
      lore:        '+80% dmg, +30% rate — "Works great. (mostly)"',
      damageX:     1.8,
      rangeX:      1.15,
      fireRateX:   1.3,
    },
    b: {
      cost:        120,
      displayName: 'Tweet Market Manipulation',
      lore:        '+50% fire rate — "One post, infinite chaos. SEC? Lol."',
      damageX:     1.3,
      rangeX:      1.15,
      fireRateX:   1.5,
    },
    c: {
      cost:        180,
      displayName: 'Chain Lightning',
      lore:        'Bolts arc to 2 additional targets on impact — "Unlimited power"',
      chainDamage: 2,
    },
    d: {
      cost:        260,
      displayName: 'Ludicrous Mode',
      lore:        'Triple burst + 2-arc chain — "Is this even legal?"',
      burstShots:  3,
      chainDamage: 2,
    },
  },
};

export const SELL_RATE = 0.75;

// ============================================================
// DIFFICULTY PRESETS — Funding Stage Edition™
// ============================================================
export const DIFFICULTIES = {
  easy: {
    label:        'Pre-Seed',
    startGold:    200,
    startLives:   25,
    enemyHpMult:  0.75,
    enemySpdMult: 0.9,
    description:  'Angel money. Light resistance. Training wheels.',
  },
  normal: {
    label:        'Series A',
    startGold:    150,
    startLives:   20,
    enemyHpMult:  1.0,
    enemySpdMult: 1.0,
    description:  'Standard runway. Board expects results.',
  },
  hard: {
    label:        'Post-Acquisition',
    startGold:    100,
    startLives:   15,
    enemyHpMult:  1.35,
    enemySpdMult: 1.15,
    description:  'Integration hell. Headcount frozen.',
  },
};

// Game speed options
export const SPEED_OPTIONS = [1, 2];

// ============================================================
// ENEMY DEFINITIONS — Threat Actor Taxonomy
// ============================================================
export const ENEMIES = {
  basic: {
    hp:     60,
    speed:  1.8,
    reward: 10,
    size:   0.45,
    color:  '#71717a',
    label:  'Intern',
    armor:  0,
    isBoss: false,
  },
  fast: {
    hp:     30,
    speed:  3.5,
    reward: 7,
    size:   0.35,
    color:  '#22c55e',
    label:  'Growth Hacker',
    armor:  0,
    isBoss: false,
  },
  tank: {
    hp:     240,
    speed:  0.9,
    reward: 25,
    size:   0.60,
    color:  '#ef4444',
    label:  'VC Money',
    armor:  0,
    isBoss: false,
  },
  armored: {
    hp:     120,
    speed:  1.4,
    reward: 18,
    size:   0.50,
    color:  '#94a3b8',
    label:  'Consultant',
    armor:  8,
    isBoss: false,
  },
  boss: {
    hp:     800,
    speed:  0.7,
    reward: 60,
    size:   0.75,
    color:  '#dc2626',
    label:  'Disruptor',
    armor:  5,
    isBoss: true,
  },
};

// ============================================================
// MAPS — Network Zones / Campus Layouts
// ============================================================
export const MAPS = [
  {
    id:          'alpha',
    name:        'Alpha — Valley HQ',
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
    name:        'Beta — FAANG Campus',
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
    name:        'Gamma — Startup Hub',
    description: 'Open floor plan. Exposed center lane.',
    waypoints: [
      { col: 0,  row: 3  },
      { col: 9,  row: 3  },
      { col: 9,  row: 10 },
      { col: 19, row: 10 },
    ],
  },
];

export const PATH_WAYPOINTS = MAPS[0].waypoints;

// ============================================================
// COLORS (canvas rendering — mirrors CSS vars)
// ============================================================
export const COLORS = {
  bgBase:            '#09090f',
  bgSurface:         '#13132a',
  bgElevated:        '#1d1d40',
  border:            '#2e2e58',
  textPrimary:       '#f1f5f9',
  textSecondary:     '#94a3b8',
  accentBlue:        '#6366f1',
  accentGreen:       '#10b981',
  accentRed:         '#f43f5e',
  accentAmber:       '#f59e0b',
  accentPurple:      '#8b5cf6',
  pathFill:          '#17173a',
  pathBorder:        '#2e2e58',
  gridLine:          'rgba(255,255,255,0.03)',
  tileHover:         'rgba(99,102,241,0.20)',
  tileInvalid:       'rgba(244,63,94,0.20)',
  hpBarBg:           'rgba(255,255,255,0.09)',
  rangeRing:         'rgba(255,255,255,0.08)',
  rangeRingSelected: 'rgba(99,102,241,0.25)',
  slowTint:          'rgba(139,92,246,0.38)',
};
