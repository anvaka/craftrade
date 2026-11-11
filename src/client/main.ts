// Entry point. The town half owns boot; the run is mounted through the seam.
import { boot } from './town/boot.ts';

// iOS Safari only shows :active (the pressed stamp) on elements under a touch listener.
document.addEventListener('touchstart', () => {}, { passive: true });

void boot();
