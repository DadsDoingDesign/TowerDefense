"""Regenerate PLAN.md from plan.json and critiques.json (run from this folder)."""
import json

plan = json.load(open('plan.json'))
crit = json.load(open('critiques.json'))
S = {s['key']: s for s in crit['screens']}


def where(k):
    s = S[k]
    return s['label'] + (' (desk)' if s['viewport'].startswith('desktop') else '')


L = [
    '# Fieldwatch UI plan — from the Whales critique\n',
    f"Branch `{plan['branch']}` · Whales project **{crit['whales_product']}** · review page: `index.html` (built from `plan.json` and `critiques.json`)\n",
    'Whales critiqued 11 screens from one full run (menu → hero pick → run map → battle → spoils → merchant → defeat) on phone (390×844) and desk (1440×900). The designer confirmed every screen goal.\n',
    '**Status (round 6).** Rounds 1–3 and no hero HP are built; LS3 and LS4 (easy to pick up) are being built. Round 6 lists the calls the builders made, for your review. '
    'Q2, Q6, Q7, Q9, Q11, Q13 and Q14 became the round-4 proposals (skill system, levels, exact stats, spreading fire), '
    'together with the Hall of Champions idea. Q15 is parked.\n',
    'Round-1 screenshots are in `shots/`; the latest build is in `after/`. `scripts/flow-shots.mjs` recaptures both.\n',
]
for st in plan['streams']:
    items = [i for i in plan['items'] if i['stream'] == st['id']]
    if not items:
        continue
    L.append(f"## {st['name']}\n\n{st['blurb']}\n")
    for i in items:
        if i.get('kind') == 'question':
            tag = ' · **blocks progress**' if i.get('blocking') else ''
            L.append(f"### {i['id']} · {i['title']}\n\n*From {i['from']}{tag}*\n")
            L += [f"- {p}" for p in i['proposal']]
            L.append('')
            continue
        src = 'Whales' if i['source'] == 'whales' else 'Claude'
        state = 'done' if i.get('built') else (f"reworked as {i['reworked']}" if i.get('reworked') else 'awaiting your decision')
        L.append(f"### {i['id']} · {i['title']}\n\n*Effort {i['effort']} · from {src} · {state}*\n")
        if i.get('yourNote'):
            L.append('> **Your note on ' + i['replaces'] + ':** ' + i['yourNote'].replace('\n', ' ') + '\n')
        refs = [(k, n) for k, n in i['refs'] if n > 0]
        if refs:
            L.append('**What Whales found (round 1)**\n')
            for k, n in refs:
                r = S[k]['rows'][n - 1]
                L.append(f"- {where(k)} #{n}: **{r['problem']}**. {r['detail']}")
            L.append('')
        L.append('**Proposed change**\n')
        L += [f"- {p}" for p in i['proposal']]
        L.append('')
        if i.get('questions'):
            L.append('**Questions (answered by default when approved)**\n')
            L += [f"{n}. {q}" for n, q in enumerate(i['questions'], 1)]
            L.append('')
        if i['files']:
            L.append('**Files:** ' + ', '.join(f"`{f}`" for f in i['files']) + '\n')
        if i.get('myRead'):
            L.append(f"> **My read, not Whales':** {i['myRead']}\n")
        for key in ('recheck', 'builtNote'):
            if i.get(key):
                L.append(f"**Result:** {i[key]}\n")
L.append('## Whales critiques, round 1 (verbatim)\n')
for s in crit['screens']:
    L.append(f"### {s['label']} · {s['viewport']}\n\n| Before | Latest build |\n|---|---|\n| ![before]({s['shot']}) | ![after]({s['after']}) |\n")
    ids = f"Critique id `{s['critique_id']}`" + (f" · round-1 re-critique `{s['after_critique_id']}`" if s.get('after_critique_id') else '')
    L.append(f"{ids} · goal (confirmed by the designer): \"{s['goal']}\"\n\n{s['summary']}\n")
    L.append('| # | Problem | What to do | Why |\n|---|---|---|---|')
    for n, r in enumerate(s['rows'], 1):
        L.append(f"| {n} | **{r['problem']}**<br>{r['detail']} | {r['fix']} | {r['why']} |")
    L.append('')
    if s['also']:
        L.append('**Also noticed**\n')
        L += [f"- {a}" for a in s['also']]
        L.append('')
    if s.get('note'):
        L.append(f"_Note: {s['note']}_\n")
open('PLAN.md', 'w').write('\n'.join(L))
print('PLAN.md written')
