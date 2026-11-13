// Every screen that is not the arena: town, camp, boss gate, tally, summary. Plain DOM.
import {
  ATOMS, BAG_TYPES, BOSSES, CARDS, CFG, LEVEL_PICKS, POOL_UNLOCK, poolName, CODEX_RANKS, CURSES, EVOLVE_TIER, FAMS, FAM_CAP, FORM, GROUNDS, GROUND_IDS, ITEMS, KITS, MATS, MUTATORS,
  NODE_MAT, OBJECTIVES, PATTERNS, PERKS, RECIPES, SCHEMATICS, SKILLS, SKILL_CAP, SOURCE_NAME, STATIONS, TIER_MUL, TOOLS, WEAPONS, WILDS, ELITES,
  brewMods, brewName, modText, skillXpFor, weekMutators, weekNumber,
  type BrewForm, type Fam, type Gear, type GearTool, type Ground, type Mat, type SchemSource, type StationId,
} from './data';
import * as M from './meta';
import * as R from './run';
import type { Sound } from './audio';

export interface Hooks {
  beginWave(): void;
  stop(): void; // the wave in progress is over, whatever the arena thinks
  sound: Sound;
}
type View = 'welcome' | 'town' | 'run' | 'summary' | 'pause' | 'none';
const TABS = ['Expedition', 'Forge', 'Workshop', 'Apothecary', 'Codex', 'Storage', 'Standing', 'Vault'] as const;
type Tab = (typeof TABS)[number];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const roman = (n: number) => ['', 'I', 'II', 'III', 'IV', 'V'][n] ?? String(n);

export class UI {
  view: View = 'none';
  private tab: Tab = 'Expedition';
  private msg = '';
  private lastClick = 0;
  private lastAction = '';
  private lastKey = '';
  private summary: M.Summary | null = null;
  private doneRun: R.RunState | null = null;
  private s = {
    fam: 'blade' as Fam, tier: 1, perks: [] as string[], tool: 'ore' as GearTool['node'], toolTier: 1, burden: 'ore' as Mat['cat'],
    ra: '', rb: '', form: 'flask' as BrewForm,
  };

  constructor(private root: HTMLElement, private p: M.Profile, private hooks: Hooks) {
    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
      if (!el || (el as HTMLButtonElement).disabled) return;
      hooks.sound.init(); // any click is a user gesture, so interface sounds work from the first one
      // a second quick click on something destructive would land on the row that slid under the cursor
      const now = performance.now();
      const a = el.dataset.a!;
      const repeat = a === this.lastAction && now - this.lastClick < 350;
      this.lastClick = now;
      this.lastAction = a;
      if (repeat && ['sell', 'scrapgear', 'break'].includes(a)) return;
      this.msg = '';
      this.act(el.dataset.a!, el.dataset.v ?? '', el.dataset.w ?? '');
    });
  }

  get run(): R.RunState | null {
    return this.p.run;
  }

  setTab(t: string): void {
    if ((TABS as readonly string[]).includes(t)) this.tab = t as Tab;
  }

  // ------------------------------------------------------------ navigation
  showTown(): void {
    this.view = this.p.guided === null ? 'welcome' : 'town';
    this.render();
  }
  showRun(): void {
    this.view = 'run';
    M.save(this.p);
    this.render();
  }
  showSummary(sum: M.Summary, run: R.RunState): void {
    this.summary = sum;
    this.doneRun = run;
    this.view = 'summary';
    M.save(this.p);
    this.render();
  }
  showPause(on: boolean): void {
    this.view = on ? 'pause' : 'none';
    this.render();
  }
  hide(): void {
    this.view = 'none';
    this.render();
  }

  private render(): void {
    if (this.view === 'none') {
      this.root.hidden = true;
      return;
    }
    // keep the scroll position while acting on a screen, but start a new screen at the top
    const key = `${this.view}:${this.view === 'run' ? this.run?.phase : this.view === 'town' ? this.tab : ''}`;
    const y = key === this.lastKey ? this.root.scrollTop : 0;
    this.lastKey = key;
    this.root.hidden = false;
    this.root.innerHTML = `<div class="screen">${this.html()}</div>`;
    this.root.scrollTop = y;
  }
  private html(): string {
    switch (this.view) {
      case 'welcome': return this.welcome();
      case 'town': return this.town();
      case 'run': {
        const run = this.run!;
        return run.phase === 'tally' ? this.tally(run) : run.phase === 'gate' ? this.gate(run) : this.camp(run);
      }
      case 'summary': return this.summaryHtml();
      case 'pause': return `<h1>Paused</h1><p class="dim">The expedition is saved at camp and at boss gates. Closing the game in the middle of a wave counts as a fall.</p>${CONTROLS}<div class="row"><button data-a="resume">Resume</button><button class="alt" data-a="mute">${this.hooks.sound.muted ? 'Sound is off: turn on' : 'Sound is on: turn off'}</button><button class="alt" data-a="abandon">Abandon expedition</button></div>`;
      default: return '';
    }
  }

  // ---------------------------------------------------------------- actions
  private act(a: string, v: string, w: string): void {
    const p = this.p;
    const run = this.run;
    const snd = this.hooks.sound;
    const l = p.loadout;
    const fail = (text: string | null | undefined) => {
      if (text) {
        this.msg = text;
        snd.ui('deny');
      }
      return !!text;
    };
    switch (a) {
      // welcome and town chrome
      case 'guided': p.guided = v === '1'; this.view = 'town'; break;
      case 'tab': this.tab = v as Tab; break;
      case 'wipe':
        if (confirm('Delete the save and start over?')) {
          M.wipe();
          location.reload();
        }
        return;
      case 'openall': p.guided = false; break;
      case 'resume': document.dispatchEvent(new CustomEvent('cw-resume')); return;

      // expedition loadout
      case 'key': l.keyLevel = Math.max(1, Math.min(p.key, l.keyLevel + Number(v))); break;
      case 'ground': l.ground = v as Ground; break;
      case 'kit': l.kit = v; break;
      case 'lw': {
        const uid = Number(v);
        if (l.weapons.includes(uid)) l.weapons = l.weapons.filter((u) => u !== uid);
        else l.weapons = [...l.weapons, uid].slice(-2);
        break;
      }
      case 'ltool': l.tool = Number(v); break;
      case 'lbag': l.bag = Number(v); break;
      case 'pack': {
        const b = M.parseBrew(v);
        if (M.brewsFree(p, v) <= 0) {
          fail('No more of that brew in storage.');
          break;
        }
        if (b.form === 'charm' && l.charms.length < 2) l.charms.push(v);
        else if (b.form === 'oil') l.oil = v;
        else if (b.form === 'flask' && l.flasks.length < M.flaskSlots(p)) l.flasks.push(v);
        else fail('No free slot for that.');
        break;
      }
      case 'unpack': {
        const drop = (list: string[]) => {
          const i = list.indexOf(v);
          if (i >= 0) list.splice(i, 1);
        };
        if (l.oil === v) l.oil = null;
        else if (l.charms.includes(v)) drop(l.charms);
        else drop(l.flasks);
        break;
      }
      case 'lrec':
        if (l.recipes.includes(v)) l.recipes = l.recipes.filter((r) => r !== v);
        else if (l.recipes.length < M.recipeSlots(p)) l.recipes.push(v);
        else fail(`The loadout holds ${M.recipeSlots(p)} recipes.`);
        break;
      case 'start': {
        if (fail(M.loadoutProblem(p))) break;
        snd.init();
        M.startRun(p);
        M.save(p);
        this.hooks.beginWave();
        return;
      }
      case 'continue':
        snd.init();
        if (run && run.phase === 'wave') {
          // the save is from the start of a wave that was never finished: leaving mid-wave is a fall, not a retry
          run.outcome = 'died';
          this.showSummary(M.finishRun(p, run), run);
          return;
        }
        this.view = 'run';
        break;
      case 'race':
        snd.init();
        M.startRun(p, true);
        M.save(p);
        this.hooks.beginWave();
        return;
      case 'sellmat': if (M.sellMat(p, v, 10)) snd.ui('buy'); break;
      case 'donate': if (M.donate(p, v, 10)) snd.ui('buy'); break;
      case 'levelpick': if (run && R.pickLevel(run, v)) snd.ui('level'); break;
      case 'abandon':
        if (run && confirm('Abandon the expedition? It counts as a fall.')) {
          this.hooks.stop();
          run.outcome = 'died';
          this.showSummary(M.finishRun(p, run), run);
          return;
        }
        break;

      // forge, workshop, apothecary
      case 'ffam': this.s.fam = v as Fam; break;
      case 'ftier': this.s.tier = Number(v); break;
      case 'fperk': {
        const n = M.chosenPerks(p);
        this.s.perks = this.s.perks.includes(v) ? this.s.perks.filter((x) => x !== v) : [...this.s.perks, v].slice(-n);
        break;
      }
      case 'fcraft': {
        const r = M.craftWeapon(p, this.s.fam, this.s.tier, this.s.perks);
        if (!fail(typeof r === 'string' ? r : null)) {
          const g = r as Gear;
          this.msg = `Forged ${g.name}${g.kind === 'weapon' ? `, gear score ${g.gs}, with ${g.perks.map((x) => PERKS[x].name).join(' and ')}` : ''}.`;
          snd.ui('craft');
        }
        break;
      }
      case 'ttool': this.s.tool = v as GearTool['node']; break;
      case 'ttier': this.s.toolTier = Number(v); break;
      case 'tcraft': {
        const r = M.craftTool(p, this.s.tool, this.s.toolTier);
        if (!fail(typeof r === 'string' ? r : null)) {
          this.msg = `Made ${(r as Gear).name}.`;
          snd.ui('craft');
        }
        break;
      }
      case 'burden': this.s.burden = v as Mat['cat']; break;
      case 'bcraft': {
        const r = M.craftBag(p, v, this.s.burden);
        if (!fail(typeof r === 'string' ? r : null)) {
          const g = r as Gear;
          this.msg = `Made ${g.name}${g.kind === 'bag' ? ` (comfort ${g.comfort}, lightens ${g.burden})` : ''}.`;
          snd.ui('craft');
        }
        break;
      }
      case 'pattern': {
        const r = M.usePattern(p, v);
        if (!fail(typeof r === 'string' ? r : null)) {
          this.msg = `Made ${(r as Gear).name}. The pattern is used up.`;
          snd.ui('merge');
        }
        break;
      }
      case 'scrapgear':
        if (!confirm('Dismantle this for 2 coin? It cannot be undone.')) return;
        if (!M.scrapGear(p, Number(v))) fail('That is in your loadout.');
        break;
      case 'mute': snd.toggleMute(); break;
      case 'upgrade': if (!fail(M.upgradeStation(p, v as StationId))) { this.msg = `${STATIONS[v as StationId].name} raised.`; snd.ui('merge'); } break;
      case 'ra': this.s.ra = v; break;
      case 'rb': this.s.rb = v; break;
      case 'form': this.s.form = v as BrewForm; break;
      case 'brew': {
        const r = M.brew(p, this.s.ra, this.s.rb, this.s.form);
        this.msg = r.text;
        snd.ui(r.ok ? 'craft' : 'deny');
        break;
      }

      // codex, standing, vault
      case 'learn': if (!fail(M.learn(p, v))) { this.msg = `Learned ${SCHEMATICS[v].name}.`; snd.ui('merge'); } break;
      case 'break': M.breakDown(p, v); break;
      case 'redeem': {
        const id = M.redeem(p, v as SchemSource);
        if (id) { this.msg = `Four fragments became ${SCHEMATICS[id].name}.`; snd.ui('merge'); }
        break;
      }
      case 'card': M.pickCard(p, v); snd.ui('buy'); break;
      case 'vault': if (M.claimVault(p, Number(v))) snd.ui('merge'); break;

      // tally, camp, gate
      case 'tallyok': if (run) R.afterTally(run); break;
      case 'buy': if (run) { if (R.buy(run, Number(v))) snd.ui('buy'); else fail(R.canBuy(run, run.shop[Number(v)])); } break;
      case 'lock': if (run) run.shop[Number(v)].locked = !run.shop[Number(v)].locked; break;
      case 'reroll': if (run && !R.reroll(run)) fail('Not enough scrap.'); break;
      case 'merge': if (run && R.merge(run, Number(v))) snd.ui('merge'); break;
      case 'sell': if (run) R.sell(run, Number(v)); break;
      case 'craft': if (run) { if (R.craft(run, v)) snd.ui('craft'); else fail(R.canCraft(run, v)); } break;
      case 'drink': if (run) R.drink(run, Number(v)); break;
      case 'route': if (run) R.chooseRoute(run, Number(v)); break;
      case 'go':
        if (run) {
          R.leaveCamp(run);
          M.save(p);
          this.hooks.beginWave();
        }
        return;
      case 'chest': if (run) { R.openChest(run); snd.ui('merge'); } break;
      case 'evolve': if (run && R.evolve(run, Number(v), w)) snd.ui('evolve'); break;
      case 'wild': if (run) R.pickWild(run, v || null); break;
      case 'push': if (run) R.push(run); break;
      case 'extract':
        if (run) {
          R.extract(run);
          this.showSummary(M.finishRun(p, run), run);
        }
        return;
      case 'town': this.summary = null; this.view = 'town'; this.tab = 'Expedition'; break;
    }
    if (this.view !== 'none') M.save(p);
    this.render();
  }

  // ------------------------------------------------------------- fragments
  private note(): string {
    return this.msg ? `<p class="note">${this.msg}</p>` : '';
  }
  private mats(rec: Record<string, number>, empty = 'nothing'): string {
    const e = Object.entries(rec).filter(([, n]) => n > 0).sort((a, b) => (MATS[a[0]].cat + MATS[a[0]].tier).localeCompare(MATS[b[0]].cat + MATS[b[0]].tier));
    if (!e.length) return `<span class="dim">${empty}</span>`;
    return e.map(([id, n]) => `<span class="chip"><i style="background:${MATS[id].color}"></i>${n} ${MATS[id].name}</span>`).join(' ');
  }
  private gearLine(g: Gear): string {
    if (g.kind === 'weapon') return `<b>${g.name}</b> <span class="dim">${WEAPONS[g.fam].name} · gear score ${g.gs}${g.perks.length ? ' · ' + g.perks.map((x) => PERKS[x].name).join(', ') : ''}</span>`;
    if (g.kind === 'tool') return `<b>${g.name}</b> <span class="dim">grade ${roman(g.tier)} · ${TOOLS[g.node].text}</span>`;
    return `<b>${g.name}</b> <span class="dim">carries ${g.comfort} weight before slowing${g.burden ? ` · ${g.burden} weighs 40% less` : ''}</span>`;
  }
  private pick(a: string, v: string | number, on: boolean, body: string, dis = false): string {
    return `<button class="pick${on ? ' on' : ''}" data-a="${a}" data-v="${v}" ${dis ? 'disabled' : ''}>${body}</button>`;
  }

  // ---------------------------------------------------------------- welcome
  private welcome(): string {
    return `<h1>Craft World</h1>
      <p class="sub">Gather under fire, build a weapon set between waves, carry home what you dare, and craft for the next expedition.</p>
      <div class="cols">
        <div class="card"><h3>Guided start</h3><p>Systems open one at a time over your first five expeditions, starting with a short run where nothing can be lost.</p><button data-a="guided" data-v="1">Guided start</button></div>
        <div class="card"><h3>Everything open</h3><p>All twelve waves, heat, routes, schematics and the full town from the first expedition.</p><button class="alt" data-a="guided" data-v="0">Everything open</button></div>
      </div>${CONTROLS}`;
  }

  // ------------------------------------------------------------------- town
  private town(): string {
    const p = this.p;
    const pending = p.standing.pending > 0;
    const tabs = TABS.map((t) => `<button class="tab${t === this.tab ? ' on' : ''}" data-a="tab" data-v="${t}">${t}${t === 'Standing' && pending ? ' •' : ''}${t === 'Vault' && !p.week.claimed && p.week.runs > 0 ? ' •' : ''}</button>`).join('');
    const body = { Expedition: () => this.tExpedition(), Forge: () => this.tForge(), Workshop: () => this.tWorkshop(), Apothecary: () => this.tApothecary(), Codex: () => this.tCodex(), Storage: () => this.tStorage(), Standing: () => this.tStanding(), Vault: () => this.tVault() }[this.tab]();
    return `<div class="head"><h1>Town</h1><div class="dim">${p.coin} coin · key level ${p.key} · standing ${p.standing.lvl} · mastery rank ${M.masteryRank(p)} · codex rank ${M.codexRank(p)}</div></div>
      <div class="tabs">${tabs}</div>${this.note()}${body}`;
  }

  private tExpedition(): string {
    const p = this.p;
    const l = p.loadout;
    const feat = M.featFor(p);
    const rank = M.masteryRank(p);
    const problem = M.loadoutProblem(p);
    if (p.run) {
      return `<div class="card"><h3>An expedition is under way</h3><p>Wave ${p.run.wave + 1} of ${R.runWaves(p.run)}.</p>
        ${p.run.phase === 'wave' ? '<p class="short">You left in the middle of a wave. That counts as a fall.</p>' : ''}
        <div class="row"><button data-a="continue">${p.run.phase === 'wave' ? 'See what came home' : 'Continue'}</button>${p.run.phase === 'wave' ? '' : '<button class="alt" data-a="abandon">Abandon</button>'}</div></div>`;
    }
    const guiding = !!p.guided && p.sessions < M.GUIDE_STEPS;
    const guide = guiding ? `<div class="card guide"><b>Guided start, expedition ${p.sessions + 1} of ${M.GUIDE_STEPS}.</b> ${M.GUIDE_TEXT[p.sessions]} <button class="sm alt" data-a="openall">Open everything now</button></div>` : '';
    const quota = M.keyQuota(l.keyLevel);
    const muts = weekMutators(weekNumber());
    const brews = Object.keys(p.brews).filter((k) => p.brews[k] > 0);
    const packedCount = (k: string) => l.charms.filter((x) => x === k).length + l.flasks.filter((x) => x === k).length + (l.oil === k ? 1 : 0);
    const known = M.knownRecipes(p);
    return `${guide}
      <div class="row"><button data-a="start" ${problem ? 'disabled' : ''}>Start expedition</button><span class="dim">${problem ?? `${KITS.find((k) => k.id === l.kit)!.name} · ${GROUNDS[l.ground].name} · danger ${feat.heat ? l.keyLevel : 1}`}</span></div>
      <div class="cols">
        ${feat.schem ? `<div class="card"><h3>Key</h3>
          <div class="row"><button class="sm alt" data-a="key" data-v="-1">−</button><b>Danger ${l.keyLevel}</b><button class="sm alt" data-a="key" data-v="1">+</button><span class="dim">best ${p.key}</span></div>
          <p class="dim">Each level: enemies +${Math.round(CFG.key.hp * 100)}% health, +${Math.round(CFG.key.dmg * 100)}% damage, +${Math.round(CFG.key.rate * 100)}% numbers; nodes +${Math.round(CFG.key.yield * 100)}% yield; +25% coin.</p>
          <p class="dim">The key rises when, at your best danger, you clear all twelve waves, kill all three bosses and bank ${quota} ore, wood or herbs. It never falls. The first clear of each danger with each kit pays a standing card.</p>
          <h3>This week</h3>${muts.map((m) => `<p><b>${MUTATORS[m].name}.</b> ${MUTATORS[m].text}</p>`).join('')}</div>` : ''}
        <div class="card"><h3>First ground</h3>${GROUND_IDS.map((g) => this.pick('ground', g, l.ground === g, `<b>${GROUNDS[g].name}</b><br><span class="dim">${GROUNDS[g].text}</span>`)).join('')}</div>
        <div class="card"><h3>Kit</h3>${KITS.map((k) => this.pick('kit', k.id, l.kit === k.id, `<b>${k.name}</b>${k.rank > rank ? ` <span class="short">mastery rank ${k.rank}</span>` : p.kitBest[k.id] ? ` <span class="dim">best clear: danger ${p.kitBest[k.id]}</span>` : ''}<br><span class="dim">${k.text}</span>`, k.rank > rank)).join('')}</div>
        <div class="card"><h3>Weapons (two)</h3><p class="dim">They set your two abilities and start at tier I. The run supplies the power.</p>${M.weaponsOf(p).map((g) => this.pick('lw', g.uid, l.weapons.includes(g.uid), this.gearLine(g))).join('')}</div>
        <div class="card"><h3>Tool</h3>${M.toolsOf(p).map((g) => this.pick('ltool', g.uid, l.tool === g.uid, this.gearLine(g))).join('')}
          <h3>Bag</h3>${M.bagsOf(p).map((g) => this.pick('lbag', g.uid, l.bag === g.uid, this.gearLine(g))).join('')}</div>
        <div class="card"><h3>Brews</h3><p class="dim">Charms ${l.charms.length}/2 · oil ${l.oil ? 1 : 0}/1 · flasks ${l.flasks.length}/${M.flaskSlots(p)}. Packed brews are used up.</p>
          ${brews.length ? brews.map((k) => { const b = M.parseBrew(k); const n = packedCount(k); return `<div class="line"><div><b>${cap(brewName(b))}</b> <span class="dim">${n} packed of ${p.brews[k]}</span><br><span class="dim">${modText(brewMods(b))} · ${FORM[b.form].lasts}</span></div><div><button class="sm" data-a="pack" data-v="${k}">Pack</button>${n ? `<button class="sm alt" data-a="unpack" data-v="${k}">Take out</button>` : ''}</div></div>`; }).join('') : '<p class="dim">None. Brew some at the apothecary.</p>'}</div>
        <div class="card wide"><h3>Recipes (${l.recipes.length}/${M.recipeSlots(p)})</h3><p class="dim">Only these can be used on the expedition.</p><div class="cols tight">${known.map((r) => this.pick('lrec', r, l.recipes.includes(r), `<b>${RECIPES[r].name}</b><br><span class="dim">${RECIPES[r].text}</span>`)).join('')}</div></div>
      </div>
      ${feat.schem ? `<div class="card" style="margin-top:12px"><h3>Weekly race</h3><p class="dim">The same seed for everyone this week: the same waves and shops, danger 3, the starter kit, no town bonuses. Nothing is banked and nothing is lost. Rank is deepest wave, then time.</p>
        <div class="row"><button class="alt" data-a="race">Run the race</button><span class="dim">${p.race.waves ? `Your best this week: ${p.race.waves} waves in ${p.race.time}s` : 'No run yet this week'}</span></div></div>` : ''}
      <p class="dim small"><button class="sm alt" data-a="wipe">Delete save</button></p>`;
  }

  private station(id: StationId): string {
    const p = this.p;
    const t = p.stations[id];
    const n = M.stationNeeds(p, id);
    const tiers = STATIONS[id].tiers.map((x, i) => `<li class="${i < t ? '' : 'dim'}">${roman(i + 1)}. ${x}</li>`).join('');
    const up = n ? `<p>Raise to tier ${roman(n.tier)}: ${M.costText(p, n.cost, n.coin)}${n.blueprint ? `, and <span class="${p.schematics[n.blueprint] > 0 ? '' : 'short'}">${SCHEMATICS[n.blueprint].name}</span> (${SOURCE_NAME[SCHEMATICS[n.blueprint].source]})` : ''}</p><button class="sm" data-a="upgrade" data-v="${id}">Raise ${STATIONS[id].name}</button>` : '<p class="dim">At the top tier.</p>';
    return `<div class="card"><h3>${STATIONS[id].name}, tier ${roman(t)}</h3><ul class="plain">${tiers}</ul>${up}</div>`;
  }
  private patterns(station: 'forge' | 'workshop'): string {
    const p = this.p;
    const held = Object.keys(p.schematics).filter((id) => p.schematics[id] > 0 && SCHEMATICS[id].kind === 'pattern' && PATTERNS[SCHEMATICS[id].ref].station === station);
    if (!held.length) return '<p class="dim">No patterns held. Named elites, shrines and boss chests carry them.</p>';
    return held.map((id) => {
      const pat = PATTERNS[SCHEMATICS[id].ref];
      return `<div class="line"><div><b>${pat.name}</b> ×${p.schematics[id]}<br><span class="dim">${pat.text}</span><br>${M.costText(p, pat.cost, Math.round(30 * M.feeMul(p, station)))}</div><button class="sm" data-a="pattern" data-v="${id}">Make</button></div>`;
    }).join('');
  }
  private gearList(kinds: Gear['kind'][]): string {
    const l = this.p.loadout;
    return this.p.gear.filter((g) => kinds.includes(g.kind)).map((g) => {
      const used = l.weapons.includes(g.uid) || l.tool === g.uid || l.bag === g.uid;
      return `<div class="line"><div>${this.gearLine(g)}</div>${used ? '<span class="dim">in loadout</span>' : `<button class="sm alt" data-a="scrapgear" data-v="${g.uid}">Dismantle</button>`}</div>`;
    }).join('');
  }

  private tForge(): string {
    const p = this.p;
    const s = this.s;
    const n = M.chosenPerks(p);
    const grade = (a: string, cur: number) => [1, 2, 3].map((t) => this.pick(a, t, cur === t, `${['', 'Iron', 'Skysteel', 'Sunmetal'][t]}${p.stations.forge < M.gradeStation(t) ? ` <span class="short">forge ${roman(M.gradeStation(t))}</span>` : ''}`)).join('');
    const lo = 200 + (s.tier - 1) * 100 + p.skills.smithing.lvl * 2;
    return `<div class="cols">${this.station('forge')}
      <div class="card"><h3>Forge a weapon</h3>
        <div class="picks">${FAMS.map((f) => this.pick('ffam', f, s.fam === f, WEAPONS[f].name)).join('')}</div>
        <p class="dim">${WEAPONS[s.fam].text} Ability: ${WEAPONS[s.fam].ability.name}. ${WEAPONS[s.fam].ability.text}.</p>
        <div class="picks">${grade('ftier', s.tier)}</div>
        <p>Choose ${n} perk${n > 1 ? 's' : ''}; one more is rolled at random. <span class="dim">Gear score rolls ${lo}–${300 + (s.tier - 1) * 100}; smithing raises the floor, and a higher score strengthens the perks.</span></p>
        <div class="picks">${Object.entries(PERKS).map(([id, k]) => this.pick('fperk', id, s.perks.includes(id), `<b>${k.name}</b> <span class="dim">${modText(k.mods)}</span>`)).join('')}</div>
        <p>Cost: ${M.costText(p, M.weaponCost(s.fam, s.tier), Math.round(10 * s.tier * M.feeMul(p, 'forge')))}</p>
        <button data-a="fcraft">Forge</button></div>
      <div class="card"><h3>Make a tool</h3>
        <div class="picks">${(Object.keys(TOOLS) as GearTool['node'][]).map((t) => this.pick('ttool', t, s.tool === t, TOOLS[t].name)).join('')}</div>
        <p class="dim">${TOOLS[s.tool].text} At this grade: ${modText(TOOLS[s.tool].mods(s.toolTier))}.</p>
        <div class="picks">${grade('ttier', s.toolTier)}</div>
        <p>Cost: ${M.costText(p, M.toolCost(s.tool, s.toolTier), Math.round(8 * s.toolTier * M.feeMul(p, 'forge')))}</p>
        <button data-a="tcraft">Make</button></div>
      <div class="card"><h3>Patterns</h3>${this.patterns('forge')}</div>
      <div class="card wide"><h3>Weapons and tools</h3>${this.gearList(['weapon', 'tool'])}</div></div>`;
  }

  private tWorkshop(): string {
    const p = this.p;
    const choose = p.stations.workshop >= 4;
    return `<div class="cols">${this.station('workshop')}
      <div class="card"><h3>Make a bag</h3>
        <p class="dim">A bag sets how much you carry before the weight slows you, and makes one kind of material 40% lighter${choose ? '' : ' (rolled at random until the workshop is tier IV)'}. Outfitting skill adds comfort.</p>
        ${choose ? `<div class="picks">${(['ore', 'wood', 'herb'] as Mat['cat'][]).map((c) => this.pick('burden', c, this.s.burden === c, `Lighten ${c}`)).join('')}</div>` : ''}
        ${Object.entries(BAG_TYPES).map(([id, b]) => `<div class="line"><div><b>${b.name}</b> <span class="dim">comfort ${b.comfort + p.skills.outfitting.lvl}${p.stations.workshop < b.station ? ` · <span class="short">workshop ${roman(b.station)}</span>` : ''}</span><br>${M.costText(p, b.cost, Math.round(12 * b.station * M.feeMul(p, 'workshop')))}</div><button class="sm" data-a="bcraft" data-v="${id}">Make</button></div>`).join('')}</div>
      <div class="card"><h3>Patterns</h3>${this.patterns('workshop')}</div>
      <div class="card"><h3>Bags</h3>${this.gearList(['bag'])}</div></div>`;
  }

  private tApothecary(): string {
    const p = this.p;
    const s = this.s;
    const have = M.REAGENTS.filter((m) => (p.bank[m.id] ?? 0) >= 2);
    const reagent = (a: string, cur: string) => have.length ? have.map((m) => this.pick(a, m.id, cur === m.id, `${m.name} <span class="dim">×${p.bank[m.id]}</span>`)).join('') : '<p class="dim">You need at least two of a reagent.</p>';
    const book = M.REAGENTS.map((m) => {
      const known = p.book[m.id] ?? [];
      const cells = [...known.map((x) => `<span class="chip">${ATOMS[x].name}</span>`), ...Array(4 - known.length).fill('<span class="chip dim">?</span>')].join(' ');
      return `<div class="line"><div><i class="dot" style="background:${m.color}"></i>${m.name}</div><div>${cells}</div></div>`;
    }).join('');
    const brews = Object.keys(p.brews).filter((k) => p.brews[k] > 0).map((k) => {
      const b = M.parseBrew(k);
      const vol = b.atoms.map((x) => ATOMS[x].volatile).filter(Boolean);
      return `<div class="line"><div><b>${cap(brewName(b))}</b> ×${p.brews[k]}<br><span class="dim">${modText(brewMods(b))} · lasts ${FORM[b.form].lasts}</span>${vol.length ? `<br><span class="short">Volatile: ${vol.join('; ')}.</span>` : ''}</div></div>`;
    }).join('');
    return `<div class="cols">${this.station('apothecary')}
      <div class="card"><h3>Brew</h3><p class="dim">Every reagent hides four effects. Brew two reagents that share one and the brew carries what they share (up to three). Two of each are used. Nothing shared: sludge, and the reagents are gone.</p>
        <h4>First reagent</h4><div class="picks">${reagent('ra', s.ra)}</div>
        <h4>Second reagent</h4><div class="picks">${reagent('rb', s.rb)}</div>
        <h4>Form</h4><div class="picks">${(Object.keys(FORM) as BrewForm[]).map((f) => this.pick('form', f, s.form === f, `${FORM[f].name}${p.stations.apothecary < FORM[f].station ? ` <span class="short">tier ${roman(FORM[f].station)}</span>` : ''}<br><span class="dim">${FORM[f].lasts}</span>`)).join('')}</div>
        ${s.ra && s.rb && M.knownInert(p, s.ra, s.rb) ? '<p class="short">You have tried this pair: they share nothing.</p>' : ''}
        <button data-a="brew" ${s.ra && s.rb && s.ra !== s.rb ? '' : 'disabled'}>Brew</button>
        <p class="dim">Alchemy ${p.skills.alchemy.lvl}: ${(p.skills.alchemy.lvl - 1) * 4}% chance of one more from a batch.</p></div>
      <div class="card"><h3>Reagent book</h3>${book}</div>
      <div class="card"><h3>Brews in storage</h3>${brews || '<p class="dim">None yet.</p>'}</div></div>`;
  }

  private tCodex(): string {
    const p = this.p;
    const rank = M.codexRank(p);
    const next = CODEX_RANKS[rank];
    const groups = (Object.keys(SOURCE_NAME) as SchemSource[]).map((src) => {
      const list = Object.values(SCHEMATICS).filter((s) => s.source === src);
      const frags = p.fragments[src] ?? 0;
      const rows = list.map((s) => {
        const have = p.schematics[s.id] ?? 0;
        const done = p.codex.includes(s.id);
        const name = done || have ? s.name : `<span class="dim">Unknown ${s.kind}</span>`;
        const buttons = have ? `${s.kind === 'recipe' && !done ? `<button class="sm" data-a="learn" data-v="${s.id}">Learn</button>` : ''}${done || s.kind !== 'recipe' ? `<button class="sm alt" data-a="break" data-v="${s.id}">Break</button>` : ''}` : '';
        return `<div class="line"><div>${done ? '✓ ' : ''}${name}${have ? ` <span class="dim">×${have} held</span>` : ''}</div><div>${buttons}</div></div>`;
      }).join('');
      return `<div class="card"><h3>${SOURCE_NAME[src]} <span class="dim">${list.filter((s) => p.codex.includes(s.id)).length}/${list.length}</span></h3>${rows}
        <div class="row"><span class="dim">Fragments ${frags}/4</span><button class="sm" data-a="redeem" data-v="${src}" ${frags >= 4 ? '' : 'disabled'}>Trade four for a missing schematic</button></div></div>`;
    }).join('');
    return `<p>Codex rank ${rank}. ${next ? `${p.codex.length}/${next} for the next rank.` : 'Top rank.'} <span class="dim">Rank 2 lets you choose a second perk at the forge. Recipes are learned for good; patterns are used once at their station; blueprints raise a station. A spare copy breaks into a fragment.</span></p><div class="cols">${groups}</div>`;
  }

  private tStorage(): string {
    const p = this.p;
    const cats: [Mat['cat'], string][] = [['ore', 'Ore'], ['wood', 'Wood'], ['herb', 'Herbs'], ['creature', 'From kills'], ['part', 'Elite and boss parts']];
    const rows = (c: Mat['cat']) => Object.entries(p.bank).filter(([id, n]) => MATS[id].cat === c && n > 0).sort((a, b) => MATS[a[0]].tier - MATS[b[0]].tier).map(([id, n]) => {
      const v = M.sellValue(id);
      return `<div class="line"><div><i class="dot" style="background:${MATS[id].color}"></i>${n} ${MATS[id].name}</div>${v > 0 ? `<div><button class="sm alt" data-a="sellmat" data-v="${id}" ${n >= 10 ? '' : 'disabled'}>Sell 10: ${v * 5} coin</button><button class="sm alt" data-a="donate" data-v="${id}" ${n >= 10 ? '' : 'disabled'}>Give 10: ${v * 5} standing</button></div>` : ''}</div>`;
    }).join('') || '<p class="dim">None.</p>';
    return `<p class="dim">Surplus has two uses: the quartermaster pays a little coin, or it goes to town projects and raises your standing.</p><div class="stack">${cats.map(([c, name]) => `<div class="card"><h3>${name}</h3>${rows(c)}</div>`).join('')}</div>`;
  }

  private tStanding(): string {
    const p = this.p;
    const st = p.standing;
    const offer = M.cardOffer(p);
    const cards = offer ? `<div class="card wide"><h3>Pick one card (${st.pending} to pick)</h3><div class="cols tight">${offer.map((id) => { const c = CARDS.find((x) => x.id === id)!; return this.pick('card', id, false, `<b>${c.name}</b><br><span class="dim">${c.text}</span>`); }).join('')}</div></div>` : '';
    const owned = Object.entries(st.cards).map(([id, n]) => `<p><b>${CARDS.find((c) => c.id === id)!.name}</b>${n > 1 ? ` ×${n}` : ''} <span class="dim">${CARDS.find((c) => c.id === id)!.text}</span></p>`).join('') || '<p class="dim">None yet.</p>';
    const bar = (v: number, max: number) => `<span class="meter"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></span>`;
    const rank = M.masteryRank(p);
    return `<div class="cols">${cards}
      <div class="card"><h3>Town standing ${st.lvl}</h3><p>${bar(st.xp, M.standingFor(st.lvl))} <span class="dim">${st.xp}/${M.standingFor(st.lvl)}. Earned for waves cleared; each level is a card.</span></p><h4>Cards held</h4>${owned}</div>
      <div class="card"><h3>Trade skills</h3>${SKILLS.map((s) => `<div class="line"><div>${cap(s)} ${p.skills[s].lvl}${p.skills[s].lvl >= SKILL_CAP ? ' (cap)' : ''}</div><div>${bar(p.skills[s].xp, skillXpFor(p.skills[s].lvl))}</div></div>`).join('')}
        <p class="dim">Gathering skills add yield. Skinning adds drops. Smithing raises the gear score floor; outfitting adds bag comfort.</p></div>
      <div class="card"><h3>Weapon mastery</h3>${FAMS.map((f) => `<div class="line"><div>${WEAPONS[f].name} ${p.fams[f].lvl}${p.fams[f].lvl >= FAM_CAP ? ' (cap)' : ''}</div><div>${bar(p.fams[f].xp, M.famXpFor(p.fams[f].lvl))}</div></div>`).join('')}</div>
      <div class="card"><h3>Mastery rank ${rank}</h3><p>${bar(M.masteryPoints(p) % 8, 8)} <span class="dim">From every weapon family, trade skill, bag type and codex rank. Ranks open kits, not stats.</span></p>
        ${KITS.filter((k) => k.rank > 0).map((k) => `<p class="${k.rank <= rank ? '' : 'dim'}">Rank ${k.rank}: <b>${k.name}</b>. ${k.text}</p>`).join('')}</div>
      <div class="card"><h3>The pool grows with standing</h3>${Object.entries(POOL_UNLOCK).sort((a, b) => a[1] - b[1]).map(([key, lvl]) => `<p class="${lvl <= st.lvl ? '' : 'dim'}">Standing ${lvl}: ${poolName(key)}${lvl <= st.lvl ? ' ✓' : ''}</p>`).join('')}</div>
      <div class="card"><h3>Record</h3><p>${p.stats.runs} expeditions · ${p.stats.clears} full clears · ${p.stats.deaths} falls · deepest wave ${p.stats.bestWave}</p>
        <p>Best haul ${p.records.haul} node materials · most kills ${p.records.kills}</p>
        <p class="dim">${Object.entries(p.kitBest).map(([k, d]) => `${KITS.find((x) => x.id === k)!.name}: danger ${d}`).join(' · ') || 'No full clear yet.'}</p></div></div>`;
  }

  private tVault(): string {
    const p = this.p;
    const opts = M.vaultOptions(p);
    return `<div class="card"><h3>Weekly vault</h3><p>${p.week.runs} expedition${p.week.runs === 1 ? '' : 's'} completed this week (four waves or more counts). Rows open at 1, 4 and 8. Take one item a week; a missed week costs nothing.</p>
      ${opts.map((o, i) => `<div class="line"><div><b>${o.row}</b> <span class="dim">opens at ${o.need}</span><br>${o.label}</div><button class="sm" data-a="vault" data-v="${i}" ${p.week.claimed || p.week.runs < o.need ? 'disabled' : ''}>Take</button></div>`).join('')}
      ${p.week.claimed ? '<p class="dim">Taken for this week.</p>' : ''}</div>`;
  }

  // ------------------------------------------------------------------ tally
  private tally(run: R.RunState): string {
    const last = run.last!;
    const res = last.res;
    const rows: [string, number, number][] = run.weapons.map((w, i) => [R.weaponName(w), res.dmgBy[i] ?? 0, res.killsBy[i] ?? 0]);
    const n = res.dmgBy.length;
    rows.push(['Heavy swing', res.dmgBy[n - 2] ?? 0, res.killsBy[n - 2] ?? 0], ['Ability and effects', res.dmgBy[n - 1] ?? 0, res.killsBy[n - 1] ?? 0]);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    const weakest = rows.slice(0, run.weapons.length).sort((a, b) => a[1] - b[1])[0];
    return `<h1>Wave ${last.index + 1} cleared</h1>
      <div class="card"><h3>What did the work</h3>
        ${rows.map(([name, dmg, kills], i) => `<div class="tallyrow" style="animation-delay:${i * 0.12}s"><span>${name}</span><span class="meter big"><i style="width:${(dmg / max) * 100}%"></i></span><span>${Math.round(dmg)} damage · ${kills} kills</span></div>`).join('')}
        ${run.weapons.length > 1 && weakest ? `<p class="dim">Weakest weapon this wave: ${weakest[0]}.</p>` : ''}</div>
      <div class="card"><h3>Brought in</h3><p>${this.mats(res.gathered, 'no materials')}</p>
        <p>${Math.round(res.scrap)} scrap${last.levelUps ? ` · level ${run.level}` : ''}${res.objective ? ' · objective done' : ''}${last.found.length ? ` · found ${last.found.map((id) => SCHEMATICS[id].name).join(', ')}` : ''}</p>
        <p class="dim">${Math.round(res.dmgTaken)} damage taken · heat peaked at ${Math.round(res.heatPeak)} · ${res.gatherTime.toFixed(1)}s gathering</p></div>
      ${run.pendingPicks > 0 ? `<div class="card guide"><h3>Level ${run.level - run.pendingPicks + 1}: pick one${run.pendingPicks > 1 ? ` (${run.pendingPicks} to pick)` : ''}</h3><div class="cols tight">${run.pickOffer.map((id) => { const x = LEVEL_PICKS.find((q) => q.id === id)!; return this.pick('levelpick', id, false, `<b>${x.name}</b><br><span class="dim">${cap(modText(x.mods))}</span>`); }).join('')}</div></div>` : `<div class="row"><button data-a="tallyok">Continue</button></div>`}`;
  }

  // ------------------------------------------------------------------- camp
  private status(run: R.RunState): string {
    const m = R.runMods(run);
    const w = R.bagWeight(run, m);
    const over = Math.max(0, w - run.comfort);
    const slow = m.weight >= 1 ? 0 : Math.min(CFG.player.slowMax, over * CFG.player.slowPerWeight);
    return `<div class="status"><span>Health <b>${Math.round(run.hp)}/${R.maxHp(run, m)}</b></span><span>Scrap <b>${run.scrap}</b></span><span>Level <b>${run.level}</b></span>
      <span>Bag <b>${w.toFixed(0)}/${run.comfort}</b>${slow > 0 ? ` <span class="short">${Math.round(slow * 100)}% slower</span>` : ''}</span>
      ${run.heat >= 1 ? `<span>Heat carried in <b>${Math.round(run.heat)}</b></span>` : ''}
      ${run.curse ? `<span class="short">Cursed: ${CURSES[run.curse].text}</span>` : ''}</div>`;
  }
  private weaponCard(run: R.RunState, i: number, withButtons: boolean): string {
    const w = run.weapons[i];
    const d = WEAPONS[w.fam];
    const dmg = d.dmg * TIER_MUL[w.tier] * (0.9 + 0.2 * w.gs) * (w.evolved ? 1.5 : 1);
    const sealed = i >= R.effSlots(run);
    const canMerge = R.mergeTarget(run, w.fam, w.tier, i) >= 0 && !w.evolved;
    return `<div class="line"><div><i class="dot" style="background:${d.color}"></i><b>${R.weaponName(w)}</b> <span class="dim">gear score ${R.weaponGs(w)} · ${dmg.toFixed(0)} every ${d.every}s${sealed ? ' · <span class="short">sealed</span>' : ''}</span></div>
      ${withButtons ? `<div>${canMerge ? `<button class="sm" data-a="merge" data-v="${i}">Merge</button>` : ''}${run.weapons.length > 1 ? `<button class="sm alt" data-a="sell" data-v="${i}">Sell ${R.sellPrice(run, w)}</button>` : ''}</div>` : ''}</div>`;
  }
  private routeCard(run: R.RunState, r: R.Route, i: number): string {
    const g = GROUNDS[r.ground];
    const seg = R.segmentOf(run.wave);
    const matName = MATS[NODE_MAT[g.node][seg]].name;
    let extra = '';
    if (r.shrine) extra = `<br><span class="short">Shrine. A third more enemies this wave, and until the next boss ${CURSES[r.shrine.curse].text}.</span><br>Prize: <b>${SCHEMATICS[r.shrine.prize].name}</b>`;
    else if (r.objective !== 'none') extra = `<br><b>${OBJECTIVES[r.objective].name}${r.elite ? `: ${ELITES.find((e) => e.id === r.elite)!.name}` : ''}.</b> <span class="dim">${OBJECTIVES[r.objective].text}</span>`;
    return this.pick('route', i, run.routePick === i, `<b>${g.name}</b> <span class="dim">${matName}</span><br><span class="dim">${g.text}</span>${extra}`);
  }
  private camp(run: R.RunState): string {
    const next = run.wave;
    const boss = R.isBossWave(next);
    const sets = Object.entries(R.famCounts(run)).map(([f, n]) => {
      const [c1, b1, c2, b2] = WEAPONS[f as Fam].set;
      return `<span class="chip" title="Tier points: a tier III weapon counts three">${WEAPONS[f as Fam].name} set ${n}/${n >= c1 ? c2 : c1}: ${n >= c2 ? modText([...b1, ...b2]) : n >= c1 ? `${modText(b1)}; at ${c2}, ${modText(b2)}` : `at ${c1}, ${modText(b1)}`}</span>`;
    }).join(' ');
    const shop = run.shop.map((o, i) => {
      const why = R.canBuy(run, o);
      let body: string;
      if (o.kind === 'weapon') {
        const d = WEAPONS[o.fam!];
        const merges = run.weapons.length >= R.effSlots(run) && R.mergeTarget(run, o.fam!, o.tier) >= 0;
        body = `<i class="dot" style="background:${d.color}"></i><b>${d.name} ${roman(o.tier)}</b><br><span class="dim">${d.text}${merges ? ' Merges into the one you carry.' : ''}</span>`;
      } else {
        const it = ITEMS[o.item!];
        body = `<b>${it.name}</b><br><span class="dim">${it.heal ? `Heal ${it.heal} now` : cap(modText(it.mods))}</span>`;
      }
      return `<div class="offer${o.sold ? ' sold' : ''}"><div>${body}${why && !o.sold ? `<br><span class="short">${cap(why)}</span>` : ''}</div><div class="row"><button class="sm" data-a="buy" data-v="${i}" ${why ? 'disabled' : ''} title="${why ?? ''}">${o.sold ? 'Sold' : `Buy ${o.price}`}</button>${o.sold ? '' : `<button class="sm alt" data-a="lock" data-v="${i}">${o.locked ? 'Locked' : 'Lock'}</button>`}</div></div>`;
    }).join('');
    const crafts = run.recipes.filter((id) => RECIPES[id].kind !== 'evolution').map((id) => {
      const why = R.canCraft(run, id);
      return `<div class="line"><div><b>${RECIPES[id].name}</b><br><span class="dim">${RECIPES[id].text}${R.craftCost(run, id) !== RECIPES[id].cost!.n ? ` Your kit pays ${R.craftCost(run, id)}.` : ''}</span>${why ? `<br><span class="short">${cap(why)}</span>` : ''}</div><button class="sm" data-a="craft" data-v="${id}" ${why ? 'disabled' : ''}>Craft</button></div>`;
    }).join('');
    const flasks = run.flasks.map((b, i) => `<div class="line"><div><b>${cap(brewName(b))}</b><br><span class="dim">${modText(brewMods(b))}</span></div><button class="sm" data-a="drink" data-v="${i}" ${run.flaskActive ? 'disabled' : ''}>Drink</button></div>`).join('');
    const items = run.items.length ? run.items.map((id) => `<span class="chip">${ITEMS[id].name}: ${modText(ITEMS[id].mods)}</span>`).join(' ') : '<span class="dim">none</span>';
    const active = [...(run.flaskActive ? [`Flask: ${modText(brewMods(run.flaskActive))}`] : []), ...(run.campMods.length ? [`Camp craft: ${modText(run.campMods)}`] : [])];
    return `<div class="head"><h1>Camp</h1><div class="dim">Next: wave ${next + 1} of ${R.runWaves(run)}${boss ? ` · <b>${BOSSES[R.segmentOf(next)].name}</b>` : ''}</div></div>
      ${this.status(run)}${this.note()}
      <div class="cols">
        <div class="card wide"><h3>Shop</h3><div class="shop">${shop}</div>
          <div class="row"><button class="sm alt" data-a="reroll" ${run.scrap < R.rerollCost(run) ? 'disabled' : ''}>Reroll ${R.rerollCost(run) || 'free'}</button><span class="dim">Buy as much as you can afford. Two identical weapons merge into the next tier and reroll its gear score.</span></div></div>
        <div class="card"><h3>Weapons ${run.weapons.length}/${R.effSlots(run)}</h3>${run.weapons.map((_, i) => this.weaponCard(run, i, true)).join('')}<p>${sets}</p>
          <h4>Items</h4><p>${items}</p>${run.picks.length ? `<h4>Level picks</h4><p>${Object.entries(run.picks.reduce<Record<string, number>>((a, id) => ((a[id] = (a[id] ?? 0) + 1), a), {})).map(([id, n]) => `<span class="chip" title="${modText(LEVEL_PICKS.find((q) => q.id === id)!.mods)}">${LEVEL_PICKS.find((q) => q.id === id)!.name}${n > 1 ? ` ×${n}` : ''}</span>`).join(' ')}</p>` : ''}${run.wilds.length ? `<h4>Wild picks</h4>${run.wilds.map((id) => `<p class="dim"><b>${WILDS.find((x) => x.id === id)!.name}.</b> ${WILDS.find((x) => x.id === id)!.text}</p>`).join('')}` : ''}</div>
        ${run.feat.craft ? `<div class="card"><h3>Camp craft <span class="dim">${run.craftsLeft} left</span></h3><p class="dim">Use materials now, or carry them home.</p>${crafts || '<p class="dim">No camp recipes in the loadout.</p>'}
          ${flasks ? `<h4>Flasks</h4>${flasks}` : ''}${active.length ? `<p class="note">${active.join(' · ')}</p>` : ''}</div>` : ''}
        <div class="card"><h3>Bag</h3><p>${this.mats(run.bagMats, 'empty')}</p>${run.bagSchem.length ? `<p>${run.bagSchem.map((id) => `<span class="chip">${SCHEMATICS[id].name}</span>`).join(' ')}</p>` : ''}
          <p class="dim">${run.feat.loss ? `If you fall, ${Math.round((CFG.keptOnDeath + 0.08 * (run.cards.keep ?? 0)) * 100)}% comes home. Extraction is at the boss gates.` : 'Nothing is lost on this expedition.'}</p></div>
        ${run.feat.routes ? `<div class="card wide"><h3>${boss ? 'Where to meet the boss' : 'Next ground'}</h3><div class="cols tight">${run.routeOptions.map((r, i) => this.routeCard(run, r, i)).join('')}</div></div>` : ''}
      </div>
      <div class="row sticky"><button data-a="go">Start wave ${next + 1}</button></div>`;
  }

  // ------------------------------------------------------------------- gate
  private gate(run: R.RunState): string {
    const g = run.gate!;
    const boss = BOSSES[g.boss];
    let chest: string;
    if (!g.killed) chest = `<p>${boss.name} still stands. You outlasted the clock, but there is no chest.</p>`;
    else if (!g.opened) chest = `<p>${boss.name} is down.</p><button data-a="chest">Open the chest</button>`;
    else {
      const parts = R.eliteParts(run);
      const evo = R.evolvable(run).map((i) => parts.map((part) => `<button class="sm" data-a="evolve" data-v="${i}" data-w="${part}">Evolve ${R.weaponName(run.weapons[i])} with ${MATS[part].name} → ${WEAPONS[run.weapons[i].fam].evolved}</button>`).join('')).join('');
      const hint = `No weapon can evolve. It takes a tier ${roman(EVOLVE_TIER)} or higher weapon of a family you brought (${run.abilities.map((f) => WEAPONS[f].name.toLowerCase()).join(', ')}) or hold the recipe for, and the part of a named elite: take a route with a named elite before the boss.`;
      chest = `<p>In the chest: ${g.loot.join(', ')}.</p>${g.final ? '' : evo ? `<h4>Evolution</h4><div class="picks">${evo}</div>` : `<p class="dim">${hint}</p>`}`;
    }
    const wild = g.wildDone ? `<p class="dim">${run.wilds.length ? `Wild picks held: ${run.wilds.map((id) => WILDS.find((x) => x.id === id)!.name).join(', ')}.` : 'No wild pick taken.'}</p>`
      : `<div class="cols tight">${g.wildOffer.map((id) => { const x = WILDS.find((q) => q.id === id)!; return this.pick('wild', id, false, `<b>${x.name}</b><br><span class="dim">${x.text}</span>`); }).join('')}</div><button class="sm alt" data-a="wild" data-v="">Take none</button>`;
    const ready = g.wildDone && (!g.killed || g.opened);
    const keep = Math.round((CFG.keptOnDeath + 0.08 * (run.cards.keep ?? 0)) * 100);
    const nextSeg = g.boss + 1;
    const deeper = g.final ? '' : `<p class="dim">Deeper: waves ${run.wave + 1}–${run.wave + 4}, ${['', 'skysteel, oldwood and silkweed', 'sunmetal, heartwood and ghostbloom'][nextSeg]}, then ${BOSSES[nextSeg].name} and its own schematics. Only a full clear raises the key.</p>`;
    return `<div class="head"><h1>Boss gate ${g.boss + 1}</h1><div class="dim">${g.final ? 'The expedition ends here.' : 'Extract with the bag, or push on.'}</div></div>
      ${this.status(run)}${this.note()}
      <div class="cols">
        <div class="card"><h3>Chest</h3>${chest}</div>
        ${g.final ? '' : `<div class="card"><h3>Wild pick</h3><p class="dim">One rule to bend for the rest of the expedition.</p>${wild}</div>`}
        <div class="card"><h3>Weapons</h3>${run.weapons.map((_, i) => this.weaponCard(run, i, false)).join('')}</div>
        <div class="card"><h3>Bag</h3><p>${this.mats(run.bagMats, 'empty')}</p>${run.bagSchem.length ? `<p>${run.bagSchem.map((id) => `<span class="chip">${SCHEMATICS[id].name}</span>`).join(' ')}</p>` : ''}
          <p class="dim">Extract and all of it is banked. ${run.feat.loss ? `Fall later and ${keep}% comes home.` : ''}</p>${deeper}</div>
      </div>
      <div class="row sticky"><button data-a="extract" ${ready ? '' : 'disabled'}>${g.final ? 'Return to town' : 'Extract'}</button>${g.final ? '' : `<button class="alt" data-a="push" ${ready ? '' : 'disabled'}>Push on</button>`}${ready ? '' : `<span class="dim">${g.final ? 'Open the chest first.' : g.killed ? 'Deal with the chest and the wild pick first.' : 'Take or decline the wild pick first.'}</span>`}</div>`;
  }

  // ---------------------------------------------------------------- summary
  private summaryHtml(): string {
    const s = this.summary!;
    const run = this.doneRun!;
    const title = (s.race ? 'Weekly race: ' : '') + (s.outcome === 'cleared' ? 'Full clear' : s.outcome === 'extracted' ? `Extracted after wave ${s.waves}` : `Fell in wave ${s.waves + 1}`);
    const lostAny = Object.keys(s.lost).length > 0 || s.schemLost > 0;
    const t = run.totals;
    const top = [...run.weapons].sort((a, b) => b.dmg - a.dmg)[0];
    return `<h1>${title}</h1>
      <div class="cols">
        <div class="card"><h3>Banked</h3><p>${this.mats(s.kept, 'nothing')}</p>${s.schemKept.length ? `<p>${s.schemKept.map((id) => `<span class="chip">${SCHEMATICS[id].name}</span>`).join(' ')}</p>` : ''}
          ${lostAny ? `<h4 class="short">Lost with the bag</h4><p>${this.mats(s.lost, 'no materials')}${s.schemGone.map((id) => ` <span class="chip">${SCHEMATICS[id].name}</span>`).join('')}</p>` : ''}
          <p>${s.coin} coin${s.keyUp ? ` · <b>the key rises to danger ${this.p.key}</b>` : ''}</p>${s.keyWhy ? `<p class="dim">${s.keyWhy}</p>` : ''}</div>
        <div class="card"><h3>What the session paid</h3>${s.lines.map((x) => `<p>${x}</p>`).join('')}</div>
        <div class="card"><h3>The expedition</h3><p>${t.kills} kills · ${t.bosses} boss${t.bosses === 1 ? '' : 'es'} · ${t.elites} named elite${t.elites === 1 ? '' : 's'} · level ${run.level}</p>
          <p>${Math.round(t.dmgTaken)} damage taken · heat peaked at ${Math.round(t.heatPeak)} · ${t.gatherTime.toFixed(0)}s gathering · ${t.crafts} camp craft${t.crafts === 1 ? '' : 's'}</p>
          ${top ? `<p>Best weapon: ${R.weaponName(top)}, ${Math.round(top.dmg)} damage.</p>` : ''}
          ${s.outcome === 'died' ? `<p class="dim">${deathHint(run)}</p>` : ''}</div>
      </div>
      <div class="row"><button data-a="town">Back to town</button></div>`;
  }
}

/** A failed run should show the player what to change. */
function deathHint(run: R.RunState): string {
  const t = run.totals;
  const last = run.last?.res;
  if (!last?.died) return 'You left the expedition, which counts as a fall.';
  if (last && last.heatPeak > 75) return 'Heat was above 75 when you fell. Each strike brings more enemies; leave the ore alone until it cools.';
  if (R.bagWeight(run) > run.comfort * 4) return 'The bag was more than four times what it carries in comfort, so you were slow and stamina came back late. Extract earlier or craft a bigger bag.';
  if (run.weapons.length < 4) return 'You fell with fewer than four weapons. Spend scrap on weapons first and merge pairs.';
  if (t.crafts === 0 && run.feat.craft) return 'No camp crafts were used. A mending tonic costs four herbs.';
  return 'Shield-bearers and armoured bosses only break to the heavy swing; keep stamina for it.';
}

const CONTROLS = `<div class="controls">
  <div><b>Desktop</b> WASD move · mouse aims · hold left button to wind up the heavy swing, release to strike · Space dodges · E or right button uses the ability · Q swaps ability · P pauses · M mutes</div>
  <div><b>Touch</b> left thumb moves · right thumb: hold to wind up, drag to aim, release to strike · buttons for dodge, ability and swap</div></div>`;
