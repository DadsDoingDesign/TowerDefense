import { BattleCanvas } from '../BattleCanvas'
import { RunMapView } from '../components/RunMapView'
import { useGameStore } from '../../state/gameStore'
import type { ShellContext } from './context'

/**
 * Band 2 — the subject. Rule two of the shell: nothing ever covers this. No
 * sheet, no drawer, no scrim. Every "screen" the game used to push is a
 * different subject rendered here.
 */
export function StageBand({ ctx }: { ctx: ShellContext }) {
  return (
    <section className={`sh-stage stage-${ctx.stage}`}>
      {ctx.stage === 'battlefield' && <BattlefieldStage />}
      {ctx.stage === 'map' && <RunMapView />}
      {ctx.stage === 'board' && <BoardStage board={ctx.board} />}
      {ctx.stage === 'result' && <ResultStage />}
      {ctx.stage === 'title' && <TitleStage />}
    </section>
  )
}

function BattlefieldStage() {
  const battlePhase = useGameStore((s) => s.battlePhase)
  const currentWave = useGameStore((s) => s.currentWave)
  const hud = useGameStore((s) => s.hud)
  const speed = useGameStore((s) => s.speed)
  const setSpeed = useGameStore((s) => s.setSpeed)

  const live = battlePhase === 'battle'
  const total = hud.enemiesTotal || currentWave?.spawns.length || 0
  const killed = Math.max(0, hud.enemiesSpawned - hud.enemiesAlive)
  const frac = total ? killed / total : 0

  return (
    <>
      {live && (
        <div className="sh-wave-strip">
          <span className="sh-wave-label">{currentWave?.label ?? 'Wave'}</span>
          <span className="sh-wave-bar">
            <span className="sh-wave-fill" style={{ width: `${frac * 100}%` }} />
          </span>
          <button
            className="sh-speed"
            data-sfx="toggle"
            onClick={() => setSpeed(speed === 3 ? 1 : ((speed + 1) as 1 | 2 | 3))}
            aria-label={`Battle speed ${speed}×`}
          >
            {speed}×
          </button>
        </div>
      )}
      <BattleCanvas />
    </>
  )
}

function BoardStage({ board }: { board: ShellContext['board'] }) {
  if (!board) return null
  return (
    <div className="sh-board">
      <div className="sh-board-card">
        <span className="sh-board-glyph">◇</span>
        <h2>{board.title}</h2>
        <p>{board.blurb}</p>
      </div>
    </div>
  )
}

function TitleStage() {
  return (
    <div className="sh-title">
      <h1>FIELDWATCH</h1>
      <p>Hold the meadow against the goblin horde</p>
    </div>
  )
}

/**
 * The run-end card. Mirrors `.overlay-card` — panel fill, a 3px outcome rule in
 * good/bad, and the marks chip — but as a stage subject rather than a modal.
 */
function ResultStage() {
  const mode = useGameStore((s) => s.mode)
  const runPhase = useGameStore((s) => s.runPhase)
  const wins = useGameStore((s) => s.wins)
  const marksEarned = useGameStore((s) => s.marksEarned)
  const clearedNodeIds = useGameStore((s) => s.clearedNodeIds)
  const won = runPhase === 'won'
  const depth = Math.max(0, clearedNodeIds.length - 1)

  const { glyph, title, body } =
    mode === 'endless'
      ? {
          glyph: '❖',
          title: 'Endless Watch — Over',
          body: `You held out for ${wins} wave${wins === 1 ? '' : 's'} before the last life fell.`,
        }
      : won
        ? {
            glyph: '❖',
            title: 'The Watch Holds',
            body: 'You reached the end of the line and struck down the Colossus.',
          }
        : {
            glyph: '☠',
            title: 'The Line Breaks',
            body: `Your base has fallen after clearing ${depth} node${depth === 1 ? '' : 's'}. Permadeath — this run is over.`,
          }

  return (
    <div className="sh-result">
      <div className={`sh-result-card ${won ? 'win' : 'loss'}`}>
        <span className="sh-result-glyph">{glyph}</span>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="sh-result-marks">
          <span>Watch Marks earned</span>
          <strong>✦ {marksEarned}</strong>
        </div>
      </div>
    </div>
  )
}
