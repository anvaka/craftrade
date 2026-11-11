// Condense <TAG>-audit.json: per device a pass/fail line per screen, then offenders grouped across devices.
//   node tools/exp/mobile/summary.cjs before
const L = require('./lib.cjs');
const tag = process.argv[2] || L.TAG;
const a = require(`${L.OUT}/${tag}-audit.json`);
const HARD = ['offscreen', 'spill', 'smallText', 'clipped', 'unsafe', 'hudOverlap', 'errors'];
const agg = {};
for (const [d, r] of Object.entries(a)) {
  const line = [];
  for (const [k, m] of Object.entries(r)) {
    if (k === '__failed') { line.push('SCRIPT FAILED: ' + m); continue; }
    const hard = (m.overflowX > 0 ? 1 : 0) + HARD.reduce((n, c) => n + m[c].length, 0);
    line.push(`${k}:${hard ? 'FAIL' : 'ok'}${m.smallTargets.length ? ` t${m.smallTargets.length}` : ''}${m.closeTargets.length ? ` c${m.closeTargets.length}` : ''}`);
    if (m.overflowX > 0) (agg[`overflowX ${m.overflowX}px`] = agg[`overflowX ${m.overflowX}px`] || new Set()).add(`${d}/${k}`);
    for (const c of [...HARD, 'smallTargets', 'closeTargets']) for (const x of m[c]) {
      // group: drop the measured pixels and the quoted text so the same rule lands in one bucket
      const key = `${c}: ` + (c === 'unsafe' ? x.replace(/\d+px/g, 'Npx').replace(/ [a-z0-9]+[.\["].*$/, ' ' + (x.includes('scrolled to end') ? '(at end of scroll)' : '(at rest)')) : x.replace(/\[[^\]]*\]/, '').replace(/"[^"]*"/g, '').replace(/^\d+x(\d+)/, 'h$1').replace(/^h(\d+)/, (_, h) => `height ${h}`));
      (agg[key] = agg[key] || new Set()).add(`${d}/${k}`);
    }
    if (m.hud && k === 'run-boss') line.push(`[hud cover ${m.hud.coverPct}% top band ${m.hud.topBandPx}px clear ${m.hud.clearHeightPx}px]`);
  }
  console.log(`${d}: ${line.join('  ')}`);
}
console.log('');
for (const [k, v] of Object.entries(agg).sort()) console.log(`${String(v.size).padStart(3)} screens  ${k}   e.g. ${[...v].slice(0, 2).join(', ')}`);
