# Football Dice

A football game where you play as one player. The match clock runs in the background, and whenever you're involved it stops and you make the call: pass, dribble, shoot, tackle or save. Then you roll 2d6 plus your modifiers.

Early mock-up. Every number is a placeholder.

## Stack

React, Vite, TypeScript and Tailwind CSS, deployed to Cloudflare Workers as static assets. Phaser is installed but not used yet.

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

- `src/game/config.ts`: every tunable number (target numbers, shot zones, involvement rates, stats)
- `src/game/dice.ts`: dice rolling and checks
- `src/game/match.ts`: the clock, background events and decision resolution
- `src/components/`: the UI
