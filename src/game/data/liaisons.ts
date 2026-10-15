import type { CompanyId } from './companies'

/**
 * ---------------------------------------------------------------------------
 * The liaisons (Draft 4 · D — companies as sponsors, "someone to talk to")
 * ---------------------------------------------------------------------------
 *
 * One person per company who speaks for it: at each city on its road, and on
 * the receipt. (The home's board line went with the map-first home, Oct 2026.) They talk the way the
 * stop keepers do (`ui/shell/stopScene.ts`): one short spoken line in a bubble
 * over their head, in their own voice — never a rule. What a contract pays,
 * asks and risks is said by the terms, the route panel and the receipt; a
 * liaison only ever reacts to it, and promises nothing the rules do not pay
 * (a met ask's tip is paid by the destination, on a delivery: so "Reach
 * Deepforge for the tip", never "the tip doubles").
 *
 * Each liaison stands at the company's own post, a scene baked from the CC0
 * pack by `scripts/stop-scenes.ts` (`public/assets/scenes/liaison-<company>.png`).
 *
 * Pure data. Which line is said is a rule (`run/liaison.ts`): a hash of the
 * run seed and the city — never a draw on a run stream.
 *
 * Lines are written without their quotes; `run/liaison.ts` adds them and fills
 * `{c1}` `{c2}` `{dest}` (the road's three cities), `{here}` (the city the
 * caravan stands in) and `{next}` (the city after it). Every filled line, its
 * quotes included, fits the bubble's two lines (`MAX_LINE`, tested).
 */

/** What a liaison says of one of the company's asks, mid-road. */
export interface AskWords {
  /** The ask still open: a nudge, in the liaison's voice. */
  open: string
  /** The ask already met (a count ask only; one judged at the end is never met mid-road). */
  met?: string
}

export interface Liaison {
  company: CompanyId
  /** Their name: "Brannoch". */
  name: string
  /** What they are to the company, lower case: "factor" ("Brannoch · Ironvein’s factor"). */
  role: string
  /** At a city, by the cargo that arrived: 90% or more, 60% or more, less. */
  city: { readonly good: readonly string[]; readonly fair: readonly string[]; readonly rough: readonly string[] }
  /** At a city, of one of the contract's asks (keyed by ask id, `run/asks.ts`). */
  asks: Readonly<Record<string, AskWords>>
  /** On a delivery: every ask met, some, none, or a contract that asked nothing (a first contract). */
  delivered: { readonly all: readonly string[]; readonly some: readonly string[]; readonly none: readonly string[]; readonly plain: readonly string[] }
  /** Cashed out at a city. */
  cashedOut: readonly string[]
  /** The wagons fell. */
  fallen: readonly string[]
}

export const LIAISONS: Readonly<Record<CompanyId, Liaison>> = {
  // Peppercorn Co. — a spice broker: brisk, hot, always on the price.
  spice: {
    company: 'spice',
    name: 'Saffra',
    role: 'broker',
    city: {
      good: ['Smells like profit. On to {next}.', 'Not a sack singed. Lovely.'],
      fair: ['Some sacks singed. Still sells.'],
      rough: ['Half my spice is smoke. Do better.'],
    },
    asks: {
      'spice.burning': { open: 'Let them burn. I like the smell.', met: 'Plenty burned. {dest} tips for it.' },
      'spice.clean': { open: 'Not one of them at the wagons. Hear?', met: 'Clean fights. {dest} tips for it.' },
      'spice.felled': { open: 'Thin them out. Fell the lot.', met: 'A fine tally. {dest} tips for it.' },
    },
    delivered: {
      all: ['Every ask kept. Sold before the turn.'],
      some: ['Sold before the price turned. Good.'],
      none: ['Delivered. Next time, mind my asks.'],
      plain: ['Delivered, and still hot. Come back.'],
    },
    cashedOut: ['Selling early? Your loss, not mine.'],
    fallen: ['Smoke and ash. Next road, burn them.'],
  },

  // Easel House — a curator: fussy, precise, in love with the frames.
  art: {
    company: 'art',
    name: 'Vell',
    role: 'curator',
    city: {
      good: ['Not a scratch. Exquisite.', 'Spotless. On to {next}, gently.'],
      fair: ['A frame or two chipped. Tolerable.'],
      rough: ['My paintings! Half of them, ruined.'],
    },
    asks: {
      'art.cargo': { open: 'Every frame to {dest}, mind.' },
      'art.cities': { open: 'Keep the city fights spotless.', met: 'Clean cities. Reach {dest}, it tips.' },
      'art.clean': { open: 'No raider near the wagons. None.', met: 'Spotless fights. {dest} tips for it.' },
    },
    delivered: {
      all: ['Every frame, every ask. A triumph.'],
      some: ['The frames survived. Mostly.'],
      none: ['Delivered, though not as I asked.'],
      plain: ['Delivered. Hang them in the light.'],
    },
    cashedOut: ['Sold here? To these philistines?'],
    fallen: ['Ruined. All of it, in the canal.'],
  },

  // Ironvein — a factor: gruff, short, counts every cart.
  metals: {
    company: 'metals',
    name: 'Brannoch',
    role: 'factor',
    city: {
      good: ['Good haul. On to {next}.', 'Every cart whole. That’s the job.'],
      fair: ['A few carts short. It’ll do.'],
      rough: ['Half the ore gone. Not good enough.'],
    },
    asks: {
      'metals.plated': { open: 'Plated brutes ahead. Crack them.', met: 'Plate cracked. {dest} tips for it.' },
      'metals.elite': { open: 'Take on the elites. Show me nerve.', met: 'Elites down. Reach {dest}, it tips.' },
      'metals.felled': { open: 'Fell them all. Leave none standing.', met: 'Good tally. {dest} tips for it.' },
    },
    delivered: {
      all: ['Every ask met. Ironvein remembers.'],
      some: ['Ore’s in. Decent work.'],
      none: ['Ore’s in. You ignored my asks.'],
      plain: ['Ore’s in. Ironvein pays its debts.'],
    },
    cashedOut: ['Selling short? Your call. Ore’s ore.'],
    fallen: ['Carts in the ditch. Ore gone. Pity.'],
  },

  // Rosethread — a mercer: smooth, warm, money in every word.
  silk: {
    company: 'silk',
    name: 'Odile',
    role: 'mercer',
    city: {
      good: ['Not a thread pulled. Lovely.', 'Soft as you found it. On to {next}.'],
      fair: ['Some bolts snagged. Nobody’ll mind.'],
      rough: ['Torn silk sells for rags. Careful.'],
    },
    asks: {
      'silk.wares': { open: 'Spend at the stalls. Trade is trade.', met: 'Good shopping. {dest} tips for it.' },
      'silk.roadGold': { open: 'Hoard your road gold for {dest}.' },
      'silk.earned': { open: 'Make the road pay. Every coin.', met: 'The road paid. {dest} tips for it.' },
    },
    delivered: {
      all: ['Every ask, every bolt. Divine.'],
      some: ['Delivered. The silk’s still soft.'],
      none: ['Delivered, but not as I asked.'],
      plain: ['Delivered. {dest} thanks you.'],
    },
    cashedOut: ['Selling at {here}? Cheap, but fine.'],
    fallen: ['All that silk, in the mud.'],
  },

  // Moonquill — an archivist: quiet, a little ominous.
  scrolls: {
    company: 'scrolls',
    name: 'Wren',
    role: 'archivist',
    city: {
      good: ['The seals hold. On to {next}.', 'Every seal whole. As foretold.'],
      fair: ['A few seals cracked. It will do.'],
      rough: ['Half the scrolls lost. Ill omen.'],
    },
    asks: {
      'scrolls.pact': { open: 'The old stones bargain. Heed one.', met: 'A pact made. Reach {dest}, it tips.' },
      'scrolls.warded': { open: 'Warded ones ahead. Steel, not spells.', met: 'Wards broken. Reach {dest}, it tips.' },
      'scrolls.city': { open: 'Hold the cities. Let none through.', met: 'Clean cities. Reach {dest}, it tips.' },
    },
    delivered: {
      all: ['All asked, all done. It is written.'],
      some: ['Delivered. The seals held.'],
      none: ['Delivered. My asks went unheard.'],
      plain: ['Delivered. The seals held.'],
    },
    cashedOut: ['You turn back. The scrolls remember.'],
    fallen: ['The scrolls burn. So it was written.'],
  },
}

/** A company's liaison. */
export const liaisonOf = (company: CompanyId): Liaison => LIAISONS[company]
