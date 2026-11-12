// The Canvas2D renderer and its presentation-side effects (chips, numbers,
// ghosts, rings, shake). It reads the sim and never writes to it.
//
// Draw order, bottom to top:
//   floor, lane marks, telegraphs (spawn marks, charge lanes, slam rings,
//   work rings), shards, pickups, then everything that stands sorted by
//   foot line (nodes, stumps, enemies, the player and their weapons), then
//   melee arcs, player shots, chips, the treeline, enemy shots, the player's
//   head mark, the hurt tick, numbers, and the low-health hatch at the edges.
// Enemy shots and the player's marks go over everything in the clearing so
// they are never lost.
//
// Cost rules (phones spend most of a frame filling canvas pixels): every new
// mark is a baked sprite or one short path; nothing fills the screen with
// alpha; telegraphs that do not threaten the player are drawn as outlines.
import {
  INK, MADDER, OCHRE, OUTLINE, drawChargeLane, drawFloor, drawSlamRing, drawSprite, drawTreeline, drawWorkRing,
  type Sprite, type Sprites,
} from '../art/index.ts';
import {
  AI, ENEMIES, ES, HZ_RING, MAX_ENEMIES, MAX_ESHOTS, MAX_HAZARDS, MAX_PICKUPS, MAX_SHOTS,
  NODE_RING, PK_SCRIP, SOURCE_IDS, pickTier, SPAWN_TELL, WEAPONS, weaponRange,
  type Enemy, type Run, type SimEvent,
} from '../../sim/index.ts';

const MOSS = '#7C8C5A';
const T_MITE = 0, T_GNAT = 1, T_BOAR = 2, T_SPITTER = 3, T_MAGPIE = 4, T_BURROWER = 5, T_BRUTE = 6, T_STAG = 7, T_ROT = 8, T_TUSK = 9;

const MAX_CHIPS = 220;
const MAX_NUMS = 36;
const MAX_GHOSTS = 40;
const MAX_RINGS = 24;
const MAX_SWEEP = 140;
/** Seconds between two hit-stops asked for by the player's own hits and kills. */
const STOP_GAP = 0.3;
const MAX_REMNANTS = 20;
/** View margin kept between the arena edge and the screen edge, so the treeline shows. */
const EDGE = 96;
const CULL = 90;

// Draw-list kinds for the y-sort.
const K_ENEMY = 0, K_NODE = 1, K_REMNANT = 2, K_PLAYER = 3, K_GHOST = 4;
const MAX_ITEMS = MAX_ENEMIES + 256 + MAX_REMNANTS + MAX_GHOSTS + 4;
const BUCKET_PX = 3;
/** Ring colours by drop tier: blue, purple, orange. */
const TIER_RING: readonly string[] = ['', '', '#3E6C8A', '#7B4BA0', '#D99A2B'];

export interface Renderer {
  resize(cssW: number, cssH: number, dpr: number): void;
  setSprites(s: Sprites): void;
  /** Feed one sim event. Call before the queue is cleared. */
  event(ev: SimEvent): void;
  /** Advance effects by real seconds (not called during hit-stop). */
  update(dt: number): void;
  draw(alpha: number): void;
  /** Put the camera on the player at once (wave start). */
  snap(): void;
  /** World point to css px inside the canvas. */
  screenX(x: number): number;
  screenY(y: number): number;
  viewW(): number;
  /** World units to css px: 0.75 on phones, 1 on a laptop, more on a big screen. */
  zoom(): number;
  /** Seconds of hit-stop asked for by events since the last call. */
  takeFreeze(): number;
  /** Css px of each screen edge covered by the HUD. The camera keeps the player out from under them. */
  setInsets(top: number, right: number, bottom: number, left: number): void;
  /** Stand a teaching pointer over a world point; null takes it away. */
  pointAt(x: number | null, y?: number): void;
  /** One beat of the low-health hatch (called with the heart sound). */
  pulse(): void;
  /** Pickups still flying in after a wave end. */
  sweeping(): number;
  /** The name of what last hurt the player, '' if nothing has. */
  lastHurtBy(): string;
  /** Extra drawing in world space: `under` on the ground before anything stands on it, `over` above what stands. */
  under?: (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => void;
  over?: (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => void;
  shake: boolean;
  /** prefers-reduced-motion: no optional hit-stop, no pulsing, rings do not grow. */
  reduced: boolean;
  /** Entities drawn last frame, for the perf readout. */
  drawn: number;
}

export function createRenderer(canvas: HTMLCanvasElement, sprites0: Sprites, run: Run): Renderer {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  /** The node pool and the ground are the run's own: a clearing, or a whole zone on an outing. */
  const NODES = run.nodes.length, ARENA_W = run.w, ARENA_H = run.h;
  let S = sprites0;
  let cssW = 1, cssH = 1, dpr = 1, zoom = 1, scale = 1;
  let vw = 1, vh = 1; // view size in world units
  let camX = 0, camY = 0, lookX = 0, lookY = 0;
  let camReady = false;
  let time = 0;
  let trauma = 0, shakeX = 0, shakeY = 0;
  let freeze = 0;
  let hurtFlash = 0;
  let insT = 0, insR = 0, insB = 0, insL = 0;
  let lastStop = -10;
  let pointX = 0, pointY = 0, pointOn = false;
  let beatT = 0;
  // Where the last hit came from: unit direction, age, and the name of the source.
  let tickX = 0, tickY = 0, tickAge = 10, tickLife = 0.75, hurtBy = '';
  // One line of large type over the player (a level gained).
  let callText = '', callAge = 10;
  const CALL_LIFE = 1.25;
  let playerFlip = false;
  let stride = 0;
  let fontReady = false, fontAsked = false;

  // ---- tables that depend on the sprite set ------------------------------
  let enemyWalk: (readonly [Sprite, Sprite])[] = [];
  let pickupSprite: Sprite[] = [];
  let shotSprite: Sprite[] = [];
  let shotSpin = new Float32Array(SOURCE_IDS.length);
  let weaponIcon: Sprite[] = [];
  let playerWalk: readonly [Sprite, Sprite] = S.player.greenhorn.walk;
  function bind(): void {
    const e = S.enemy;
    enemyWalk = [e.mite.walk, e.gnat.walk, e.boar.walk, e.spitter.walk, e.magpie.walk, e.burrower.walk, e.brute.walk, e.stag.walk, e.rotwood.walk, e.tusk.walk];
    pickupSprite = [S.pickup.scrip, S.pickup.timber, S.pickup.ore, S.pickup.hide,
      // Outing materials, two tiers of each: wood, ore, hide, fibre.
      S.pickup.timber, S.pickup.timber, S.pickup.ore, S.pickup.ore, S.pickup.hide, S.pickup.hide, S.pickup.fibre, S.pickup.fibre,
      // Forge game: tier 2 wood, ore, hide; a part, a schematic, a relic.
      S.pickup.timber, S.pickup.ore, S.pickup.hide, S.pickup.hide, S.pickup.fibre, S.pickup.scrip];
    shotSprite = SOURCE_IDS.map((id) =>
      id === 'sling' ? S.shot.stone : id === 'bow' ? S.shot.arrow : id === 'musket' ? S.shot.ball : id === 'axe' ? S.shot.axe
        : id === 'bola' ? S.shot.bola : id === 'shards' ? S.chip.ochre[1] : S.shot.stone);
    shotSpin = new Float32Array(SOURCE_IDS.length);
    SOURCE_IDS.forEach((id, i) => { shotSpin[i] = id === 'axe' ? 20 : id === 'bola' ? 12 : id === 'shards' ? 9 : 0; });
    weaponIcon = WEAPONS.map((w) => S.icon.weapon[w.id as keyof typeof S.icon.weapon].s);
    playerWalk = S.player[run.character].walk;
  }
  bind();

  // ---- effect pools --------------------------------------------------------
  const chipX = new Float32Array(MAX_CHIPS), chipY = new Float32Array(MAX_CHIPS);
  const chipVX = new Float32Array(MAX_CHIPS), chipVY = new Float32Array(MAX_CHIPS);
  const chipRot = new Float32Array(MAX_CHIPS), chipVR = new Float32Array(MAX_CHIPS);
  const chipLife = new Float32Array(MAX_CHIPS);
  const chipKind = new Uint8Array(MAX_CHIPS); // colour * 4 + shape
  let chipNext = 0;
  const C_INK = 0, C_OCHRE = 1, C_MADDER = 2, C_SPRUCE = 3;
  let rs = 0x2545f491;
  const rnd = (): number => {
    rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
    return (rs >>> 0) / 4294967296;
  };
  function chips(x: number, y: number, n: number, colour: number, speed: number, dirX = 0, dirY = 0): void {
    for (let k = 0; k < n; k++) {
      const i = chipNext; chipNext = (chipNext + 1) % MAX_CHIPS;
      const a = rnd() * 6.2832, v = speed * (0.45 + rnd() * 0.75);
      chipX[i] = x; chipY[i] = y;
      chipVX[i] = Math.cos(a) * v + dirX * speed * 0.7; chipVY[i] = Math.sin(a) * v * 0.8 + dirY * speed * 0.7 - 30;
      chipRot[i] = a; chipVR[i] = (rnd() - 0.5) * 22;
      chipLife[i] = 0.22 + rnd() * 0.2;
      chipKind[i] = colour * 4 + ((rnd() * 4) | 0);
    }
  }

  const numX = new Float32Array(MAX_NUMS), numY = new Float32Array(MAX_NUMS), numAge = new Float32Array(MAX_NUMS);
  const numVal = new Float32Array(MAX_NUMS), numUid = new Int32Array(MAX_NUMS).fill(-1);
  const numKind = new Uint8Array(MAX_NUMS); // 0 hit, 1 crit, 2 hurt
  const numText: string[] = new Array(MAX_NUMS).fill('');
  const NUM_LIFE = 0.62, NUM_MERGE = 0.34;
  /** Above this many live figures, ordinary hits are added up per patch of ground instead of per target. */
  const NUM_CROWD = 9;
  const NUM_PATCH_X = 70, NUM_PATCH_Y = 54;
  let numLive = 0;
  function number(x: number, y: number, v: number, kind: number, uid: number, label = ''): void {
    let slot = -1, oldest = -1, oldestAge = -1, patch = -1, live = 0;
    for (let i = 0; i < MAX_NUMS; i++) {
      if (uid !== -1 && numUid[i] === uid && numAge[i] < NUM_MERGE) { slot = i; break; }
      if (numAge[i] >= NUM_LIFE) { if (slot < 0) slot = i; continue; }
      live++;
      if (numAge[i] > oldestAge && numKind[i] !== 2) { oldestAge = numAge[i]; oldest = i; }
      if (kind === 0 && patch < 0 && numKind[i] === 0 && numAge[i] < NUM_MERGE && Math.abs(numX[i] - x) < NUM_PATCH_X && Math.abs(numY[i] - y) < NUM_PATCH_Y) patch = i;
    }
    numLive = live;
    // The player's own figure: one at a time, so two hits never print over each other.
    if (uid === -2) for (let i = 0; i < MAX_NUMS; i++) if (numUid[i] === -2 && numAge[i] < NUM_LIFE) { slot = i; if (numAge[i] >= NUM_MERGE) numVal[i] = 0; numAge[i] = 0; break; }
    const same = slot >= 0 && numUid[slot] === uid && uid !== -1 && numAge[slot] < NUM_MERGE;
    if (same) {
      numVal[slot] += v;
      if (kind > numKind[slot]) numKind[slot] = kind;
      numAge[slot] = 0;
      numX[slot] = x; numY[slot] = y;
    } else if (patch >= 0 && live >= NUM_CROWD) {
      // A crowd: one figure per patch, standing where it first appeared.
      slot = patch;
      numVal[slot] += v;
      numAge[slot] = Math.min(numAge[slot], 0.1);
    } else {
      if (slot < 0) slot = oldest;
      if (slot < 0) return;
      numVal[slot] = v; numKind[slot] = kind; numAge[slot] = 0; numUid[slot] = uid;
      numX[slot] = x; numY[slot] = y;
    }
    const shown = Math.max(1, Math.round(numVal[slot]));
    numText[slot] = numKind[slot] === 2 ? (label ? `-${shown} ${label}` : `-${shown}`) : String(shown);
  }
  numAge.fill(NUM_LIFE);

  const ghostX = new Float32Array(MAX_GHOSTS), ghostY = new Float32Array(MAX_GHOSTS), ghostLife = new Float32Array(MAX_GHOSTS);
  const ghostType = new Uint8Array(MAX_GHOSTS), ghostFlip = new Uint8Array(MAX_GHOSTS);
  let ghostNext = 0;
  const GHOST_LIFE = 0.085;

  const ringX = new Float32Array(MAX_RINGS), ringY = new Float32Array(MAX_RINGS), ringR = new Float32Array(MAX_RINGS);
  const ringR0 = new Float32Array(MAX_RINGS), ringLife = new Float32Array(MAX_RINGS), ringDur = new Float32Array(MAX_RINGS);
  const ringKind = new Uint8Array(MAX_RINGS); // 0 slam landed (ink), 1 burst (ochre), 2 level (ochre, double), 3 arrival (madder, double)
  let ringNext = 0;
  function ring(x: number, y: number, r: number, r0: number, kind: number, dur: number): void {
    const i = ringNext; ringNext = (ringNext + 1) % MAX_RINGS;
    ringX[i] = x; ringY[i] = y; ringR[i] = r; ringR0[i] = r0; ringKind[i] = kind; ringLife[i] = dur; ringDur[i] = dur;
  }

  const remX = new Float32Array(MAX_REMNANTS), remY = new Float32Array(MAX_REMNANTS);
  const remKind = new Uint8Array(MAX_REMNANTS); // type * 2 + rich, 255 = empty
  remKind.fill(255);
  let remNext = 0;
  const nodeKick = new Uint8Array(NODES);
  const enemyFlip = new Uint8Array(MAX_ENEMIES);
  const pullFrom = new Float32Array(MAX_PICKUPS);
  // What stood at the last draw, so a wave end can show what it swept away.
  const pickupWas = new Uint8Array(MAX_PICKUPS), enemyWas = new Uint8Array(MAX_ENEMIES), eshotWas = new Uint8Array(MAX_ESHOTS);
  // Pickups flying in at a wave end: from where, what, and when each starts and lands.
  const sweepX = new Float32Array(MAX_SWEEP), sweepY = new Float32Array(MAX_SWEEP);
  const sweepT = new Float32Array(MAX_SWEEP), sweepDur = new Float32Array(MAX_SWEEP);
  const sweepKind = new Uint8Array(MAX_SWEEP);
  let sweepN = 0, sweepLeft = 0;
  // Telegraphs that threaten the player this frame, drawn last and in full.
  const hotLane = new Int16Array(MAX_ENEMIES);

  // ---- y-sort ----------------------------------------------------------------
  let bucketCount = 1;
  let head = new Int32Array(1), tail = new Int32Array(1);
  const next = new Int32Array(MAX_ITEMS);
  const itemKind = new Uint8Array(MAX_ITEMS), itemIdx = new Int16Array(MAX_ITEMS);
  const itemX = new Float32Array(MAX_ITEMS), itemY = new Float32Array(MAX_ITEMS);
  let items = 0;
  function push(kind: number, idx: number, x: number, y: number): void {
    if (items >= MAX_ITEMS) return;
    let b = ((y - camY + CULL) / BUCKET_PX) | 0;
    if (b < 0) b = 0; else if (b >= bucketCount) b = bucketCount - 1;
    const i = items++;
    itemKind[i] = kind; itemIdx[i] = idx; itemX[i] = x; itemY[i] = y; next[i] = -1;
    if (head[b] < 0) head[b] = i; else next[tail[b]] = i;
    tail[b] = i;
  }

  // ---- telegraph cache ----------------------------------------------------------
  // The kit's charge lane and slam ring are a clip plus a hatch: fine for a
  // few, slow for twenty. They only vary by kind and by how far they have
  // filled, so each (shape, fill step) is drawn once to its own canvas.
  const FILL_STEPS = 8;
  const TPAD = 6;
  const laneCache = new Map<number, HTMLCanvasElement>();
  const ringCache = new Map<number, HTMLCanvasElement>();
  function bakeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
    const g = c.getContext('2d')!;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    return [c, g];
  }
  function laneSprite(type: number, len: number, hw: number, step: number): HTMLCanvasElement {
    const key = type * 16 + step;
    let c = laneCache.get(key);
    if (!c) {
      const made = bakeCanvas(len + TPAD * 2, hw * 2 + TPAD * 2);
      c = made[0];
      drawChargeLane(made[1], TPAD, hw + TPAD, TPAD + len, hw + TPAD, hw, step / FILL_STEPS);
      laneCache.set(key, c);
    }
    return c;
  }
  function ringSprite(r: number, step: number): HTMLCanvasElement {
    const key = Math.round(r) * 16 + step;
    let c = ringCache.get(key);
    if (!c) {
      const made = bakeCanvas((r + TPAD) * 2, (r + TPAD) * 2);
      c = made[0];
      drawSlamRing(made[1], r + TPAD, r + TPAD, r, step / FILL_STEPS);
      ringCache.set(key, c);
    }
    return c;
  }

  function trauma_(v: number): void { trauma = Math.min(1, trauma + v); }
  /** A short hit-stop for the player's own big hits and kills, at most one every STOP_GAP. */
  function stop(seconds: number): void {
    if (self.reduced || time - lastStop < STOP_GAP) return;
    lastStop = time;
    freeze = Math.max(freeze, seconds);
  }
  /** Where a hit of this enemy type came from, as a unit vector from the player. False if nothing fits. */
  function hurtFrom(type: number): boolean {
    const p = run.player;
    let bx = 0, by = 0, bd = 1e12;
    // A shot that was in the air at the last draw and is gone now, close by: it came along its own line.
    for (let i = 0; i < MAX_ESHOTS; i++) {
      const s = run.eshots[i];
      if (s.alive || !eshotWas[i] || s.type !== type) continue;
      const d = (s.x - p.x) * (s.x - p.x) + (s.y - p.y) * (s.y - p.y);
      if (d < 70 * 70 && d < bd) { bd = d; bx = -s.vx; by = -s.vy; }
    }
    if (bd === 1e12) {
      for (let i = 0; i < MAX_ENEMIES; i++) {
        const e = run.enemies[i];
        if (!e.alive || e.type !== type) continue;
        const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
        if (d < bd) { bd = d; bx = e.x - p.x; by = e.y - p.y; }
      }
    }
    const len = Math.hypot(bx, by);
    if (bd === 1e12 || len < 0.5) return false;
    tickX = bx / len; tickY = by / len;
    return true;
  }
  const inView = (x: number, y: number, m: number): boolean => x > camX - m && x < camX + vw + m && y > camY - m && y < camY + vh + m;

  function event(ev: SimEvent): void {
    const p = run.player;
    switch (ev.type) {
      case 'hit':
      case 'crit': {
        const e = run.enemies[ev.b];
        if (!inView(ev.x, ev.y, 40)) break;
        const top = e ? enemyTop(e) : 30;
        number(ev.x, ev.y - top, ev.a, ev.type === 'crit' ? 1 : 0, e ? e.uid : -1);
        const dx = ev.x - p.x, dy = ev.y - p.y, d = Math.hypot(dx, dy) || 1;
        chips(ev.x, ev.y - (e ? e.r : 10), ev.type === 'crit' ? 3 : 1, C_MADDER, 150, dx / d, dy / d);
        // A big hit: a third of a tough enemy's health in one blow. Two frames of stop and a nudge.
        if (e && e.maxHp >= 30 && ev.a >= 12 && ev.a >= e.maxHp * 0.3) { stop(0.034); trauma_(0.12); chips(ev.x, ev.y - e.r, 4, C_INK, 220, dx / d, dy / d); }
        break;
      }
      case 'kill': {
        if (!inView(ev.x, ev.y, 60)) break;
        const rank = ev.b;
        const dx = ev.x - p.x, dy = ev.y - p.y, d = Math.hypot(dx, dy) || 1;
        const r = ENEMIES[ev.a]?.r ?? 12;
        chips(ev.x, ev.y - r, rank > 0 ? 18 : r > 20 ? 7 : 3, C_MADDER, rank > 0 ? 330 : 210, dx / d, dy / d);
        chips(ev.x, ev.y - r, rank > 0 ? 8 : 1, C_INK, rank > 0 ? 260 : 170, dx / d, dy / d);
        const g = ghostNext; ghostNext = (ghostNext + 1) % MAX_GHOSTS;
        ghostX[g] = ev.x; ghostY[g] = ev.y; ghostType[g] = ev.a; ghostLife[g] = GHOST_LIFE * (rank > 0 ? 2.5 : 1);
        ghostFlip[g] = dx > 0 ? 1 : 0;
        if (rank === 0 && r > 20) { stop(0.034); trauma_(0.1); }
        break;
      }
      case 'hurt': {
        hurtBy = ENEMIES[ev.b]?.name ?? '';
        number(p.x, p.y - 104, ev.a, 2, -2, hurtBy);
        chips(p.x, p.y - 20, 5, C_OCHRE, 230);
        trauma_(0.42);
        freeze = Math.max(freeze, 0.06);
        hurtFlash = 2;
        if (hurtFrom(ev.b)) { tickAge = 0; tickLife = 0.75; }
        break;
      }
      case 'shieldBreak':
        chips(p.x, p.y - 20, 6, C_INK, 240);
        break;
      case 'secondWind':
        ring(p.x, p.y, 70, 0, 1, 0.14);
        trauma_(0.3);
        break;
      case 'death':
        chips(p.x, p.y - 20, 14, C_OCHRE, 300);
        chips(p.x, p.y - 20, 6, C_INK, 220);
        trauma_(0.7);
        freeze = Math.max(freeze, 0.12);
        // The tick stays through the beat that follows, pointing at what did it.
        hurtBy = ENEMIES[ev.a]?.name ?? hurtBy;
        if (tickAge < tickLife || hurtFrom(ev.a)) { tickAge = 0; tickLife = 3; }
        break;
      case 'work': {
        for (let i = 0; i < NODES; i++) if (run.nodes[i].alive && run.nodes[i].x === ev.x && run.nodes[i].y === ev.y) nodeKick[i] = 4;
        chips(ev.x, ev.y - 26, 2, ev.a === 0 || ev.a === 3 ? C_SPRUCE : ev.a === 1 ? C_INK : C_OCHRE, 150);
        chips(ev.x, ev.y - 26, 1, C_OCHRE, 130);
        break;
      }
      case 'break': {
        chips(ev.x, ev.y - 24, 7, ev.a === 0 || ev.a === 3 ? C_SPRUCE : C_INK, 260);
        chips(ev.x, ev.y - 24, 5, C_OCHRE, 220);
        const el = run.eliteIdx >= 0 ? run.enemies[run.eliteIdx] : null;
        const walking = el && el.alive && el.type === T_ROT && Math.abs(el.x - ev.x) < 2 && Math.abs(el.y - ev.y) < 2;
        if (!walking) {
          const i = remNext; remNext = (remNext + 1) % MAX_REMNANTS;
          remX[i] = ev.x; remY[i] = ev.y; remKind[i] = ev.a * 2 + (ev.b ? 1 : 0);
        }
        break;
      }
      case 'levelup':
        // An event: two Ochre rings out to arm's length and beyond, a burst of chips, the level in large type.
        ring(p.x, p.y, 150, 0, 2, 0.5);
        ring(p.x, p.y, 92, 0, 2, 0.34);
        chips(p.x, p.y - 22, 14, C_OCHRE, 330);
        chips(p.x, p.y - 22, 4, C_INK, 240);
        callText = `Level ${ev.a}`; callAge = 0;
        break;
      case 'slam':
        ring(ev.x, ev.y, ev.a, ev.b, 0, 0.07);
        if (inView(ev.x, ev.y, ev.a)) trauma_(Math.min(0.34, 0.1 + ev.a / 700));
        break;
      case 'burst': {
        // A chain of kill bursts would paper the clearing with rings; three at a time is enough to read it.
        let live = 0;
        for (let i = 0; i < MAX_RINGS; i++) if (ringLife[i] > 0 && ringKind[i] === 1) live++;
        if (live < 3) ring(ev.x, ev.y, ev.a, 0, 1, 0.1);
        chips(ev.x, ev.y - 8, 3, C_OCHRE, 260);
        break;
      }
      case 'eliteSpawn':
        trauma_(0.3);
        ring(ev.x, ev.y, 130, 0, 3, 0.4);
        freeze = Math.max(freeze, 0.05);
        break;
      case 'bossSpawn':
        trauma_(0.55);
        ring(ev.x, ev.y, 190, 0, 3, 0.5);
        freeze = Math.max(freeze, 0.066);
        break;
      case 'bossPhase':
        trauma_(0.55);
        ring(ev.x, ev.y, 150, 0, 3, 0.4);
        break;
      case 'eliteDeath':
        trauma_(0.5);
        freeze = Math.max(freeze, 0.066);
        chips(ev.x, ev.y - 30, 16, C_INK, 320);
        break;
      case 'waveEnd': {
        // What the wave end took off the floor flies in; what it killed pops.
        sweepN = 0;
        let seen = 0;
        for (let i = 0; i < MAX_PICKUPS; i++) {
          const k = run.pickups[i];
          if (k.alive || !pickupWas[i]) continue;
          pickupWas[i] = 0;
          seen++;
          if (sweepN >= MAX_SWEEP || !inView(k.x, k.y, 200)) continue;
          const d = Math.hypot(k.x - p.x, k.y - p.y);
          const j = sweepN++;
          sweepX[j] = k.x; sweepY[j] = k.y; sweepKind[j] = k.kind;
          sweepT[j] = -Math.min(0.3, d / 2400) - rnd() * 0.06;
          sweepDur[j] = 0.3 + Math.min(0.3, d / 1800);
        }
        sweepLeft = sweepN;
        for (let i = 0; i < MAX_ENEMIES; i++) {
          const e = run.enemies[i];
          if (e.alive || !enemyWas[i]) continue;
          enemyWas[i] = 0;
          if (!inView(e.x, e.y, 40)) continue;
          const g = ghostNext; ghostNext = (ghostNext + 1) % MAX_GHOSTS;
          ghostX[g] = e.x; ghostY[g] = e.y; ghostType[g] = e.type; ghostLife[g] = GHOST_LIFE * 2; ghostFlip[g] = e.x > p.x ? 1 : 0;
          if (seen < 400) chips(e.x, e.y - e.r, 2, C_MADDER, 190);
        }
        ring(p.x, p.y, 210, 0, 2, 0.55);
        break;
      }
      case 'bossDeath':
        trauma_(0.85);
        freeze = Math.max(freeze, 0.12);
        break;
      case 'steal':
        chips(ev.x, ev.y - 10, 2, C_OCHRE, 120);
        break;
      case 'waveStart':
        // A new node may have been placed where an old stump stood.
        for (let i = 0; i < MAX_REMNANTS; i++) {
          if (remKind[i] === 255) continue;
          for (let n = 0; n < NODES; n++) {
            const nd = run.nodes[n];
            if (nd.alive && Math.abs(nd.x - remX[i]) < 110 && Math.abs(nd.y - remY[i]) < 90) { remKind[i] = 255; break; }
          }
        }
        numAge.fill(NUM_LIFE); chipLife.fill(0); ghostLife.fill(0); ringLife.fill(0);
        break;
    }
  }

  function enemyTop(e: Enemy): number {
    const sp = enemyWalk[e.type]?.[0];
    return (sp ? sp.ay : 30) + 6;
  }

  function update(dt: number): void {
    time += dt;
    for (let i = 0; i < MAX_CHIPS; i++) {
      if (chipLife[i] <= 0) continue;
      chipLife[i] -= dt;
      chipX[i] += chipVX[i] * dt; chipY[i] += chipVY[i] * dt;
      const k = 1 - 5.5 * dt;
      chipVX[i] *= k; chipVY[i] = chipVY[i] * k + 260 * dt;
      chipRot[i] += chipVR[i] * dt;
    }
    for (let i = 0; i < MAX_NUMS; i++) if (numAge[i] < NUM_LIFE) numAge[i] += dt;
    for (let i = 0; i < MAX_GHOSTS; i++) if (ghostLife[i] > 0) ghostLife[i] -= dt;
    for (let i = 0; i < MAX_RINGS; i++) if (ringLife[i] > 0) ringLife[i] -= dt;
    if (sweepLeft > 0) {
      let left = 0;
      for (let i = 0; i < sweepN; i++) { if (sweepT[i] < sweepDur[i]) { sweepT[i] += dt; if (sweepT[i] < sweepDur[i]) left++; } }
      sweepLeft = left;
    }
    if (tickAge < tickLife) tickAge += dt;
    if (callAge < CALL_LIFE) callAge += dt;
    if (beatT > 0) beatT -= dt;
    trauma = Math.max(0, trauma - dt * 2.1);
    if (run.player.moving) stride += dt;
  }

  function resize(w: number, h: number, ratio: number): void {
    cssW = Math.max(1, w); cssH = Math.max(1, h); dpr = ratio;
    const size = Math.sqrt(cssW * cssH);
    zoom = size < 760 ? 0.75 : size < 1500 ? 1 : size < 2100 ? 1.25 : 1.5;
    scale = dpr * zoom;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    vw = cssW / zoom; vh = cssH / zoom;
    bucketCount = Math.ceil((vh + CULL * 2) / BUCKET_PX) + 2;
    head = new Int32Array(bucketCount); tail = new Int32Array(bucketCount);
    camReady = false;
    laneCache.clear(); ringCache.clear();
    edgeStrips = null;
  }

  // The camera may run past the clearing by as much as the HUD covers, so a
  // player in a corner is still out from under the panels. What shows there
  // is the forest.
  function clampCam(x: number, y: number): void {
    const minX = -EDGE - insL / zoom, maxX = ARENA_W + EDGE - vw + insR / zoom;
    const minY = -EDGE - insT / zoom, maxY = ARENA_H + EDGE - vh + insB / zoom;
    camX = maxX < minX ? (ARENA_W - vw) / 2 : x < minX ? minX : x > maxX ? maxX : x;
    camY = maxY < minY ? (ARENA_H - vh) / 2 : y < minY ? minY : y > maxY ? maxY : y;
  }

  const snapPx = (v: number): number => Math.round(v * scale) / scale;

  // ---- low health: a Madder hatch along the screen edges ------------------------
  // Baked once per size as four strips at two depths, so a frame costs four
  // blits and never a full-screen fill.
  let edgeStrips: HTMLCanvasElement[] | null = null;
  const EDGE_DEPTH = [18, 30];
  function bakeEdges(): HTMLCanvasElement[] {
    const out: HTMLCanvasElement[] = [];
    for (const depth of EDGE_DEPTH) {
      for (let side = 0; side < 2; side++) {
        const w = side === 0 ? cssW : depth, h = side === 0 ? depth : cssH;
        const c = document.createElement('canvas');
        c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
        const g = c.getContext('2d')!;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.strokeStyle = MADDER;
        g.lineWidth = 2.5;
        g.beginPath();
        for (let k = -h; k < w + h; k += 8) { g.moveTo(k, h + 1); g.lineTo(k + h + 2, -1); }
        g.stroke();
        g.lineWidth = OUTLINE;
        g.beginPath();
        if (side === 0) { g.moveTo(0, depth - 1.5); g.lineTo(w, depth - 1.5); } else { g.moveTo(depth - 1.5, 0); g.lineTo(depth - 1.5, h); }
        g.stroke();
        out.push(c);
      }
    }
    return out;
  }
  function drawLowHealth(): void {
    if (!edgeStrips) edgeStrips = bakeEdges();
    const deep = beatT > 0 && !self.reduced ? 1 : 0;
    const d = EDGE_DEPTH[deep];
    const top = edgeStrips[deep * 2], sideStrip = edgeStrips[deep * 2 + 1];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(top, 0, 0, cssW, d);
    ctx.save();
    ctx.translate(0, cssH); ctx.scale(1, -1);
    ctx.drawImage(top, 0, 0, cssW, d);
    ctx.restore();
    ctx.drawImage(sideStrip, 0, d * dpr, d * dpr, (cssH - d * 2) * dpr, 0, d, d, cssH - d * 2);
    ctx.save();
    ctx.translate(cssW, 0); ctx.scale(-1, 1);
    ctx.drawImage(sideStrip, 0, d * dpr, d * dpr, (cssH - d * 2) * dpr, 0, d, d, cssH - d * 2);
    ctx.restore();
  }

  function ngon(x: number, y: number, rx: number, ry: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * 6.2832;
      const px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function enemySprite(e: Enemy, i: number): Sprite {
    const st = e.state;
    const f = (((time * (st === ES.Charge ? 14 : e.type === T_GNAT ? 12 : 6) + i * 0.37) | 0) & 1) as 0 | 1;
    const en = S.enemy;
    switch (e.type) {
      case T_BOAR: return st === ES.Windup ? en.boar.windup : en.boar.walk[f];
      case T_SPITTER: return st === ES.Windup ? en.spitter.spit : en.spitter.walk[f];
      case T_MAGPIE: return st === ES.Flee || e.n > 0 ? en.magpie.carry[f] : en.magpie.walk[f];
      case T_BURROWER: return st === ES.Burrowed || st === ES.Surfacing ? en.burrower.mound : en.burrower.walk[f];
      case T_BRUTE: return st === ES.Slam ? en.brute.slam : en.brute.walk[f];
      case T_STAG: return st === ES.Windup ? en.stag.windup : en.stag.walk[f];
      case T_TUSK:
        return st === ES.Summon ? en.tusk.phase[1] : st === ES.Slam ? en.tusk.phase[2] : st === ES.Windup ? en.tusk.phase[0] : en.tusk.walk[f];
      default: return (enemyWalk[e.type] ?? enemyWalk[T_MITE])[f];
    }
  }

  function chargeLen(type: number, t: number, charging: boolean): number {
    const sp = type === T_BOAR ? AI.boarChargeSpeed : type === T_STAG ? AI.stagChargeSpeed : AI.tuskChargeSpeed;
    const full = type === T_BOAR ? AI.boarChargeTime : type === T_STAG ? AI.stagChargeTime : AI.tuskChargeTime;
    return sp * (charging ? Math.max(0, t) : full);
  }
  function chargeTell(type: number): number {
    return type === T_BOAR ? AI.boarTell : type === T_STAG ? AI.stagTell : AI.tuskTell;
  }

  function drawPlayer(x: number, y: number): void {
    const p = run.player;
    if (p.moving && Math.abs(p.fx) > 0.2) playerFlip = p.fx < 0;
    const f = p.moving ? ((((stride * 8) | 0) & 1) as 0 | 1) : 0;
    const bob = p.moving && f === 1 ? -2 : 0;
    const dead = run.phase === 'over' && !run.won;
    // The i-frame flicker: every other pair of frames the print drops to its Ink block.
    const blink = p.iframes > 0 && (((time * 30) | 0) & 3) < 2;
    const body = hurtFlash > 0 || blink || dead ? playerWalk[f].ink : playerWalk[f];
    const n = p.weapons.length;
    const cx = x, cy = y - 17;
    // Weapons behind the body first, then the body, then the ones in front.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const w = p.weapons[i];
        const a = -1.5708 + ((i + 0.5) / n) * 6.2832 + (n === 1 ? 2.2 : 0);
        const oy = Math.sin(a) * 13;
        if ((oy < 0) !== (pass === 0)) continue;
        let wx = cx + Math.cos(a) * 25, wy = cy + oy + Math.sin(time * 2.4 + i * 1.7) * 1.5;
        let rot = 0;
        if (w.swing > 0 && w.swingDur > 0) {
          const k = 1 - w.swing / w.swingDur;
          const s = Math.sin(k * 3.1416);
          const def = WEAPONS[w.def];
          if (def.kind === 'shot') { wx -= w.ax * s * 6; wy -= w.ay * s * 6; }
          else {
            wx += w.ax * s * 15; wy += w.ay * s * 15;
            if (def.kind === 'sweep') rot = (w.flip ? 1 : -1) * (k - 0.5) * 1.9;
          }
        }
        drawSprite(ctx, dead ? weaponIcon[w.def].ink : weaponIcon[w.def], snapPx(wx), snapPx(wy), w.ax < 0, 0.66, rot);
      }
      if (pass === 0) drawSprite(ctx, body, snapPx(x), snapPx(y + bob), playerFlip);
    }
  }

  function draw(alpha: number): void {
    const p = run.player;
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;

    // Camera: the player with a little look-ahead, eased, clamped to the
    // clearing, and centred in the part of the screen the HUD leaves open.
    const wantLX = p.moving ? p.fx * 56 : 0, wantLY = p.moving ? p.fy * 40 : 0;
    const offX = (insL - insR) / 2 / zoom, offY = (insT - insB) / 2 / zoom;
    if (!camReady) { lookX = 0; lookY = 0; clampCam(px - vw / 2 - offX, py - vh / 2 - offY); camReady = true; }
    else {
      lookX += (wantLX - lookX) * 0.045; lookY += (wantLY - lookY) * 0.045;
      const tx = px + lookX - vw / 2 - offX, ty = py + lookY - vh / 2 - offY;
      clampCam(camX + (tx - camX) * 0.16, camY + (ty - camY) * 0.16);
    }
    if (self.shake && trauma > 0) {
      const m = trauma * trauma * 7;
      shakeX = Math.sin(time * 91.7) * m; shakeY = Math.cos(time * 77.3) * m;
    } else { shakeX = 0; shakeY = 0; }
    const cx = snapPx(camX + shakeX), cy = snapPx(camY + shakeY);
    const x0 = cx - CULL, x1 = cx + vw + CULL, y0 = cy - CULL, y1 = cy + vh + CULL;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = MOSS;
    ctx.fillRect(0, 0, vw, vh);
    drawFloor(ctx, S.floor, cx, cy, vw, vh);
    ctx.translate(-cx, -cy);
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';

    // Lane mouths open this wave: two Madder chevrons pointing in.
    ctx.strokeStyle = MADDER;
    ctx.lineWidth = OUTLINE;
    ctx.beginPath();
    for (let i = 0; i < run.laneCount; i++) {
      const lx = run.lanes[i * 2], ly = run.lanes[i * 2 + 1];
      if (lx < x0 - 60 || lx > x1 + 60 || ly < y0 - 60 || ly > y1 + 60) continue;
      const dx = ARENA_W / 2 - lx, dy = ARENA_H / 2 - ly, d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      for (let k = 0; k < 2; k++) {
        const bx = lx + ux * (34 + k * 16), by = ly + uy * (34 + k * 16);
        ctx.moveTo(bx - uy * 13 - ux * 9, by + ux * 13 - uy * 9);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + uy * 13 - ux * 9, by - ux * 13 - uy * 9);
      }
    }
    ctx.stroke();

    self.under?.(ctx, x0, y0, x1, y1);

    // Work rings.
    for (let i = 0; i < NODES; i++) {
      const n = run.nodes[i];
      if (!n.alive || n.x < x0 - NODE_RING || n.x > x1 + NODE_RING || n.y < y0 - NODE_RING || n.y > y1 + NODE_RING) continue;
      drawWorkRing(ctx, n.x, n.y, NODE_RING, n.work / n.need);
    }
    const elite = run.eliteIdx >= 0 ? run.enemies[run.eliteIdx] : null;
    if (elite && elite.alive && elite.type === T_ROT && elite.state !== ES.Spawn) {
      drawWorkRing(ctx, elite.px + (elite.x - elite.px) * alpha, elite.py + (elite.y - elite.py) * alpha, AI.rotWorkRing, elite.work / AI.rotWork);
    }

    // Slam rings and shards.
    for (let i = 0; i < MAX_HAZARDS; i++) {
      const h = run.hazards[i];
      if (!h.alive) continue;
      if (h.x < x0 - h.r1 || h.x > x1 + h.r1 || h.y < y0 - h.r1 || h.y > y1 + h.r1) continue;
      if (h.kind === HZ_RING) {
        const prog = Math.max(0, Math.min(1, 1 - h.t / h.dur));
        // A ring the player is in, or a step from, is drawn in full. The rest
        // keep their outline: enough to see coming, not a red carpet.
        const hd = Math.hypot(h.x - px, h.y - py);
        if (hd > h.r1 + 44 || hd < h.r0 - 44) {
          if (h.r1 <= 200 && h.r0 <= 0) {
            const sp = ringSprite(h.r1, 0);
            const side = (h.r1 + TPAD) * 2;
            ctx.drawImage(sp, snapPx(h.x - h.r1 - TPAD), snapPx(h.y - h.r1 - TPAD), side, side);
          } else {
            ctx.strokeStyle = MADDER;
            ctx.lineWidth = OUTLINE;
            ctx.beginPath();
            ngon(h.x, h.y, h.r1, h.r1, 20);
            if (h.r0 > 0) ngon(h.x, h.y, h.r0, h.r0, 20);
            ctx.stroke();
          }
        } else if (h.r0 > 0) {
          // A band: the kit's ring hatches a whole disc, so cut the middle out.
          ctx.save();
          ctx.beginPath();
          ctx.rect(h.x - h.r1 - 4, h.y - h.r1 - 4, h.r1 * 2 + 8, h.r1 * 2 + 8);
          ngon(h.x, h.y, h.r0, h.r0, 20);
          ctx.clip('evenodd');
          drawSlamRing(ctx, h.x, h.y, h.r1, prog * (1 - h.r0 / h.r1));
          ctx.restore();
        } else if (h.r1 <= 200) {
          const sp = ringSprite(h.r1, Math.round(prog * FILL_STEPS));
          const side = (h.r1 + TPAD) * 2;
          ctx.drawImage(sp, snapPx(h.x - h.r1 - TPAD), snapPx(h.y - h.r1 - TPAD), side, side);
        } else drawSlamRing(ctx, h.x, h.y, h.r1, prog);
      } else if (h.t > 0.9 || (((time * 10) | 0) & 1) === 0) {
        drawSprite(ctx, S.shot.shard, snapPx(h.x), snapPx(h.y), false, 1, i * 1.3);
      }
    }

    // Spawn marks: the ones near the player at the outline weight, the rest thin.
    for (let pass = 0; pass < 2; pass++) {
      let marks = 0;
      ctx.strokeStyle = MADDER;
      ctx.lineWidth = pass === 0 ? 1.5 : OUTLINE;
      ctx.beginPath();
      for (let i = 0; i < MAX_ENEMIES; i++) {
        const e = run.enemies[i];
        if (!e.alive || e.state !== ES.Spawn) continue;
        if (e.x < x0 || e.x > x1 || e.y < y0 || e.y > y1) continue;
        const near = Math.abs(e.x - px) < 230 && Math.abs(e.y - py) < 230;
        if (near !== (pass === 1)) continue;
        const k = Math.max(0, Math.min(1, e.t / SPAWN_TELL));
        const r = e.r * (0.9 + k * 0.9);
        ctx.moveTo(e.x - r, e.y); ctx.lineTo(e.x, e.y - r * 0.55); ctx.lineTo(e.x + r, e.y); ctx.lineTo(e.x, e.y + r * 0.55); ctx.closePath();
        marks++;
      }
      if (marks) ctx.stroke();
    }
    // Charge lanes. A lane that crosses the player, or passes within a step,
    // is drawn last with its hatch filling; the others are a dashed outline.
    let hot = 0;
    const lane = (i: number, full_: boolean): void => {
      const e = run.enemies[i];
      const charging = e.state === ES.Charge;
      const full = chargeLen(e.type, 0, false);
      const len = charging ? Math.min(full, chargeLen(e.type, e.t, true)) : full;
      const ex = e.px + (e.x - e.px) * alpha, ey = e.py + (e.y - e.py) * alpha;
      const fill = !full_ ? 0 : charging ? 1 : Math.max(0, Math.min(1, 1 - e.t / chargeTell(e.type)));
      const hw = e.r + 5;
      const sp = laneSprite(e.type, full, hw, Math.round(fill * FILL_STEPS));
      // A charge under way shows only what is left of its lane: the far end of the same print.
      const cut = full - len;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(Math.atan2(e.dy, e.dx));
      ctx.drawImage(sp, cut * scale, 0, sp.width - cut * scale, sp.height, cut > 0 ? 0 : -TPAD, -hw - TPAD, len + (cut > 0 ? TPAD : TPAD * 2), hw * 2 + TPAD * 2);
      ctx.restore();
    };
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const e = run.enemies[i];
      if (!e.alive || (e.state !== ES.Windup && e.state !== ES.Charge)) continue;
      if (e.type !== T_BOAR && e.type !== T_STAG && e.type !== T_TUSK) continue;
      const charging = e.state === ES.Charge;
      const full = chargeLen(e.type, 0, false);
      const len = charging ? Math.min(full, chargeLen(e.type, e.t, true)) : full;
      if (len < 24) continue;
      // Distance from the player to the lane's centre line.
      const rx = px - e.x, ry = py - e.y;
      const along = Math.max(0, Math.min(len, rx * e.dx + ry * e.dy));
      const off = Math.hypot(rx - e.dx * along, ry - e.dy * along);
      if (off < e.r + 5 + 40) hotLane[hot++] = i; else lane(i, false);
    }
    for (let k = 0; k < hot; k++) lane(hotLane[k], true);

    // Pickups lie on the ground. Pulled ones lag, then catch up: it reads as acceleration.
    for (let i = 0; i < MAX_PICKUPS; i++) {
      const k = run.pickups[i];
      pickupWas[i] = k.alive ? 1 : 0;
      if (!k.alive) { pullFrom[i] = 0; continue; }
      let x = k.px + (k.x - k.px) * alpha, y = k.py + (k.y - k.py) * alpha;
      let sc = 1;
      if (k.pulled) {
        const dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
        if (pullFrom[i] === 0) pullFrom[i] = Math.max(d, 1);
        const d0 = pullFrom[i];
        if (d < d0 && d > 0.5) {
          const u = 1 - d / d0;
          const shown = d0 * (1 - u * u);
          x = px + (dx / d) * shown; y = py + (dy / d) * shown;
          sc = 1 - u * 0.3;
        }
      } else pullFrom[i] = 0;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      // Above plain, a ring in the drop's colour: the colour is known before the name.
      const pt = k.kind >= 12 ? pickTier(k.kind) : 1;
      if (pt >= 2) {
        const r = (pt === 4 ? 22 : pt === 3 ? 18 : 14) + ((Math.sin(time * 6 + i) * 0.5 + 0.5) * (pt - 1));
        ctx.lineWidth = pt >= 3 ? 4 : 3;
        ctx.strokeStyle = TIER_RING[pt];
        ctx.beginPath(); ctx.arc(snapPx(x), snapPx(y), r, 0, 6.2832); ctx.stroke();
      }
      drawSprite(ctx, pickupSprite[k.kind] ?? pickupSprite[PK_SCRIP], snapPx(x), snapPx(y), false, pt >= 3 ? sc * 1.35 : sc);
    }
    // The wave-end sweep: what was left on the floor flies to the player.
    if (sweepLeft > 0) {
      for (let i = 0; i < sweepN; i++) {
        const t = sweepT[i], dur = sweepDur[i];
        if (t >= dur) continue;
        const u = t <= 0 ? 0 : t / dur, e = u * u;
        const x = sweepX[i] + (px - sweepX[i]) * e, y = sweepY[i] + (py - 16 - sweepY[i]) * e;
        drawSprite(ctx, pickupSprite[sweepKind[i]] ?? pickupSprite[PK_SCRIP], snapPx(x), snapPx(y), false, 1 - e * 0.35);
      }
    }

    // Everything that stands, sorted by foot line.
    head.fill(-1);
    items = 0;
    for (let i = 0; i < MAX_REMNANTS; i++) {
      if (remKind[i] === 255 || remX[i] < x0 || remX[i] > x1 || remY[i] < y0 || remY[i] > y1) continue;
      push(K_REMNANT, i, remX[i], remY[i]);
    }
    for (let i = 0; i < NODES; i++) {
      const n = run.nodes[i];
      if (!n.alive || n.x < x0 - 60 || n.x > x1 + 60 || n.y < y0 || n.y > y1 + 120) continue;
      push(K_NODE, i, n.x, n.y);
    }
    for (let i = 0; i < MAX_GHOSTS; i++) if (ghostLife[i] > 0) push(K_GHOST, i, ghostX[i], ghostY[i]);
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const e = run.enemies[i];
      enemyWas[i] = e.alive ? 1 : 0;
      if (!e.alive || e.state === ES.Spawn) continue;
      const x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
      const m = e.r > 30 ? 60 : 0;
      if (x < x0 - m || x > x1 + m || y < y0 || y > y1 + m + 40) continue;
      push(K_ENEMY, i, x, y);
    }
    push(K_PLAYER, 0, px, py);
    self.drawn = items;

    const nodeIds = ['tree', 'seam', 'carcass', 'plant', 'chest'] as const;
    for (let b = 0; b < bucketCount; b++) {
      for (let it = head[b]; it >= 0; it = next[it]) {
        const x = itemX[it], y = itemY[it], idx = itemIdx[it];
        switch (itemKind[it]) {
          case K_ENEMY: {
            const e = run.enemies[idx];
            if (e.dx < -0.12) enemyFlip[idx] = 1; else if (e.dx > 0.12) enemyFlip[idx] = 0;
            const sp = enemySprite(e, idx);
            let ox = 0;
            if (e.state === ES.Windup && e.type !== T_SPITTER) ox = (((time * 40) | 0) & 1) * 2 - 1;
            drawSprite(ctx, e.flash > 0 ? sp.ink : sp, snapPx(x + ox), snapPx(y), enemyFlip[idx] === 1);
            break;
          }
          case K_NODE: {
            const n = run.nodes[idx];
            const set = S.node[nodeIds[n.type] ?? 'tree'];
            const stage = Math.min(3, Math.floor((n.work / n.need) * 4));
            let ox = 0;
            if (nodeKick[idx] > 0) { ox = (nodeKick[idx] & 1) === 0 ? 2 : -2; nodeKick[idx]--; }
            drawSprite(ctx, (n.rich ? set.rich : set.normal)[stage], snapPx(x + ox), snapPx(y));
            break;
          }
          case K_REMNANT: {
            const set = S.node[nodeIds[remKind[idx] >> 1] ?? 'tree'];
            drawSprite(ctx, remKind[idx] & 1 ? set.richRemnant : set.remnant, snapPx(x), snapPx(y));
            break;
          }
          case K_GHOST: {
            // Death pop: the Ink block of the thing, squashed, for a few frames.
            const sp = (enemyWalk[ghostType[idx]] ?? enemyWalk[T_MITE])[0].ink;
            ctx.save();
            ctx.translate(snapPx(x), snapPx(y));
            ctx.scale(ghostFlip[idx] ? -1.18 : 1.18, 0.72);
            ctx.drawImage(sp.canvas, -sp.ax, -sp.ay, sp.w, sp.h);
            ctx.restore();
            break;
          }
          case K_PLAYER: {
            // A heavy ground mark, Ink with an Ochre line: no coin or raw looks like it.
            drawSprite(ctx, S.mark.ground, snapPx(x), snapPx(y));
            drawPlayer(x, y);
            break;
          }
        }
      }
    }
    if (hurtFlash > 0) hurtFlash--;

    // Melee arcs, anchored on the wielder.
    for (let i = 0; i < p.weapons.length; i++) {
      const w = p.weapons[i];
      if (w.swing <= 0 || w.swingDur <= 0) continue;
      const def = WEAPONS[w.def];
      if (def.kind === 'shot') continue;
      const k = 1 - w.swing / w.swingDur;
      const frames = def.kind === 'sweep' ? S.arc.sweep : S.arc.thrust;
      const sp = frames[k < 0.55 ? 0 : 1];
      const s = weaponRange(p, def) / (def.kind === 'sweep' ? 48 : 58);
      ctx.save();
      ctx.translate(snapPx(px), snapPx(py - 16));
      ctx.rotate(Math.atan2(w.ay, w.ax));
      const sy = def.kind === 'sweep' ? s : Math.min(s, 1.5);
      ctx.scale(s, w.flip ? -sy : sy);
      ctx.drawImage(sp.canvas, -sp.ax, -sp.ay, sp.w, sp.h);
      ctx.restore();
    }

    // Player shots.
    for (let i = 0; i < MAX_SHOTS; i++) {
      const s = run.shots[i];
      if (!s.alive) continue;
      const x = s.px + (s.x - s.px) * alpha, y = s.py + (s.y - s.py) * alpha;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const spin = shotSpin[s.src] ?? 0;
      drawSprite(ctx, shotSprite[s.src] ?? S.shot.stone, snapPx(x), snapPx(y - 14), false, s.crit ? 1.35 : 1,
        spin ? time * spin + i : Math.atan2(s.vy, s.vx));
    }

    // Chips.
    const chipSets = [S.chip.ink, S.chip.ochre, S.chip.madder, S.chip.spruce];
    for (let i = 0; i < MAX_CHIPS; i++) {
      if (chipLife[i] <= 0) continue;
      const x = chipX[i], y = chipY[i];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      drawSprite(ctx, chipSets[chipKind[i] >> 2][chipKind[i] & 3], snapPx(x), snapPx(y), false, 1, chipRot[i]);
    }

    // Landed slams and bursts: a hard ring for a few frames.
    for (let i = 0; i < MAX_RINGS; i++) {
      if (ringLife[i] <= 0) continue;
      const k = self.reduced ? 1 : 1 - ringLife[i] / ringDur[i];
      const kind = ringKind[i];
      ctx.strokeStyle = kind === 0 ? INK : kind === 3 ? MADDER : OCHRE;
      ctx.lineWidth = OUTLINE;
      const r = kind === 0 ? ringR[i] : kind === 1 ? ringR[i] * (0.55 + 0.45 * k) : ringR[i] * (0.25 + 0.75 * Math.sqrt(k));
      ctx.beginPath();
      ngon(ringX[i], ringY[i], r, r, 20);
      if (ringR0[i] > 0) ngon(ringX[i], ringY[i], ringR0[i], ringR0[i], 20);
      // Level and arrival rings are doubled, with an Ink ring between, so they read on Moss and over a crowd.
      if (kind >= 2 && r > 16) ngon(ringX[i], ringY[i], r - 9, r - 9, 20);
      ctx.stroke();
      if (kind >= 2 && r > 16) {
        ctx.strokeStyle = INK;
        ctx.beginPath();
        ngon(ringX[i], ringY[i], r - 4.5, r - 4.5, 20);
        ctx.stroke();
      }
    }

    self.over?.(ctx, x0, y0, x1, y1);
    drawTreeline(ctx, S.treeline, { x: 0, y: 0, w: ARENA_W, h: ARENA_H });

    // Enemy shots: over everything in the clearing, a heavy Ink rim round a
    // Madder core, turned to their heading.
    const pulse = (((time * 7) | 0) & 1) === 0 ? 1 : 1.12;
    for (let i = 0; i < MAX_ESHOTS; i++) {
      const s = run.eshots[i];
      eshotWas[i] = s.alive ? 1 : 0;
      if (!s.alive) continue;
      const x = s.px + (s.x - s.px) * alpha, y = s.py + (s.y - s.py) * alpha;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      drawSprite(ctx, S.shot.spit, snapPx(x), snapPx(y - 12), false, (s.r / 7) * pulse, Math.atan2(s.vy, s.vx));
    }

    // The player's head mark, over the crowd, the treeline and the shots. It steps, it does not glide.
    if (run.phase !== 'over' || run.won) {
      const hop = self.reduced ? 0 : (((time * 2.5) | 0) & 1) * 3;
      drawSprite(ctx, S.mark.head, snapPx(px), snapPx(py - 84 - hop));
    }
    // Where the last hit came from.
    if (tickAge < tickLife && (tickAge > 0.24 || (((tickAge * 25) | 0) & 1) === 0)) {
      const d = 52;
      drawSprite(ctx, S.mark.tick, snapPx(px + tickX * d), snapPx(py - 20 + tickY * d), false, tickLife > 1 ? 1.3 : 1, Math.atan2(tickY, tickX));
    }
    if (pointOn) {
      const hop = self.reduced ? 0 : (((time * 3) | 0) & 1) * 5;
      drawSprite(ctx, S.mark.point, snapPx(pointX), snapPx(pointY - 118 - hop));
    }

    // Edge chevrons for things behind the edge of the screen: Madder for the
    // elite or boss, Ochre for the nearest node when none is in view.
    const edgeMark = (ex: number, ey: number, colour: string, count: number): void => {
      const m = 26 / zoom;
      if (!(ex < cx || ex > cx + vw || ey < cy || ey > cy + vh)) return;
      const ax = Math.max(cx + m + insL / zoom, Math.min(cx + vw - m - insR / zoom, ex));
      const ay = Math.max(cy + m + Math.max(70, insT) / zoom, Math.min(cy + vh - m - insB / zoom, ey));
      const dx = ex - ax, dy = ey - ay, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, w = 11 / zoom;
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? INK : colour;
        ctx.lineWidth = (pass === 0 ? OUTLINE * 2.4 : OUTLINE) / zoom;
        ctx.beginPath();
        for (let k = 0; k < count; k++) {
          const bx = ax - ux * k * w, by = ay - uy * k * w;
          ctx.moveTo(bx - uy * w - ux * w * 0.8, by + ux * w - uy * w * 0.8);
          ctx.lineTo(bx, by);
          ctx.lineTo(bx + uy * w - ux * w * 0.8, by - ux * w - uy * w * 0.8);
        }
        ctx.stroke();
      }
    };
    if (elite && elite.alive) edgeMark(elite.x, elite.y, MADDER, 2);
    {
      let best = -1, bestD = Infinity, inView = false;
      const pl = run.player;
      for (let i = 0; i < run.nodes.length; i++) {
        const n = run.nodes[i];
        if (!n.alive) continue;
        if (n.x >= cx && n.x <= cx + vw && n.y >= cy && n.y <= cy + vh) { inView = true; break; }
        const d2 = (n.x - pl.x) * (n.x - pl.x) + (n.y - pl.y) * (n.y - pl.y);
        if (d2 < bestD) { bestD = d2; best = i; }
      }
      if (!inView && best >= 0) edgeMark(run.nodes[best].x, run.nodes[best].y, OCHRE, 1);
    }

    // Damage numbers, one per target, in the one typeface.
    if (!fontReady) {
      // Never draw a figure in a fallback face: wait for the one typeface.
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
      fontReady = !fonts || fonts.check('700 15px "Zilla Slab"');
      if (!fontReady) { if (!fontAsked) { fontAsked = true; void fonts!.load('700 15px "Zilla Slab"'); } lowHealth(); return; }
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    for (let pass = 0; pass < 3; pass++) {
      let set = false;
      for (let i = 0; i < MAX_NUMS; i++) {
        if (numAge[i] >= NUM_LIFE || numKind[i] !== pass) continue;
        if (!set) {
          set = true;
          const px_ = (pass === 0 ? 15 : 20) / zoom;
          ctx.font = `700 ${px_}px "Zilla Slab", serif`;
          ctx.fillStyle = pass === 0 ? INK : pass === 1 ? OCHRE : MADDER;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 3 / zoom;
        }
        const a = numAge[i];
        const rise = a < 0.08 ? (a / 0.08) * 10 : 10 + (a - 0.08) * 22;
        const x = snapPx(numX[i]), y = snapPx(numY[i] - rise);
        if (pass > 0) ctx.strokeText(numText[i], x, y);
        ctx.fillText(numText[i], x, y);
      }
    }
    // A level gained: its number in large type over the player for a second.
    if (callAge < CALL_LIFE) {
      const a = callAge;
      const rise = a < 0.1 ? (a / 0.1) * 14 : 14 + (a - 0.1) * 8;
      ctx.font = `700 ${30 / zoom}px "Zilla Slab", serif`;
      ctx.fillStyle = OCHRE;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5 / zoom;
      const x = snapPx(px), y = snapPx(py - 128 - rise);
      ctx.strokeText(callText, x, y);
      ctx.fillText(callText, x, y);
    }
    lowHealth();
  }

  function lowHealth(): void {
    const p = run.player;
    if (run.phase === 'wave' && p.hp > 0 && p.hp / Math.max(1, p.maxHp) <= 0.3) drawLowHealth();
  }

  const self: Renderer = {
    resize, event, update, draw,
    setSprites(s) { S = s; bind(); },
    snap() { camReady = false; },
    screenX: (x) => (x - camX) * zoom,
    screenY: (y) => (y - camY) * zoom,
    viewW: () => cssW,
    zoom: () => zoom,
    takeFreeze() { const f = freeze; freeze = 0; return f; },
    setInsets(t, r, b, l) { insT = t; insR = r; insB = b; insL = l; },
    pointAt(x, y = 0) { pointOn = x !== null; if (x !== null) { pointX = x; pointY = y; } },
    pulse() { beatT = 0.16; },
    sweeping: () => sweepLeft,
    lastHurtBy: () => hurtBy,
    shake: true,
    reduced: false,
    drawn: 0,
  };
  return self;
}
