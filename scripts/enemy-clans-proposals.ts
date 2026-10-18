/**
 * PROPOSAL art — never shipped, never a runtime role (asset critique, Oct
 * 2026). The world bible plans two re-themes for the designer to judge:
 *
 *  - Smudge Gang → **the Gnawbone Pack**, the Butcherblock reptilians' raiders
 *    (salt marsh, smokehouses): bone helms, meat hooks, salt kegs.
 *  - Hexmoon Coven → **the Sporecap Rot**, the Greenvial gnomes' raiders
 *    (glasshouses, mushroom hollows): mushroom caps, spore censers, rotting vats.
 *
 * Same ladder and the same bake as the shipped clans (`recipeFromKit`), so the
 * mock cards show exactly what shipping one would look like:
 *
 *   npx tsx scripts/enemy-clans.ts --proposals <dir>
 *
 * Nothing here is in `CLAN_IDS`; the game never sees it.
 *
 * Briefs (the character-design skill, step 2):
 *  - Gnawbone Pack. Who: marsh goblins who raid Butcherblock's smokehouse
 *    barges for salt and meat. Want: the haul; worry: the reptiles' hooks.
 *    Temperament: greedy, swaggering, secretly squeamish (the skull is a
 *    boar's, worn so nobody sees them flinch). Silhouette: a beast's skull over
 *    the hood, snout forward. Prop: a meat hook. Keg: a salt barrel heaped white.
 *  - Sporecap Rot. Who: hollow-dwellers who brew Greenvial's spoiled stock into
 *    rot. Want: more spores; worry: daylight. Temperament: dreamy, patient,
 *    gleefully filthy. Silhouette: a huge spotted cap. Prop: a swinging spore
 *    censer. Keg: a copper vat foaming over with green rot.
 */
import { banner, lugs, onTnt, overlay, PAD_AT, pole, TNT_PAD_AT, type Kit, type Part } from './enemy-clans-art'

// ────────────────────────────────────────────────────────────── GNAWBONE ──
function gnawbone(): Kit {
  const skull = [
    'TT.....................T....',
    'TtT...................TtT...',
    '.TtT.................TtT....',
    '..TtT......55555555.TtT.....',
    '...TtTT..5TTTTTTTT5TtT......',
    '.....tTT5TTTTTTTTTTTT5......',
    '.......5TTTTTTTTTTTTT55.....',
    '......5TTTTTTTBBTTTTTTT5....',
    '......5TTTTTTBBBBTTTTTTTT5..',
    '......5TTTTTTTBBTTTTTTTTTT5.',
    '......t5TTTTTTTTTTTTTTTTTBT5',
    '.......t555TTTTTTTTTTTTTTTt5',
    '.........ttt5t5t5t5t5t5ttt..',
    '..........t.t.t.t.t.t.t.....',
  ]
  const tusks = overlay(skull, ['TT', 'Tt', '.Tt', '..T'], 25, 12)
  const bigSkull = overlay(
    tusks,
    ['TT.........', 'TtT........', '.TtT.......', '..TtT......', '...TtTT....'],
    0,
    0,
  )
  const boneCrown = ['.T...T...T...T.', 'TtT.TtT.TtT.TtT', 'TtTTTtTTTtTTTtT', 'ttttttttttttttt']
  const hat: Part = { name: 'boar-skull', grid: skull, at: 'head', x: 64, y: 2 }
  const hatBig: Part = { name: 'tusked-skull', grid: bigSkull, at: 'head', x: 64, y: 1 }
  const crown: Part[] = [
    { name: 'bone-crown', grid: boneCrown, at: 'head', x: 73, y: 2 },
    { name: 'crowned-skull', grid: tusks, at: 'head', x: 64, y: 2 },
  ]
  const hook = ['..3333...', '.34..43..', '34....43.', '4......3.', '4......3.', '.4.....3.', '..1....3.', '.......3.', '......aaa', '......aaa', '.......b.']
  const hide = ['....aaaaaaa....', '..aaabaaabaa...', '.aabaaaabaaab..', 'aaaaabaaaaaaab.', 'abBabBabBabBa..', '.B.B.B.B.B.B...']
  const rack = ['BBBBBBBBBBB', '.R...R...R.', '.Rr..Rr..Rr', '.RR..RR..RR', '.Rp..Rr..Rp', '.RR..RR..RR', '.R...R....R', '.....R.....']
  const cape = ['..aaaaaaa....', '.aaaaaaaaa...', '.aabaaaaaaa..', 'aaaabaaaaaa..', 'aaaaaabaaaaa.', 'aabaaaaaaaaa.', 'aaaaaaaabaaa.', 'aaaabaaaaaaaa', 'aaaaaaaaaabaa', 'abaaaaaaaaaaa', 'aaaaaabaaaaaa', 'aaaaaaaaaaaa.', 'TaTaTaTaTaTa.', '.T.T.T.T.T...']
  const sack = ['..b...', '.TbT..', 'TTTTT.', 'T5TTTT', 'TTTT5T', 'TTTTTT', '.TTTT.']
  const salt = ['.........W..........', '......WWW4WW........', '....WW44WWW4WWW.....', '...W4WWWsWW44WW4W...', '.WWW4WWW4WWWWsWWWWW.', 'W4WWWWsWWW4WWWWW4WWW', 'sWWsWWWWsWWWsWWWWsWs']
  return {
    weapon: { name: 'meat-hook', grid: hook, at: 'tip', x: -6, y: -10 },
    hat,
    hatBig,
    crown,
    pad: { name: 'hide-pauldron', grid: hide, ...PAD_AT },
    back: { name: 'smoke-rack', grid: banner(rack, 46), at: 'head', x: 56, y: -8, layer: 'under' },
    mantle: { name: 'hide-cape', grid: cape, at: 'head', x: 50, y: 30, layer: 'under' },
    tntHat: onTnt(hat),
    tntHatBig: onTnt(hatBig),
    tntCrown: onTnt(crown),
    tntPad: { name: 'hide-pauldron', grid: hide, ...TNT_PAD_AT },
    tntBack: { name: 'smoke-rack', grid: banner(rack, 34), at: 'head', x: 3, y: -8, layer: 'under' },
    tntStandard: { name: 'hide-standard', grid: banner(cape.slice(0, 12), 42), at: 'head', x: 0, y: -16, layer: 'under' },
    pack: { name: 'salt-sacks', grid: overlay(overlay(overlay(['', ''], sack, 0, 5), sack, 7, 1), sack, 14, 6), at: 'head', x: 4, y: 20, layer: 'under' },
    bomb: { name: 'salt-pouch', grid: ['...bb...', '..bTTb..', '..TTTT..', '.TTWTTT.', 'TT5TTTTT', 'TTTTT5TT', '.TTTTTT.', '..TTTT..'], at: 'hand', x: -4, y: -4 },
    cap: { name: 'salt-heap', grid: salt, at: 'head', x: 16, y: 12 },
    capBig: [
      { name: 'salt-heap', grid: salt, at: 'head', x: 16, y: 12 },
      { name: 'bone-in-salt', grid: ['TT.', 'TtT', '.Tt', '..T', '..T', '..T', '.TT'], at: 'head', x: 27, y: 6 },
    ],
    bossCap: [
      { name: 'salt-heap', grid: salt, at: 'head', x: 16, y: 12 },
      { name: 'bone-crown-keg', grid: ['.T....T....T.', 'TtT..TtT..TtT', '.t....t....t.'], at: 'head', x: 19, y: 9 },
    ],
    mark: {
      name: 'crossed-bones',
      grid: [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'abbbbbbbbTT........TTbbbbbba',
        'abbbbbbbbbTT......TTbbbbbbba',
        'abbbbbbbbbbTTT..TTTbbbbbbbba',
        'abbbbbbbbbbbbTTTTbbbbbbbbbba',
        'abbbbbbbbbbTTT..TTTbbbbbbbba',
        'abbbbbbbbbTT......TTbbbbbbba',
        'abbbbbbbbTT........TTbbbbbba',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ].map((r) => r.replace(/\./g, 'b')),
      at: 'head',
      x: 12,
      y: 47,
    },
    hoops: { name: 'twine', grid: ['b.a.b.a.b.a.b.a.b.a.b.a.b', '.........................', ...Array(13).fill('.........................'), 'a.b.a.b.a.b.a.b.a.b.a.b.a'], at: 'head', x: 13, y: 43, ink: false },
    sides: lugs('hanging-bone', ['.TT', 'TtT', '.T.', '.T.', '.T.', 'TtT', '.TT'], 30),
    bands: { light: 'a', dark: 'b', hi: 't' },
  }
}

// ────────────────────────────────────────────────────────────── SPORECAP ──
function sporecap(): Kit {
  const cap = [
    '..........vvvvvvvv..........',
    '.......vvvvCCvvvvvvvv.......',
    '.....vvvvvCCCCvvvvvvvvv.....',
    '....vvCCvvvCCvvvvvCCvvvv....',
    '...vvCCCCvvvvvvvvCCCCvvvv...',
    '..vvvvCCvvvvvCCvvvvCCvvvVV..',
    '..vvvvvvvvvvCCCCvvvvvvvVVV..',
    '.vvvvvvvvvvvvCCvvvvvvvVVVVV.',
    '.VvvvvvvvvvvvvvvvvvvvVVVVVV.',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    '.hGhGhGhGhGhGhGhGhGhGhGhGhG.',
    '..h.h.h.h.h.h.h.h.h.h.h.h...',
  ]
  const small = ['..vvvv..', '.vCvvvv.', 'vvvvCvvV', 'VVVVVVVV', '.hGhGhG.', '...55...', '...55...']
  const doubleCap = overlay(['', '', '', '', '', '', '', ...cap], small, 12, 0)
  const toadstool = ['.vvv.', 'vCvvV', 'VVVVV', '.h5h.', '..5..']
  const ring = overlay(overlay(overlay(overlay(['', '', '', '', ''], toadstool, 0, 0), toadstool, 7, 0), toadstool, 14, 0), toadstool, 21, 0)
  const hat: Part = { name: 'spotted-cap', grid: cap, at: 'head', x: 63, y: 1 }
  const hatBig: Part = { name: 'double-cap', grid: doubleCap, at: 'head', x: 63, y: -6 }
  const crown: Part[] = [
    { name: 'toadstool-ring', grid: ring, at: 'head', x: 65, y: -4 },
    { name: 'crowned-cap', grid: cap, at: 'head', x: 63, y: 1 },
  ]
  const censer: Part[] = [
    { name: 'spore-censer', grid: ['...BB...', '..B..B..', '.333333.', '33h3h333', '3hhhhhh3', '33333333', '.3h3h33.', '..3333..', '...bb...', '...bb...'], at: 'tip', x: -4, y: -9 },
    { name: 'censer-spores', grid: ['.h...z.', 'h.h.z.z', '.h...z.', '...h...'], at: 'tip', x: -5, y: -15, ink: false },
  ]
  const moss = ['....GGGGGGG....', '..GGgGGGgGGG...', '.GgGGhGGGgGGG..', 'GGGgGGGGhGGGGG.', 'GhGGGgGGGGgGG..', '.G.G.G.G.G.G...']
  const cloak = ['..GGGGGGG....', '.GGgGGGGGG...', '.GGGGGhGGGG..', 'GGgGGGGGGGG..', 'GGGGGGGgGGGG.', 'GhGGGGGGGGGG.', 'GGGGgGGGhGGG.', 'GGGGGGGGGGGGG', 'GgGGGGhGGGGGG', 'GGGGGGGGGgGGG', 'GGhGGGGGGGGGG', 'GGGGGgGGGGGG.', 'gGgGgGgGgGgG.', '.g.g.g.g.g...']
  const jar = ['.bb.', 'cccc', 'czqc', 'cqqc', 'cqzc', 'cccc']
  const ooze = ['....gggggggggg....', '..gghhggggggghgg..', '.ghhgggGggggggggg.', 'gggggGgggggGggggg.', 'g.gg.G.ggg.g.gg.g.', 'g..g...g.g...g..g.', '...g.....g.......g', '.........g........']
  return {
    weapon: censer,
    hat,
    hatBig,
    crown,
    pad: { name: 'moss-pauldron', grid: moss, ...PAD_AT },
    back: { name: 'glow-cap-pole', grid: pole(small, 3, 40), at: 'head', x: 55, y: -6, layer: 'under' },
    mantle: { name: 'moss-cloak', grid: cloak, at: 'head', x: 50, y: 30, layer: 'under' },
    tntHat: onTnt(hat),
    tntHatBig: onTnt(hatBig),
    tntCrown: onTnt(crown),
    tntPad: { name: 'moss-pauldron', grid: moss, ...TNT_PAD_AT },
    tntBack: { name: 'glow-cap-pole', grid: pole(small, 3, 28), at: 'head', x: 2, y: -6, layer: 'under' },
    tntStandard: { name: 'moss-standard', grid: banner(cloak.slice(0, 12), 42), at: 'head', x: 0, y: -16, layer: 'under' },
    tntRecolor: [{ box: [33, 14, 64, 33], map: { '#f4e341': 'h', '#d9945f': 'g' } }],
    pack: { name: 'rot-jars', grid: overlay(overlay(overlay(['', ''], jar, 1, 4), jar, 7, 1), jar, 13, 5), at: 'head', x: 4, y: 22, layer: 'under' },
    bomb: [
      { name: 'puffball', grid: ['..5555..', '.5TT555.', '5T55t555', '5555555t', '55t5555t', '.555t5t.', '..tttt..'], at: 'hand', x: -4, y: -3 },
      { name: 'puff-spores', grid: ['h.z', '.h.', 'z.h'], at: 'hand', x: -1, y: -7, ink: false },
    ],
    cap: { name: 'rot-ooze', grid: ooze, at: 'head', x: 17, y: 14, ink: false },
    capBig: [
      { name: 'rot-ooze', grid: ooze, at: 'head', x: 17, y: 14, ink: false },
      { name: 'vat-toadstool', grid: ['..vvvv..', '.vCvvvv.', 'vvvvCvvV', 'VVVVVVVV', '...55...', '...55...'], at: 'head', x: 22, y: 7 },
    ],
    bossCap: [
      { name: 'rot-ooze', grid: ooze, at: 'head', x: 17, y: 14, ink: false },
      { name: 'vat-toadstools', grid: ring.map((r) => r.slice(0, 19)), at: 'head', x: 17, y: 8 },
    ],
    mark: {
      name: 'rot-window',
      grid: [
        '1111111111111111111111111111',
        '1cccccccccccccccccccccccccc1',
        '1cqqqqzqqqqqhqqqqqzqqqqqqc1.',
        '1cqzqqqqqhqqqqqzqqqqqhqqqc1.',
        '1cqqqhqqqqqqzqqqqqqqqqqzqc1.',
        '1cqqqqqqzqqqqqqqhqqqzqqqqc1.',
        '1cqhqqqqqqqqqqqqqqqqqqhqqc1.',
        '1cccccccccccccccccccccccccc1',
        '1111111111111111111111111111',
      ],
      at: 'head',
      x: 12,
      y: 47,
    },
    hoops: { name: 'moss-patches', grid: ['GG.....Gg.......GG....gG.', '.G......G........G.....G.', ...Array(12).fill('.........................'), 'gG......GG.....Gg.....GG.', '.G.......G......G......G.'], at: 'head', x: 13, y: 42, ink: false },
    sides: lugs('side-toadstool', ['.vvv', 'vCvvV', 'VVVVV', '..55.', '..55.'], 30),
    bands: { light: 'z', dark: 'u', hi: 'C' },
  }
}

/** The proposals, by the id their cards file under. */
export const PROPOSAL_KITS: Readonly<Record<string, () => Kit>> = { gnawbone, sporecap }
