// Before/after table from the two audit files: per device, screens passing, and offender totals per check.
//   node tools/exp/mobile/compare.cjs
const L = require('./lib.cjs');
const CATS = ['overflowX', 'offscreen', 'spill', 'smallText', 'clipped', 'unsafe', 'hudOverlap', 'errors', 'smallTargets', 'closeTargets'];
const HARD = CATS.slice(0, 8);
const load = (t) => require(`${L.OUT}/${t}-audit.json`);
const sum = (a) => {
  const out = {};
  for (const [d, r] of Object.entries(a)) {
    const o = out[d] = { screens: 0, pass: 0, failed: [], cat: Object.fromEntries(CATS.map((c) => [c, 0])) };
    for (const [k, m] of Object.entries(r)) {
      if (k === '__failed') { o.failed.push('SCRIPT: ' + m); continue; }
      o.screens++;
      let hard = 0;
      for (const c of CATS) { const n = c === 'overflowX' ? (m.overflowX > 0 ? 1 : 0) : (m[c] || []).length; o.cat[c] += n; if (HARD.includes(c)) hard += n; }
      if (hard) o.failed.push(k); else o.pass++;
    }
  }
  return out;
};
const b = sum(load('before')), a = sum(load('after'));
console.log('device          | screens passing (before -> after) | ' + CATS.map((c) => c).join(' | '));
for (const d of Object.keys(b)) {
  const x = b[d], y = a[d] || { pass: '?', screens: '?', cat: {}, failed: [] };
  console.log(`${d.padEnd(15)} | ${x.pass}/${x.screens} -> ${y.pass}/${y.screens} | ` + CATS.map((c) => `${x.cat[c]} -> ${y.cat[c]}`).join(' | '));
  if (y.failed.length) console.log(`   still failing after: ${y.failed.join(', ')}`);
}
