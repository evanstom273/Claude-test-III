# Football Dice

A top-down football game. The pitch runs left to right, the camera follows the ball, and players are shaded tokens. Play as just your own player (player career) or control the whole team, switching to whoever's on the ball.

Every player on both sides has ten stats rated 0–5 stars: speed, strength, stamina, composure, finishing, aerial, keeping, defending, dribbling and passing. They set how fast players run, how accurate passes and shots are, and who wins duels. Tackles, interceptions and saves still use the original rule underneath: each half star of difference is worth 1 on a hidden 2d6, with double one always failing and double six always succeeding.

Early prototype. Every number is a placeholder.

## Controls

- **Phone:** left thumb anywhere on the left half to move; Pass, hold-to-power Shoot, Tackle, and Call (player mode) or Switch (team mode) on the right.
- **Keyboard:** arrows or WASD to move, J or Space pass, hold K shoot, L tackle, Shift switch, C call.

## Stack

React, Vite, TypeScript and Tailwind CSS for the menus; Phaser for the match. Deployed to Cloudflare Workers as static assets.

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

- `src/pitch/sim.ts`: the match itself: physics, AI, rules. No drawing, so it can be run headless.
- `src/pitch/art.ts`: all the artwork as SVG, authored at native world scale.
- `src/pitch/PitchScene.ts`: the Phaser scene that draws the simulation.
- `src/pitch/PitchMatch.tsx`, `Controls.tsx`: the full-screen match, scoreboard, joystick and buttons.
- `src/pitch/constants.ts`: pitch size, speeds, timings and tuning numbers.
- `src/game/config.ts`: stats, positions, roles, formations and styles.
- `src/game/squad.ts`: generating players and teams.
