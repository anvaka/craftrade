// Entry point. The town half owns boot; the run is mounted through the seam.
import { boot } from './town/boot.ts';
import { installTips } from './ui/tip.ts';

// iOS Safari only shows :active (the pressed stamp) on elements under a touch listener.
document.addEventListener('touchstart', () => {}, { passive: true });

installTips();

// The offline cache (src/client/sw.js). Only in a built game: in development it would serve stale files.
if ((import.meta as { env?: { PROD?: boolean } }).env?.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
void boot();
