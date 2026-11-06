// One Durable Object per table. It holds the seats and the game, checks every move,
// runs the timers and the computer players, and sends each phone only what that player may see.
import { DurableObject } from 'cloudflare:workers';
import * as E from '../public/engine.js';

const BOT_NAMES = ['Aibek', 'Dana', 'Ruslan', 'Aruzhan'];
const EMOTES = new Set(['😂', '😎', '👍', '🔥', '😱', '😡', '😭', '🤔', '🤝', '🐐', 'p0', 'p1', 'p2', 'p3', 'p4']);
const STALE_MS = 6 * 3600 * 1000;   // a code can be reused after a table sits idle this long
const pick = a => a[Math.floor(Math.random() * a.length)];
const cleanName = s => String(s || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);

export class Table extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.T = null;
    ctx.blockConcurrencyWhile(async () => { this.T = (await ctx.storage.get('T')) || null; });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/create') {
      const { code, seats } = await request.json();
      if (this.T && Date.now() - this.T.touched < STALE_MS) return new Response('taken', { status: 409 });
      const n = Math.min(4, Math.max(2, +seats || 3));
      this.T = { code, phase: 'lobby', host: null, seats: Array(n).fill(null), G: null, touched: Date.now(), next: null, deadline: null, turnKey: null };
      await this.save();
      return new Response('ok');
    }
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws, raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!this.T) { this.send(ws, { t: 'error', code: 'notable' }); return; }
    if (m.t === 'join') return this.join(ws, m);
    const pid = (ws.deserializeAttachment() || {}).pid;
    if (!pid) return;
    const T = this.T, G = T.G, seat = T.seats.findIndex(s => s && s.pid === pid);
    if (seat < 0) return;
    switch (m.t) {
      case 'start':
        if (pid === T.host && T.phase === 'lobby') await this.start();
        break;
      case 'again':
        if (pid === T.host && G && G.phase === 'over') await this.start();
        break;
      case 'play': {
        if (!G) return;
        const err = E.act(G, seat, Array.isArray(m.cards) ? m.cards.map(String) : [], !!m.down);
        if (err) { this.send(ws, { t: 'error', code: err }); this.sendState(ws); return; }
        await this.changed();
        break;
      }
      case 'pass': {
        if (!G) return;
        const err = E.pass(G, seat);
        if (err) { this.send(ws, { t: 'error', code: err }); return; }
        await this.changed();
        break;
      }
      case 'emote': {
        const now = Date.now(), att = ws.deserializeAttachment() || {};
        if (!EMOTES.has(m.e) || now - (att.lastEmote || 0) < 1200) return;
        ws.serializeAttachment({ ...att, lastEmote: now });
        this.broadcast({ t: 'emote', seat, e: m.e });
        break;
      }
      case 'leave':
        if (T.phase === 'lobby') {
          T.seats[seat] = null;
          if (T.host === pid) T.host = (T.seats.find(s => s && !s.bot) || {}).pid || null;
          await this.save(); this.broadcastState();
        }
        break;
    }
  }

  async webSocketClose(ws) { this.broadcastState(ws); }
  async webSocketError(ws) { this.broadcastState(ws); }

  async join(ws, m) {
    const T = this.T, pid = String(m.pid || '').slice(0, 40);
    if (!pid) return;
    const name = cleanName(m.name) || 'Player';
    let idx = T.seats.findIndex(s => s && s.pid === pid);
    if (idx < 0) {
      if (T.phase === 'lobby') idx = T.seats.findIndex(s => !s);
      else idx = T.seats.findIndex(s => s && s.bot);          // late arrivals take over a computer player
      if (idx < 0) { this.send(ws, { t: 'error', code: T.phase === 'lobby' ? 'full' : 'started' }); return; }
    }
    T.seats[idx] = { pid, name };
    if (!T.host || !T.seats.some(s => s && s.pid === T.host)) T.host = pid;
    ws.serializeAttachment({ pid });
    T.touched = Date.now();
    await this.save();
    this.broadcastState();
  }

  async start() {
    const T = this.T, used = new Set(T.seats.filter(Boolean).map(s => s.name));
    const free = BOT_NAMES.filter(b => !used.has(b));
    T.seats = T.seats.map(s => (s && !s.bot ? s : { pid: 'bot-' + Math.random().toString(36).slice(2, 8), name: free.shift() || 'Bot', bot: true }));
    T.phase = 'game';
    T.G = E.newGame(T.seats.length);
    const n = T.seats.length;
    T.G.dealer = (n - 2 + n) % n;      // nextHand moves the deal one seat on, so seat 0 leads the first hand
    E.nextHand(T.G); T.G.handNo = 1;
    T.G.players.forEach(p => { p.pen = 0; });
    await this.changed();
  }

  // Call after any change to the game: timers, saving, and sending the new state.
  async changed() {
    const T = this.T, G = T.G;
    if (G && E.ACTIVE.includes(G.phase)) {
      const key = `${G.handNo}-${G.phase}-${G.turn}-${G.trick ? G.trick.plays.length : 0}`;
      if (T.turnKey !== key) { T.turnKey = key; T.deadline = Date.now() + E.TURN_MS; }
    } else T.deadline = null;
    T.touched = Date.now();
    this.reactions();
    await this.schedule();
    await this.save();
    this.broadcastState();
  }

  async schedule() {
    const T = this.T, G = T.G, now = Date.now();
    let at = null, kind = null;
    if (G) {
      if (G.phase === 'reveal') { at = now + 1900; kind = 'lead'; }
      else if (G.phase === 'collect') { at = now + 1700; kind = 'collect'; }
      else if (E.ACTIVE.includes(G.phase)) {
        if (T.seats[G.turn].bot) { at = now + 900 + Math.random() * 1300; kind = 'bot'; }
        else { at = T.deadline; kind = 'timeout'; }
      } else if (G.phase === 'handEnd') { at = now + 10000; kind = 'next'; }
    }
    T.next = at ? { at, kind } : null;
    if (at) await this.ctx.storage.setAlarm(at);
    else await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    const T = this.T;
    if (!T || !T.next || !T.G) return;
    if (Date.now() < T.next.at - 25) { await this.ctx.storage.setAlarm(T.next.at); return; }
    const G = T.G, k = T.next.kind;
    if (k === 'lead' && G.phase === 'reveal') E.startLead(G);
    else if (k === 'collect' && G.phase === 'collect') E.collect(G);
    else if (k === 'bot' && E.ACTIVE.includes(G.phase) && T.seats[G.turn].bot) E.botStep(G);
    else if (k === 'timeout' && E.ACTIVE.includes(G.phase) && !T.seats[G.turn].bot) E.autoStep(G);
    else if (k === 'next' && G.phase === 'handEnd') E.nextHand(G);
    else return;
    await this.changed();
  }

  // Computer players react now and then: a big trick, a bad hand, someone becoming the Kozel.
  reactions() {
    const T = this.T, G = T.G;
    if (!G) return;
    const mark = `${G.handNo}-${G.phase}-${G.lastWin}-${G.result ? 1 : 0}`;
    if (T.reactMark === mark) return;
    T.reactMark = mark;
    const bots = T.seats.map((s, i) => (s.bot ? i : -1)).filter(i => i >= 0);
    if (!bots.length) return;
    const say = (seat, list, chance) => { if (Math.random() < chance) this.broadcast({ t: 'emote', seat, e: pick(list), delay: 700 }); };
    if (G.phase === 'collect') {
      const pts = E.sumPts(G.trick.plays.flatMap(x => x.cards)), w = G.lastWin;
      if (T.seats[w].bot) say(w, pts >= 15 ? ['😎', '🔥', 'p0'] : ['😎', '👍'], pts >= 15 ? 0.55 : 0.15);
      else if (pts >= 15) { const b = pick(bots); say(b, E.partnerOf(G.n, b) === w ? ['👍', '🤝'] : ['😱', '😡', '🤔'], 0.4); }
    } else if ((G.phase === 'handEnd' || G.phase === 'over') && G.result) {
      const r = G.result;
      r.groups.forEach((g, k) => g.forEach(i => { if (T.seats[i].bot) say(i, r.add[k] >= 6 ? ['😭', '😡'] : r.add[k] === 0 ? ['😎', '🔥'] : ['🤔'], 0.5); }));
      if (G.phase === 'over') {
        const maxPen = Math.max(...G.players.map(p => p.pen));
        bots.forEach(i => { if (G.players[i].pen < maxPen) say(i, ['🐐', '😂'], 0.6); });
      }
    }
  }

  // What one seat is allowed to see. Face-down cards and other hands stay hidden.
  view(seat) {
    const T = this.T, G = T.G;
    const online = new Set(this.ctx.getWebSockets().map(w => (w.deserializeAttachment() || {}).pid).filter(Boolean));
    const v = {
      t: 'state', now: Date.now(), code: T.code, phase: T.phase, me: seat,
      host: seat >= 0 && T.seats[seat] && T.seats[seat].pid === T.host,
      seats: T.seats.map(s => (s ? { name: s.name, bot: !!s.bot, online: !!s.bot || online.has(s.pid), host: s.pid === T.host } : null)),
    };
    if (!G) return v;
    v.g = {
      phase: G.phase, turn: G.turn, deadline: T.deadline, limit: E.LIMIT, handNo: G.handNo, dealSeq: G.dealSeq, nextTurn: G.nextTurn,
      trump: G.trump, trumpBy: G.trumpBy, double: G.double, mult: G.mult || (G.double ? 2 : 1), doubleWhy: G.doubleWhy || null, firstTrick: G.firstTrick, stock: G.stock.length,
      reveal: G.reveal, lastWin: G.lastWin, result: G.result, nextAt: G.phase === 'handEnd' && T.next ? T.next.at : null,
      players: G.players.map((p, i) => ({ pen: p.pen, count: p.hand.length, hand: i === seat ? p.hand : null })),
      trick: G.trick && {
        n: G.trick.n, leader: G.trick.leader, lap: G.trick.lap, win: G.trick.win, folded: G.trick.folded,
        plays: G.trick.plays.map(x => ({ p: x.p, down: x.down, lap: x.lap, cards: x.down ? x.cards.map(() => 'X') : x.cards })),
      },
    };
    return v;
  }

  sendState(ws) {
    const pid = (ws.deserializeAttachment() || {}).pid;
    const seat = pid ? this.T.seats.findIndex(s => s && s.pid === pid) : -1;
    this.send(ws, this.view(seat));
  }
  broadcastState(skip) {
    for (const ws of this.ctx.getWebSockets()) if (ws !== skip) this.sendState(ws);
  }
  broadcast(msg) { for (const ws of this.ctx.getWebSockets()) this.send(ws, msg); }
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch { /* socket already closed */ } }
  async save() { await this.ctx.storage.put('T', this.T); }
}
