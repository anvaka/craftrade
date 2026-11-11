// The game half of the client: everything the player sees and does during a
// run. The town half calls mountRun(host) and gets the recap back through
// host.onEnd. See ../seam.ts for the contract.
//
//   mount.ts   loop, pause, teaching, hand-off      render.ts  canvas and effects
//   hud.ts     DOM over the canvas                  input.ts   keys, touch stick, gamepad
//   bench.ts   bench, anvil, mule                   end.ts     recap and carry
//   sound.ts   sim events to the audio kit          dev.ts     harness for play.html
import type { MountRun } from '../seam.ts';
import { mount } from './mount.ts';

export const mountRun: MountRun = (host) => mount(host);
