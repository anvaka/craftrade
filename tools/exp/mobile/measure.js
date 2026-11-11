// Runs inside the page. Returns layout offenders for whatever is on screen.
// insets: the safe area the device would report (css px); Chromium cannot draw a notch, so we test geometry.
(insets, tag) => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const out = { vw, vh, overflowX: 0, offscreen: [], spill: [], smallText: [], smallTargets: [], closeTargets: [], clipped: [], unsafe: [], hud: null };
  const visible = (e) => {
    if (!e.getClientRects().length) return false;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    for (let p = e; p; p = p.parentElement) if (p.hidden) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const name = (e) => {
    const t = (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    const cls = typeof e.className === 'string' ? e.className.split(' ').filter(Boolean).slice(0, 3).join('.') : '';
    return `${e.tagName.toLowerCase()}${cls ? '.' + cls : ''}${e.dataset && e.dataset.fk ? '[' + e.dataset.fk + ']' : ''} "${t}"`;
  };
  const scrollerOf = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) return p; } return null; };
  const scrollsX = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1) return true; } return false; };

  // 1. horizontal overflow
  const de = document.documentElement;
  out.overflowX = Math.max(de.scrollWidth, document.body.scrollWidth) - vw;
  for (const sc of document.querySelectorAll('.g-bench, .g-end, .g-pause')) if (visible(sc) && sc.scrollWidth > sc.clientWidth + 1) out.overflowX = Math.max(out.overflowX, sc.scrollWidth - sc.clientWidth);
  const all = [...document.body.querySelectorAll('*')].filter(visible);
  for (const e of all) {
    if (e.closest('.g-stick') || e.tagName === 'CANVAS' && e.classList.contains('g-canvas')) continue;
    const r = e.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !scrollsX(e)) out.offscreen.push(`${name(e)} x=${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  // 2. text under 12px
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const e = n.parentElement;
    if (!e || seen.has(e) || !visible(e) || e.closest('script,style,noscript')) continue;
    seen.add(e);
    // 5b. text that has run out of the ruled or filled box it belongs to
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      const boxed = parseFloat(ps.borderLeftWidth) + parseFloat(ps.borderRightWidth) > 0 || (ps.backgroundColor !== 'rgba(0, 0, 0, 0)' && ps.backgroundColor !== 'transparent');
      if (!boxed || p.tagName === 'TD' || p.tagName === 'TH' || p.tagName === 'TR') continue;
      const range = document.createRange(); range.selectNodeContents(n);
      const tr = range.getBoundingClientRect(), br = p.getBoundingClientRect();
      if (tr.width && (tr.right > br.right + 1.5 || tr.left < br.left - 1.5)) out.spill.push(`${name(e)} out of ${name(p).split(' "')[0]} by ${Math.round(Math.max(tr.right - br.right, br.left - tr.left))}px`);
      break;
    }
    const fs = parseFloat(getComputedStyle(e).fontSize);
    if (fs < 12) out.smallText.push(`${fs}px ${name(e)}`);
    // 5a. text clipped by its own box
    const cs = getComputedStyle(e);
    if ((cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 1) out.clipped.push(`${name(e)} ${e.scrollWidth}>${e.clientWidth}`);
  }
  // 3. tap targets
  const targets = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"], summary')].filter(visible)
    .filter((e) => { // topmost at its centre (not covered by an overlay)
      const r = e.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > vw || cy > vh) return true;
      const top = document.elementFromPoint(cx, cy); return !top || e.contains(top) || top.contains(e) || !!top.closest('label');
    });
  const rects = targets.map((e) => e.getBoundingClientRect());
  targets.forEach((e, i) => {
    const r = rects[i];
    if (r.width < 43.5 || r.height < 43.5) out.smallTargets.push(`${Math.round(r.width)}x${Math.round(r.height)} ${name(e)}`);
  });
  for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
    const a = rects[i], b = rects[j];
    const dx = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
    const dy = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
    const d = Math.hypot(dx, dy);
    if (d < 7.5 && !targets[i].contains(targets[j]) && !targets[j].contains(targets[i])) out.closeTargets.push(`${Math.round(d)}px ${name(targets[i])} | ${name(targets[j])}`);
  }
  // 4. safe area: anything readable or tappable inside the inset bands, measured at rest (scroll 0) and for fixed/sticky things
  if (insets) {
    const band = (r) => (r.top < insets.top - 0.5 && r.bottom > 0 ? `top ${Math.round(insets.top - r.top)}px` : '') + (r.bottom > vh - insets.bottom + 0.5 && r.top < vh ? ` bottom ${Math.round(r.bottom - (vh - insets.bottom))}px` : '') +
      (r.left < insets.left - 2.5 ? ` left ${Math.round(insets.left - r.left)}px` : '') + (r.right > vw - insets.right + 2.5 ? ` right ${Math.round(r.right - (vw - insets.right))}px` : '');
    const leaf = [...seen, ...targets];
    const done = new Set();
    for (const e of leaf) {
      if (done.has(e)) continue; done.add(e);
      const r = e.getBoundingClientRect();
      const sc = scrollerOf(e);
      // Pinned = fixed or sticky inside its scroller, or part of the HUD. Everything else scrolls.
      let pinned = !!e.closest('.g-hud, .g-teach, .g-pause');
      for (let p = e; p && p !== sc && p !== document.body && !pinned; p = p.parentElement) { const ps = getComputedStyle(p).position; if (ps === 'fixed' || ps === 'sticky') pinned = true; }
      const scrolls = !!sc || de.scrollHeight > vh + 1;
      const atTop = sc ? sc.scrollTop < 1 : window.scrollY < 1;
      const atEnd = sc ? sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1 : window.scrollY + vh >= de.scrollHeight - 1;
      let b = band(r);
      if (scrolls && !pinned) {
        // Scrolling content only has to clear the top inset at rest and the bottom inset at the very end.
        if (!atTop) b = b.replace(/top \d+px/, '');
        if (!atEnd) b = b.replace(/ bottom \d+px/, '');
      }
      if (b.trim()) out.unsafe.push(`${b.trim()} ${name(e)}${tag || ''}`);
    }
  }
  // 6. the HUD against the play field
  const hud = document.querySelector('.g-hud');
  if (hud && visible(hud)) {
    const boxes = [...hud.children].filter(visible).map((e) => ({ n: name(e), r: e.getBoundingClientRect() }));
    const teach = document.querySelector('.g-teach'); if (teach && visible(teach)) boxes.push({ n: 'teach', r: teach.getBoundingClientRect() });
    let area = 0; for (const b of boxes) area += b.r.width * b.r.height;
    const run = window.__run; let player = null;
    const overlaps = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r;
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps.push(`${boxes[i].n} x ${boxes[j].n}`);
    }
    const top = Math.max(0, ...boxes.filter((b) => b.r.top < vh / 2).map((b) => b.r.bottom));
    const bottom = Math.min(vh, ...boxes.filter((b) => b.r.top >= vh / 2).map((b) => b.r.top));
    out.hud = { coverPct: +(100 * area / (vw * vh)).toFixed(1), topBandPx: Math.round(top), bottomBandFromPx: Math.round(bottom), clearHeightPx: Math.round(bottom - top), overlaps,
      centreCovered: boxes.filter((b) => b.r.left < vw / 2 + 24 && b.r.right > vw / 2 - 24 && b.r.top < vh / 2 + 30 && b.r.bottom > vh / 2 - 30).map((b) => b.n) };
  }
  for (const k of ['offscreen', 'spill', 'smallText', 'smallTargets', 'closeTargets', 'clipped', 'unsafe']) out[k] = [...new Set(out[k])];
  return out;
}
