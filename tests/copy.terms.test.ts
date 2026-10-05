import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * LS4 — one name per thing, held by a grep.
 *
 * Every string a player can read — string literals, template text and JSX
 * text, across `src/` — is checked for the names the game retired:
 *
 *  - the playable units are **heroes**, never "Sentinels" or "towers", and
 *    never "the company" (the group is "your heroes");
 *  - the run's difficulty multiplier is **"Enemy strength +N%"**, never
 *    "Threat ×1.06" — "Threat" now names only the targeting order;
 *  - the meta currency is **Marks**; "Watch Marks" is said once, where it is
 *    explained ("Watch Marks (Marks)").
 *
 * Comments and code identifiers are not player-facing and are not checked.
 * The allow-list is short on purpose, and each entry says why.
 */
const ROOT = join(__dirname, '..', 'src')

const RULES: { name: string; bad: RegExp; allow?: (text: string) => boolean }[] = [
  {
    name: 'Sentinel(s) — say "hero(es)"',
    bad: /\bSentinels?\b/,
    // A specialization's proper name ("Sentinel of Order"), not the unit.
    allow: (t) => t.trim() === 'Sentinel of Order',
  },
  { name: 'tower(s) — say "hero(es)"', bad: /\btowers?\b/i },
  {
    // Case-sensitive: `company` is also an atlas icon key. Proper names that
    // mean the group ("Full Company", "Free Companies") are fine.
    name: 'the company — say "your heroes"',
    bad: /\b([Tt]he|[Ww]hole|[Yy]our|[Aa]) company\b|\bcompany (is|full)\b|^Company\b/,
  },
  {
    name: 'Threat as the difficulty — say "Enemy strength +N%"',
    bad: /\bThreat\b/,
    // The targeting order is called Threat: its label, its full name, and the
    // counter lines that point the player at it.
    allow: (t) => t.trim() === 'Threat' || /Threats first|Threat targeting/.test(t),
  },
  {
    // The classless rework: there are no classes. A hero is what it holds —
    // "swings a sword", "shoots a bow", "casts magic". The old names survive
    // only as the legacy evolution tree's node names (data the balance benches
    // build from, never shown) — `archetypeTree.ts` is allowed by file below.
    name: 'Fighter / Rogue / Mystic — say what the hero holds',
    bad: /\b(Fighters?|Rogues?|Mystics?)\b/,
    // A skill's `from` line — which retired perk it replaced — is provenance
    // for designers (`data/skills.ts`), never printed.
    allow: (t) => /\bperk\b/.test(t),
  },
  {
    name: 'Watch Marks — say "Marks" (after the one explanation)',
    bad: /\bWatch Marks?\b/,
    allow: (t) => /Watch Marks \(Marks\)/.test(t),
  },
]

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  )
}

/** Every player-readable string in one file, with its line. */
function strings(file: string): { text: string; line: number }[] {
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: { text: string; line: number }[] = []
  const visit = (n: ts.Node) => {
    // Module specifiers are paths, not copy.
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n) ||
      ts.isJsxText(n)
    ) {
      out.push({ text: n.text, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

describe('one name per thing (LS4)', () => {
  const all = sources(ROOT).flatMap((f) => strings(f).map((s) => ({ ...s, file: relative(ROOT, f) })))

  it('scans the whole tree', () => {
    expect(all.length).toBeGreaterThan(2000)
  })

  for (const rule of RULES) {
    it(`no player-facing string uses a retired name: ${rule.name}`, () => {
      const hits = all
        .filter((s) => rule.bad.test(s.text) && !(rule.allow?.(s.text) ?? false))
        // The legacy evolution tree: node names the balance benches read, never shown.
        .filter((s) => !(rule.name.startsWith('Fighter') && s.file === join('game', 'data', 'archetypeTree.ts')))
        .map((s) => `${s.file}:${s.line}  ${s.text.trim().slice(0, 100)}`)
      expect(hits).toEqual([])
    })
  }
})
