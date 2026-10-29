# Football Dice

A football game where you play as one player in a fully simulated match. Every player on the pitch, on both sides, has the same ten stats and goes through the same dice. When the play reaches you, the clock stops and you make the call.

## How the dice work

- Ten stats, each 0–5 stars in half steps: speed, strength, stamina, composure, finishing, aerial, keeping, defending, dribbling, passing.
- Every contest is your stars against theirs. Each half star of difference is +1 or −1 on 2d6.
- Some rolls use the average of two stats (dribbling uses dribbling and speed).
- Double one always fails, double six always succeeds.
- The attacker rolls. When you're defending you see the same roll from your side, with identical odds.

Early prototype. Every number is a placeholder.

## Prototypes

The home screen offers three ways of playing your moments, all on the same squads, stars, formations and styles:

- **Grid tactics:** a top-down pitch of squares. Each turn (30 seconds) you move up to three of your players one square; the AI moves the rest, then the ball is passed, tackled for or shot. Contests still use stars and dice.
- **Mini-games:** the simulated match, but your rolls come from stopping a timing bar. Random timing gives exactly the dice odds.
- **Live moments:** the simulated match, but when you're on the ball going forward you play a short live passage in Phaser: hold to run, flick to pass or shoot. Tackles, interceptions and shots use the same star odds.

The original dice version is still there to compare against.

## Stack

React, Vite, TypeScript and Tailwind CSS, deployed to Cloudflare Workers as static assets. Phaser runs the live moments.

## Commands

```sh
npm install
npm run dev        # local dev server
npm run build      # typecheck and build into dist/
npm run cf:dev     # build, then serve through Wrangler (closest to production)
npm run deploy     # build and deploy to Cloudflare Workers
```

If you connect the repo through Cloudflare's dashboard (Workers Builds), use `npm run build` as the build command and `npx wrangler deploy` as the deploy command.

## Where things live

- `src/game/config.ts`: every tunable number, plus positions, roles, formations and styles
- `src/game/dice.ts`: dice rolling, double one/six, and mirroring a roll to the defender's side
- `src/game/squad.ts`: generating players and teams
- `src/game/match.ts`: the simulation, contests and your decisions
- `src/grid/`: the grid tactics engine and screen
- `src/live/`: the Phaser live-moment scene
- `src/components/TimingMeter.tsx`: the mini-game timing bar
- `src/components/`: the UI
