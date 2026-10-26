# Notices

Impact's own source code is under the MIT licence in [LICENSE](LICENSE), which also says what that licence does not cover.

## Third-party code in this repository

| Where | What | Licence |
| --- | --- | --- |
| `src/render/vfx/Beams.ts` | The tube construction and the facing term are adapted from LinearAbiltyCastingExtendedThreeJS by Mohamed Achref Elouafi. | MIT: `src/render/vfx/LICENSE.upstream.txt` |
| `src/render/vfx/engine/ice/` | Adapted from HandCastAbilityThreeJS and threejs-vfx (mohamedachrefelouafi) and Ability-ThreeJS-Project (itzmitto). Each file names what it adapts in its header. | MIT: `src/render/vfx/engine/ice/LICENSE.upstream.txt` |
| `src/ui/social/discord.ts` | The Discord mark's outline, from Phosphor Icons. | MIT (phosphoricons.com). The mark itself belongs to Discord. |

A file that adapts someone else's work says so in its header. If you find one that should be listed here and is not, write to Hello@Dude.work.

## Code that is not in this repository

- **The VFX Armory.** The game draws many of its effects with a separate effects library, which has its own licence and is not published here. `src/render/vfx/armory/vendor/` holds type declarations only, so that the rest of the code type-checks.
- **Content packs.** `src/packs/` holds type declarations only.

## Packages

The packages named in `package.json` are installed from npm and are not part of this repository.

| Package | Licence | Used |
| --- | --- | --- |
| three | MIT | in the game |
| @colyseus/sdk, colyseus | MIT | in the game and on the server |
| @dimforge/rapier3d-compat | Apache-2.0 | in the game and on the server |
| msgpackr | MIT | in the game and on the server |
| tsx | MIT | runs the server |
| react, react-dom | MIT | sign-in only |
| @privy-io/react-auth | Apache-2.0 | sign-in only |
| @solana/kit | MIT | not imported by this code (a peer of the sign-in package) |
| @solana-program/system, @solana-program/token | Apache-2.0 | not imported by this code (peers of the sign-in package) |
| vite, vitest | MIT | build and tests |
| typescript, @playwright/test | Apache-2.0 | build and tests |
| meshoptimizer | MIT | tools |
| @types/node, @types/react, @types/react-dom, @types/three | MIT | types |

The locked tree (`package-lock.json`) names about a thousand packages in all. Nearly all are MIT, Apache-2.0, ISC or BSD. Those that are not: sixteen under MPL-2.0, and the wallet-connection packages that the sign-in package depends on (`@reown/*`, `@walletconnect/*`), which state a licence of their own in their `LICENSE.md`. None of them is copied into this repository.
