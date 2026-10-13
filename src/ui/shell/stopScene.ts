import { hashSeed } from '../../game/core/rng'

/**
 * What the world says at a stop on the road (Oct 2026; the designer: "what's
 * unique to them and makes it lively for the story"). One line per visit,
 * picked by the node so two merchants on one road say different things. The
 * world talking, never a rule: what a stop offers is on its own cards.
 */
export type StopKind = 'merchant' | 'campfire' | 'shrine' | 'recruit'

export const STOP_LINES: Readonly<Record<StopKind, readonly string[]>> = {
  merchant: [
    '“Coin first, friend. Questions after.”',
    '“Everything here has seen a worse road than yours.”',
    '“Buy it now. The next stall is a long walk off.”',
    '“Steel, mail and a wheelwright. What’ll it be?”',
    '“Mind the goods. Mind the price more.”',
  ],
  campfire: [
    'The fire cracks. It won’t last till morning.',
    'Night on the road. One thing gets done before dawn.',
    'Someone sings off-key. The wagons creak and settle.',
    'Embers, and a pot of something. The goblins can wait.',
  ],
  shrine: [
    'The stone hums. It gives, and it takes.',
    'Old words, cut deep. Something is listening.',
    'The candles burn without wax.',
    'A bargain is a bargain. The stone remembers.',
  ],
  recruit: [
    '“Blades for hire. Coin up front.”',
    '“We’ve walked worse roads than yours.”',
    '“Feed us, pay us, point us at goblins.”',
    '“Looking for a banner to stand under.”',
  ],
}

/** The line this stop says, fixed for the node. */
export const stopLine = (kind: StopKind, nodeId: string): string => {
  const lines = STOP_LINES[kind]
  return lines[hashSeed(nodeId, 'stop-line') % lines.length]
}

export const isStopKind = (k: string | undefined | null): k is StopKind =>
  k === 'merchant' || k === 'campfire' || k === 'shrine' || k === 'recruit'
