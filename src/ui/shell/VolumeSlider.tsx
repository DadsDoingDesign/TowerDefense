import { sfx } from '../../audio/audio'

/**
 * One volume dial — lifted from the legacy Watchtower (`HubScreen`'s
 * `VolumeSlider`) before that screen is deleted, so the shell's Sound row has
 * real dials instead of two on/off switches (Wave 1).
 *
 * Same contract as the original: 0–1 in, 0–1 out, an integer 0–100 on screen,
 * and a short preview sound on release so the new level is heard, not guessed.
 * Class names are `pg-vol-*` rather than the legacy `vol-*`, because
 * `legacy.css` goes when the legacy screens do.
 */
export function VolumeSlider({
  label,
  value,
  onChange,
  preview,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  preview?: 'click' | 'coin' | 'select'
}) {
  const pct = Math.round(value * 100)
  return (
    <label className="pg-vol">
      <span className="pg-vol-label">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={() => preview && sfx(preview)}
        aria-label={`${label} volume`}
        aria-valuetext={pct === 0 ? `${label} off` : `${pct} percent`}
      />
      <span className="pg-vol-val">{pct === 0 ? 'Off' : pct}</span>
    </label>
  )
}
