// Sim events to the audio kit. Panning follows screen x. Weapon sounds are
// throttled per class on top of the kit's own caps, so six weapons do not
// machine-gun.
//
// Telegraphs: a late wave starts three to six tells a second, which as sound
// is a rattle with nothing in it. Only a tell that can reach the player is
// played at full level and ducks the rest; the others are quiet and rare.
import { audio, type SoundId } from '../audio/index.ts';
import {
  AI, ENEMIES, PK_SCRIP, TELL_CHARGE, TELL_SLAM, TELL_SPIT, TELL_SUMMON, TELL_SURFACE, WEAPONS, type Run, type SimEvent,
} from '../../sim/index.ts';

const WORK: SoundId[] = ['chop', 'clink', 'scrape'];
const BREAK: SoundId[] = ['chopBreak', 'clinkBreak', 'scrapeBreak'];

interface WeaponVoice { id: SoundId; pitch: number; gain: number }
const VOICE: Record<string, WeaponVoice> = {
  hatchet: { id: 'edge', pitch: 1, gain: 1 },
  pick: { id: 'blunt', pitch: 1.15, gain: 0.9 },
  knife: { id: 'edge', pitch: 1.4, gain: 0.7 },
  maul: { id: 'blunt', pitch: 0.72, gain: 1.15 },
  pike: { id: 'edge', pitch: 0.85, gain: 0.95 },
  sling: { id: 'shot', pitch: 1.25, gain: 0.75 },
  bow: { id: 'shot', pitch: 1, gain: 0.9 },
  musket: { id: 'musket', pitch: 1, gain: 1 },
  axe: { id: 'edge', pitch: 0.7, gain: 0.9 },
  brand: { id: 'blunt', pitch: 1.3, gain: 0.8 },
  bola: { id: 'shot', pitch: 0.75, gain: 0.8 },
  buckler: { id: 'blunt', pitch: 0.95, gain: 0.85 },
};
/** Shortest gap, in seconds, between two plays of a throttled sound. */
const GAP: Partial<Record<SoundId, number>> = { edge: 0.11, blunt: 0.13, shot: 0.1, musket: 0.2, hit: 0.045, crit: 0.08, kill: 0.05, telegraph: 0.12 };
/** Least gap between two tells that are not aimed at the player. */
const FAR_TELL_GAP = 0.7;

/** How far from the player a tell of each kind still matters, in world px. */
function tellReach(kind: number, type: number): number {
  if (kind === TELL_CHARGE) {
    const id = ENEMIES[type]?.id;
    const len = id === 'stag' ? AI.stagChargeSpeed * AI.stagChargeTime : id === 'tusk' ? AI.tuskChargeSpeed * AI.tuskChargeTime : AI.boarChargeSpeed * AI.boarChargeTime;
    return len + 60;
  }
  if (kind === TELL_SPIT) return 460;
  if (kind === TELL_SLAM) return 280;
  if (kind === TELL_SURFACE) return 200;
  return 1e9;
}

export interface RunSound {
  event(ev: SimEvent, screenX: number, viewW: number): void;
}

export function createRunSound(run: Run): RunSound {
  const last = new Map<SoundId, number>();
  let farTellAt = -10;
  const play = (id: SoundId, pan: number, pitch = 1, gain = 1): void => {
    const gap = GAP[id];
    if (gap !== undefined) {
      const now = performance.now() / 1000;
      if (now - (last.get(id) ?? -10) < gap) return;
      last.set(id, now);
    }
    audio.play(id, { pan, pitch, gain });
  };
  return {
    event(ev, sx, vw) {
      const pan = Math.max(-0.8, Math.min(0.8, ((sx - vw / 2) / (vw / 2)) * 0.8));
      switch (ev.type) {
        case 'attack': {
          const v = VOICE[WEAPONS[ev.a]?.id ?? ''];
          if (v) play(v.id, 0, v.pitch, v.gain * 0.8);
          break;
        }
        case 'hit': play('hit', pan, 1, 0.8); break;
        case 'crit': play('crit', pan); break;
        case 'kill': play('kill', pan, ENEMIES[ev.a] && ENEMIES[ev.a].r > 20 ? 0.75 : 1); break;
        case 'hurt': play('hurt', 0); break;
        case 'dodge': play('dodge', 0); break;
        case 'pickup':
          if (ev.a === PK_SCRIP) play('scrip', 0, 1, 0.8); else play('pickup', 0);
          break;
        case 'work': play(WORK[ev.a] ?? 'chop', pan); break;
        case 'break': play(BREAK[ev.a] ?? 'chopBreak', pan, ev.b ? 0.88 : 1); break;
        case 'levelup': play('levelUp', 0, 1, 1.15); break;
        case 'tell': {
          const pitch = ev.b === TELL_CHARGE ? 1 : ev.b === TELL_SPIT ? 1.5 : ev.b === TELL_SLAM ? 0.7 : ev.b === TELL_SURFACE ? 0.85 : ev.b === TELL_SUMMON ? 1.2 : 1;
          const p = run.player;
          const near = Math.hypot(ev.x - p.x, ev.y - p.y) <= tellReach(ev.b, ev.a);
          if (near) play('telegraph', pan, pitch, ev.b === TELL_SPIT ? 0.6 : 1);
          else {
            const now = performance.now() / 1000;
            if (now - farTellAt < FAR_TELL_GAP) break;
            farTellAt = now;
            audio.play('telegraph', { pan, pitch, gain: 0.22, noDuck: true });
          }
          break;
        }
        case 'slam': play('blunt', pan, 0.5, Math.min(1.4, 0.7 + ev.a / 300)); break;
        case 'burst': play('musket', pan, 0.62, 0.6); break;
        case 'eliteSpawn': play('elite', pan); break;
        case 'bossSpawn': play('boss', 0); break;
        case 'bossPhase': play('boss', 0, 1.18, 0.9); break;
        case 'eliteDeath': play('bossDeath', pan, 1.3, 0.85); break;
        case 'bossDeath': play('bossDeath', 0); break;
        case 'steal': play('steal', pan); break;
        case 'escape': play('steal', pan, 0.7, 1.1); break;
        case 'waveStart': play('waveStart', 0); break;
        case 'waveEnd': play('waveEnd', 0); break;
        case 'shieldBreak': play('clinkBreak', 0, 1.35, 0.8); break;
        case 'secondWind': play('levelUp', 0, 0.7, 1.1); break;
        case 'death': play('death', 0); break;
      }
    },
  };
}
