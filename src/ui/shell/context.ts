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
  /** Meta chrome (Watchtower, main menu) shows marks, not run resources. */
  meta: boolean
  /** Board headline + blurb, when the stage is a board. */
  board: { title: string; blurb: string } | null
  /**
   * `bands` is the four-band shell — used only by battle and the run map,
   * the two places where the Stage must stay uncovered and the pack must stay
   * on screen. Everything else is a `page`: title, body, pinned CTA.
   */
  layout: 'bands' | 'page'
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
    return { stage: 'result', selector: 'party', meta: false, board: null, layout: 'page' }
  }

  if (screen === 'hub') {
    return { stage: 'title', selector: 'menu', meta: true, board: null, layout: 'page' }
  }

  if (screen === 'heroPick') {
    return {
      stage: 'board',
      selector: 'offers',
      meta: false,
      board: { title: 'Choose your first hero', blurb: 'This is your starting tower. You can recruit more heroes as you play through a run.' },
      layout: 'page',
    }
  }

  if (screen === 'crossroads' && crossroads) {
    return {
      stage: 'board',
      selector: 'offers',
      meta: false,
      board: { title: 'The Crossroads', blurb: 'One choice only — take a recruit or mutate a hero.' },
      layout: 'page',
    }
  }

  if (screen === 'endless') {
    if (endlessRoom) return { stage: 'board', selector: 'offers', meta: false, board: ROOM_BOARD[endlessRoom], layout: 'page' }
    return {
      stage: 'board',
      selector: 'rooms',
      meta: false,
      board: { title: 'Endless Watch', blurb: 'Pick a room, then take the next wave.' },
      layout: 'page',
    }
  }

  if (screen === 'map') {
    // An event node parks a board over the map until you resolve it.
    if (event && mode === 'campaign') {
      return { stage: 'board', selector: 'offers', meta: false, board: EVENT_BOARD[event.kind], layout: 'page' }
    }
    // A post-wave reward pick is an offer board too.
    if (reward) {
      return {
        stage: 'board',
        selector: 'offers',
        meta: false,
        board: { title: 'Spoils', blurb: 'Take one — it applies to the whole watch.' },
        layout: 'page',
      }
    }
    return { stage: 'map', selector: 'party', meta: false, board: null, layout: 'bands' }
  }

  // Battle — the stage is the field, live or in setup.
  return { stage: 'battlefield', selector: 'party', meta: false, board: null, layout: 'bands' }
}

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
