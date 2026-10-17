import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { RELICS } from '../src/game/data/relics'
import { allStatCards } from '../src/game/data/rewards'
import { ALL_SKILLS } from '../src/game/data/skills'
import { allMutations } from '../src/game/data/mutations'
import { RELIC_NOTE } from '../src/ui/shell/relicOffers'
import { CLANS, FACTIONS } from '../src/game/data/clans'

/**
 * The copy pass (Oct 2026, `docs/copy/COPY.md`). The designer, on a relic
 * card: "+5 Patience to team / *relics affect new team members and stack for
 * the remainder of your run*" — then "apply to all copy in the game … as
 * brief as it can be".
 *
 * An effect line is the number and what it touches. These caps hold the
 * lines that sell a choice to that shape: a cap a line can only pass by
 * staying an effect line, not a paragraph. Raising one needs a reason in
 * COPY.md's table, like any other rule there.
 */
export const CAPS = {
  /** A stat relic's or a boon's effect: "+5 Patience to team". */
  statEffect: 60,
  /** A pact's or a curse's bill: "−34% attack speed to team". */
  bill: 40,
  /** A rule relic: one rule, one line ("+25 gold per win"). */
  ruleEffect: 100,
  /** A skill: one sentence, its numbers in it. */
  skill: 80,
  /** A mutation's upside (its bill is the `downside`). */
  mutation: 60,
  /** A goblin's name (the clans, Oct 2026): it rides a 32px chip's label and the boss plate, with " · Plated" after it. */
  enemyName: 18,
  /** A clan's name: a Codex section title and a chip. */
  clanName: 14,
} as const

/** The scope boilerplate the relic card retired; the note says it once. */
const BOILERPLATE = [/every hero, hires included/i, /·\s*all your heroes/i, /held for the rest of the run/i, /\byour company\b/i]

describe('the goblin clans are named, not described', () => {
  it('every clan and every one of its units keeps a name a chip can carry', () => {
    for (const c of CLANS) {
      expect(c.name.length, c.name).toBeLessThanOrEqual(CAPS.clanName)
      const names = [...FACTIONS.flatMap((f) => c.units[f]), ...Object.values(c.specialists)]
      for (const n of names) {
        expect(n.length, `${c.name}: ${n}`).toBeLessThanOrEqual(CAPS.enemyName)
        // A name, not a sentence: no full stop, no clause.
        expect(n, n).toMatch(/^[A-Z][A-Za-z' ]+$/)
      }
    }
  })
})

describe('effect lines stay effect lines', () => {
  it('stat relics and boons: at most 60 characters, scope said once ("to team")', () => {
    for (const r of [...RELICS.filter((x) => x.kind === 'stat'), ...allStatCards().map((c) => ({ name: c.title, desc: c.desc }))]) {
      expect(r.desc.length, `${r.name}: ${r.desc}`).toBeLessThanOrEqual(CAPS.statEffect)
      expect(r.desc, r.name).toMatch(/to team$|^Team’s /)
    }
  })

  it('rule relics: one line, at most 100 characters', () => {
    for (const r of RELICS.filter((x) => x.kind === 'rule')) {
      expect(r.desc.length, `${r.name}: ${r.desc}`).toBeLessThanOrEqual(CAPS.ruleEffect)
      expect(r.desc.split('. ').length, r.name).toBe(1)
    }
  })

  it('a pact or curse says its bill in at most 40 characters, and the effect line does not repeat it', () => {
    const pacts = [...RELICS.map((r) => ({ name: r.name, desc: r.desc, downside: r.downside })), ...allStatCards().map((c) => ({ name: c.title, desc: c.desc, downside: c.downside }))]
    for (const p of pacts.filter((x) => x.downside)) {
      expect(p.downside!.length, p.name).toBeLessThanOrEqual(CAPS.bill)
      // Say a fact once: the bill is the warning line, never also in the effect line.
      const bill = p.downside!.replace(/ to team$/, '')
      expect(p.desc, p.name).not.toContain(bill)
    }
  })

  it('skills: one sentence, at most 80 characters', () => {
    for (const k of ALL_SKILLS) expect(k.desc.length, `${k.name}: ${k.desc}`).toBeLessThanOrEqual(CAPS.skill)
  })

  it('mutations: the upside in at most 60 characters', () => {
    for (const m of allMutations()) expect(m.desc.length, `${m.name}: ${m.desc}`).toBeLessThanOrEqual(CAPS.mutation)
  })

  it('the relic note is the one place relics explain themselves', () => {
    expect(RELIC_NOTE).toMatch(/new team members/)
    expect(RELIC_NOTE).toMatch(/stack/)
    for (const r of RELICS) expect(r.desc, r.name).not.toMatch(/rest of (the|your) run|hires included/i)
  })
})

/** Every player-readable string in `src/` (the walk `copy.terms.test.ts` uses). */
function strings(): { text: string; at: string }[] {
  const root = join(__dirname, '..', 'src')
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
    )
  const out: { text: string; at: string }[] = []
  for (const file of files(root)) {
    const src = readFileSync(file, 'utf8')
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const visit = (n: ts.Node) => {
      if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
        out.push({ text: n.text, at: `${relative(root, file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}` })
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return out
}

describe('no scope boilerplate anywhere a player reads', () => {
  const all = strings()
  it('scans the whole tree', () => expect(all.length).toBeGreaterThan(2000))
  for (const bad of BOILERPLATE) {
    it(`no string says ${bad}`, () => {
      expect(all.filter((s) => bad.test(s.text)).map((s) => `${s.at}  ${s.text.trim().slice(0, 90)}`)).toEqual([])
    })
  }
})
