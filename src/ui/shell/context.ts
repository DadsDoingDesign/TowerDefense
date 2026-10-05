import { useGameStore } from '../../state/gameStore'
import { useSettingsStore } from '../../state/settingsStore'

/**
 * Which subject each band is showing. The whole app is a function of this —
 * there is no navigation, only a change of context. See docs/FIGMA.md.
 */
/**
 * `contracts` is the contract board and its terms; `city` a city's payout and
 * its "cash out or press on" (the mercenary company). Both are pages of their
 * own (`ContractsScreen`, `CityScreen`), drawn like the result page.
 */
export type StageKind = 'battlefield' | 'map' | 'board' | 'result' | 'title' | 'contracts' | 'city'
export type SelectorKind = 'party' | 'offers' | 'menu'

export interface ShellContext {
  stage: StageKind
  selector: SelectorKind
  /**
   * Board headline + blurb, when the stage is a board.
   *
   * `live` marks a board that is an OUTCOME rather than a destination — it is
   * announced to a screen reader when it appears (see `PageLayout`'s `live`).
   * Only the Crossroads reveal sets it: every other board is somewhere the
   * player chose to go, and announcing those would narrate navigation.
   */
  board: { title: string; blurb: string; live?: boolean; tone?: 'elite' } | null
  /**
   * `bands` is the four-band shell — used only by battle and the run map,
   * the two places where the Stage must stay uncovered and the pack must stay
   * on screen. Everything else is a `page`: title, body, pinned CTA.
   */
  layout: 'bands' | 'page'
}

/**
 * `layout: 'bands'` implies `selector: 'party'`, and something depends on it.
 *
 * `RootShell` early-returns for `layout: 'page'`, so `SelectorBand` renders
 * only under `bands` — and it draws the party row unconditionally, because
 * every `bands` context below carries `party` and every `offers` context is a
 * page. That used to be covered by a branch in `SelectorBand` whose else-half
 * held a second, divergent copy of the offer card; the copy is gone, and this
 * is what replaces it. It is checked HERE, at the two `return`s that could make
 * it false, rather than at the render site that would silently draw an empty
 * row instead.
 *
 * Dev-only. In production a broken invariant costs a party row on a screen
 * that has no party, which is a strictly better failure than a crash.
 */
const checked = (c: ShellContext): ShellContext => {
  if (import.meta.env.DEV && c.layout === 'bands' && c.selector !== 'party') {
    console.warn(
      `[context] layout 'bands' with selector '${c.selector}' — SelectorBand only draws the party row. ` +
        `Either give this context 'party', or make it a page.`,
    )
  }
  return c
}

export function useShellContext(): ShellContext {
  const screen = useGameStore((s) => s.screen)
  const runPhase = useGameStore((s) => s.runPhase)
  // SK1 / LS3: the hero pick's one tip, until a hero has been picked once.
  const skillTaught = useSettingsStore((s) => s.taught.heroSkill)
  // The classless rework's one tip: a hero is what it holds.
  const gearTaught = useSettingsStore((s) => s.taught.heroGear)
  const event = useGameStore((s) => s.event)
  const cityPending = useGameStore((s) => s.contract?.pending != null)
  const charter = useGameStore((s) => !!s.contract?.charter)
  const crossroads = useGameStore((s) => s.crossroads)
  const reward = useGameStore((s) => s.reward)
  // The node whose spoils these are — an elite's get their own frame (Phase 2).
  const clearedType = useGameStore((s) => s.runMap.nodes.find((n) => n.id === s.currentNodeId)?.type)

  // A finished run takes over the stage wherever it happened.
  if (runPhase !== 'active' && screen !== 'hub') {
    return { stage: 'result', selector: 'party', board: null, layout: 'page' }
  }

  if (screen === 'hub') {
    return { stage: 'title', selector: 'menu', board: null, layout: 'page' }
  }

  if (screen === 'contracts') {
    return { stage: 'contracts', selector: 'menu', board: null, layout: 'page' }
  }

  if (screen === 'heroPick') {
    return {
      stage: 'board',
      selector: 'offers',
      board: {
        title: 'Choose your first hero',
        // The pick's one tip: said once, where it first matters, then the
        // plain line it replaces. What a hero does comes from its gear (the
        // classless rework) — there are no classes to learn.
        blurb: !gearTaught
          ? 'A hero is what it holds, plus one skill.'
          : skillTaught
            ? 'Recruit more along the road.'
            : 'Each hero comes with a skill, and learns more as it levels up.',
      },
      layout: 'page',
    }
  }

  if (screen === 'crossroads' && crossroads) {
    return {
      stage: 'board',
      selector: 'offers',
      // The mutate branch is two steps, and the headline has to say which one
      // you are on — "aim at a hero" and "choose one of three Mythics" would
      // otherwise read as the same screen twice (M8).
      board: crossroads.revealed
        ? {
            title: 'Mutated',
            blurb: `${crossroads.revealed.heroName} fights differently from here on.`,
            // The one board that arrives as a result rather than as a place:
            // the permanent Mythic has just landed, and until now nothing said
            // so to anyone who could not see the screen change (F9).
            live: true,
          }
        : crossroads.mutationHeroId
          ? {
              title: 'Choose the mutation',
              blurb: 'Three Mythics, dealt when the fork fired. Read what each costs. The one you take is permanent.',
            }
          : { title: 'The Crossroads', blurb: 'One choice: take a recruit, or aim a mutation at one of your own.' },
      layout: 'page',
    }
  }

  if (screen === 'map') {
    // A city's payout comes first: what it paid, then cash out or press on.
    if (cityPending) return { stage: 'city', selector: 'menu', board: null, layout: 'page' }
    // An event node parks a board over the map until you resolve it.
    if (event) {
      // The Sovereign Route's merchants charge double (Rosethread's condition): the board says so.
      const board = event.kind === 'merchant' && charter ? CHARTER_MERCHANT : EVENT_BOARD[event.kind]
      return { stage: 'board', selector: 'offers', board, layout: 'page' }
    }
    // A post-wave reward pick is an offer board too.
    if (reward) {
      return {
        stage: 'board',
        selector: 'offers',
        // "It applies to the whole watch" was false for every item card — an
        // item goes to the pack. Each card now says its own scope (Wave 1).
        board:
          clearedType === 'elite'
            ? {
                title: 'Elite spoils',
                blurb: 'An elite pays richer: 25 gold banked and luckier cards. Take one.',
                tone: 'elite',
              }
            : { title: 'Spoils', blurb: 'Take one. Each card says where it goes.' },
        layout: 'page',
      }
    }
    return checked({ stage: 'map', selector: 'party', board: null, layout: 'bands' })
  }

  // Battle — the stage is the field, live or in setup.
  if (screen === 'battle') {
    return checked({ stage: 'battlefield', selector: 'party', board: null, layout: 'bands' })
  }

  /*
   * Anything left is a screen this function has no context for: a `crossroads`
   * whose payload rehydrated as null, a screen name from a save written by a
   * future build, a field cleared by a half-applied migration.
   *
   * It used to fall into the battle bands, and that made the fallback a trap
   * rather than a fallback. The bands draw the field's own controls; with no
   * wave and no node they draw "Tap a Sentinel to see its detail" and nothing
   * that goes anywhere — proven live with `screen: 'crossroads'`,
   * `crossroads: null`. A board page cannot strand anyone the same way, because
   * `useOffers` adds an exit to any page whose offers cannot get you out, and
   * an unrecognised screen produces no offers at all.
   */
  return { stage: 'board', selector: 'offers', board: LOST_BOARD, layout: 'page' }
}

/** Copy for the unrecognised-screen fallback above. It says so plainly. */
const LOST_BOARD = {
  title: 'Off the Path',
  blurb: 'Your heroes lost their bearings here, and this part of the run cannot be shown. Take the way on below.',
} as const

const CHARTER_MERCHANT = { title: 'Merchant', blurb: 'Every price here is double, on the Sovereign Route.' } as const

const EVENT_BOARD = {
  // "Three offers" over a board of four items and a hire (Wave 1).
  merchant: { title: 'Merchant', blurb: 'Spend your gold before you march.' },
  shrine: { title: 'Shrine', blurb: 'A bargain with terms. Read them.' },
  recruit: { title: 'Recruit', blurb: 'A hero looking for work.' },
  campfire: { title: 'Campfire', blurb: 'One night at the fire, and one thing done with it. Choose one.' },
} as const

