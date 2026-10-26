# Impact

An anime arena fighter that runs in the browser: twelve-fighter battle royales, 1v1 duels and co-op survival. It is played at **https://impact.dude.work**.

Impact is purely a fan game, made by lovers of anime and manga who grew up watching these characters day in and day out. Impact is a free, fan-made, non-commercial project. It is not affiliated with, endorsed by, or sponsored by Shueisha, Kodansha, Hakusensha, Toei Animation, Bandai Namco or any other rights holder of the series it celebrates. All characters, names and marks belong to their respective owners.

The game is open source. It has no monetization whatsoever, and it never will, in any form or shape: nothing is sold, and there are no ads.

## This repository is the code only

It holds the game's source code and its tests. It holds **no assets**: no models, animations, textures, images, audio, voices, music or fonts. So **it does not build into a playable game by itself.**

What is not here:

- **Every asset.** The game loads its fighters, stages, effects textures, sounds and fonts from `public/assets/`, which is not in this repository. The page's icons and share image are not here either.
- **The VFX Armory**, a separate effects library that draws many of the fighters' moves. It has its own licence. `src/render/vfx/armory/vendor/` holds type declarations only.
- **Content packs** (`src/packs/`): type declarations only.
- **The harbour stage's stone arch**, as a collision mesh: it is the geometry of a third-party model, so `src/game/data/stoneArchCollider.json` is an empty mesh here. The physics library refuses an empty mesh, so the harbour stage's collision world does not build in this tree, and the tests that build it are not here.
- A few other modules are published as type declarations only (a `.d.ts` file with a first line that says so), 16 files in all, and the brush lettering's outlines (`src/render/area/glyphs.json`, made from two fonts) as an empty table.
- The project's internal documents, its asset pipelines and its release tooling.
- **The code's comments.** This release publishes the source without them. Licence notices are kept, and the files with third-party code (NOTICE.md) keep theirs.

What runs without them:

| Command | What it does here |
| --- | --- |
| `npm ci` | Installs the packages (Node.js 22.12 or newer). |
| `npx tsc --noEmit` | Type-checks all 1000 source files and the tests. |
| `npm test` | Runs the 375 test files that need only the code: the simulation, the moves, the rooms, the rules of each mode, the interface logic. Tests that read assets, or that would run code that is not published, are not in this repository. |
| `npm run server` | Starts the match server on port 2567. Matches run: the simulation needs no assets (on every stage but the harbour, the default one: see above). Accounts stay off unless you set them up yourself. |
| `npm run dev` | Starts the page, which then fails to load its assets. |

`vite.config.ts` reads the current commit from git, so run the commands inside a git checkout, or set `VITE_BUILD_SHA` to any text first. `npm run build` type-checks and then stops at the first missing file.

## The stack

TypeScript throughout. The page is built with Vite and draws with Three.js; the match server is Colyseus on Node.js and owns the simulation; collision is Rapier; the tests are Vitest.

## A map of the source

| Where | What |
| --- | --- |
| `src/game/` | The simulation, shared by the server and the page: movement, moves, combos, awakenings, bots, stages as collision, and the rules of each mode (`duel/`, `objectives/`, `moba/`, `training/`). `src/game/fighters/` holds each fighter's moves as data; `src/game/economy/` the in-game currency, earned by playing. |
| `src/engine/` | The fighter engine: one specification per fighter (`sim/`), checked by one validator, the effects data (`vfx/`), and what the page reads of them (`client/`). |
| `src/server/` | The match server: rooms for each mode, the input queue and step clock, accounts and the ledger of what was earned (`economy/`), parties and custom rooms (`social/`). |
| `src/render/` | Everything drawn: fighters and their animation, stages, effects (`vfx/`, `signature/`), the camera, the looks. |
| `src/ui/` | The interface: home, fighter select, the HUD (`hud/`), results, options, the legal notice. |
| `src/audio/` | Music, effects and voices as cue plans (the sounds themselves are assets). |
| `src/survival/` | Co-op survival: rounds, enemies, bosses, the skill tree. |
| `src/input/`, `src/network.ts`, `src/network/`, `src/loading/`, `src/social/` | Keyboard, pad and touch; the connection to the server; loading; parties. |
| `src/main.ts`, `index.html` | The page's entry. |
| `tests/`, and `*.test.ts` beside the code | The tests. |
| `scripts/build/` | What the build configuration imports. |
| `public/` | The legal and privacy pages. |

## If something of yours is in the game

If you are an IP owner, or someone whose models, effects or other assets have been used in the game, and you would like them removed, email **Hello@Dude.work** and they will be removed promptly.

It helps to send:

- who you are and what you hold the rights to, or made;
- what in the game it concerns (a character, a model, a sound, an effect), with a link or a screenshot if you have one;
- what you would like: removal, or a credit.

## Reporting a security problem

Email **Hello@Dude.work** with "Security" in the subject. Please do not open a public issue for it. Say what you found and how to reproduce it; you will get an answer, and credit if you want it once it is fixed.

## Contributing

Issues and pull requests on the code are welcome. Please do not add assets, or anything taken from a series, a game or another person's work, to this repository.

## Licence

The project's own source code is under the [MIT licence](LICENSE). That licence does not cover the characters, names and other intellectual property of the series the game celebrates, any asset, or third-party code: [LICENSE](LICENSE) says so in full, and [NOTICE.md](NOTICE.md) lists the third-party code that is included.
