import { hashSeed } from '../../game/core/rng'
import type { CompanyId } from '../../game/data/companies'

/**
 * What the keeper says at a stop on the road (Oct 2026; the designer: "a
 * campfire with a person that's talking to you"). One line per visit, picked
 * by the node so two merchants on one road say different things, spoken in a
 * bubble over the keeper's head (`StopScene`): the trader at the stall, the
 * cook at the fire, the shrine's keeper, the recruiting sergeant. Speech,
 * never a rule (what a stop offers is on its own cards), and short: a line
 * fits a phone's bubble in two lines (`MAX_LINE`, tested).
 */
export type StopKind = 'merchant' | 'campfire' | 'shrine' | 'recruit'

/** The longest a line may run, quotes included: two lines of the bubble. */
export const MAX_LINE = 40

export const STOP_LINES: Readonly<Record<StopKind, readonly string[]>> = {
  merchant: [
    '“Coin first. Questions after.”',
    '“Buy it now. The next stall’s far.”',
    '“Steel, mail and a wheelwright.”',
    '“Mind the goods. Mind the price.”',
    '“It’s all seen worse roads.”',
  ],
  campfire: [
    '“Sit. Stew’s on.”',
    '“Nothing walks into a fire this big.”',
    '“Sleep, or sharpen up?”',
    '“One thing before dawn. Pick.”',
  ],
  shrine: [
    '“The stone gives, and it takes.”',
    '“Old words. Something listens.”',
    '“A bargain is a bargain.”',
    '“Lay a hand on it, if you dare.”',
  ],
  recruit: [
    '“Blades for hire. Room on your wagons?”',
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

/**
 * Every baked scene (`scripts/stop-scenes.ts`): the four stops, and each
 * company's post where its liaison stands (Draft 4 · D).
 */
export type SceneKind = StopKind | `liaison-${CompanyId}`

/** The scene a company's liaison stands in. */
export const liaisonScene = (company: CompanyId): SceneKind => `liaison-${company}`

export const isStopKind =(k: string | undefined | null): k is StopKind =>
  k === 'merchant' || k === 'campfire' || k === 'shrine' || k === 'recruit'
