// Kozel rules engine. Shared by the game server (src/table.js) and the phones (public/app.js).
// Cards are 2-character ids: suit letter + rank index, e.g. "H7" = 10 of hearts.
// Rank order inside a suit: 6 7 8 9 J Q K 10 A  (index 0..8)

export const SUITS = ['S', 'H', 'C', 'D'];
export const SYM = { S: '♠', C: '♣', D: '♦', H: '♥' };
export const PTS = [0, 0, 0, 0, 2, 3, 4, 10, 11];
export const HAND = 6, LIMIT = 12, TURN_MS = 30000;
export const ACTIVE = ['lead', 'follow', 'challenge'];
export const ALL = [];
for (const s of SUITS) for (let r = 0; r < 9; r++) ALL.push(s + r);

export const sOf = c => c[0];
export const rOf = c => +c[1];
export const pOf = c => PTS[rOf(c)];
export const sumPts = a => a.reduce((x, c) => x + pOf(c), 0);
export const isRedSuit = s => s === 'H' || s === 'D';
export const trumpSuit = G => (G && G.trump ? sOf(G.trump) : null);
export const partnerOf = (n, p) => (n === 4 ? (p + 2) % 4 : -1);
export const groupsOf = n => (n === 4 ? [[0, 2], [1, 3]] : Array.from({ length: n }, (_, i) => [i]));

export function beats(a, b, ts) {
  if (sOf(a) === sOf(b)) return rOf(a) > rOf(b);
  return sOf(a) === ts && sOf(b) !== ts;
}
// every card of `att` must be beaten by a different card of `def`
export function canBeat(att, def, ts) {
  if (!att || !def || att.length !== def.length) return false;
  const used = def.map(() => false);
  const go = i => {
    if (i === att.length) return true;
    for (let j = 0; j < def.length; j++) {
      if (!used[j] && beats(def[j], att[i], ts)) { used[j] = true; if (go(i + 1)) return true; used[j] = false; }
    }
    return false;
  };
  return go(0);
}
export const validLead = cs => cs.length > 0 && (cs.every(c => sOf(c) === sOf(cs[0])) || cs.every(c => rOf(c) === rOf(cs[0])));
export function combos(arr, k) {
  const out = [];
  const rec = (i, cur) => {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let j = i; j < arr.length; j++) { cur.push(arr[j]); rec(j + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}
function leads(hand) {
  const out = [];
  for (let m = 1; m < (1 << hand.length); m++) {
    const s = hand.filter((_, i) => m & (1 << i));
    if (validLead(s)) out.push(s);
  }
  return out;
}
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function sortHand(h, ts) {
  const order = SUITS.filter(s => s !== ts).concat(ts ? [ts] : []);
  h.sort((a, b) => order.indexOf(sOf(a)) - order.indexOf(sOf(b)) || rOf(a) - rOf(b));
  return h;
}
const sortAll = G => G.players.forEach(p => sortHand(p.hand, trumpSuit(G)));

/* ---------------- game flow ---------------- */
export function newGame(n) {
  const G = { n, players: Array.from({ length: n }, () => ({ hand: [], won: [], pen: 0 })), dealer: Math.floor(Math.random() * n), handNo: 0, dealSeq: 0 };
  newHand(G);
  return G;
}
// Deal 6 each one at a time, turn up the next card to set trump for the first trick,
// then put that card back into the middle of the deck. A six or an ace doubles the hand.
export function newHand(G) {
  const n = G.n;
  G.players.forEach(p => { p.hand = []; p.won = []; });
  const stock = shuffle(ALL.slice());
  for (let k = 0; k < HAND; k++) for (let i = 1; i <= n; i++) G.players[(G.dealer + i) % n].hand.push(stock.pop());
  const tc = stock.pop();
  stock.splice(Math.floor(Math.random() * (stock.length + 1)), 0, tc);
  Object.assign(G, {
    stock, trump: tc, trumpBy: -1, double: rOf(tc) === 0 || rOf(tc) === 8, firstTrick: true, seen: [],
    trick: null, lastWin: null, result: null, reveal: { c: tc, by: -1 }, nextTurn: (G.dealer + 1) % n,
    phase: 'reveal', turn: -1
  });
  G.handNo++; G.dealSeq++;
  sortAll(G);
}
export function startLead(G) { G.reveal = null; G.turn = G.nextTurn; G.phase = 'lead'; }

// A trick goes around in laps; every lap everyone plays the same number of cards.
// Back at the leader: if the leader still holds the best play the trick ends,
// otherwise the leader beats again (another lap) or lets it go.
// Returns null on success or an error code.
export function act(G, p, ids, down) {
  if (!ACTIVE.includes(G.phase) || G.turn !== p) return 'turn';
  const hand = G.players[p].hand;
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || !ids.every(c => hand.includes(c))) return 'cards';
  const ts = trumpSuit(G);
  if (G.phase === 'lead') {
    if (down || !validLead(ids)) return 'lead';
  } else {
    if (ids.length !== G.trick.n) return 'count';
    if (G.phase === 'challenge' && down) return 'challenge';
    if (!down) {
      if (G.trick.folded.includes(p)) return 'folded';
      if (!canBeat(G.trick.plays[G.trick.win].cards, ids, ts)) return 'beat';
    }
  }
  G.players[p].hand = hand.filter(c => !ids.includes(c));
  if (G.phase === 'lead') {
    G.trick = { n: ids.length, leader: p, lap: 1, plays: [{ p, cards: ids, down: false, lap: 1 }], win: 0, folded: [] };
    G.seen.push(...ids);
  } else {
    G.trick.plays.push({ p, cards: ids, down: !!down, lap: G.trick.lap });
    if (down) { if (!G.trick.folded.includes(p)) G.trick.folded.push(p); }
    else { G.trick.win = G.trick.plays.length - 1; G.seen.push(...ids); }
  }
  const next = (p + 1) % G.n;
  if (next === G.trick.leader) {
    const holder = G.trick.plays[G.trick.win].p;
    if (holder === G.trick.leader || G.players[next].hand.length < G.trick.n) { endTrick(G); return null; }
    G.trick.lap++; G.turn = next; G.phase = 'challenge';
  } else { G.turn = next; G.phase = 'follow'; }
  return null;
}
export function pass(G, p) {
  if (G.phase !== 'challenge' || G.turn !== p) return 'turn';
  endTrick(G);
  return null;
}
function endTrick(G) { G.phase = 'collect'; G.lastWin = G.trick.plays[G.trick.win].p; G.turn = -1; }

// Winner takes the trick. Everyone draws back to 6 one card at a time, winner first.
// The very last card goes to the player before the winner and is shown: new trump.
export function collect(G) {
  const n = G.n, w = G.lastWin;
  G.players[w].won.push(...G.trick.plays.flatMap(x => x.cards));
  G.trick = null; G.firstTrick = false;
  const need = HAND - G.players[0].hand.length;
  const per = Math.min(need, Math.floor(G.stock.length / n));
  let last = null;
  for (let k = 0; k < per; k++) for (let i = 0; i < n; i++) {
    last = { p: (w + i) % n, c: G.stock.pop() };
    G.players[last.p].hand.push(last.c);
  }
  G.nextTurn = w;
  if (last) {
    G.dealSeq++;
    G.trump = last.c; G.trumpBy = last.p; G.reveal = { c: last.c, by: last.p };
    sortAll(G);
    G.phase = 'reveal'; G.turn = -1;
    return;
  }
  sortAll(G);
  if (G.players.every(p => p.hand.length === 0)) { endHand(G); return; }
  startLead(G);
}
// Scoring: most points 0; at/over the line +2; under it +4; no cards +6; cards worth 0 points +8.
// Tie for most: +2 each. Line is 31 with 3 players, 41 with 2 players or pairs. A doubled hand doubles everything. 12 = Kozel.
export function endHand(G) {
  const groups = groupsOf(G.n), line = G.n === 3 ? 31 : 41, mult = G.double ? 2 : 1;
  const pts = groups.map(g => g.reduce((a, i) => a + sumPts(G.players[i].won), 0));
  const cards = groups.map(g => g.reduce((a, i) => a + G.players[i].won.length, 0));
  const max = Math.max(...pts), top = pts.filter(x => x === max).length;
  const add = groups.map((g, k) => mult * (pts[k] === max ? (top > 1 ? 2 : 0) : cards[k] === 0 ? 6 : pts[k] === 0 ? 8 : pts[k] >= line ? 2 : 4));
  groups.forEach((g, k) => g.forEach(i => { G.players[i].pen += add[k]; }));
  G.result = { groups, pts, add, line, mult };
  G.phase = G.players.some(p => p.pen >= LIMIT) ? 'over' : 'handEnd';
  G.turn = -1;
}
export function nextHand(G) { G.dealer = (G.dealer + 1) % G.n; newHand(G); }

/* ---------------- computer players ---------------- */
function helpers(G) {
  const ts = trumpSuit(G), isT = c => sOf(c) === ts;
  return {
    ts, isT,
    keepVal: c => pOf(c) * 1.5 + (isT(c) ? 12 + rOf(c) : rOf(c) * 0.6),
    throwVal: c => pOf(c) * 2 + (isT(c) ? 15 + rOf(c) : 0) + rOf(c) * 0.5,
  };
}
function unseenFor(G, p) {
  const known = new Set([...G.seen, ...G.players[p].hand]);
  return ALL.filter(c => !known.has(c));
}
export function botLead(G, p) {
  const { ts, keepVal } = helpers(G), hand = G.players[p].hand, un = unseenFor(G, p), cands = leads(hand);
  const safe = c => !un.some(u => beats(u, c, ts));
  let win = null;
  for (const c of cands) {
    if (!c.every(safe)) continue;
    const v = sumPts(c) + c.length * 0.5;
    if (sumPts(c) > 0 && (!win || v > win.v)) win = { c, v };
  }
  if (win) return win.c;
  let best = null;
  for (const c of cands) {
    const v = c.reduce((a, x) => a + keepVal(x), 0) - 1.5 * (c.length - 1);
    if (!best || v < best.v) best = { c, v };
  }
  return best.c;
}
export function botFollow(G, p, challenge) {
  const { ts, isT, throwVal } = helpers(G);
  const hand = G.players[p].hand, n = G.trick.n, tg = G.trick.plays[G.trick.win].cards, un = unseenFor(G, p);
  const safe = c => !un.some(u => beats(u, c, ts));
  const isLast = !challenge && (p + 1) % G.n === G.trick.leader;
  const tablePts = sumPts(G.trick.plays.filter(x => !x.down).flatMap(x => x.cards));
  const holder = G.trick.plays[G.trick.win].p, mate = partnerOf(G.n, p);
  if (challenge && holder === mate) return null;
  if (!challenge && (G.trick.folded.includes(p) || holder === mate)) {
    const feed = isLast && holder === mate;
    const order = feed ? (a, b) => (isT(a) - isT(b)) || (pOf(b) - pOf(a)) : (a, b) => throwVal(a) - throwVal(b);
    return { cards: hand.slice().sort(order).slice(0, n), down: true };
  }
  let best = null;
  for (const c of combos(hand, n)) {
    if (!canBeat(tg, c, ts)) continue;
    const trumps = c.filter(isT).length;
    const cost = c.reduce((a, x) => a + (isT(x) ? 6 + rOf(x) : rOf(x) * 0.3), 0) + (isLast ? 0 : sumPts(c) * 0.4);
    if (!best || cost < best.cost) best = { c, cost, trumps, safe: c.every(safe) };
  }
  if (best) {
    const go = challenge ? (best.safe || best.trumps === 0 || tablePts >= 6)
      : isLast ? (best.trumps === 0 || tablePts >= 4 * best.trumps || sumPts(best.c) >= 10)
      : (best.safe || best.trumps === 0 || tablePts >= 10);
    if (go) return { cards: best.c, down: false };
  }
  if (challenge) return null;
  return { cards: hand.slice().sort((a, b) => throwVal(a) - throwVal(b)).slice(0, n), down: true };
}
// One move for whoever's turn it is (a computer player).
export function botStep(G) {
  const p = G.turn;
  if (G.phase === 'lead') return act(G, p, botLead(G, p), false);
  if (G.phase === 'follow') { const m = botFollow(G, p, false); return act(G, p, m.cards, m.down); }
  if (G.phase === 'challenge') { const m = botFollow(G, p, true); return m ? act(G, p, m.cards, false) : pass(G, p); }
  return 'turn';
}
// A person's timer ran out: lead the lowest card, throw the lowest cards, or let it go.
export function autoStep(G) {
  const p = G.turn, { keepVal, throwVal } = helpers(G), h = G.players[p].hand;
  if (G.phase === 'lead') return act(G, p, [h.slice().sort((a, b) => keepVal(a) - keepVal(b))[0]], false);
  if (G.phase === 'follow') return act(G, p, h.slice().sort((a, b) => throwVal(a) - throwVal(b)).slice(0, G.trick.n), true);
  if (G.phase === 'challenge') return pass(G, p);
  return 'turn';
}
