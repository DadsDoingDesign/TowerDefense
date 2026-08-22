import { useGameStore } from '../../state/gameStore'

/**
 * Which subject each band is showing. The whole app is a function of this —
 * there is no navigation, only a change of context. See docs/FIGMA.md.
 */
export type StageKind = 'battlefield' | 'map' | 'board' | 'result' | 'title'
export type SelectorKind = 'party' | 'offers' | 'rooms' | 'menu'

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
  board: { title: string; blurb: string; live?: boolean } | null
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
  const mode = useGameStore((s) => s.mode)
  const runPhase = useGameStore((s) => s.runPhase)
  const event = useGameStore((s) => s.event)
  const endlessRoom = useGameStore((s) => s.endlessRoom)
  const crossroads = useGameStore((s) => s.crossroads)
  const reward = useGameStore((s) => s.reward)

  // A finished run takes over the stage wherever it happened.
  if (runPhase !== 'active' && screen !== 'hub') {
    return { stage: 'result', selector: 'party', board: null, layout: 'page' }
  }

  if (screen === 'hub') {
    return { stage: 'title', selector: 'menu', board: null, layout: 'page' }
  }

  if (screen === 'heroPick') {
    return {
      stage: 'board',
      selector: 'offers',
      board: { title: 'Choose your first hero', blurb: 'This is your starting tower. You can recruit more heroes as you play through a run.' },
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
              blurb: 'Three Mythics, dealt when the fork fired. Read what each one costs — the one you take is permanent.',
            }
          : { title: 'The Crossroads', blurb: 'One choice only — take a recruit, or aim a mutation at one of your own.' },
      layout: 'page',
    }
  }

  if (screen === 'endless') {
    if (endlessRoom) return { stage: 'board', selector: 'offers', board: ROOM_BOARD[endlessRoom], layout: 'page' }
    return {
      stage: 'board',
      selector: 'rooms',
      board: { title: 'Endless Watch', blurb: 'Pick a room, then take the next wave.' },
      layout: 'page',
    }
  }

  if (screen === 'map') {
    // An event node parks a board over the map until you resolve it.
    if (event && mode === 'campaign') {
      return { stage: 'board', selector: 'offers', board: EVENT_BOARD[event.kind], layout: 'page' }
    }
    // A post-wave reward pick is an offer board too.
    if (reward) {
      return {
        stage: 'board',
        selector: 'offers',
        board: { title: 'Spoils', blurb: 'Take one — it applies to the whole watch.' },
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
  blurb: 'The watch lost its bearings here — this part of the run cannot be shown. Take the way on below.',
} as const

const EVENT_BOARD = {
  merchant: { title: 'Merchant', blurb: 'Three offers. Spend before you march.' },
  shrine: { title: 'Shrine', blurb: 'A bargain with terms. Read them.' },
  recruit: { title: 'Recruit', blurb: 'A Sentinel looking for a banner.' },
} as const

const ROOM_BOARD = {
  merchant: { title: 'Merchant', blurb: 'Spend gold before the next wave.' },
  forge: { title: 'Forge', blurb: 'Spend dust to reforge or upgrade.' },
  shrine: { title: 'Shrine', blurb: 'A bargain with terms.' },
  recruit: { title: 'Recruit', blurb: 'Add a Sentinel to the watch.' },
} as const
