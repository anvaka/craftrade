// The music and ambience volumes, shown under the sound switch on the pause screen and in Help and settings.
import { VOL_STEPS, type Channel, type Sound } from '../audio';
import { bar } from './kit';

const NAME: Record<Channel, string> = { music: 'Music', amb: 'Ambience' };

/** One row per channel: quieter, a level bar, louder. Dispatched as `vol` with the channel and the step. */
export function volumeRows(snd: Sound): string {
  const row = (ch: Channel): string => {
    const v = snd.volume[ch];
    return `<div class="volrow" role="group" aria-label="${NAME[ch]} volume"><b>${NAME[ch]}</b>
      <button class="sm" data-a="vol" data-v="${ch}" data-w="-1" aria-label="${NAME[ch]} quieter" ${v <= 0 ? 'disabled' : ''}>−</button>
      ${bar(v / VOL_STEPS)}<span class="num" aria-live="polite">${v === 0 ? 'off' : `${v * 10}%`}</span>
      <button class="sm" data-a="vol" data-v="${ch}" data-w="1" aria-label="${NAME[ch]} louder" ${v >= VOL_STEPS ? 'disabled' : ''}>+</button></div>`;
  };
  return `<div class="volrows${snd.muted ? ' off' : ''}">${row('music')}${row('amb')}${snd.muted ? '<p class="dim small" style="margin:0">Sound is off, so neither is heard.</p>' : ''}</div>`;
}
