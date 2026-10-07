/* In-page collector for the Whales conformance scan. Injected with page.evaluate(src).
   Returns raw DOM measurements; pixel sampling and verdicts happen in scan.mjs. */
(() => {
  const VW = innerWidth, VH = innerHeight
  const parse = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const lum = ({ r, g, b }) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 })
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

  // A short, stable-ish selector for reporting.
  const sel = (el) => {
    const parts = []
    let e = el
    for (let i = 0; e && e.nodeType === 1 && i < 4; i++, e = e.parentElement) {
      let s = e.tagName.toLowerCase()
      const cls = [...e.classList].filter((c) => !/^(is-|active$|selected$)/.test(c)).slice(0, 2)
      if (cls.length) s += '.' + cls.join('.')
      parts.unshift(s)
      if (e.classList.length && /^(sh|pg|mn|ct|hq|cx|st|rs)-/.test(e.classList[0]) && i > 0) break
    }
    return parts.join(' > ')
  }
  const visible = (el) => {
    if (!el.getClientRects().length) return false
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return false
    }
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < VH && r.left < VW
  }
  const occluded = (el, x, y) => {
    const top = document.elementFromPoint(x, y)
    return !!top && !(top === el || el.contains(top) || top.contains(el))
  }
  // Inside a scroller whose mask-image fades its bottom edge: how far into the fade is this point?
  const masked = (el, y) => {
    for (let e = el; e; e = e.parentElement) {
      const m = getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage
      if (m && m !== 'none' && /gradient/.test(m)) {
        const r = e.getBoundingClientRect()
        return { sel: sel(e), fromBottom: Math.round(r.bottom - y) }
      }
    }
    return null
  }
  const opacityChain = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o }

  // Effective background: composite ancestors' background-colors bottom-up until opaque.
  // `uncertain` when an image/gradient/canvas/img sits in the chain or behind (elementsFromPoint).
  const effBg = (el, x, y) => {
    const layers = []
    let uncertain = []
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      const c = parse(cs.backgroundColor)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') uncertain.push(`bg-image on ${sel(e)}`)
      if (cs.backdropFilter && cs.backdropFilter !== 'none') uncertain.push(`backdrop-filter on ${sel(e)}`)
      if (c && c.a > 0) { layers.push({ ...c, a: c.a * parseFloat(cs.opacity) }); if (c.a >= 0.999 && parseFloat(cs.opacity) >= 0.999) break }
    }
    // Anything painted under the element at its centre that is not an ancestor (canvas, img, positioned art)
    const stack = document.elementsFromPoint(x, y)
    const idx = stack.findIndex((s) => s === el || s.contains(el) || el.contains(s))
    for (const s of stack.slice(Math.max(0, idx))) {
      if (s.contains(el)) continue
      if (/^(CANVAS|IMG|VIDEO|svg)$/i.test(s.tagName)) { uncertain.push(`${s.tagName.toLowerCase()} behind (${sel(s)})`); break }
      const cs = getComputedStyle(s)
      if (cs.backgroundImage !== 'none' || parse(cs.backgroundColor)?.a > 0) { uncertain.push(`sibling layer behind (${sel(s)})`); break }
    }
    let bg = { r: 32, g: 23, b: 17, a: 1 } // --bg, body fallback
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg)
    return { bg, uncertain: [...new Set(uncertain)] }
  }

  // ---------------- text ----------------
  const texts = []
  const seen = new Set()
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n; (n = tw.nextNode()); ) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim()
    if (!t || !/[\p{L}\p{N}]/u.test(t)) continue
    const el = n.parentElement
    if (!el || seen.has(el) || /^(SCRIPT|STYLE|NOSCRIPT|TITLE)$/.test(el.tagName)) continue
    if (!visible(el)) continue
    const range = document.createRange(); range.selectNodeContents(n)
    const rr = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
    if (!rr.length) continue
    seen.add(el)
    const box = rr.reduce((a, r) => ({ l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) }), { l: 1e9, t: 1e9, r: -1e9, b: -1e9 })
    if (box.b <= 0 || box.t >= VH) continue
    const cs = getComputedStyle(el)
    const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight, 10) || 400
    const col = parse(cs.color) || { r: 0, g: 0, b: 0, a: 1 }
    const op = opacityChain(el)
    const cx = Math.min(VW - 1, Math.max(0, (box.l + box.r) / 2)), cy = Math.min(VH - 1, Math.max(0, (box.t + box.b) / 2))
    if (occluded(el, cx, cy)) continue
    const mk = masked(el, box.b)
    const { bg, uncertain } = effBg(el, cx, cy)
    const fg = over({ ...col, a: col.a * op }, bg)
    const large = fs >= 24 || (fs >= 18.66 && fw >= 700)
    const shadow = cs.textShadow !== 'none'
    const stroke = cs.webkitTextStrokeWidth && parseFloat(cs.webkitTextStrokeWidth) > 0
    texts.push({
      text: t.slice(0, 60), sel: sel(el), fs, fw, large, upper: cs.textTransform === 'uppercase',
      color: hex(col), alpha: +(col.a * op).toFixed(2), fg: hex(fg), bg: hex(bg), domRatio: +ratio(fg, bg).toFixed(2),
      uncertain, shadow, stroke,
      mask: mk, box: { x: Math.round(box.l), y: Math.round(box.t), w: Math.round(box.r - box.l), h: Math.round(box.b - box.t) },
      inViewport: box.t < VH && box.b > 0,
    })
  }

  // ---------------- icons / art ----------------
  const icons = []
  const textOf = (e) => (e ? (e.innerText || '').replace(/\s+/g, ' ').trim() : '')
  const labelOf = (el) => {
    // A visible text label: text in the same row/control (parent, or the nearest button/row ancestor).
    const ctl = el.closest('button,[role=button],a,li,label')
    const p = el.parentElement
    const own = textOf(el)
    const pt = textOf(p).replace(own, '').trim()
    if (pt) return { kind: 'parent-text', text: pt.slice(0, 40) }
    if (ctl && textOf(ctl)) return { kind: 'control-text', text: textOf(ctl).slice(0, 40) }
    // up to two more ancestors (a tile/row wrapper around the icon's own box)
    for (let e = p?.parentElement, i = 0; e && i < 2; e = e.parentElement, i++) {
      const r = e.getBoundingClientRect(), ir = el.getBoundingClientRect()
      if (r.height > Math.max(96, ir.height * 3)) break // left the row: text further away is not this icon's label
      if (textOf(e)) return { kind: 'row-text', text: textOf(e).slice(0, 40) }
    }
    const aria = el.getAttribute('aria-label') || p?.getAttribute('aria-label') || ctl?.getAttribute('aria-label')
    if (aria) return { kind: 'aria-only', text: aria.slice(0, 40) }
    return null
  }
  const iconLike = [...document.querySelectorAll('.fw-i, img, svg, canvas, [class*="glyph"], [class*="icon"], [class*="portrait"], [class*="art"], [class*="mark"], [class*="crest"]')]
  const iseen = new Set()
  for (const el of iconLike) {
    if (iseen.has(el) || !visible(el)) continue
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    if (occluded(el, Math.min(VW - 1, r.left + r.width / 2), Math.min(VH - 1, Math.max(0, r.top + r.height / 2)))) continue
    // skip the battlefield / map canvases (Stage subject, not UI icons)
    const big = r.width * r.height > 160 * 160
    const isStage = !!el.closest('.sh-stage, .sh-stage-wrap') && el.tagName === 'CANVAS'
    const hasPicture = el.tagName !== 'DIV' && el.tagName !== 'SPAN' ? true : (cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)) || el.classList.contains('fw-i')
    const isGlyphText = !hasPicture && textOf(el).length > 0 && textOf(el).length <= 3 // unicode glyph like ★ ▶ ◆
    if (!hasPicture && !isGlyphText) continue
    iseen.add(el)
    icons.push({
      sel: sel(el), tag: el.tagName.toLowerCase(), icon: el.dataset?.icon || null, glyph: isGlyphText ? textOf(el) : null,
      w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top),
      big, isStage, label: labelOf(el), ariaHidden: el.closest('[aria-hidden=true]') ? true : false,
      glyphFs: isGlyphText ? parseFloat(cs.fontSize) : null,
    })
  }

  // ---------------- buttons ----------------
  const CTA = { r: 87, g: 162, b: 182 }
  const near = (a, b) => a && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 24 && a.a > 0.8
  const buttons = []
  for (const b of document.querySelectorAll('button,[role=button],a[href]')) {
    if (!visible(b)) continue
    const r = b.getBoundingClientRect()
    const cs = getComputedStyle(b)
    const bgc = parse(cs.backgroundColor)
    const primary = near(bgc, CTA) || /\b(primary|pg-cta|mn-cta)\b/.test(b.className)
    const ctaFill = near(bgc, CTA)
    const { bg: under } = effBg(b.parentElement || b, r.left + r.width / 2, r.top + r.height / 2)
    const fill = bgc && bgc.a > 0 ? over(bgc, under) : under
    buttons.push({
      name: (b.getAttribute('aria-label') || textOf(b)).slice(0, 70), sel: sel(b), primary, ctaFill,
      disabled: b.disabled || b.getAttribute('aria-disabled') === 'true',
      x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      fill: hex(fill), fillVsGround: +ratio(fill, under).toFixed(2), border: cs.borderTopColor + ' ' + cs.borderTopWidth,
      fs: parseFloat(cs.fontSize), fw: parseInt(cs.fontWeight, 10),
      pressed: b.getAttribute('aria-pressed') || b.getAttribute('aria-selected') || b.getAttribute('aria-current') || null,
      selectedClass: /\b(selected|is-selected|active|is-active|picked|on)\b/.test(b.className),
      inViewport: r.top < VH && r.bottom > 0,
    })
  }

  // ---------------- headings vs body ----------------
  const heads = []
  for (const h of document.querySelectorAll('h1,h2,h3,h4,[class*="title"],[class*="head"],[class*="name"],[class*="kicker"]')) {
    if (!visible(h) || !textOf(h) || h.children.length > 4) continue
    if (/^(HEADER|SECTION|NAV|UL|OL)$/.test(h.tagName)) continue
    if (![...h.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim())) continue // must own its words
    const hcs = getComputedStyle(h)
    const hfs = parseFloat(hcs.fontSize), hfw = parseInt(hcs.fontWeight, 10)
    // body: the text in the same block (parent), outside the heading
    const block = h.parentElement
    if (!block) continue
    let maxBody = 0, bodySel = null, bodyFw = 0, bodyEl = null
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    for (let n; (n = walker.nextNode()); ) {
      const e = n.parentElement
      if (!e || h.contains(e) || !n.nodeValue.trim() || !visible(e)) continue
      if (e.closest('button') && !h.closest('button')) continue
      const ecs = getComputedStyle(e)
      const f = parseFloat(ecs.fontSize)
      if (n.nodeValue.trim().length < 4) continue
      if (f > maxBody) { maxBody = f; bodySel = sel(e); bodyFw = parseInt(ecs.fontWeight, 10); bodyEl = e }
    }
    if (!maxBody) continue
    const r = h.getBoundingClientRect()
    // A label and its value on ONE line ("HELD · Move one hero", "SKILL Volley")
    // is a caption pair, not a title over its body: the rule does not apply.
    const br = bodyEl.getBoundingClientRect()
    if (Math.abs(br.top + br.height / 2 - (r.top + r.height / 2)) < 4 && r.height < 24 && br.height < 24) continue
    heads.push({ text: textOf(h).slice(0, 50), sel: sel(h), fs: hfs, fw: hfw, bodyFs: maxBody, bodyFw, bodySel, y: Math.round(r.top) })
  }

  // ---------------- selection groups ----------------
  const groups = []
  const allBtns = [...document.querySelectorAll('button,[role=button],[role=option],[role=radio],[role=tab]')].filter(visible)
  const byParent = new Map()
  for (const b of allBtns) { const p = b.parentElement; if (!byParent.has(p)) byParent.set(p, []); byParent.get(p).push(b) }
  for (const [p, list] of byParent) {
    if (list.length < 2) continue
    const isSel = (b) => ['true', 'page', 'step'].includes(b.getAttribute('aria-pressed') || b.getAttribute('aria-selected') || b.getAttribute('aria-checked') || b.getAttribute('aria-current') || '') || /\b(selected|is-selected|picked)\b/.test(b.className)
    const sels = list.filter(isSel)
    if (!sels.length) continue
    const desc = (b) => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { name: (b.getAttribute('aria-label') || textOf(b)).slice(0, 30), w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor, border: cs.borderTopColor + ' ' + cs.borderTopWidth, shadow: cs.boxShadow !== 'none', outline: cs.outlineStyle !== 'none' } }
    const others = list.filter((b) => !isSel(b)).map(desc)
    const sizes = others.map((o) => o.w * o.h)
    const spread = sizes.length ? Math.max(...sizes) / Math.max(1, Math.min(...sizes)) : 1
    const styles = new Set(others.map((o) => o.bg + '|' + o.border))
    groups.push({ parent: sel(p), selected: sels.map(desc), others, otherAreaSpread: +spread.toFixed(2), otherStyleVariants: styles.size })
  }

  // ---------------- chrome vs content ----------------
  const CHROME = ['.sh-header', '.pg-head', '.pg-notice', '.sh-coach', '.pg-foot', '.pg-secondary', '.sh-toast', '.receipt-toast', '[class*="banner"]', '.mn-head', '.sh-stage-top', 'nav']
  const intervals = []
  const chromeEls = []
  for (const s of CHROME) for (const e of document.querySelectorAll(s)) {
    if (!visible(e)) continue
    const r = e.getBoundingClientRect()
    const t = Math.max(0, r.top), b = Math.min(VH, r.bottom)
    if (b > t) { intervals.push([t, b]); chromeEls.push({ sel: sel(e), top: Math.round(t), h: Math.round(b - t) }) }
  }
  intervals.sort((a, b) => a[0] - b[0])
  let covered = 0, cur = null
  for (const iv of intervals) { if (!cur || iv[0] > cur[1]) { if (cur) covered += cur[1] - cur[0]; cur = [...iv] } else cur[1] = Math.max(cur[1], iv[1]) }
  if (cur) covered += cur[1] - cur[0]

  // ---------------- spacing (4/8/10/12 scale) ----------------
  const OK = new Set([0, 1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64])
  const spacing = new Map()
  for (const e of document.querySelectorAll('body *')) {
    if (!e.classList.length || !visible(e)) continue
    const cs = getComputedStyle(e)
    for (const prop of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
      const v = parseFloat(cs[prop])
      if (!v || isNaN(v) || v < 0) continue
      if (/margin/.test(prop) && v > 64) continue
      if (!OK.has(Math.round(v * 2) / 2)) {
        const k = sel(e).split(' > ').pop() + ' ' + prop + ':' + v
        spacing.set(k, (spacing.get(k) || 0) + 1)
      }
    }
  }

  // ---------------- art regions (dark-art check is done on pixels) ----------------
  const art = icons.filter((i) => (i.tag === 'canvas' || i.tag === 'img' || /portrait|art/.test(i.sel)) && !i.isStage && i.w >= 24)

  return {
    url: location.href, vw: VW, vh: VH, title: document.querySelector('h1')?.innerText || null,
    texts, icons, buttons, heads, groups, art,
    chrome: { pct: +(100 * covered / VH).toFixed(1), els: chromeEls },
    spacing: [...spacing.entries()].map(([k, n]) => ({ k, n })),
    docHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
  }
})()
