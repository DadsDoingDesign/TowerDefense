/**
 * copy-inventory — every string a player can read, grouped by surface, each
 * surface with its one job (the copy pass, Oct 2026; `docs/copy/COPY.md`).
 *
 *   npx tsx scripts/copy-inventory.ts                 # writes docs/copy/INVENTORY.md
 *   npx tsx scripts/copy-inventory.ts --json out.json # also dumps the strings
 *   npx tsx scripts/copy-inventory.ts --compare before.json  # counts per surface
 *
 * It reads string literals, template text and JSX text with the TypeScript
 * parser (the same walk as `tests/copy.terms.test.ts`) and keeps what reads as
 * copy: words with a space, or a capitalised word. Ids, class names, CSS,
 * paths, keys, errors and console lines are dropped. It is an inventory, not
 * a gate: a few code strings slip in and a few short labels slip out.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import ts from 'typescript'

const ROOT = join(import.meta.dirname, '..')

/** A surface: where its strings live, and the one job its copy does. */
interface Surface {
  name: string
  job: string
  files: RegExp
}

/** First match wins, so the narrow rows come first. */
export const SURFACES: Surface[] = [
  { name: 'Relics', job: 'Say what a relic does to the team, in a number, and that relics stack and reach new hires (once, as a note).', files: /game\/data\/relics\.ts$|ui\/shell\/relicOffers\.ts$|game\/run\/relics\.ts$/ },
  { name: 'Boons and pacts (stat cards)', job: 'Say the gain and, for a pact, its bill: numbers and what they touch.', files: /game\/data\/rewards\.ts$|game\/run\/rewards\.ts$/ },
  { name: 'Skills', job: 'Say what a skill does to its hero, in numbers, so two can be compared at a glance.', files: /game\/data\/(skills|fusions|infusions)\.ts$|game\/run\/(skills|fusion)\.ts$|ui\/shell\/(SkillCards|SkillPanel|LevelUpPanel|FuseBeat)\.tsx$|ui\/shell\/(levelUps|fuseBeat|skillDrop)\.ts$/ },
  { name: 'Items and gear', job: 'Name the item and say what it does in the hand: its numbers, its quirk.', files: /game\/data\/(items|itemKinds|peopleKinds|gear|describe)\.ts$|game\/run\/inventory\.ts$|ui\/shell\/(PackStrip|gearPlan)\.tsx?$/ },
  { name: 'Mutations', job: 'Say how a mutation changes one hero\'s attack, and its cost.', files: /game\/data\/mutations\.ts$/ },
  { name: 'Enemies', job: 'Name the goblin and the one thing about it that changes how you fight it.', files: /game\/data\/(enemies|enemyKnowledge|behaviours)\.ts$|ui\/shell\/(EnemyCard|EnemyPortrait|enemyFacts|enemyQueue|BossPlate|WaveQueue)\.tsx?$/ },
  { name: 'Ground and hazards', job: 'Say what a tile does to a hero posted on it, in a few words.', files: /game\/data\/(terrain|hazards)\.ts$|game\/run\/terrain\.ts$|ui\/GroundMark\.tsx$|ui\/shell\/NextGround\.tsx$/ },
  { name: 'Shrines', job: 'Say the bargain: what you get, what it costs.', files: /game\/data\/shrines\.ts$/ },
  { name: 'Companies, contracts and asks', job: 'Say what a contract pays, risks and asks, in numbers, before you sign.', files: /game\/data\/companies\.ts$|game\/run\/(contracts|asks|standing|settle|clearance)\.ts$|ui\/shell\/contracts\//},
  { name: 'Loyalty track and liveries', job: 'Say what each standing level pays, by name.', files: /game\/run\/(track|livery|militiaTheme)\.ts$|game\/data\/companyKits\.ts$|ui\/shell\/company\/(TrackScreen|LiveryScreen|trackLink)/ },
  { name: 'Trade war', job: 'Say who leads the season, who pays you at its end, and what desperate terms mean.', files: /game\/run\/tradeWar\.ts$|ui\/shell\/war\/|ui\/shell\/homeSeason\.ts$/ },
  { name: 'Home (map, dock, card)', job: 'Say what the focused road is like and what its next level pays; the CTA opens its terms.', files: /ui\/shell\/(MenuScreen\.tsx|homeCard\.ts|homeDock\.ts|mapFocus\.ts)$|ui\/attract\// },
  { name: 'Militia and the Sovereign Route', job: 'Found and dress your militia; say what the Sovereign Route costs and opens.', files: /ui\/shell\/(MilitiaScreen|useMilitia)|ui\/shell\/company\/FlagCarousel|ui\/shell\/charter\/|game\/run\/(charter|militia|nameFilter)\.ts$|game\/data\/banner\.ts$/ },
  { name: 'HQ and crates', job: 'Say what a building does and costs, and what a crate holds.', files: /ui\/shell\/hq\/|game\/run\/hq\.ts$/ },
  { name: 'Codex', job: 'Name every entry and say what it does; a locked one says how it opens.', files: /ui\/shell\/codex\// },
  { name: 'Stops (merchant, campfire, shrine)', job: 'Say what each offer gives and costs; the keeper says one line.', files: /ui\/shell\/(ShopFront|StopScene|stopScene|campfireOffers)\.tsx?$|game\/run\/(campfire|economy)\.ts$/ },
  { name: 'Liaisons (spoken)', job: 'Character voice: one spoken line, 40 characters at most.', files: /game\/data\/liaisons\.ts$|game\/run\/liaison\.ts$|ui\/shell\/LiaisonScene\.tsx$/ },
  { name: 'Run map and node preview', job: 'Say what a stop is and what it risks or pays, so a road can be chosen.', files: /ui\/components\/RunMapView\.tsx$|ui\/shell\/(NodePreview|encounterPreview)\.tsx?$|game\/data\/runmap\.ts$|game\/run\/map\.ts$/ },
  { name: 'Battle HUD', job: 'Say the state of the fight and the one action now; nothing to read twice mid-wave.', files: /ui\/shell\/(HeaderBand|StageBand|CommandSlot|WaveCeremony|AskToast|AssistedTag|HeroCards|Announcer|live|staging|autoContinue)\.tsx?$|ui\/(BattleCanvas|SlotLayer|battleLedger)\.tsx?$|game\/data\/commands\.ts$/ },
  { name: 'Result and receipt', job: 'Say how the run ended and what it paid, item by item.', files: /ui\/shell\/(DefeatReceipt|FeatsEarned|ProgressEarned)\.tsx$|game\/data\/achievements\.ts$/ },
  { name: 'Offers (spoils, pick cards)', job: 'Say what each offer gives, in the fewest words that let you pick.', files: /ui\/shell\/(offers\.ts|OfferPick\.tsx|PickStrip\.tsx|SelectorBand\.tsx|oneTap\.tsx)$/ },
  { name: 'Hero detail (Context panel)', job: 'Say what the selected hero, item or tile does now, in numbers.', files: /ui\/shell\/(DetailBand|context|InfoToggle)\.tsx?$/ },
  { name: 'Pages and their headers', job: 'Name the page; the CTA names the action.', files: /ui\/shell\/(Page|PageScreens|RootShell|LeaveRun)\.tsx$/ },
  { name: 'Coach and tips', job: 'Teach one thing, once, the first time it matters, in one sentence.', files: /ui\/shell\/(Coach|coachRules|Shortcuts)\.tsx?$|game\/run\/firstRun\.ts$/ },
  { name: 'Glossary and shared labels', job: 'One name and one short meaning per term, shared by every surface.', files: /ui\/channels\.ts$|game\/data\/(glyphs|iconAtlas)\.ts$/ },
  { name: 'Settings and system', job: 'Say what a setting changes; system notices say what happened and what to do.', files: /state\/settingsStore\.ts$|ui\/(ResumeRunPrompt|UpdateNotice|RotatePrompt|ErrorBoundary|fatal)\.tsx?$|ui\/shell\/VolumeSlider\.tsx$/ },
  { name: 'Recruits and heroes', job: 'Name the hero and what it holds.', files: /game\/data\/(sentinels|archetypeTree)\.ts$|game\/run\/(recruits|heroes)\.ts$/ },
  { name: 'Other', job: '—', files: /./ },
]

/** The source the sweep covers: game data, run rules, UI, and settings. */
const DIRS = ['src/game/data', 'src/game/run', 'src/ui', 'src/state/settingsStore.ts']
/** Not player copy: generated tables, art, colour and placement maths. */
const SKIP = /\.generated\.ts$|pixelArt|themeArt|fxWorlds|fxEngine|pixelPen|paintMap|labelLayout|fieldGen|maps\.ts$|waves\.ts$|companyStandard|iconAtlas|fieldSeasons|companyThemes|themeArtDom|useCompanyTheme|fieldZoom|press\.ts$|Icon\.tsx$|pixel\.tsx$/

/** Property names whose values are ids or code, never copy. */
const CODE_KEYS = new Set([
  'id', 'key', 'className', 'class', 'kind', 'icon', 'mark', 'tone', 'rarity', 'slot', 'unlock', 'requires', 'rule', 'type', 'role', 'variant',
  'shape', 'tincture', 'charge', 'pattern', 'metal', 'src', 'href', 'path', 'archetype', 'weapon', 'damageType', 'stat', 'target', 'faction',
  'sprite', 'art', 'scene', 'color', 'colour', 'hue', 'tag', 'from', 'season', 'sound', 'cue', 'focus', 'company', 'ground', 'hazard', 'size',
  'data-testid', 'htmlFor', 'name' /* JSX name= attrs are form names */, 'inputMode', 'autoComplete', 'enterKeyHint', 'step', 'dir',
])

const looksLikeCopy = (s: string): boolean => {
  const t = s.trim()
  if (t.length < 2) return false
  if (!/[A-Za-z]/.test(t)) return false
  if (/^(--|var\(|#|rgba?\(|color-mix|url\(|\.|\/|@|data:|https?:)/.test(t)) return false
  if (/^[a-z0-9_.\-/:]+$/.test(t)) return false // ids, keys, paths
  if (/^[A-Za-z0-9_-]+(\s+[a-z0-9_-]+-[a-z0-9_-]+)+$/.test(t)) return false // class lists
  if (/^[a-z][a-zA-Z0-9]*$/.test(t)) return false // camelCase ids
  if (/[{};]\s*$/.test(t) && /:/.test(t)) return false // CSS
  if (/^(sh|pg|mn|tm|tk|tw|ct|co|hq|cx|pk|ask|lia|shop|rm|th)-/.test(t)) return false // class names
  return /\s/.test(t) || /^[A-Z]/.test(t) || /^[+−\-×]?\d/.test(t)
}

export interface Found {
  file: string
  line: number
  text: string
}

function sources(p: string): string[] {
  const abs = join(ROOT, p)
  if (/\.tsx?$/.test(p)) return [abs]
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(p, e.name)) : /\.tsx?$/.test(e.name) ? [join(abs, e.name)] : [],
  )
}

const propName = (n: ts.Node): string | undefined => {
  const p = n.parent
  if (!p) return
  if (ts.isPropertyAssignment(p) && p.initializer === n) return p.name.getText()
  if (ts.isJsxAttribute(p)) return p.name.getText()
  if (ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent)) return p.parent.name.getText()
  return
}

const skipCall = (n: ts.Node): boolean => {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isNewExpression(p) && /Error$/.test(p.expression.getText())) return true
    if (ts.isCallExpression(p)) {
      const e = p.expression.getText()
      if (/^console\.|^(import|require)$|querySelector|getElementById|classList|addEventListener|setProperty|getPropertyValue|localStorage|matchMedia|\.test$|\.match$|\.replace$|\.split$|startsWith|endsWith|includes$|\.join$|^cx$|^cls$|^clsx$|dispatchEvent|getAttribute|setAttribute/.test(e)) return true
    }
    if (ts.isElementAccessExpression(p) || ts.isCaseClause(p) || ts.isTypeNode(p)) return true
    if (ts.isBinaryExpression(p) && /^(===|!==|==|!=)$/.test(p.operatorToken.getText())) return true
    if (ts.isFunctionLike(p) || ts.isStatement(p)) break
  }
  return false
}

export function scan(): Found[] {
  const files = DIRS.flatMap(sources).filter((f) => !SKIP.test(f) && !f.includes('.test.'))
  const out: Found[] = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const visit = (n: ts.Node) => {
      if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isTypeNode(n)) return
      let text: string | undefined
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n)) text = n.text
      else if (ts.isTemplateExpression(n)) {
        // Keep a template whole, with each hole as {…}, so a line reads as a line.
        text = n.head.text + n.templateSpans.map((s) => `{${s.expression.getText().slice(0, 24)}}${s.literal.text}`).join('')
      }
      if (text !== undefined) {
        const key = propName(n)
        const t = text.replace(/\s+/g, ' ').trim()
        if (!(key && CODE_KEYS.has(key)) && !skipCall(n) && looksLikeCopy(t)) {
          out.push({ file: relative(ROOT, file), line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, text: t })
        }
        if (ts.isTemplateExpression(n)) return
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return out
}

export const surfaceOf = (file: string): Surface => SURFACES.find((s) => s.files.test(file))!

function group(found: Found[]): Map<string, Found[]> {
  const by = new Map<string, Found[]>()
  for (const s of SURFACES) by.set(s.name, [])
  for (const f of found) by.get(surfaceOf(f.file).name)!.push(f)
  return by
}

const avg = (xs: Found[]) => (xs.length ? Math.round(xs.reduce((a, f) => a + f.text.length, 0) / xs.length) : 0)

function inventory(found: Found[]): string {
  const by = group(found)
  const lines = [
    '# Copy inventory',
    '',
    'Generated by `npx tsx scripts/copy-inventory.ts` — do not edit by hand. Every',
    'string a player can read, by surface, each with its one job. The rules the',
    'jobs follow are in [`COPY.md`](COPY.md). The scan is a parser walk with a',
    'filter: a few code strings slip in, and a few one-word labels slip out.',
    '',
    '| Surface | Its copy\'s one job | Strings | Avg chars |',
    '|---|---|---:|---:|',
    ...SURFACES.map((s) => `| ${s.name} | ${s.job} | ${by.get(s.name)!.length} | ${avg(by.get(s.name)!)} |`),
    '',
  ]
  for (const s of SURFACES) {
    const xs = by.get(s.name)!
    if (!xs.length) continue
    lines.push(`## ${s.name}`, '', `**Job:** ${s.job}`, '')
    let file = ''
    for (const f of xs) {
      if (f.file !== file) {
        file = f.file
        lines.push('', `### \`${file}\``, '')
      }
      lines.push(`- L${f.line}: ${f.text.replace(/\|/g, '\\|').slice(0, 220)}`)
    }
    lines.push('')
  }
  return lines.join('\n') + '\n'
}

/** Per surface: strings now, strings whose text changed, and average length before and after. */
function compare(before: Found[], after: Found[]): string {
  const b = group(before)
  const a = group(after)
  const rows = ['| Surface | Strings | Changed | Avg chars before | Avg chars after |', '|---|---:|---:|---:|---:|']
  let tb = 0
  let ta = 0
  let tc = 0
  for (const s of SURFACES) {
    const bs = b.get(s.name)!
    const as = a.get(s.name)!
    const bt = new Set(bs.map((f) => `${f.file}\u0000${f.text}`))
    const at = new Set(as.map((f) => `${f.file}\u0000${f.text}`))
    const changed = Math.max([...bt].filter((x) => !at.has(x)).length, [...at].filter((x) => !bt.has(x)).length)
    tb += bs.reduce((x, f) => x + f.text.length, 0)
    ta += as.reduce((x, f) => x + f.text.length, 0)
    tc += changed
    rows.push(`| ${s.name} | ${as.length} | ${changed} | ${avg(bs)} | ${avg(as)} |`)
  }
  rows.push(`| **All** | ${after.length} | ${tc} | ${Math.round(tb / before.length)} | ${Math.round(ta / after.length)} |`)
  return rows.join('\n')
}

const args = process.argv.slice(2)
const found = scan()
const out = join(ROOT, 'docs/copy/INVENTORY.md')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, inventory(found))
console.log(`copy-inventory: ${found.length} strings → docs/copy/INVENTORY.md`)
const ji = args.indexOf('--json')
if (ji >= 0) writeFileSync(args[ji + 1], JSON.stringify(found, null, 1))
const ci = args.indexOf('--compare')
if (ci >= 0) console.log(compare(JSON.parse(readFileSync(args[ci + 1], 'utf8')) as Found[], found))
