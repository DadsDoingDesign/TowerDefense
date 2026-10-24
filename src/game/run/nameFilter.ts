/**
 * ---------------------------------------------------------------------------
 * A company name the player types (Oct 2026: "you can make any name you want
 * but use a profanity filter")
 * ---------------------------------------------------------------------------
 *
 * Pure. `checkCompanyName` normalises a typed name (spaces, length, the
 * characters a name may hold) and refuses one that spells profanity or a slur
 * — after undoing leetspeak (`5h1t`), spacing (`f u c k`) and stretched
 * letters (`fuuuck`). Two lists, so a filter does not trip on innocent words:
 *
 *  - STEMS match anywhere in the name with its spaces and symbols removed
 *    (long, unambiguous stems: they turn up inside nothing a company would be
 *    called);
 *  - WORDS match only a whole word, for short stems that do hide inside real
 *    ones ("Spice", "Peacock", "Horsemen", "Torpedo", "Thorny", "Therapist").
 *
 * The lists are ROT13 in the source so the file reads clean; they are decoded
 * once on load. The refusal never repeats the word it found.
 */
const rot13 = (s: string) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97))

const STEMS = 'shpx fuvg phag avttre avttn snttbg ovgpu juber fyhg anmv uvgyre ergneq chffl cravf intvan cbea wvmm gjng obyybpx qvyqb zbyrfg cnrqb vaprfg nffubyr cvff xvxr pbpxfhpx zbgures onfgneqb betnfz oybjwbo unaqwbo genaal furznyr ornare jrgonpx fxnax'
  .split(' ')
  .map(rot13)
const WORDS = new Set(
  'nff nefr snt sntf pbpx pbpxf qvpx qvpxf phz gvg gvgf fcvp puvax tbbx jbc nany nahf xxx ubzb frk encr encrq obbo obbof gbffre wnc anmvf yrfob fzhg gheq ohggubyr zvys gubg crqb crqbf arteb pbba pbbaf cevpx cevpxf pyvg frzra qlxr urvy encvfg encvfgf ubeal jnax jnaxre jnaxref'
    .split(' ')
    .map(rot13),
)

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', $: 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '6': 'g' }

/** Lower case, accents off, leetspeak undone. */
function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[0-9!|@$+]/g, (c) => LEET[c] ?? c)
}
/**
 * A stem as a pattern that forgives stretched letters but not missing ones:
 * each run of a letter may repeat ("fuuuck"), a doubled letter must stay at
 * least doubled (so a short stem does not turn up inside "Therapists").
 */
const stretch = (stem: string) =>
  new RegExp(
    stem
      .match(/(.)\1*/g)!
      .map((run) => `${run[0]}{${run.length},}`)
      .join(''),
  )
const STEM_RES = STEMS.map(stretch)
const WORD_RES = [...WORDS].map((w) => new RegExp(`^${stretch(w).source}$`))

/**
 * Whether the text spells something the filter refuses. A stem is looked for
 * inside each word (never across a space: "Kestrelholt Watch" is innocent);
 * a short word must be a whole word. Letters typed apart ("f u c k", "fu ck")
 * are read together.
 */
export function isProfane(text: string): boolean {
  const words = fold(text).split(/[^a-z]+/).filter(Boolean)
  const spaced: string[] = []
  let run = ''
  for (const w of words) {
    if (w.length <= 2) run += w
    else {
      if (run) spaced.push(run)
      run = ''
    }
  }
  if (run) spaced.push(run)
  const candidates = [...words, ...spaced.filter((r) => r.length >= 3)]
  return candidates.some((w) => STEM_RES.some((re) => re.test(w)) || WORD_RES.some((re) => re.test(w)))
}

export const NAME_MIN = 3
export const NAME_MAX = 32

export type NameCheck = { ok: true; name: string } | { ok: false; why: string }

/**
 * A typed company name, cleaned — or why not. Letters (any alphabet), digits,
 * spaces and `' - . &`; 3–32 characters; at least one letter; no profanity.
 */
export function checkCompanyName(raw: unknown): NameCheck {
  if (typeof raw !== 'string') return { ok: false, why: 'Give your militia a name.' }
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (name.length < NAME_MIN) return { ok: false, why: `At least ${NAME_MIN} letters.` }
  if (name.length > NAME_MAX) return { ok: false, why: `At most ${NAME_MAX} characters.` }
  if (!/^[\p{L}\p{N} '\-.&]+$/u.test(name)) return { ok: false, why: 'Letters, numbers, spaces and - \' . & only.' }
  if (!/\p{L}/u.test(name)) return { ok: false, why: 'A name needs a letter or two.' }
  if (isProfane(name)) return { ok: false, why: 'That name isn’t allowed. Try another.' }
  return { ok: true, name }
}
