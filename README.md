# AI Arcade

A browser-based arcade of 9 AI-themed mini-games, all self-contained and playable offline.

## Games

- **Burping Monkey Vision Girth** — a monkey that burps, with vision and girth.
- **CritterClash** — critter combat.
- **DecAI Before Glory** — the machine decides your fate.
- **GattinoGame** — 15 levels of kitten mayhem.
- **IncrementALL** — an idle/incrementer with ascend and transcend mechanics.
- **Prompter** — prompt-bug squashing.
- **RPS 1vAI** — rock-paper-scissors against an adaptive AI.
- **Sil Fighter** — a fighting game with a surprisingly green opponent.
- **The Bottom of The Barrel** — a fall-from-grace platformer.

## Running

Open `index.html` in any modern browser — no build step, no server, no dependencies. Everything runs from static files, including save data via `localStorage`.

`refresh-games.ps1` regenerates `games.json` / `games-data.js` from each game's `game.json`.
