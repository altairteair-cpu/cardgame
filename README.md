# Kozel

Play Kozel, the card game, online with friends. Create a table, share the 5-letter code or link, and play from any phone browser. Empty seats get computer players, and a friend who arrives late can take over a computer seat.

## How it runs

- `public/` is the website: home, lobby and table (`index.html`, `app.js`, `style.css`).
- `public/engine.js` holds the rules. The server and the phones both use it.
- `src/worker.js` creates tables and connects phones to them.
- `src/table.js` is one table (a Cloudflare Durable Object). It checks every move, runs the turn timers and the computer players, and sends each player only their own cards.

Everything runs on Cloudflare's free Workers plan.

## Deploying

Cloudflare builds and deploys this repo automatically on every push to `main`. In the Cloudflare dashboard: Workers & Pages → Create → Import a repository → `cardgame`. Leave the build command empty and keep the deploy command `npx wrangler deploy`.

## Running it on your own computer

```
npm install
npx wrangler dev
```

Then open http://localhost:8787 in two browser windows.

## House rules

36 cards (6 to ace), 6 in hand. Leads share a suit or a rank. Each player beats every card of the best play or throws the same number face down, and once you throw you keep throwing for that trick. The trick goes around in laps until the leader lets it go. The last card drawn after each trick is shown and sets the next trump. Scoring lines are 31 with 3 players, and 41 with 2 players or pairs. A turned-up six or ace doubles the hand. First to 12 penalties is the Kozel.
