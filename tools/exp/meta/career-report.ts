// Tables from career JSON files. npx tsx tools/exp/meta/career-report.ts <dir>
import { readdirSync, readFileSync } from 'node:fs';
import { mean, table } from './lib.ts';
const dir = process.argv[2];
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const groups = new Map<string, any[]>();
for (const f of files) { const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')); const k = `${d.skill} / ${d.policy}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(d); }
const marks = [1, 3, 5, 10, 20, 30, 50, 75, 100, 150];
for (const [k, ds] of groups) {
  const maxN = Math.min(...ds.map((d) => d.rows.length));
  const rows = marks.filter((n) => n <= maxN).map((n) => {
    const at = ds.map((d) => d.rows[n - 1]);
    const win = (lo: number) => mean(ds.flatMap((d) => d.rows.slice(lo, n).map((r: any) => r.won)));
    const lo = Math.max(0, n - 10);
    return {
      run: n, 'win% (last 10)': Math.round(100 * win(lo)), marks: Math.round(mean(at.map((r) => r.marks))), raws: Math.round(mean(at.map((r) => r.raws))),
      stash: mean(at.map((r) => r.stash)).toFixed(1), 'kit pts used': Math.round(mean(at.map((r) => r.kit))), 'stash top 2 pts': Math.round(mean(at.map((r) => r.top2))),
      standing: Math.round(mean(at.map((r) => r.standing))), 'station tiers (4-20)': mean(at.map((r) => r.stations)).toFixed(1), finds: Math.round(mean(at.map((r) => r.finds))),
      chars: at[0].chars, feats: at[0].feats,
    };
  });
  const all = ds.flatMap((d) => d.rows);
  console.log(`\n### ${k} (${ds.length} career${ds.length > 1 ? 's' : ''}, ${maxN} runs)\n`);
  console.log(table(rows));
  console.log(`\noverall win rate ${Math.round(100 * mean(all.map((r: any) => r.won)))}%; per run: +${Math.round(mean(all.map((r: any) => r.gainedMarks)))} marks, +${Math.round(mean(all.map((r: any) => r.gainedRaws)))} raws, +${mean(all.map((r: any) => r.gainedItems)).toFixed(2)} items; town maxed at run ${ds.map((d) => d.townDoneRun).join(', ')}; town fusions ${ds.map((d) => d.townFuses).join(', ')} (first finds ${ds.map((d) => d.firsts).join(', ')}, charge refreshes ${ds.map((d) => d.refreshes).join(', ')}); raws bought from Factor ${ds.map((d) => d.bought).join(', ')}; ledger audit ${ds.every((d) => d.auditOk) ? 'ok' : 'MISMATCH'}`);
  const led: Record<string, { marks: number; raws: number }> = {};
  for (const d of ds) for (const l of d.ledger) { led[l.kind] ??= { marks: 0, raws: 0 }; led[l.kind].marks += l.marks / ds.length; led[l.kind].raws += l.raws / ds.length; }
  console.log('ledger (mean per career): ' + Object.entries(led).map(([kk, v]) => `${kk} marks ${Math.round(v.marks)} raws ${Math.round(v.raws)}`).join('; '));
}
