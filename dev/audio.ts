// Soundboard for src/audio.ts. Open /dev/audio.html on the Vite dev server.
// Top to bottom: where you are (bed and echo), the music and what drives it, gathering, arena events,
// stingers, interface sounds, then offline renders with measurements (also used headless: window.__lab).
import { Sound } from '../src/audio';
import { COMP_TRIM, SPACES, type SpaceId } from '../src/audio/core';
import { PLACES, type Ground, type Place } from '../src/audio/beds';
import { MUSIC_MODES, STINGERS, type MusicMode, type Station, type Stinger } from '../src/audio/music';
import { strike, type NodeSound } from '../src/audio/impacts';
import { BED_SLOTS, HIT_SLOTS, type Candidate } from '../src/audio/samples';
import type { GameEvent } from '../src/game';

const sound = new Sound();
// ?base=http://localhost:4198/ serves the recordings from somewhere other than public/audio/ (for testing)
const baseParam = new URLSearchParams(location.search).get('base');
if (baseParam) sound.samplesBase = baseParam;
const GROUNDS: Ground[] = ['quarry', 'grove', 'marsh'];
const TOD = ['day', 'dusk', 'night'];
const BEATS = ['lull', 'swell', 'peak'];

// what the board is set to
const st = { place: 'quarry' as Place, tod: 0, ground: 'quarry' as Ground, mode: 'arena' as MusicMode, beat: 0, heat: 0, enemies: 0, paused: false, tier: 1 };

// ------------------------------------------------------------------- page
const root = document.getElementById('root')!;
const top = document.getElementById('top')!;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, text = '', cls = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (cls) e.className = cls;
  parent.appendChild(e);
  return e;
}
function section(title: string, note = ''): HTMLElement {
  const h = el('h2', root, title);
  if (note) el('small', h, note);
  return el('div', root);
}
function row(parent: HTMLElement, label = ''): HTMLElement {
  const r = el('div', parent, '', 'row');
  if (label) el('b', r, label);
  return r;
}
function btn(parent: HTMLElement, label: string, fn: () => void): HTMLButtonElement {
  const b = el('button', parent, label);
  b.addEventListener('click', () => {
    sound.init();
    fn();
  });
  return b;
}
/** A row of buttons of which one is lit. */
function choice<T>(parent: HTMLElement, label: string, opts: readonly T[], get: () => T, set: (v: T) => void, name: (v: T) => string = String): () => void {
  const r = row(parent, label);
  const bs = opts.map((o) => btn(r, name(o), () => {
    set(o);
    paint();
    apply();
  }));
  const paint = (): void => bs.forEach((b, i) => b.classList.toggle('on', opts[i] === get()));
  paint();
  return paint;
}
function slider(parent: HTMLElement, label: string, min: number, max: number, get: () => number, set: (v: number) => void): () => void {
  const l = el('label', parent, '', 'sl');
  el('span', l, label);
  const i = el('input', l);
  i.type = 'range';
  i.min = String(min);
  i.max = String(max);
  i.value = String(get());
  const o = el('output', l, String(get()));
  i.addEventListener('input', () => {
    set(Number(i.value));
    o.textContent = i.value;
  });
  return () => {
    i.value = String(get());
    o.textContent = i.value;
  };
}
const repaint: (() => void)[] = [];

/** Push the board's settings into the sound engine. */
function apply(): void {
  if (!sound.core) return;
  sound.scene(st.place, st.tod, st.ground, st.mode);
  sound.music.setState(st.beat, st.heat / 100);
}

// ---------------------------------------------------------------- the top
document.getElementById('start')!.addEventListener('click', () => {
  sound.init();
  document.getElementById('gate')!.remove();
  apply();
  watch();
  void whenSettled().then(paintRecordings);
});
{
  const r = row(top);
  const mute = btn(r, '', () => {
    sound.toggleMute();
    mute.textContent = sound.muted ? 'Sound is off' : 'Sound is on';
  });
  mute.textContent = sound.muted ? 'Sound is off' : 'Sound is on';
  slider(r, 'Music', 0, 10, () => sound.volume.music, (v) => {
    sound.setVolume('music', v);
    apply(); // at 0 the music is not running at all; above 0 it starts
  });
  slider(r, 'Ambience', 0, 10, () => sound.volume.amb, (v) => sound.setVolume('amb', v));
  btn(r, 'Silence everything', () => {
    st.place = 'none';
    st.mode = 'off';
    st.enemies = 0;
    stress = 0;
    repaint.forEach((f) => f());
    apply();
  });
  el('div', top, '', '').id = 'meter';
}

// ------------------------------------------------------------- recordings
const WHAT: Record<string, string> = {
  quarry: 'open stone and wind', grove: 'forest', marsh: 'water and reeds', town: 'the town outside the benches', forge: 'fire, bellows, iron', workshop: 'wood being worked',
  apothecary: 'a pot, glass', camp: 'a fire in the open', night: 'insects, laid over a ground or the camp at dusk (half) and at night (full)',
  pick: 'pick on rock', crumble: 'a vein breaking', axe: 'axe on wood', treefall: 'a tree coming down', sickle: 'blade through reeds or grass', reedfall: 'the stand of reeds going over',
  anvil: 'craft complete at the forge', saw: 'craft complete at the workshop', brew: 'craft complete at the apothecary', 'pickup-stone': 'picking up ore', 'pickup-wood': 'picking up wood', 'pickup-plant': 'picking up reeds',
};
const recBox = section('Recordings', 'the candidates for each sound: play them, compare with the synthesised one, choose');
el('p', recBox, 'Press "Start audio" to list the recordings.', 'note');
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function whenSettled(): Promise<void> {
  for (let i = 0; i < 80 && !sound.samples.settled; i++) await wait(50);
}
/** Load every file of a candidate and wait for it; returns what was measured in each. */
async function loaded(c: Candidate, bed: boolean): Promise<string> {
  const out: string[] = [];
  for (const f of c.files) {
    let e = sound.samples.entry(f, bed);
    for (let i = 0; i < 200 && e.state === 'loading'; i++) {
      await wait(50);
      e = sound.samples.entry(f, bed);
    }
    out.push(e.state === 'ready' ? `${e.buf.duration.toFixed(1)} s, ${e.buf.numberOfChannels === 1 ? 'mono' : 'stereo'}, peak ${e.peakDb} dBFS, rms ${e.rmsDb}, played at ${(20 * Math.log10(e.gain)).toFixed(1)} dB` : e.state === 'failed' ? `FAILED to load ${f}: ${e.why}` : `still loading ${f}`);
  }
  return out.join(' | ');
}
let playing = 0; // counts up on every Play, so that a sequence still running knows it has been replaced
function stopRecordings(): void {
  playing++;
  sound.samples.preview = {};
  sound.samples.version++;
  sound.beds.audition(null);
  st.place = 'none';
  repaint.forEach((f) => f());
  apply();
}
/** Play a slot the way the game would, with whatever is being auditioned for it. */
function trigger(slot: string, i: number): void {
  const c = sound.core!;
  if (slot === 'pick') hit('ore', false, false, i);
  else if (slot === 'crumble') hit('ore', false, true, 2);
  else if (slot === 'axe') hit('wood', false, false, i);
  else if (slot === 'treefall') hit('wood', false, true, 2);
  else if (slot === 'sickle') hit('herb', false, false, i);
  else if (slot === 'reedfall') hit('herb', false, true, 2);
  else if (slot === 'anvil' || slot === 'saw' || slot === 'brew') {
    const bench = slot === 'anvil' ? 'forge' : slot === 'saw' ? 'workshop' : 'apothecary';
    if (!sound.samples.hit(slot, c.jingle, c.now, { vol: 0.8 })) sound.jingle('craft', bench);
  } else ev({ t: 'pickup', x: 0, y: 0, part: false, mat: slot === 'pickup-stone' ? 'iron' : slot === 'pickup-wood' ? 'greenwood' : 'reed' });
}
async function play(slot: string, id: string, bed: boolean, line: HTMLElement): Promise<void> {
  const mine = ++playing;
  const s = sound.samples;
  const c = s.slots[slot]?.find((x) => x.id === id);
  s.preview = {};
  if (bed) {
    if (c) {
      line.textContent = 'loading...';
      line.textContent = await loaded(c, true);
      if (mine !== playing) return;
      st.place = 'none';
      repaint.forEach((f) => f());
      apply();
      sound.beds.audition(c.files[0]);
    } else {
      // the synthesised bed of that place; the night layer has none of its own, so it is heard as the grove at night
      s.audition(slot === 'night' ? 'grove' : slot, 'synth');
      sound.beds.audition(null);
      st.place = slot === 'night' ? 'grove' : (slot as Place);
      if (slot === 'night') st.tod = 2;
      repaint.forEach((f) => f());
      apply();
    }
    return;
  }
  s.audition(slot, id);
  if (c) {
    line.textContent = 'loading...';
    line.textContent = await loaded(c, false);
  }
  const falls = slot === 'crumble' || slot === 'treefall' || slot === 'reedfall';
  const pick = slot.startsWith('pickup');
  const n = falls ? 2 : pick ? 6 : slot === 'anvil' || slot === 'saw' || slot === 'brew' ? 3 : 5;
  for (let i = 0; i < n && mine === playing; i++) {
    s.audition(slot, id); // another Play may have ended this audition
    trigger(slot, i);
    await wait(falls ? 2600 : pick ? 120 : 800);
  }
}
function paintRecordings(): void {
  const s = sound.samples;
  recBox.textContent = '';
  const r = row(recBox);
  btn(r, 'Stop', stopRecordings);
  btn(r, 'Reload manifests', () => void s.reload().then(paintRecordings));
  const copy = btn(r, 'Copy my choices', () => {
    const text = JSON.stringify(s.choice);
    box.value = text;
    void navigator.clipboard.writeText(text).then(() => (copy.textContent = 'Copied'), () => (copy.textContent = 'Copy failed: select the text'));
  });
  const box = el('input', r);
  box.readOnly = true;
  box.value = JSON.stringify(s.choice);
  box.style.cssText = 'flex:1;min-width:260px;background:#14171c;color:#c7ced6;border:1px solid #323a45;padding:6px;font:12px ui-monospace,Menlo,monospace';
  box.setAttribute('aria-label', 'Your choices as JSON');
  el('p', recBox, `beds.json: ${s.found['beds.json'] ? 'read' : 'not found'}. hits.json: ${s.found['hits.json'] ? 'read' : 'not found'}. Served from ${s.base}. A choice is kept in this browser and the game picks it up at once, in this tab or another. With no choice the manifest's default plays; with no default, the synthesised sound.`, 'note');
  const r2 = row(recBox, 'Hits echo in');
  for (const id of Object.keys(SPACES) as SpaceId[]) btn(r2, id, () => sound.core?.setSpace(id));
  for (const [slots, bed] of [[BED_SLOTS, true], [HIT_SLOTS, false]] as const) {
    el('h3', recBox, bed ? 'Ambience beds (a recording loops until Stop)' : 'Hits (a few in a row, as the game plays them)');
    for (const slot of slots) {
      const list = s.slots[slot] ?? [];
      const inUse = s.choice[slot] ?? s.defaults[slot] ?? 'synth';
      const head = el('div', recBox, '', 'row');
      head.style.marginTop = '12px';
      const name = el('b', head, slot);
      name.style.cssText = 'color:#e8ecf1;font-weight:600;min-width:110px';
      el('span', head, `${WHAT[slot] ?? ''}. ${list.length} recording${list.length === 1 ? '' : 's'}. In use: ${inUse}${s.choice[slot] ? ' (your choice)' : s.defaults[slot] ? ' (the default)' : ''}`, 'note');
      if (s.choice[slot]) btn(head, 'Back to the default', () => {
        s.choose(slot, null);
        paintRecordings();
      });
      const table = el('table', recBox);
      table.style.cssText = 'margin:2px 0 0;width:100%';
      const line = (id: string, title: string, meta: string): void => {
        const tr = el('tr', table);
        if (id === inUse) tr.style.background = '#16263a';
        const a = el('td', tr);
        a.style.cssText = 'text-align:left;white-space:nowrap;width:1%';
        const info = document.createElement('div');
        info.className = 'note';
        if (id !== 'off') btn(a, 'Play', () => void play(slot, id, bed, info));
        const use = btn(a, id === inUse ? 'In use' : 'Use this one', () => {
          s.choose(slot, id);
          paintRecordings();
        });
        use.style.marginLeft = '4px';
        if (id === inUse) use.classList.add('on');
        const b = el('td', tr);
        b.style.textAlign = 'left';
        b.innerHTML = `<b>${title}</b> ${meta}`;
        b.appendChild(info);
      };
      const esc = (x: unknown): string => String(x ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
      const link = (url: unknown, text: string): string => (typeof url === 'string' && /^https?:\/\//.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener" style="color:#6fb7ff">${esc(text)}</a>` : esc(text));
      for (const c of list) {
        line(c.id, esc(c.title ?? c.id), `<span class="note">by ${esc(c.author ?? 'unknown')} · ${link(c.licenceUrl, c.licence ?? 'licence not stated')} · ${c.seconds ?? '?'} s${c.files.length > 1 ? ` · ${c.files.length} variations` : ''} · ${link(c.source, 'source')}${c.edits ? ` · edits: ${esc(c.edits)}` : ''}</span>${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}`);
      }
      line('synth', 'Synthesised', `<span class="note">${slot === 'night' ? 'the crickets of the synthesised grove at night' : 'what the game played before there were recordings'}</span>`);
      line('off', 'Off', '<span class="note">silence for this sound</span>');
    }
  }
}

// ------------------------------------------------------------------ place
{
  const s = section('1. Where you are', 'the ambience bed, and how the place echoes');
  repaint.push(choice(s, 'Place', ['none', ...PLACES] as Place[], () => st.place, (v) => (st.place = v)));
  repaint.push(choice(s, 'Time of day', [0, 1, 2], () => st.tod, (v) => (st.tod = v), (v) => TOD[v]));
  repaint.push(choice(s, 'Ground', GROUNDS, () => st.ground, (v) => (st.ground = v)));
  el('p', s, 'Time of day changes the three grounds and the camp (waves 1 to 4 are day, 5 to 8 dusk, 9 to 12 night). Ground sets the key of the music and what a camp borrows. "cold" is the summary after a fall. Give a bed half a minute: most of it is things that happen now and then.', 'note');
}

// ------------------------------------------------------------------ music
{
  const s = section('2. Music', 'off in the game unless turned up: raise the Music slider at the top to hear it');
  repaint.push(choice(s, 'Mode', MUSIC_MODES, () => st.mode, (v) => (st.mode = v)));
  repaint.push(choice(s, 'Wave beat', [0, 1, 2], () => st.beat, (v) => (st.beat = v), (v) => BEATS[v]));
  const r = row(s, 'Drive it');
  repaint.push(slider(r, 'Heat', 0, 100, () => st.heat, (v) => {
    st.heat = v;
    apply();
  }));
  repaint.push(slider(r, 'Enemies', 0, 90, () => st.enemies, (v) => (st.enemies = v)));
  const r2 = row(s, 'Also');
  const pause = btn(r2, 'Paused (behind glass)', () => {
    st.paused = !st.paused;
    pause.classList.toggle('on', st.paused);
  });
  btn(r2, 'Play a 45 second wave', () => demoWave(false));
  btn(r2, 'Play a 45 second boss wave', () => demoWave(true));
  el('p', s, 'Beat and heat only change "arena" and "boss". Heat darkens the mode a flat at a time (above 38 and above 72) and detunes the drone. Enemies bring up the enemy drone, and the music gives way to it. The wave buttons move the controls the way a wave does: lull, swell, peak, with heat and enemies climbing.', 'note');
}
let demoT = 0;
function demoWave(boss: boolean): void {
  clearInterval(demoT);
  st.mode = boss ? 'boss' : 'arena';
  if (!GROUNDS.includes(st.place as Ground)) st.place = st.ground;
  const t0 = performance.now();
  demoT = window.setInterval(() => {
    const f = (performance.now() - t0) / 45000;
    if (f >= 1) {
      clearInterval(demoT);
      st.enemies = 0;
      st.mode = 'off';
      sound.jingle('waveClear');
    } else {
      st.beat = f < 0.3 ? 0 : f < 0.78 ? 1 : 2;
      st.heat = Math.round(Math.max(0, Math.min(100, (f - 0.15) * 150)));
      st.enemies = Math.round(4 + f * f * 70);
    }
    repaint.forEach((p) => p());
    apply();
  }, 250);
}

// -------------------------------------------------------------- gathering
function hit(kind: NodeSound, rich: boolean, broke: boolean, depth = 0, at = 0): void {
  const c = sound.core;
  if (c && sound.live) strike(c, { kind, tier: st.tier, rich, broke, depth, pan: 0 }, c.now + at, sound.samples);
}
{
  const s = section('3. Gathering', 'the heavy swing on a node; the place chosen above answers it');
  repaint.push(choice(s, 'Material tier', [1, 2, 3], () => st.tier, (v) => (st.tier = v)));
  const names: [NodeSound, string][] = [['ore', 'Pick on ore'], ['wood', 'Axe on wood'], ['herb', 'Sickle in reeds'], ['nest', 'Nest']];
  for (const [kind, name] of names) {
    const r = row(s, name);
    btn(r, 'strike', () => hit(kind, false, false));
    btn(r, 'second', () => hit(kind, false, false, 1));
    btn(r, 'third', () => hit(kind, false, false, 2));
    btn(r, kind === 'wood' ? 'tree falls' : 'breaks', () => hit(kind, false, true, 2));
    if (kind !== 'nest') {
      btn(r, 'rich strike', () => hit(kind, true, false));
      btn(r, 'rich breaks', () => hit(kind, true, true, 3));
      btn(r, 'work a whole node', () => {
        for (let i = 0; i < 3; i++) hit(kind, false, i === 2, i, i * 0.85);
        for (let i = 0; i < 4; i++) setTimeout(() => ev({ t: 'pickup', x: 0, y: 0, part: false, mat: 'iron' }), 2000 + i * 110);
      });
    }
  }
  const r = row(s, 'Hear it in');
  for (const id of Object.keys(SPACES) as SpaceId[]) btn(r, id, () => sound.core?.setSpace(id));
  el('p', s, 'The echo is the point: quarry throws back separate slaps, the grove a soft cloud, the marsh almost nothing. "Hear it in" changes only the echo, not the bed.', 'note');
}

// ----------------------------------------------------------- arena events
let clock = 0;
function ev(e: GameEvent): void {
  clock = performance.now() / 1000;
  sound.onEvent(e, clock);
}
const EVENTS: [string, () => GameEvent][] = [
  ['shot', () => ({ t: 'shot', x1: 0, y1: 0, x2: 0, y2: 0, color: '' })],
  ['sweep', () => ({ t: 'sweep', x: 0, y: 0, ang: 0, r: 0, full: false, color: '' })],
  ['burst', () => ({ t: 'burst', x: 0, y: 0, r: 0, color: '' })],
  ['tink (armour)', () => ({ t: 'tink', x: 0, y: 0 })],
  ['kill: swarm', () => ({ t: 'kill', kind: 'swarm', x: 0, y: 0, sweep: false, big: false })],
  ['kill: other', () => ({ t: 'kill', kind: 'shield', x: 0, y: 0, sweep: false, big: false })],
  ['kill: big', () => ({ t: 'kill', kind: 'brute', x: 0, y: 0, sweep: false, big: true })],
  ['swing (miss)', () => ({ t: 'swing', hits: 0, struck: false })],
  ['swing (hit)', () => ({ t: 'swing', hits: 1, struck: false })],
  ['heavy hit', () => ({ t: 'heavyHit', x: 0, y: 0 })],
  ['shield break', () => ({ t: 'shieldBreak', x: 0, y: 0 })],
  ['pickup (chains)', () => ({ t: 'pickup', x: 0, y: 0, part: false, mat: 'iron' })],
  ['pickup: boss part', () => ({ t: 'pickup', x: 0, y: 0, part: true, mat: 'maw' })],
  ['hurt', () => ({ t: 'hurt', dmg: 5, x: 0, y: 0, by: '' })],
  ['dodge', () => ({ t: 'dodge' })],
  ['no stamina', () => ({ t: 'noStamina' })],
  ['early release', () => ({ t: 'early' })],
  ['ability not ready', () => ({ t: 'notReady', left: 1 })],
  ['closed vein', () => ({ t: 'closedVein', x: 0, y: 0 })],
  ['ability', () => ({ t: 'ability', fam: 'blade' })],
  ['swap', () => ({ t: 'swap' })],
  ['beat: peak', () => ({ t: 'beat', beat: 'peak' })],
  ['rich veins open', () => ({ t: 'richOpen' })],
  ['rich veins close', () => ({ t: 'richClose' })],
  ['burrower up', () => ({ t: 'burrowUp', x: 0, y: 0 })],
  ['node bitten', () => ({ t: 'nodeBite', x: 0, y: 0, ate: false })],
  ['spit', () => ({ t: 'spit' })],
  ['telegraph', () => ({ t: 'telegraph', x: 0, y: 0 })],
  ['announcement', () => ({ t: 'say', text: '', color: '' })],
  ['objective done', () => ({ t: 'objective', done: true, scrap: 0, heal: 0 })],
  ['wave survived', () => ({ t: 'over', died: false })],
  ['fell', () => ({ t: 'over', died: true })],
];
{
  const s = section('4. Arena events', 'as the game sends them; unchanged from before except where they are now tuned to the key');
  const r = row(s);
  for (const [name, make] of EVENTS) btn(r, name, () => ev(make()));
  const r2 = row(s, 'Busiest moment');
  const b = btn(r2, 'Hold a fight at full tilt', () => {
    stress = stress ? 0 : 1;
    b.classList.toggle('on', stress > 0);
  });
  repaint.push(() => b.classList.toggle('on', stress > 0));
  el('span', r2, 'fires shots, kills, bursts, strikes, pickups and hurts at arena rates until pressed again; set Enemies to 90 and the boss at peak, and watch the meter', 'note');
}
/** Arena events at the rates of a crowded wave. `rate` scales all of them. Shared by the live button and the offline render. */
function fight(emit: (e: GameEvent) => void, dt: number, rate = 1): void {
  const roll = (perSec: number): boolean => Math.random() < perSec * dt * rate;
  if (roll(14)) emit({ t: 'shot', x1: 0, y1: 0, x2: 0, y2: 0, color: '' });
  if (roll(6)) emit({ t: 'sweep', x: 0, y: 0, ang: 0, r: 0, full: false, color: '' });
  if (roll(4)) emit({ t: 'burst', x: 0, y: 0, r: 0, color: '' });
  if (roll(12)) emit({ t: 'kill', kind: 'swarm', x: 0, y: 0, sweep: false, big: false });
  if (roll(3)) emit({ t: 'kill', kind: 'shield', x: 0, y: 0, sweep: false, big: false });
  if (roll(0.25)) emit({ t: 'kill', kind: 'brute', x: 0, y: 0, sweep: false, big: true });
  if (roll(3)) emit({ t: 'tink', x: 0, y: 0 });
  if (roll(2)) emit({ t: 'heavyHit', x: 0, y: 0 });
  if (roll(0.5)) emit({ t: 'shieldBreak', x: 0, y: 0 });
  if (roll(1.3)) {
    emit({ t: 'swing', hits: 0, struck: true });
    emit({ t: 'nodeStrike', x: 750 + (Math.random() - 0.5) * 300, y: 400, rich: Math.random() < 0.4, broke: Math.random() < 0.3, dx: 1, dy: 0, color: '', mat: 'iron', hot: 0 });
  }
  if (roll(8)) emit({ t: 'pickup', x: 0, y: 0, part: false, mat: 'iron' });
  if (roll(1.2)) emit({ t: 'hurt', dmg: 5, x: 0, y: 0, by: '' });
  if (roll(0.8)) emit({ t: 'dodge' });
  if (roll(0.3)) emit({ t: 'ability', fam: 'blade' });
  if (roll(2)) emit({ t: 'spit' });
  if (roll(0.5)) emit({ t: 'telegraph', x: 0, y: 0 });
  if (roll(0.3)) emit({ t: 'burrowUp', x: 0, y: 0 });
}
let stress = 0;

// --------------------------------------------------------------- stingers
{
  const s = section('5. Stingers', 'short phrases for things that happen, in the key of the ground chosen above');
  const r = row(s);
  for (const k of STINGERS) if (k !== 'craft') btn(r, k, () => sound.jingle(k));
  const r2 = row(s, 'Craft complete');
  for (const stn of ['forge', 'workshop', 'apothecary', 'camp'] as Station[]) btn(r2, `at the ${stn}`, () => sound.jingle('craft', stn));
  el('p', s, 'bossDown, extract and cleared are always in the major; fall goes down through the flat second. All of them carry the same five-note call.', 'note');
}
{
  const s = section('6. Interface', 'what the menus call');
  const r = row(s);
  for (const k of ['click', 'deny', 'buy', 'merge', 'craft', 'level', 'evolve'] as const) btn(r, k, () => sound.ui(k));
  el('p', s, '"craft" here uses the bench of the place chosen in section 1.', 'note');
}

// ------------------------------------------------------------------ meter
function watch(): void {
  const core = sound.core!;
  const ctx = core.ctx;
  const split = ctx.createChannelSplitter(2);
  core.out.connect(split);
  const an = [ctx.createAnalyser(), ctx.createAnalyser()];
  an.forEach((a, i) => {
    a.fftSize = 2048;
    split.connect(a, i);
  });
  const buf = new Float32Array(2048);
  const meter = document.getElementById('meter')!;
  let hold = 0;
  let holdAt = 0;
  let max = 0;
  let last = performance.now();
  const db = (v: number): string => (v <= 1e-5 ? '  -inf' : (20 * Math.log10(v)).toFixed(1).padStart(6));
  const loop = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (sound.live) {
      if (stress) fight(ev, dt);
      sound.crowd(st.enemies, dt);
      sound.step(st.paused);
    }
    let peak = 0;
    let sq = 0;
    for (const a of an) {
      a.getFloatTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
        sq += v * v;
      }
    }
    const rms = Math.sqrt(sq / (buf.length * 2));
    if (peak > hold || now - holdAt > 2500) {
      hold = peak;
      holdAt = now;
    }
    max = Math.max(max, peak);
    const w = (v: number): number => Math.max(0, Math.min(100, (20 * Math.log10(Math.max(v, 1e-5)) + 60) / 0.6));
    meter.innerHTML = `<span class="mbar"><i style="width:${w(peak)}%"></i><u style="left:${w(hold)}%"></u></span>  peak <span class="${hold > 0.89 ? 'hot' : ''}">${db(hold)}</span> dBFS   rms ${db(rms)}   highest since load ${db(max)}   voices ${String(core.voices).padStart(2)}   ${ctx.state}`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- renders
// The same engine on an OfflineAudioContext: a scene is rendered faster than real time, measured, and
// offered as a WAV. The clock is stepped by suspending the context every 25 ms, as the frame loop does live.
interface Take {
  name: string;
  about: string;
  dur: number;
  run(s: Sound, at: (t: number, fn: () => void) => void, loop: (fn: (dt: number) => void) => void): void;
}
const bed = (place: Place, tod = 0, ground: Ground = 'quarry'): Take => ({
  name: `bed-${place}${['quarry', 'grove', 'marsh', 'camp'].includes(place) ? `-${TOD[tod]}` : ''}`, about: `ambience only: ${place}${place === 'camp' ? ` on the ${ground}` : ''}`, dur: 24,
  run: (s) => s.scene(place, tod, ground, 'off'),
});
const tune = (name: string, about: string, mode: MusicMode, ground: Ground, beat: number, heat: number, enemies = 0, dur = 26): Take => ({
  name, about, dur,
  run: (s, _at, loop) => {
    s.scene('none', 0, ground, mode);
    s.core!.setSpace(mode === 'town' ? 'town' : mode === 'camp' || mode === 'gate' ? 'camp' : ground);
    s.music.setState(beat, heat);
    if (enemies) loop((dt) => s.crowd(enemies, dt));
  },
});
const impact = (kind: NodeSound, space: SpaceId, name: string): Take => ({
  name: `impact-${name}`, about: `${name} in the ${space}: three strikes and a break, then a rich node of tier 2`, dur: 11,
  run: (s, at) => {
    s.scene('none', 0, 'quarry', 'off');
    s.core!.setSpace(space);
    const c = s.core!;
    for (let i = 0; i < 3; i++) at(0.3 + i * 0.9, () => strike(c, { kind, tier: 1, rich: false, broke: i === 2, depth: i, pan: -0.15 }));
    for (let i = 0; i < 4; i++) at(5 + i * 0.9, () => strike(c, { kind, tier: 2, rich: true, broke: i === 3, depth: i, pan: 0.15 }));
  },
});
const sting = (kind: Stinger, station: Station = ''): Take => ({
  name: `stinger-${kind}${station ? `-${station}` : ''}`, about: `stinger: ${kind} ${station}`, dur: 4.2,
  run: (s, at) => {
    s.scene('none', 0, 'quarry', 'off');
    s.core!.setSpace('town');
    at(0.2, () => s.jingle(kind, station));
  },
});
const TAKES: Take[] = [
  bed('quarry', 0), bed('quarry', 2), bed('grove', 0), bed('grove', 1), bed('grove', 2), bed('marsh', 0), bed('marsh', 2),
  bed('town'), bed('forge'), bed('workshop'), bed('apothecary'), bed('camp', 2, 'grove'), bed('gate'),
  tune('music-lull', 'quarry, lull, no heat', 'arena', 'quarry', 0, 0),
  tune('music-swell', 'quarry, swell, heat 30', 'arena', 'quarry', 1, 0.3),
  tune('music-peak', 'quarry, peak, heat 50', 'arena', 'quarry', 2, 0.5),
  tune('music-peak-hot', 'grove, peak, heat 100: two flats darker', 'arena', 'grove', 2, 1),
  tune('music-boss', 'marsh boss wave at the peak', 'boss', 'marsh', 2, 0.5),
  tune('music-town', 'town', 'town', 'quarry', 0, 0, 0, 34),
  tune('music-camp', 'camp on the grove', 'camp', 'grove', 0, 0, 0, 34),
  tune('music-gate', 'boss gate', 'gate', 'quarry', 0, 0, 0, 30),
  impact('ore', 'quarry', 'pick-on-ore'), impact('wood', 'grove', 'axe-on-wood'), impact('herb', 'marsh', 'sickle-in-reeds'),
  sting('craft', 'forge'), sting('craft', 'workshop'), sting('craft', 'apothecary'), sting('level'), sting('bossDown'), sting('extract'), sting('cleared'), sting('fall'), sting('evolve'),
  {
    name: 'transitions', about: 'every change of place in turn, three seconds each, then a pause and a resume: listen for clicks at the joins', dur: 36,
    run: (s, at) => {
      const order: [Place, number, Ground, MusicMode][] = [
        ['quarry', 0, 'quarry', 'arena'], ['grove', 1, 'grove', 'arena'], ['marsh', 2, 'marsh', 'boss'], ['camp', 2, 'marsh', 'camp'], ['gate', 2, 'marsh', 'gate'],
        ['town', 0, 'marsh', 'town'], ['forge', 0, 'marsh', 'town'], ['workshop', 0, 'marsh', 'town'], ['apothecary', 0, 'marsh', 'town'], ['cold', 0, 'quarry', 'fallen'],
      ];
      order.forEach(([place, tod, ground, mode], i) => at(i * 3, () => {
        s.scene(place, tod, ground, mode);
        s.music.setState(1, 0.4);
      }));
      at(1, () => strike(s.core!, { kind: 'ore', tier: 1, rich: false, broke: false, depth: 0, pan: 0 }));
      at(2.8, () => strike(s.core!, { kind: 'ore', tier: 1, rich: true, broke: true, depth: 1, pan: 0 })); // its echo is cut off by the move to the grove
      at(30, () => s.scene('quarry', 0, 'quarry', 'arena'));
      let held = false;
      at(32, () => (held = true));
      at(34, () => (held = false));
      const step = s.step.bind(s);
      s.step = () => step(held);
    },
  },
  {
    name: 'full-typical', about: 'a grove wave as played: lull to peak in 40 s, some mining, heat and enemies rising, music and ambience at 7', dur: 40,
    run: (s, _at, loop) => {
      s.scene('grove', 0, 'grove', 'arena');
      let t = 0;
      loop((dt) => {
        t += dt;
        const f = t / 40;
        s.music.setState(f < 0.3 ? 0 : f < 0.78 ? 1 : 2, Math.max(0, Math.min(1, (f - 0.15) * 1.5)));
        s.crowd(Math.round(4 + f * f * 60), dt);
        fight((e) => s.onEvent(e.t === 'nodeStrike' ? { ...e, mat: 'greenwood' } : e, t), dt, 0.15 + f * 0.6);
      });
    },
  },
  {
    name: 'full-busiest', about: 'the worst case: quarry boss wave at the peak, 90 enemies, heat 100, every arena event at 1.5 times a crowded rate, both volumes at 10', dur: 20,
    run: (s, at, loop) => {
      s.setVolume('music', 10, false);
      s.setVolume('amb', 10, false);
      s.scene('quarry', 2, 'quarry', 'boss');
      s.music.setState(2, 1);
      let t = 0;
      loop((dt) => {
        t += dt;
        s.crowd(90, dt);
        fight((e) => s.onEvent(e, t), dt, 1.5);
      });
      at(3, () => s.onEvent({ t: 'say', text: '', color: '' }, 3));
      at(6, () => s.onEvent({ t: 'beat', beat: 'peak' }, 6));
      at(9, () => s.jingle('objective'));
      at(12, () => s.jingle('bossDown'));
      at(15, () => s.jingle('level'));
    },
  },
];

interface Stats { name: string; about: string; seconds: number; peakDb: number; rmsDb: number; aDb: number; low: number; mid: number; high: number; clipped: number }

async function render(take: Take, rate = 48000): Promise<{ stats: Stats; wav: Uint8Array }> {
  const frames = Math.ceil(take.dur * rate);
  const ctx = new OfflineAudioContext(2, frames, rate);
  const s = new Sound(false);
  s.useSamples = false; // these renders are of the synthesised sound
  s.muted = false;
  s.volume = { music: 7, amb: 7 }; // fixed for every render, whatever this browser has saved; in the game music starts at 0
  s.attach(ctx);
  const acts: { t: number; fn: () => void }[] = [];
  const loops: ((dt: number) => void)[] = [];
  take.run(s, (t, fn) => acts.push({ t, fn }), (fn) => loops.push(fn));
  acts.sort((a, b) => a.t - b.t);
  const STEP = 0.025;
  for (let t = STEP; t < take.dur - STEP; t += STEP) {
    void ctx.suspend(t).then(() => {
      while (acts.length && acts[0].t <= ctx.currentTime) acts.shift()!.fn();
      for (const fn of loops) fn(STEP);
      s.step(false);
      void ctx.resume();
    });
  }
  s.step(false);
  const buf = await ctx.startRendering();
  s.beds.dispose();
  s.music.dispose();
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  let peak = 0;
  let sq = 0;
  let clipped = 0;
  for (let i = 0; i < frames; i++) {
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
    sq += L[i] * L[i] + R[i] * R[i];
  }
  const { aShare, ...bands } = spectrum(L, R, rate);
  const db = (v: number): number => Math.round(200 * Math.log10(Math.max(v, 1e-7))) / 10;
  const rms = Math.sqrt(sq / (frames * 2));
  return {
    stats: { name: take.name, about: take.about, seconds: take.dur, peakDb: db(peak), rmsDb: db(rms), aDb: db(rms * Math.sqrt(aShare)), ...bands, clipped },
    wav: wav16(L, R, rate),
  };
}

/**
 * Share of the energy below 200 Hz, from 200 Hz to 2 kHz, and above, in percent (Hann windows of 8192, mono sum),
 * and the share left after A-weighting: a rough stand-in for how loud it is to an ear, which hears little bass.
 */
function spectrum(L: Float32Array, R: Float32Array, rate: number): { low: number; mid: number; high: number; aShare: number } {
  const N = 8192;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const e = [0, 0, 0];
  let weighted = 0;
  const aw = new Float64Array(N / 2);
  for (let k = 1; k < N / 2; k++) {
    const f2 = Math.pow((k * rate) / N, 2);
    const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
    aw[k] = Math.pow(ra * 1.2589, 2);
  }
  for (let at = 0; at + N <= L.length; at += N / 2) {
    for (let i = 0; i < N; i++) {
      re[i] = (L[at + i] + R[at + i]) * 0.5 * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = (k * rate) / N;
      const p = re[k] * re[k] + im[k] * im[k];
      e[f < 200 ? 0 : f < 2000 ? 1 : 2] += p;
      weighted += p * aw[k];
    }
  }
  const sum = e[0] + e[1] + e[2] || 1;
  const pc = (v: number): number => Math.round((1000 * v) / sum) / 10;
  return { low: pc(e[0]), mid: pc(e[1]), high: pc(e[2]), aShare: weighted / sum };
}
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}
function wav16(L: Float32Array, R: Float32Array, rate: number): Uint8Array {
  const n = L.length;
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) out.setUint8(at + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  out.setUint32(4, 36 + n * 4, true);
  str(8, 'WAVEfmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 2, true);
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * 4, true);
  out.setUint16(32, 4, true);
  out.setUint16(34, 16, true);
  str(36, 'data');
  out.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), true);
    out.setInt16(46 + i * 4, Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), true);
  }
  return new Uint8Array(out.buffer);
}

/** What the compressor's make-up gain really is, so COMP_TRIM can undo it: a quiet tone in, the level out. */
async function makeup(): Promise<number> {
  const ctx = new OfflineAudioContext(1, 48000, 48000);
  const s = new Sound(false);
  s.useSamples = false; // these renders are of the synthesised sound
  s.muted = false;
  s.attach(ctx);
  const o = ctx.createOscillator();
  o.frequency.value = 440;
  const g = ctx.createGain();
  g.gain.value = 0.01;
  o.connect(g).connect(s.core!.post);
  o.start();
  const d = (await ctx.startRendering()).getChannelData(0);
  let sq = 0;
  for (let i = 24000; i < 48000; i++) sq += d[i] * d[i];
  return Math.sqrt(sq / 24000) / (0.01 / Math.SQRT2) / COMP_TRIM;
}

{
  const s = section('7. Render and measure', 'the same scenes offline: a WAV to keep and the numbers');
  const r = row(s);
  const sel = el('select', r);
  for (const t of TAKES) el('option', sel, `${t.name}: ${t.about}`).value = t.name;
  const table = el('table', s);
  table.innerHTML = '<tr><th>scene</th><th>s</th><th>peak dBFS</th><th>rms dBFS</th><th>A-weighted</th><th>&lt;200 Hz %</th><th>200 Hz-2 kHz %</th><th>&gt;2 kHz %</th><th>listen</th></tr>';
  const add = async (t: Take): Promise<void> => {
    const { stats, wav } = await render(t);
    const url = URL.createObjectURL(new Blob([wav.buffer as ArrayBuffer], { type: 'audio/wav' }));
    const tr = el('tr', table);
    tr.innerHTML = `<td>${stats.name}</td><td>${stats.seconds}</td><td>${stats.peakDb}</td><td>${stats.rmsDb}</td><td>${stats.aDb}</td><td>${stats.low}</td><td>${stats.mid}</td><td>${stats.high}</td><td><audio controls preload="none" src="${url}"></audio> <a href="${url}" download="${stats.name}.wav" style="color:#6fb7ff">wav</a></td>`;
  };
  btn(r, 'Render this one', () => void add(TAKES.find((t) => t.name === sel.value)!));
  btn(r, 'Render all (about half a minute)', async () => {
    for (const t of TAKES) await add(t);
  });
  el('p', s, 'Renders set music and ambience to 7 of 10 (in the game music starts at 0), except full-busiest, which sets both to 10. The ceiling is a soft clip at 0.91 (-0.8 dBFS): a peak near it means the limiter was working. Generated parts differ from one render to the next.', 'note');
}

declare global {
  interface Window { __lab: unknown }
}
window.__lab = {
  sound,
  takes: TAKES.map((t) => t.name),
  makeup,
  /** Render one scene; the WAV comes back as base64 so a headless driver can write it to disk. */
  async render(name: string): Promise<{ stats: Stats; b64: string }> {
    const { stats, wav } = await render(TAKES.find((t) => t.name === name)!);
    let bin = '';
    for (let i = 0; i < wav.length; i += 0x8000) bin += String.fromCharCode(...wav.subarray(i, i + 0x8000));
    return { stats, b64: btoa(bin) };
  },
};
