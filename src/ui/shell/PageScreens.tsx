import { useGameStore } from '../../state/gameStore'
import { useMetaStore } from '../../state/metaStore'
import type { ShellContext } from './context'
import type { Offer } from './offers'
import { InfoCard, MenuRow, PageLayout, PortraitRow, StatRow, Tile } from './Page'

/**
 * Every non-battle context, rendered on the page skeleton.
 *
 * They all reduce to the same shape — pick one of N, read what it does, commit
 * with the pinned CTA — which is why hero-pick, the merchant, the shrine, the
 * endless rooms and the perk list can share one renderer.
 */
export function PageScreen({
  ctx,
  offers,
  title: titleOverride,
  subtitle: subtitleOverride,
}: {
  ctx: ShellContext
  offers: Offer[]
  title?: string
  subtitle?: string
}) {
  const selection = useGameStore((s) => s.shellSelection)
  const shellSelect = useGameStore((s) => s.shellSelect)

  // Offers that act on tap (back, leave) are navigation, not choices — they
  // sit under the body as rows rather than joining the chooser.
  const choices = offers.filter((o) => !o.immediate)
  const navs = offers.filter((o) => o.immediate)

  // The CTA always needs a target, so default to the first choice.
  const selected = choices.find((o) => o.id === selection?.id) ?? choices[0]
  const pick = (id: string) => {
    if (selection?.kind !== 'offer' || selection.id !== id) shellSelect({ kind: 'offer', id })
  }

  const title = titleOverride ?? ctx.board?.title ?? 'Fieldwatch'
  const subtitle = subtitleOverride ?? ctx.board?.blurb
  const resources = <Resources />

  // A page where nothing is bought or spent does not need a purse on it.
  const spends = choices.some((o) => o.cost)

  // A chooser only makes sense with more than one thing to choose between.
  const asPortraits = choices.length > 1 && choices.every((o) => o.portrait)
  const asRows = choices.length > 1 && !asPortraits

  return (
    <PageLayout
      title={title}
      subtitle={subtitle}
      resources={spends ? resources : undefined}
      cta={
        selected?.action
          ? { label: selected.action.label, run: selected.action.run, disabled: selected.action.disabled }
          : undefined
      }
      secondary={
        selected?.tiles?.length ? (
          <>
            {selected.tiles.map((t) => (
              <Tile key={t.caption} caption={t.caption} glyph={t.glyph} art={t.art} />
            ))}
          </>
        ) : undefined
      }
    >
      {asPortraits && (
        <PortraitRow
          items={choices.map((o) => ({ id: o.id, art: o.portrait!.art, glyph: o.portrait!.glyph, color: o.portrait!.color }))}
          selectedId={selected?.id ?? null}
          onSelect={pick}
        />
      )}

      {/* With a row chooser the list comes first — reading a detail for
          something you have not picked yet reads backwards. */}
      {asRows && (
        <div className="pg-rows">
          {choices.map((o) => (
            <MenuRow
              key={o.id}
              label={o.title}
              value={o.cost ? `${CURRENCY[o.cost.currency]} ${o.cost.amount}` : o.sub}
              onClick={() => pick(o.id)}
              selected={o.id === selected?.id}
            />
          ))}
        </div>
      )}

      {selected && (
        <div className="pg-detail">
          {!asRows && (
            <p className="pg-name" style={selected.color ? { color: selected.color } : undefined}>
              {selected.title}
            </p>
          )}
          {selected.stats?.length ? <StatRow stats={selected.stats} /> : null}
          <InfoCard lines={selected.body} />
        </div>
      )}

      {navs.length > 0 && (
        <div className="pg-rows">
          {navs.map((o) => (
            <MenuRow key={o.id} label={o.title} value={o.sub} onClick={() => o.action?.run()} />
          ))}
        </div>
      )}

      {selected?.secondary && (
        <div className="pg-rows">
          <MenuRow label={selected.secondary.label} onClick={selected.secondary.run} />
        </div>
      )}
    </PageLayout>
  )
}

const CURRENCY = { gold: '⟡', dust: '◈', marks: '✦' } as const

/** Purse chips for pages where something is bought. */
function Resources() {
  const screen = useGameStore((s) => s.screen)
  const mode = useGameStore((s) => s.mode)
  const gold = useGameStore((s) => s.gold)
  const dust = useGameStore((s) => s.dust)
  const marks = useMetaStore((s) => s.watchMarks)

  if (screen === 'hub') return <span className="pg-chip gold">✦ {marks}</span>
  return (
    <>
      <span className="pg-chip gold">⟡ {gold}</span>
      {mode === 'endless' && <span className="pg-chip teal">◈ {dust}</span>}
    </>
  )
}

/**
 * The Watchtower menu. The only page with no chooser — the rows *are* the
 * choices and the CTA is the one thing you came here to do.
 */
export function MenuScreen({ offers }: { offers: Offer[] }) {
  const primary = offers.find((o) => o.id === 'run')
  const rows = offers.filter((o) => o.id !== 'run')

  return (
    <PageLayout
      title="Fieldwatch"
      subtitle="Hold the meadow against the goblin horde"
      cta={primary?.action ? { label: 'Start a Run', run: primary.action.run } : undefined}
    >
      <div className="pg-art" aria-hidden />
      <div className="pg-rows">
        {rows.map((o) => (
          <MenuRow
            key={o.id}
            label={o.title}
            value={o.cost ? `✦ ${o.cost.amount}` : o.sub}
            onClick={() => o.action?.run()}
            tone={o.color === 'var(--bad)' ? 'danger' : 'default'}
          />
        ))}
      </div>
    </PageLayout>
  )
}

/** Run end — no chooser, a verdict and the way back. */
export function ResultScreen() {
  const runPhase = useGameStore((s) => s.runPhase)
  const mode = useGameStore((s) => s.mode)
  const wins = useGameStore((s) => s.wins)
  const marksEarned = useGameStore((s) => s.marksEarned)
  const clearedNodeIds = useGameStore((s) => s.clearedNodeIds)
  const returnToHub = useGameStore((s) => s.returnToHub)
  const won = runPhase === 'won'
  const depth = Math.max(0, clearedNodeIds.length - 1)

  const title = mode === 'endless' ? 'The Watch Ends' : won ? 'The Watch Holds' : 'The Line Breaks'
  const blurb =
    mode === 'endless'
      ? `You held out for ${wins} wave${wins === 1 ? '' : 's'} before the last life fell.`
      : won
        ? 'You reached the end of the line and struck down the Colossus.'
        : `Your base has fallen after clearing ${depth} node${depth === 1 ? '' : 's'}. Permadeath — this run is over.`

  return (
    <PageLayout
      title={title}
      subtitle={blurb}
      cta={{ label: 'Return', run: returnToHub }}
      secondary={
        <>
          <Tile caption={`✦ ${marksEarned} earned`} glyph="✦" />
          <Tile caption={mode === 'endless' ? `${wins} waves` : `Depth ${depth}`} glyph="⌖" />
          <Tile caption={won ? 'Base intact' : 'Base lost'} glyph={won ? '⛨' : '☠'} />
        </>
      }
    >
      <div className={`pg-verdict ${won ? 'win' : 'loss'}`}>
        <span className="pg-verdict-glyph">{won ? '❖' : '☠'}</span>
      </div>
      <InfoCard
        lines={[
          `✦ ${marksEarned} Watch Marks earned`,
          'Spend them on permanent upgrades in the Watchtower — they carry into every future run.',
        ]}
      />
    </PageLayout>
  )
}
