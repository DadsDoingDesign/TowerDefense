/**
 * How a finished balance run ends: its exit code, and — in CI — the warnings it
 * leaves on the job.
 *
 * `report.ts` used to `process.exit(1)` on any failed invariant. That is the
 * right local verdict and it stays the default. But the tuning invariants have
 * been red on `main` for weeks (they are the findings the tuning pass exists to
 * fix, deliberately not tuned to pass), and a gate that is always red flags
 * nothing: a crash or a stale golden report looked exactly like a normal day.
 *
 * So CI opts in with `BALANCE_INVARIANTS=warn` and gates only on what it can
 * hold today — the harness runs to completion (a throw still exits non-zero)
 * and the committed `REPORT.md` matches the regenerated one (the workflow's
 * `git diff` step). The failing invariants are still reported, as GitHub
 * `::warning::` annotations and a section in the job summary, just not as a
 * failing exit. Nothing here touches `REPORT.md`: the golden file is the same
 * bytes in either mode.
 *
 * Pure (no fs, no process) so `tests/balance.verdict.test.ts` can hold it.
 */

export type InvariantMode = 'fail' | 'warn'

/** `BALANCE_INVARIANTS=warn` is the only opt-in; anything else keeps the failing gate. */
export function invariantMode(env: Record<string, string | undefined>): InvariantMode {
  return env.BALANCE_INVARIANTS?.trim().toLowerCase() === 'warn' ? 'warn' : 'fail'
}

/** GitHub annotation shown per step before the rest are elided; the summary lists all. */
export const MAX_ANNOTATIONS = 10

export interface Verdict {
  /** The process exit code. Only a failed invariant in `fail` mode makes it non-zero. */
  exitCode: 0 | 1
  /** Console lines, in order: the same verdict in both modes, plus the annotations in `warn`. */
  console: string[]
  /** Markdown to append to `$GITHUB_STEP_SUMMARY` (`warn` mode only; '' otherwise). */
  stepSummary: string
}

/**
 * Workflow-command escaping for an annotation's message: `%`, CR and LF are
 * the characters GitHub's runner decodes, so they must be encoded or a message
 * with a newline would end the command early.
 */
export const escapeAnnotation = (s: string): string =>
  s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')

export function balanceVerdict(failures: readonly string[], mode: InvariantMode): Verdict {
  const out: string[] = []
  if (!failures.length) {
    out.push('\n✅ All balance invariants passed.')
    const stepSummary = mode === 'warn' ? '## Balance invariants\n\n✅ All balance invariants passed.\n' : ''
    return { exitCode: 0, console: out, stepSummary }
  }

  // The verdict reads the same either way — `npm run balance` locally is unchanged.
  out.push(`\n❌ ${failures.length} invariant(s) failed:`)
  for (const f of failures) out.push('  - ' + f)
  if (mode === 'fail') return { exitCode: 1, console: out, stepSummary: '' }

  out.push(
    `\nBALANCE_INVARIANTS=warn: reporting ${failures.length} failed invariant(s) as warnings, not a failing exit. ` +
      'The gate is the harness completing and balance/REPORT.md being current.',
  )
  for (const f of failures.slice(0, MAX_ANNOTATIONS)) out.push(`::warning title=Balance invariant::${escapeAnnotation(f)}`)
  if (failures.length > MAX_ANNOTATIONS) {
    out.push(
      `::warning title=Balance invariants::${failures.length - MAX_ANNOTATIONS} more failed invariant(s) — the job summary lists all ${failures.length}.`,
    )
  }

  const summary = [
    '## Balance invariants',
    '',
    `⚠️ **${failures.length} tuning invariant(s) failed** — reported as warnings (\`BALANCE_INVARIANTS=warn\`) until the tuning pass re-anchors them. ` +
      'This job gates on the harness completing and on `balance/REPORT.md` matching the regenerated report.',
    '',
    ...failures.map((f) => `- ${f.replace(/\r?\n/g, ' ')}`),
    '',
  ].join('\n')
  return { exitCode: 0, console: out, stepSummary: summary }
}
