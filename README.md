# Craft World

A browser game that crosses New World's gathering, crafting and towns with Brotato's short waves and between-wave shop. You mine ore, fell trees and cut reeds under fire while heat brings more enemies, build a weapon set at camp between waves, extract or push on at each boss gate, and craft at the forge, workshop and apothecary in town for the next expedition.

Play it at https://anvaka.github.io/craftrade/ (single player, saved in your browser).

## Run it

```sh
npm install
npm run dev        # http://localhost:5173 (add -- --host to play on a phone on the same network)
npm run build      # typecheck and build into dist/
npm run bot        # play whole expeditions headless with scripted policies; finds crashes and gross imbalance
npm run log -- <file>   # balance report from a play log exported in the game (Character → Record → Play log)
```

`dev/icons.html` and `dev/audio.html` (under `npm run dev`) are contact sheets for the icons and the sounds.

## Previews

Every push builds the game and publishes it to GitHub Pages: the default branch at the site root, any other branch at `https://anvaka.github.io/craftrade/b/<branch>/` (slashes become dashes). A pull request gets a comment with its preview link; the preview is removed when the branch is deleted. See `.github/workflows/pages.yml`.

## Where things are

`CLAUDE.md` holds the design brief, the map of the code and the decisions taken so far. The design graph is in `design/`, the reviews in `reviews/`, and the first prototype in `archive/first-playable/`.
