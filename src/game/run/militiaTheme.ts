/**
 * ---------------------------------------------------------------------------
 * Your militia's UI theme: which ones it may wear (Oct 2026)
 * ---------------------------------------------------------------------------
 *
 * The designer: "i want allll of the ui to re-theme to the company you chose
 * and then you can unlock theme options for your own company if you get high
 * enough rank with any company".
 *
 * Every contract wears its hiring company's theme (`ui/theme/companyThemes.ts`
 * holds the colours). Your militia — on the Sovereign Route, your own road —
 * wears the one you pick in its builder: the neutral house look, or any
 * company's whose track you have climbed to {@link THEME_LEVEL}. That level is
 * named on the track ahead of time (`track.trackPay`'s `theme`), like the flag
 * piece: a fixed part, never a roll, and cosmetic only — it pays nothing the
 * balance harness reads.
 *
 * Pure: no zustand, React or DOM. `game/` must not import `ui/`, so the ids
 * live here and the UI's colour table is keyed by them.
 */
import { COMPANY_IDS, isCompanyId, type CompanyId } from '../data/companies'

/** A UI theme: the neutral house look, or a company's. */
export type ThemeId = 'neutral' | CompanyId

/** Every theme, neutral first, then the companies in `COMPANY_IDS` order. */
export const THEME_IDS: readonly ThemeId[] = ['neutral', ...COMPANY_IDS]

export const isThemeId = (v: unknown): v is ThemeId => v === 'neutral' || isCompanyId(v)

/**
 * The standing level with a company that unlocks its theme for your militia:
 * 6 of 10 — "high enough rank", past the signature skill at 5, and reached in
 * Term I (standing stays 10 through Term II, so it is never lost).
 */
export const THEME_LEVEL = 6

/** Whether your militia may wear `theme`, given your standing level with each company. */
export function themeOpen(theme: ThemeId, levelOf: (c: CompanyId) => number): boolean {
  return theme === 'neutral' || levelOf(theme) >= THEME_LEVEL
}

/**
 * A saved theme, validated: a known theme your standing has unlocked, else
 * neutral. Standing never falls, so a theme once open stays open.
 */
export function readTheme(raw: unknown, levelOf: (c: CompanyId) => number): ThemeId {
  return isThemeId(raw) && themeOpen(raw, levelOf) ? raw : 'neutral'
}
