/**
 * The company faces — each company's liaison given a body, built on the hero
 * rig (prototype, Oct 2026; nothing in the shipped game reads this yet).
 *
 * All five are the liaisons `src/game/data/liaisons.ts` voices. The `art`
 * and `scrolls` slots were renamed Butcherblock and Greenvial (Oct 2026):
 *   - Butcherblock: Vell (the old house's fussy curator) did not fit hides
 *     and salt, so the slot has a new face and voice: Hask, the salter.
 *   - Greenvial: Wren (the old house's quiet, slightly ominous archivist)
 *     fits a poison-wise herbalist, so the name is kept, with a new trade.
 *
 * Each brief follows the character-design skill (§ 2): who, want and worry,
 * temperament (one contradiction), the tic, two silhouette words, the prop.
 * Every trait lands in a design channel (§ 3): `look` (silhouette, palette,
 * prop), `posture`, and the persona's idle tempo, tic and reaction
 * (`rig.PERSONA_*`).
 *
 * Pure data.
 */
import { BUTCHERBLOCK, GREENVIAL } from '../../data/companies'
import type { HeroLook } from './look'
import type { PersonaId } from './rig'

export interface FaceBrief {
  who: string
  want: string
  temperament: string
  tic: string
  silhouette: string
  prop: string
}

export interface CompanyFace {
  id: PersonaId
  /** The company id it speaks for (`data/companies.ts`), or the slot it takes. */
  company: 'spice' | 'silk' | 'metals' | 'art' | 'scrolls'
  companyName: string
  name: string
  role: string
  /** A proposal for the designer (not in liaisons.ts). */
  proposal: false | string
  brief: FaceBrief
  look: HeroLook
  /** The tic plays about this often (s), never constantly; the five intervals all differ. */
  ticEvery: number
}

export const FACES: readonly CompanyFace[] = [
  {
    id: 'saffra',
    company: 'spice',
    companyName: 'Peppercorn Co.',
    name: 'Saffra',
    role: 'broker',
    proposal: false,
    brief: {
      who: 'Saffra, human, Peppercorn’s spice broker. Came up selling pepper off a cart in the farm towns whose fields burn every summer; she buys the smoke-singed sacks cheap.',
      want: 'Wants the price before it turns. Fears a wagon of spice gone to smoke.',
      temperament: 'Brisk, hot-tempered, generous (she tips the moment it sells).',
      tic: 'Weighs her pepper sack in her hand, and grins at the weight.',
      silhouette: 'Lean + angular: a forward lean, the knotted scarf’s tail.',
      prop: 'A burlap sack of pepper, held at the waist.',
    },
    look: {
      race: 'human', persona: 'saffra', posture: 'lean', company: 'Peppercorn', hair: 'scarf', hairInk: 'hairGinger', skin: 'skinTan', palette: { cloth: 'ochre' },
      gear: { main: 'Spice Scale', off: 'Spice Pouch', body: "Broker's Sash" },
    },
    ticEvery: 5.3,
  },
  {
    id: 'odile',
    company: 'silk',
    companyName: 'Rosethread',
    name: 'Odile',
    role: 'mercer',
    proposal: false,
    brief: {
      who: 'Odile, elf, Rosethread’s mercer. Buys bolts at the river-forest looms and sells them at the fords for twice the weight in coin.',
      want: 'Wants every coin the road can pay. Fears a pulled thread: torn silk sells for rags.',
      temperament: 'Smooth, warm, calculating (the warmth has a price).',
      tic: 'Smooths the bolt of silk on her arm, at the waist, eyes half shut.',
      silhouette: 'Tall + tapering: topknot to trailing cloak.',
      prop: 'A bolt of cream silk on the arm, tied with a rose ribbon.',
    },
    look: {
      race: 'elf', persona: 'odile', posture: 'rock', company: 'Rosethread', hair: 'topknot', hairInk: 'hairBlack', palette: { cloth: 'plum' },
      gear: { off: 'Silk Bolt', body: 'Silkwind Cloak' },
    },
    ticEvery: 7.1,
  },
  {
    id: 'brannoch',
    company: 'metals',
    companyName: 'Ironvein',
    name: 'Brannoch',
    role: 'factor',
    proposal: false,
    brief: {
      who: 'Brannoch, dwarf, Ironvein’s factor. Counts the ore carts out of the quarry halls and back in, and has named every one of them.',
      want: 'Wants every cart home whole. Fears a cart in the ditch.',
      temperament: 'Gruff, terse, secretly sentimental (about his carts).',
      tic: 'Lifts his slate and chalks another cart home.',
      silhouette: 'Squat + square: planted, the beard a block.',
      prop: 'A chalked tally slate.',
    },
    look: {
      race: 'dwarf', persona: 'brannoch', posture: 'planted', company: 'Ironvein', head: 'forked', hair: 'bald', hairInk: 'hairGinger',
      gear: { off: 'Tally Slate', body: 'Forge Apron' },
    },
    ticEvery: 6.7,
  },
  {
    id: 'hask',
    company: 'art',
    companyName: BUTCHERBLOCK,
    name: 'Hask',
    role: 'salter',
    proposal: 'New face for the art slot (was the old house’s Vell): a fussy curator does not fit hides and salt.',
    brief: {
      who: 'Hask, reptilian, Butcherblock’s salter. Works the smokehouses along the salt marsh’s reed channels, weighing hides and salting the catch.',
      want: 'Wants the meat delivered fresh. Fears rot, and the salt running out.',
      temperament: 'Patient, cold-eyed, oddly courteous (a butcher with manners).',
      tic: 'A slow blink of his slit eyes, and a swish of the tail.',
      silhouette: 'Low + long: hunched, a flat snout ahead and a thick tail behind.',
      prop: 'A butcher\u2019s J hook.',
    },
    look: {
      race: 'reptilian', persona: 'hask', posture: 'hunch', company: BUTCHERBLOCK, head: 'snout', hair: 'crest', skin: 'scaleTeal', hairInk: 'oxblood',
      gear: { main: 'Meat Hook', off: 'Salt Sack', body: 'Smokehouse Apron' },
    },
    ticEvery: 5.9,
  },
  {
    id: 'wren',
    company: 'scrolls',
    companyName: GREENVIAL,
    name: 'Wren',
    role: 'herbalist',
    proposal: 'Keeps the scrolls slot’s name (the old house’s Wren): quiet and a little ominous suits a herbalist who knows every poison. A new trade, a new body.',
    brief: {
      who: 'Wren, gnome, Greenvial’s herbalist. Tends the glasshouses in the mushroom hollows and bottles whatever glows there.',
      want: 'Wants the rare cuttings brought home whole. Fears a cracked vial, and what spills out of it.',
      temperament: 'Quiet, patient, unsettlingly cheerful.',
      tic: 'Holds a vial out to the side, in the light, and watches it glow.',
      silhouette: 'Round + tall: a small round body under a huge sprouting hat.',
      prop: 'A glowing green vial.',
    },
    look: {
      race: 'gnome', persona: 'wren', posture: 'still', company: GREENVIAL, hair: 'sproutcap',
      gear: { off: 'Glow Vial', body: "Herbalist's Coat" },
    },
    ticEvery: 7.7,
  },
]

export const faceOf = (id: PersonaId): CompanyFace => FACES.find((f) => f.id === id)!
