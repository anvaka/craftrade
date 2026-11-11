// The run flow: take a ticket, hand the screen to the game half, report the
// result, show the homecoming.

import type { CharacterId, RunEndRes, RunStartRes } from '../../shared/protocol.ts';
import { audio } from '../audio/index.ts';
import type { FuseOutcome, MountRun, RunHandle, RunRecap } from '../seam.ts';
import { ApiFail, api, asFail } from './api.ts';
import { sprites } from './dom.ts';
import { showHomecoming } from './homecoming.ts';
import { loadTab, showRun, showTown, watchReach } from './shell.ts';
import { app, redraw, say, savePrefs, sayFail, setProfile } from './state.ts';

export type Mode = 'run' | 'daily' | 'practice';

export interface Launch {
  mode: Mode;
  character: CharacterId;
  kit: string[];
}

/** How a finished run was received by the town. */
export type Report =
  | { state: 'saved'; res: RunEndRes }
  | { state: 'local' }
  | { state: 'lost-reply' }
  | { state: 'refused'; fail: ApiFail };

// ---- the game half ---------------------------------------------------------

// The real run lives in src/client/game/index.ts. The glob keeps this file
// compiling and building before that module exists; when it is missing, or
// the page is opened with ?stubrun=1, the stand-in is used.
const gameModules = import.meta.glob<{ mountRun: MountRun }>('../game/index.ts');
const wantsStub = (): boolean => new URLSearchParams(location.search).has('stubrun');

let mountPromise: Promise<MountRun> | null = null;
export function loadMountRun(): Promise<MountRun> {
  mountPromise ??= (async () => {
    const real = gameModules['../game/index.ts'];
    if (real && !wantsStub()) {
      try {
        return (await real()).mountRun;
      } catch (e) {
        console.error(e);
        mountPromise = null;
        throw new ApiFail('no_game', 'The run could not be loaded. Check the connection and try again.');
      }
    }
    return (await import('./stubrun.ts')).mountRun;
  })();
  return mountPromise;
}

// ---- starting --------------------------------------------------------------

let handle: RunHandle | null = null;
let starting = false;

function localTicket(character: CharacterId): RunStartRes {
  return {
    runId: 'local',
    seed: (Date.now() ^ (Math.random() * 0x100000000)) >>> 0,
    waves: 12,
    character,
    kit: [],
    stations: app.stations,
    profile: app.profile,
  };
}

/** Start a run with the current choices. One press from town or from the homecoming. */
export async function headOut(mode: Mode = 'run'): Promise<void> {
  if (starting || handle) return;
  starting = true;
  app.busy.add('run');
  app.notice = null;
  redraw();

  const launch: Launch = { mode, character: app.character, kit: mode === 'run' ? [...app.kit] : [] };
  savePrefs({ character: launch.character, kit: launch.kit });
  const firstRun = mode === 'run' && app.profile.runs === 0;

  let ticket: RunStartRes | null = null;
  let mount: MountRun;
  try {
    const mounting = loadMountRun();
    mounting.catch(() => {});
    if (!app.online) {
      // On a slow phone line the first hello may still be on its way. Give it
      // a few seconds before settling for a run the town will never hear of.
      try {
        const h = await api.hello(6000);
        setProfile(h.profile);
        app.stations = h.stations;
        app.online = true;
      } catch {
        // really out of reach: go on alone
      }
    }
    if (app.online) {
      try {
        ticket = await api.runStart(mode, launch.character, launch.kit);
      } catch (e) {
        const f = asFail(e);
        if (!f.unreachable) throw f;
        app.online = false;
        watchReach();
      }
    }
    if (!ticket) {
      if (mode !== 'run') throw new ApiFail('unreachable', 'The town is out of reach. The daily clearing needs it.');
      launch.kit = [];
      ticket = localTicket(launch.character);
    } else {
      setProfile(ticket.profile);
      app.stations = ticket.stations;
      if (mode === 'daily' && app.daily) savePrefs({ dailyTaken: app.daily.date });
    }
    mount = await mounting;
  } catch (e) {
    starting = false;
    app.busy.delete('run');
    sayFail('Run', e);
    showTown();
    return;
  }

  const t = ticket;
  const local = t.runId === 'local';
  let ended = false;
  let quit = false;
  let report: Promise<Report> | null = null;

  const root = showRun();
  starting = false;
  app.busy.delete('run');

  const fuse = async (a: string, b: string): Promise<FuseOutcome> => {
    if (local) return { ok: false, code: 'unreachable', message: 'The town is out of reach. Nothing was used.' };
    try {
      const res = await api.fuse({ a, b, ctx: 'run' });
      if (res.profile) setProfile(res.profile);
      return { ok: true, res };
    } catch (e) {
      const f = asFail(e);
      return { ok: false, code: f.code, message: f.message };
    }
  };

  const onEnd = (recap: RunRecap): void => {
    if (ended) return;
    ended = true;
    report = local ? Promise.resolve<Report>({ state: 'local' }) : sendReport(t.runId, recap);
    // Let the game half finish its own callback before it is torn down.
    setTimeout(() => {
      try {
        handle?.destroy();
      } catch (e) {
        console.error(e);
      }
      handle = null;
      if (quit) {
        backToTown(report!, recap);
        return;
      }
      audio.play(recap.report.won ? 'win' : 'stamp');
      showHomecoming({ recap, launch, ticket: t, report: report!, firstRun });
    }, 0);
  };

  const onQuit = (): void => {
    quit = true;
    if (!ended) {
      // The seam says onEnd comes first. If it did not, leave without a report.
      ended = true;
      setTimeout(() => {
        try {
          handle?.destroy();
        } catch (e) {
          console.error(e);
        }
        handle = null;
        say('Run', 'You left the run. Nothing came home.');
        showTown();
      }, 0);
    }
  };

  try {
    handle = mount({ root, sprites: sprites(), ticket: t, mode, firstRun, fuse, onEnd, onQuit });
  } catch (e) {
    console.error(e);
    handle = null;
    say('Run', 'The run could not start on this device.');
    showTown();
  }
}

/** Waits between tries when the town cannot be reached with a finished run in hand. A phone drops out for seconds at a time. */
const REPORT_RETRY_MS = [2500, 5000];

async function sendReport(runId: string, recap: RunRecap): Promise<Report> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await api.runEnd({ ...recap.report, runId });
      setProfile(res.profile);
      app.online = true;
      return { state: 'saved', res };
    } catch (e) {
      const fail = asFail(e);
      if (fail.unreachable) {
        const wait = REPORT_RETRY_MS[attempt];
        if (wait !== undefined) {
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        app.online = false;
        watchReach();
      } else if (fail.code === 'run_ended') {
        // An earlier try landed and its reply was lost. The account has the goods.
        try {
          const h = await api.hello(4000);
          setProfile(h.profile);
        } catch {
          // the town head will catch up on the next answer
        }
        return { state: 'lost-reply' };
      }
      return { state: 'refused', fail };
    }
  }
}

/** After a quit: no homecoming sheet, one line in town. */
function backToTown(report: Promise<Report>, recap: RunRecap): void {
  say('Run', `You left on wave ${recap.endWave}.`);
  showTown();
  void report.then((r) => {
    if (r.state === 'saved') {
      const g = r.res.gained;
      const got = [g.raws.timber && `${g.raws.timber} timber`, g.raws.ore && `${g.raws.ore} ore`, g.raws.hide && `${g.raws.hide} hide`, g.marks && `${g.marks} ${g.marks === 1 ? 'mark' : 'marks'}`].filter(Boolean);
      say('Run', `You left on wave ${recap.endWave}. ${got.length ? `Home with ${got.join(', ')}.` : 'Nothing came home.'}`);
    } else if (r.state === 'refused') {
      say('Run', `You left on wave ${recap.endWave}. ${r.fail.unreachable ? 'The town is out of reach, so nothing was saved.' : `The town did not take the report: ${r.fail.message}`}`);
    }
    redraw();
    void loadTab(app.tab);
  });
}
