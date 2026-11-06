// Kozel website: home, lobby and the table. The server (src/table.js) runs the game;
// this file draws what the server sends and sends your moves back.
import * as E from './engine.js';
const { SYM, isRedSuit, sOf, rOf, canBeat, validLead, combos, LIMIT, TURN_MS, ACTIVE, partnerOf } = E;

const $ = id => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const R_EN = ['6', '7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
const R_RU = ['6', '7', '8', '9', 'В', 'Д', 'К', '10', 'Т'];
const CIRC = 182.2, HUES = [210, 14, 280, 150];
const EMO = ['😂', '😎', '👍', '🔥', '😱', '😡', '😭', '🤔', '🤝', '🐐'];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/* ---------------- text ---------------- */
const TXT = {
 en: {
  you: 'You', rules: 'Rules', langBtn: 'RU', tagline: 'Play Kozel online with friends',
  yourName: 'Your name', seatsQ: 'Players at the table', players: '{n} players', teams: '4 · pairs', create: 'Create table',
  or: 'or join a friend', join: 'Join', needName: 'Type your name first.', needCode: 'Type the 5-letter table code.',
  tableCode: 'Table code', share: 'Invite friends', copied: 'Invite link copied', shareText: 'Join my Kozel table: {code}',
  seatsLbl: 'Seats', emptySeat: 'Empty seat', hostTag: 'host', computer: 'computer', offline: 'offline',
  start: 'Start game', startNote: 'Empty seats get computer players. Friends can still take a computer seat after the start.',
  waitingHost: 'Waiting for {name} to start the game…', leave: 'Leave table', reconnecting: 'Reconnecting…',
  err_notable: 'There’s no table with that code.', err_full: 'That table is full.', err_started: 'That game already started and has no free seat.',
  err_turn: 'It’s not your turn.', err_beat: 'Those cards don’t beat every card of the best play.', err_lead: 'Lead cards must share a suit or a rank.',
  err_count: 'Play the same number of cards as the lead.', err_folded: 'You already threw this trick, so you must throw again.', err_generic: 'That move isn’t allowed.',
  err_net: 'Couldn’t reach the server. Check your connection and try again.',
  yourLead: 'Your lead. Pick any cards of one suit or one rank.', leading: '{name} is leading…', thinking: '{name} is thinking…',
  follow: 'Beat all {n} cards, or throw {n} face down.', follow1: 'Beat this card, or throw 1 face down.',
  cantBeat: 'Nothing in your hand beats this. Pick {n} cards to throw face down.', cantBeat1: 'Nothing in your hand beats this. Pick 1 card to throw face down.',
  takes: '{name} takes the trick.', youTake: 'You take the trick.',
  beatBack: '{name} beat your lead. Beat it back for another lap, or let it go.', cantBack: 'Nothing in your hand beats it. Let it go.',
  mustThrow: 'You already threw this trick, so throw {n} face down again.', letGo: 'Let it go',
  firstTrump: 'Turned up: trump for the first trick.', newTrumpBy: '{name} shows the last card: new trump.', newTrumpYou: 'Your last card is the new trump.',
  newTrump: 'New trump', turnedUp: 'Turned up', yourCard: 'Your last card', drawnBy: '{name}’s last card', lap: 'Lap {n}',
  play: 'Play', beat: 'Beat', throwDown: 'Throw face down', emotes: 'Emotes',
  selected: 'Selected {k} of {n}', notBeat: 'These cards don’t beat every card of the best play.', invalidLead: 'Lead cards must share a suit or a rank.',
  trump: 'Trump', down: 'face down', penalty: 'Penalty', partner: 'Partner', deckOut: 'Deck is out',
  doubleTip: 'A six or an ace was turned up: penalties double this hand',
  handOver: 'Hand {n} is over', pts: 'Points', add: 'Penalty', total: 'Total', nextIn: 'Next hand in {s}s',
  line: 'Line this hand: {n} points.', doubled: 'A six or an ace was turned up, so penalties are doubled.',
  gameOver: 'Game over', kozel: '{name} is the Kozel.', youKozel: 'You are the Kozel.', winner: 'Fewest penalties: {name}.',
  playAgain: 'Play again', waitAgain: 'Waiting for {name} to start a new game.', close: 'Close',
  phr: ['Nice!', 'Hurry up!', 'Oops', 'Good game', 'Not again…'],
  rulesTitle: 'House rules',
  r: ['Deck of 36, six to ace. Order inside a suit: 6, 7, 8, 9, J, Q, K, 10, A.',
      'Points: J 2, Q 3, K 4, 10 is worth 10, A is worth 11. 120 in the whole deck.',
      'Everyone gets 6 cards, dealt one at a time. The next card is turned up to set trump (kozyr) for the first trick, then goes back into the middle of the deck. If it is a six or an ace, the whole hand is doubled.',
      'Lead as many cards as you like, as long as they all share a suit or all share a rank.',
      'Going clockwise, each player plays the same number of cards: beat every card of the best play so far (higher card of the same suit, or any trump; a trump only falls to a higher trump), or throw that many face down. Once you throw, you keep throwing for the rest of that trick.',
      'When it comes back to the leader and someone has beaten them, the leader can beat that play and send it around again, or let it go. The trick ends when the leader lets it go or nobody beat the leader. The best play takes every card on the table, face-down ones too.',
      'Everyone draws back to 6, one card at a time, winner first. The very last card goes to the player just before the winner, who shows it: that card sets trump for the next trick. The winner leads.',
      'Each turn has a 30 second timer. If it runs out, your lowest card is played for you.',
      'When the hands run out, count your pile. The line is 31 with 3 players and 41 with 2 players. Most points: 0. At the line or above: +2. Under the line: +4. No cards at all: +6. Cards worth 0 points: +8. A tie for most: +2 each. In a doubled hand every penalty counts twice.',
      'With 4 players you play in pairs: the player sitting opposite is your partner. Partners count their piles together and the line is 41 instead of 31.',
      'The first to reach 12 penalties is the Kozel.'] },
 ru: {
  you: 'Вы', rules: 'Правила', langBtn: 'EN', tagline: 'Играйте в Козла онлайн с друзьями',
  yourName: 'Ваше имя', seatsQ: 'Игроков за столом', players: 'Игроков: {n}', teams: '4 · пары', create: 'Создать стол',
  or: 'или войти к другу', join: 'Войти', needName: 'Сначала введите имя.', needCode: 'Введите код стола из 5 знаков.',
  tableCode: 'Код стола', share: 'Позвать друзей', copied: 'Ссылка скопирована', shareText: 'Заходи за мой стол в Козла: {code}',
  seatsLbl: 'Места', emptySeat: 'Свободное место', hostTag: 'хозяин', computer: 'компьютер', offline: 'не в сети',
  start: 'Начать игру', startNote: 'Свободные места займут компьютерные игроки. Друзья смогут сесть вместо них и после начала.',
  waitingHost: 'Ждём, когда {name} начнёт игру…', leave: 'Выйти', reconnecting: 'Переподключение…',
  err_notable: 'Стола с таким кодом нет.', err_full: 'За этим столом нет мест.', err_started: 'Игра уже идёт, свободных мест нет.',
  err_turn: 'Сейчас не ваш ход.', err_beat: 'Эти карты не бьют все карты лучшего хода.', err_lead: 'Карты хода должны быть одной масти или одного достоинства.',
  err_count: 'Нужно столько же карт, сколько в ходе.', err_folded: 'Вы уже сбрасывали в этой взятке, сбросьте снова.', err_generic: 'Так ходить нельзя.',
  err_net: 'Нет связи с сервером. Проверьте интернет и попробуйте снова.',
  yourLead: 'Ваш ход. Выберите карты одной масти или одного достоинства.', leading: '{name} ходит…', thinking: '{name} думает…',
  follow: 'Побейте все карты ({n}) или сбросьте {n} рубашкой вверх.', follow1: 'Побейте карту или сбросьте 1 рубашкой вверх.',
  cantBeat: 'Побить нечем. Выберите карты для сброса: {n}.', cantBeat1: 'Побить нечем. Выберите 1 карту для сброса.',
  takes: '{name} забирает взятку.', youTake: 'Взятка ваша.',
  beatBack: '{name} перебил ваш ход. Перебейте снова (ещё круг) или отдайте.', cantBack: 'Перебить нечем. Отдайте взятку.',
  mustThrow: 'Вы уже сбрасывали в этой взятке, сбросьте ещё {n}.', letGo: 'Отдать',
  firstTrump: 'Открытая карта: козырь на первую взятку.', newTrumpBy: '{name} показывает последнюю карту: новый козырь.', newTrumpYou: 'Ваша последняя карта — новый козырь.',
  newTrump: 'Новый козырь', turnedUp: 'Открыта', yourCard: 'Ваша последняя карта', drawnBy: 'Последняя карта: {name}', lap: 'Круг {n}',
  play: 'Сходить', beat: 'Побить', throwDown: 'Сбросить', emotes: 'Смайлы',
  selected: 'Выбрано {k} из {n}', notBeat: 'Эти карты не бьют все карты лучшего хода.', invalidLead: 'Карты хода должны быть одной масти или одного достоинства.',
  trump: 'Козырь', down: 'сброс', penalty: 'Штраф', partner: 'Партнёр', deckOut: 'Колода кончилась',
  doubleTip: 'Открылась шестёрка или туз: штрафы в этой раздаче удваиваются',
  handOver: 'Раздача {n} окончена', pts: 'Очки', add: 'Штраф', total: 'Итого', nextIn: 'Следующая раздача через {s} с',
  line: 'Черта в этой раздаче: {n} очков.', doubled: 'Открылась шестёрка или туз, штрафы удвоены.',
  gameOver: 'Игра окончена', kozel: '{name} — козёл.', youKozel: 'Вы — козёл.', winner: 'Меньше всех штрафных: {name}.',
  playAgain: 'Ещё партию', waitAgain: 'Ждём, когда {name} начнёт новую игру.', close: 'Закрыть',
  phr: ['Красиво!', 'Быстрее!', 'Упс', 'Хорошая игра', 'Опять…'],
  rulesTitle: 'Домашние правила',
  r: ['Колода 36 карт, от шестёрки до туза. Старшинство в масти: 6, 7, 8, 9, В, Д, К, 10, Т.',
      'Очки: валет 2, дама 3, король 4, десятка 10, туз 11. Всего в колоде 120.',
      'Каждому по 6 карт, по одной. Следующая карта открывается и задаёт козырь на первую взятку, потом уходит обратно в середину колоды. Если это шестёрка или туз, вся раздача идёт вдвойне.',
      'Ходить можно любым числом карт, если все они одной масти или одного достоинства.',
      'По часовой стрелке каждый кладёт столько же карт: бьёт каждую карту лучшего хода (старшей картой той же масти или любым козырем; козырь бьётся только старшим козырем) или сбрасывает столько же рубашкой вверх. Кто сбросил, сбрасывает до конца взятки.',
      'Когда очередь возвращается к ходившему и его перебили, он может перебить снова (ещё круг) или отдать. Взятка заканчивается, когда ходивший отдаёт или его никто не перебил. Лучший ход забирает все карты со стола, включая сброшенные.',
      'Все добирают до 6 по одной карте, начиная с победителя. Последняя карта приходит игроку перед победителем, он её показывает: это козырь на следующую взятку. Победитель ходит.',
      'На каждый ход 30 секунд. Если время вышло, за вас играет самая младшая карта.',
      'Когда карты кончились, считаем свою кучку. Черта: 31 очко втроём и 41 вдвоём. Больше всех: 0. Черта и больше: +2. Меньше черты: +4. Ни одной карты: +6. Карты есть, но 0 очков: +8. Ничья за первое место: по +2. В двойной раздаче все штрафы удваиваются.',
      'Вчетвером играют парами: напротив сидит ваш партнёр. Партнёры считают кучки вместе, и черта — 41 вместо 31.',
      'Кто первым набрал 12 штрафных, тот козёл.'] },
};
let lang = store.get('kozel-lang') || ((navigator.language || '').startsWith('ru') ? 'ru' : 'en');
const t = (k, v = {}) => String(TXT[lang][k] ?? TXT.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
const emoText = e => (/^p\d$/.test(e) ? TXT[lang].phr[+e[1]] : e);

/* ---------------- connection ---------------- */
let pid = store.get('kozel-pid');
if (!pid) { pid = 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('kozel-pid', pid); }
let ws = null, code = null, wantOpen = false, retry = 0, retryTimer = null;
let V = null, P = null, skew = 0, sel = [], sending = false, note = '', ovMode = null, emoOpen = false, seatsChoice = 3;
let sweeping = false, pending = null, fresh = [], dealAnim = null;

function connect(c) {
  code = c; wantOpen = true;
  history.replaceState(null, '', '?t=' + c);
  openSocket();
}
function openSocket() {
  clearTimeout(retryTimer);
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const s = new WebSocket(`${proto}//${location.host}/ws/${code}`);
  ws = s;
  s.onopen = () => { retry = 0; $('conn').hidden = true; s.send(JSON.stringify({ t: 'join', pid, name: store.get('kozel-name') || '' })); };
  s.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; } onMessage(m); };
  s.onclose = () => {
    if (ws !== s || !wantOpen) return;
    $('conn').textContent = t('reconnecting'); $('conn').hidden = false;
    retryTimer = setTimeout(openSocket, Math.min(5000, 800 + retry++ * 900));
  };
}
function send(m) { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(m)); return true; } return false; }
function leave() {
  wantOpen = false; send({ t: 'leave' });
  if (ws) ws.close();
  ws = null; code = null; V = null; P = null;
  history.replaceState(null, '', '/');
  show('home');
}
function onMessage(m) {
  if (m.t === 'state') {
    skew = m.now - Date.now();
    if (sweeping) { pending = m; return; }
    accept(m);
  } else if (m.t === 'emote') {
    setTimeout(() => bubble(m.seat, emoText(m.e)), m.delay || 0);
  } else if (m.t === 'error') {
    if (['notable', 'full', 'started'].includes(m.code)) {
      wantOpen = false; if (ws) ws.close(); ws = null; history.replaceState(null, '', '/');
      show('home'); $('homeErr').textContent = t('err_' + m.code);
      return;
    }
    sending = false;
    note = TXT[lang]['err_' + m.code] ? t('err_' + m.code) : t('err_generic');
    if (V && V.g) { statusText(); renderActions(); }
  }
}
function accept(m) {
  P = V; V = m; sending = false;
  if (V.phase === 'lobby') { show('lobby'); renderLobby(); return; }
  const g = V.g, pg = P && P.g;
  // a trick just got collected: slide the cards to the winner first, then draw the new state
  if (pg && pg.phase === 'collect' && pg.trick && g.phase !== 'collect' && $('game').hidden === false) {
    sweeping = true;
    sweep(pg.lastWin, () => { sweeping = false; const n = pending; pending = null; drawGame(); if (n) accept(n); });
    return;
  }
  drawGame();
}
function drawGame() {
  const g = V.g, pg = P && P.g;
  if (!pg || pg.handNo !== g.handNo || g.phase === 'lead' && pg.phase !== 'lead') sel = [];
  if (pg && pg.turn !== g.turn) sel = [];
  // which plays are new (they fly in from that player's seat)
  fresh = [];
  if (g.trick) {
    const before = pg && pg.trick && pg.trick.leader === g.trick.leader && pg.handNo === g.handNo ? pg.trick.plays.length : 0;
    for (let i = before; i < g.trick.plays.length; i++) fresh.push(i);
  }
  // cards dealt since last time (they fly out of the deck one at a time)
  dealAnim = null;
  if (pg && g.dealSeq !== pg.dealSeq || !pg) {
    const newHand = !pg || pg.handNo !== g.handNo;
    const add = g.players.map((p, i) => Math.max(0, p.count - (newHand || !pg ? 0 : pg.players[i].count)));
    const myPrev = newHand || !pg ? [] : (pg.players[me()].hand || []);
    const myNew = (g.players[me()].hand || []).filter(c => !myPrev.includes(c));
    const seq = [], left = add.slice(), n = add.length, start = g.nextTurn >= 0 ? g.nextTurn : 0;
    while (left.some(x => x > 0)) for (let i = 0; i < n; i++) { const p = (start + i) % n; if (left[p] > 0) { seq.push(p); left[p]--; } }
    if (seq.length) dealAnim = { seq, myNew };
  }
  show('game');
  renderGame();
}

/* ---------------- screens ---------------- */
function show(id) {
  for (const s of ['home', 'lobby', 'game']) $(s).hidden = s !== id;
  if (id === 'home') renderHome();
}
const me = () => (V && V.me >= 0 ? V.me : 0);
const nm = i => (i === me() ? t('you') : (V.seats[i] && V.seats[i].name) || '—');
const hostName = () => { const h = V.seats.find(s => s && s.host); return h ? h.name : '…'; };

function renderHome() {
  $('tagline').textContent = t('tagline'); $('nameLbl').textContent = t('yourName'); $('seatsQ').textContent = t('seatsQ');
  $('bCreate').textContent = t('create'); $('orTxt').textContent = t('or'); $('bJoin').textContent = t('join');
  $('codeIn').placeholder = 'ABCDE'; $('hRules').textContent = t('rules'); $('hLang').textContent = t('langBtn');
  if (!$('nameIn').value) $('nameIn').value = store.get('kozel-name') || '';
  $('seatOpts').innerHTML = [2, 3, 4].map(k => `<label><input type="radio" name="seats" id="seats${k}" value="${k}" ${k === seatsChoice ? 'checked' : ''}><span>${k === 4 ? t('teams') : t('players', { n: k })}</span></label>`).join('');
  if (!$('heroFan').innerHTML) $('heroFan').innerHTML = ['H8', 'S6', 'D7'].map((c, i) => cardHTML(c, '', 'div', `style="transform:rotate(${(i - 1) * 14}deg)"`)).join('');
}
function avatarHTML(i, ring = true) {
  return `<div class="ava" style="--h:${HUES[i % 4]}">${ring ? '<svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="trk" cx="32" cy="32" r="29"/><circle class="tm" cx="32" cy="32" r="29"/></svg>' : ''}<span class="face">${AVATAR}</span></div>`;
}
function renderLobby() {
  $('lCodeLbl').textContent = t('tableCode'); $('lCode').textContent = V.code; $('bShare').textContent = t('share');
  $('lLink').textContent = `${location.host}/?t=${V.code}`;
  $('lSeatsLbl').textContent = t('seatsLbl'); $('bLeave').textContent = t('leave'); $('lLang').textContent = t('langBtn');
  $('lSeats').innerHTML = V.seats.map((s, i) => {
    if (!s) return `<li class="empty"><div class="ava"></div><div class="who"><b>${t('emptySeat')}</b></div></li>`;
    const tags = [i === V.me ? t('you') : '', s.host ? t('hostTag') : '', !s.online ? t('offline') : '', V.seats.length === 4 && partnerOf(4, me()) === i ? t('partner') : ''].filter(Boolean).join(' · ');
    return `<li>${avatarHTML(i, false)}<div class="who"><b>${esc(s.name)}</b><small>${tags}</small></div></li>`;
  }).join('');
  $('bStart').hidden = !V.host; $('bStart').textContent = t('start');
  $('lNote').textContent = V.host ? t('startNote') : t('waitingHost', { name: hostName() });
}
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* ---------------- cards ---------------- */
const RNK = () => (lang === 'ru' ? R_RU : R_EN);
const trumpS = () => (V && V.g && V.g.trump ? sOf(V.g.trump) : null);
const PIPS = {
  0: [[33, 20], [33, 50], [33, 80], [67, 20], [67, 50], [67, 80]],
  1: [[33, 20], [33, 50], [33, 80], [67, 20], [67, 50], [67, 80], [50, 35]],
  2: [[33, 20], [33, 50], [33, 80], [67, 20], [67, 50], [67, 80], [50, 35], [50, 65]],
  3: [[33, 19], [33, 39.5], [33, 60.5], [33, 81], [67, 19], [67, 39.5], [67, 60.5], [67, 81], [50, 50]],
  7: [[33, 19], [33, 39.5], [33, 60.5], [33, 81], [67, 19], [67, 39.5], [67, 60.5], [67, 81], [50, 29], [50, 71]],
};
const COURT = {};
function courtSVG(r, s) {
  const key = r + s; if (COURT[key]) return COURT[key];
  const red = isRedSuit(s), suitC = red ? '#c81f2d' : '#16171c';
  const robe = red ? '#c8323b' : '#2b4a8f', robe2 = red ? '#2b4a8f' : '#c8323b';
  const gold = '#e2a93b', skin = '#f3d6b4', ink = '#1d1d22', sym = SYM[s];
  let head;
  if (r === 6) head = `<path d="M24 21 Q30 32 36 21 Q30 25.5 24 21Z" fill="#8a6440" stroke="${ink}" stroke-width=".5"/><path d="M22 13.5 L23 5 L26.5 9.5 L30 3 L33.5 9.5 L37 5 L38 13.5 Z" fill="${gold}" stroke="${ink}" stroke-width=".7"/><circle cx="30" cy="11" r="1.1" fill="${robe2}"/>`;
  else if (r === 5) head = `<path d="M21.5 23 Q20 10 30 10.5 Q40 10 38.5 23 Q37 15 30 15 Q23 15 21.5 23Z" fill="#6e3f20" stroke="${ink}" stroke-width=".5"/><path d="M23.5 13 Q24 6.5 26.5 9.5 Q28 4 30 8.5 Q32 4 33.5 9.5 Q36 6.5 36.5 13 Z" fill="${gold}" stroke="${ink}" stroke-width=".7"/><circle cx="30" cy="6.4" r="1.3" fill="${robe}"/>`;
  else head = `<path d="M20.5 15.5 Q21.5 7 31 8 Q40.5 8 39.5 15.5 Z" fill="${robe2}" stroke="${ink}" stroke-width=".7"/><path d="M37 10 Q45 2 47.5 6 Q42 6.5 39 12" fill="none" stroke="${gold}" stroke-width="1.5" stroke-linecap="round"/>`;
  const half = `<path d="M7 42 Q9 28.5 30 27.5 Q51 28.5 53 42 Z" fill="${robe}" stroke="${ink}" stroke-width=".8"/><path d="M18 30.5 Q30 37.5 42 30.5" fill="none" stroke="${gold}" stroke-width="2.2"/><path d="M30 31 L30 42" stroke="${gold}" stroke-width="1.6"/><circle cx="30" cy="19.5" r="7" fill="${skin}" stroke="${ink}" stroke-width=".8"/><circle cx="27.4" cy="19" r=".7" fill="${ink}"/><circle cx="32.6" cy="19" r=".7" fill="${ink}"/>${head}<text x="47" y="39" font-size="9" text-anchor="middle" fill="${suitC}" font-family="serif">${sym}</text>`;
  return (COURT[key] = `<svg viewBox="0 0 60 84" aria-hidden="true"><rect x=".7" y=".7" width="58.6" height="82.6" rx="3" fill="#fbf3df" stroke="${suitC}" stroke-width="1"/><g>${half}</g><g transform="rotate(180 30 42)">${half}</g><line x1="3" y1="42" x2="57" y2="42" stroke="${ink}" stroke-width=".5"/></svg>`);
}
function faceHTML(c) {
  const s = sOf(c), r = rOf(c), sym = SYM[s];
  if (r === 8) return `<span class="ace">${sym}</span>`;
  if (r >= 4 && r <= 6) return `<span class="court">${courtSVG(r, s)}</span>`;
  return PIPS[r].map(([x, y]) => `<span class="pip${y > 52 ? ' inv' : ''}" style="left:${x}%;top:${y}%">${sym}</span>`).join('');
}
function cardHTML(c, cls = '', tag = 'div', attrs = '') {
  const s = sOf(c), r = RNK()[rOf(c)], ix = `${r}<small>${SYM[s]}</small>`;
  const tr = trumpS() && s === trumpS() ? 'trumpc' : '';
  return `<${tag} class="card ${cls} ${isRedSuit(s) ? 'red' : ''} ${tr}" ${attrs} aria-label="${r} ${SYM[s]}"><span class="ix">${ix}</span><span class="ix br">${ix}</span>${faceHTML(c)}</${tag}>`;
}
const backHTML = (cls = '', style = '') => `<div class="card back ${cls}" style="${style}"></div>`;
const AVATAR = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="16" r="7.5" fill="rgba(255,255,255,.9)"/><path d="M5 40 Q6.5 25.5 20 25.5 Q33.5 25.5 35 40Z" fill="rgba(255,255,255,.9)"/></svg>`;

/* ---------------- the table ---------------- */
function sizes() {
  const w = innerWidth, h = innerHeight;
  const cw = Math.round(Math.max(60, Math.min(118, w * 0.255, h * 0.135)));   // big cards on phones
  const root = document.documentElement.style;
  root.setProperty('--cw', cw + 'px'); root.setProperty('--cws', Math.round(cw * 0.76) + 'px');
  root.setProperty('--deckw', Math.round(Math.max(70, cw * 0.98)) + 'px');
  return cw;
}
function seatHTML(i) {
  const g = V.g, s = V.seats[i], p = g.players[i], on = g.turn === i && ACTIVE.includes(g.phase), k = p.count;
  const fan = i === me() ? '' : `<div class="fanmini">${Array.from({ length: k }, (_, j) => `<span class="mb" style="--r:${((j - (k - 1) / 2) * 11).toFixed(1)}deg"></span>`).join('')}</div>`;
  const show = i !== me() && g.phase === 'reveal' && g.reveal && g.reveal.by === i ? `<div class="showcard">${cardHTML(g.reveal.c, 'sm')}<span>${t('newTrump')}</span></div>` : '';
  const tag = V.seats.length === 4 && partnerOf(4, me()) === i ? `<span class="tag">${t('partner')}</span>` : '';
  const off = s && !s.online ? 'off' : '';
  return `<div class="seat ${on ? 'on' : ''}" id="seat-${i}">${fan}${avatarHTML(i)}<div class="plate ${off}"><span class="nm">${esc(nm(i))}</span>${tag}<span class="pn" title="${t('penalty')}">${p.pen}/${LIMIT}</span></div>${show}</div>`;
}
function renderSeats() {
  const n = V.seats.length, order = Array.from({ length: n - 1 }, (_, r) => (me() + r + 1) % n);
  $('opps').className = 'opps n' + (n - 1);
  $('opps').innerHTML = order.map(seatHTML).join('');
  $('meSeat').innerHTML = seatHTML(me());
}
function renderDeck() {
  const g = V.g, n = g.stock;
  let pile;
  if (n) {
    const layers = Math.min(4, Math.ceil(n / 7));
    const under = g.firstTrick && g.trump && g.phase !== 'reveal' ? `<div class="under">${cardHTML(g.trump, 'sm')}</div>` : '';
    const flip = g.phase === 'reveal' && g.reveal && g.reveal.by === -1 ? `<div class="flip">${cardHTML(g.reveal.c, 'sm')}</div>` : '';
    pile = `<div class="deckstack" id="deckpile">${under}${Array.from({ length: layers }, (_, j) => backHTML('sm', `--o:${j}`)).join('')}<span class="cnt">${n}</span>${flip}</div>`;
  } else pile = `<div class="deckstack empty" id="deckpile">${t('deckOut')}</div>`;
  let badge = '';
  if (g.trump) {
    const ts = sOf(g.trump);
    const from = g.firstTrick ? t('turnedUp') : g.trumpBy === me() ? t('yourCard') : t('drawnBy', { name: esc(nm(g.trumpBy)) });
    badge = `<div class="tbadge">${t('trump')} <span class="sym ${isRedSuit(ts) ? 'red' : ''}">${SYM[ts]}</span>${g.double ? `<span class="x2" title="${t('doubleTip')}">×2</span>` : ''}</div><div class="from">${from}</div>`;
  }
  $('deck').innerHTML = pile + badge;
}
function renderTrick() {
  const g = V.g, el = $('trick');
  if (!g.trick) { el.innerHTML = ''; return; }
  const up = g.trick.plays.map((pl, i) => ({ pl, i })).filter(x => !x.pl.down);
  const downs = g.trick.plays.map((pl, i) => ({ pl, i })).filter(x => x.pl.down);
  const ch = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cws')) || 50) * 1.4;
  const L = up.length, oy = L > 1 ? Math.min(ch * 0.42, 230 / (L - 1)) : 0;   // each beat sits lower so the cards under it stay readable
  const lap = g.trick.lap > 1 ? `<div class="lapchip">${t('lap', { n: g.trick.lap })}</div>` : '';
  const stack = `<div class="stack" style="--oy:${oy.toFixed(1)}px">` + up.map(({ pl, i }, j) =>
    `<div class="layer ${i === g.trick.win ? 'win' : ''} ${pl.cards.length > 3 ? 'many' : ''}" data-i="${i}" style="--i:${j}"><span class="who">${esc(nm(pl.p))}</span>${pl.cards.map(c => cardHTML(c, 'sm')).join('')}</div>`).join('') + '</div>';
  const throws = downs.length ? '<div class="throws">' + downs.map(({ pl, i }) =>
    `<div class="throw" data-i="${i}"><span class="who">${esc(nm(pl.p))} · ${t('down')}</span><div class="tcards">${pl.cards.map(() => backHTML('tb')).join('')}</div></div>`).join('') + '</div>' : '';
  el.innerHTML = lap + `<div class="trickwrap">${stack}${throws}</div>`;
  if (!reduce) for (const i of fresh) {
    const node = el.querySelector(`[data-i="${i}"]`), from = centerOf(seatEl(g.trick.plays[i].p));
    if (!node || !from) continue;
    const a = centerOf(node);
    node.animate([{ transform: `translate(${from.x - a.x}px,${from.y - a.y}px) scale(.55)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)' });
  }
  fresh = [];
}
function statusText() {
  const g = V.g, el = $('status');
  el.classList.remove('mine');
  if (note) { el.textContent = note; el.classList.add('mine'); note = ''; return; }
  if (g.phase === 'reveal') {
    const by = g.reveal.by;
    el.textContent = by === -1 ? t('firstTrump') : by === me() ? t('newTrumpYou') : t('newTrumpBy', { name: nm(by) });
    if (by === me()) el.classList.add('mine');
    return;
  }
  if (g.phase === 'collect') {
    if (g.lastWin === me()) { el.classList.add('mine'); el.textContent = t('youTake'); }
    else el.textContent = t('takes', { name: nm(g.lastWin) });
    return;
  }
  if (ACTIVE.includes(g.phase)) {
    const mine = g.turn === me();
    if (mine) el.classList.add('mine');
    if (g.phase === 'lead') { el.textContent = mine ? t('yourLead') : t('leading', { name: nm(g.turn) }); return; }
    if (!mine) { el.textContent = t('thinking', { name: nm(g.turn) }); return; }
    const n = g.trick.n, ts = trumpS(), hand = g.players[me()].hand || [];
    const any = combos(hand, n).some(c => canBeat(g.trick.plays[g.trick.win].cards, c, ts));
    if (g.phase === 'challenge') el.textContent = any ? t('beatBack', { name: nm(g.trick.plays[g.trick.win].p) }) : t('cantBack');
    else if (g.trick.folded.includes(me())) el.textContent = t('mustThrow', { n });
    else el.textContent = any ? t(n === 1 ? 'follow1' : 'follow', { n }) : t(n === 1 ? 'cantBeat1' : 'cantBeat', { n });
    return;
  }
  el.textContent = '';
}
function renderHand() {
  const g = V.g, hand = g.players[me()].hand || [], el = $('hand'), k = hand.length, cw = sizes();
  const myTurn = g.turn === me() && ACTIVE.includes(g.phase) && !sending;
  const pad = cw * 0.18, W = Math.max(cw, el.clientWidth - 2 * pad);   // room for the fan's tilt at both ends
  const step = k > 1 ? Math.min(cw * 0.82, (W - cw) / (k - 1)) : 0;
  const x0 = pad + (W - (step * (k - 1) + cw)) / 2;
  el.classList.toggle('wait', !myTurn);
  el.innerHTML = hand.map((c, i) => {
    const d = i - (k - 1) / 2, on = sel.includes(c);
    const y = d * d * 2.2 - (on ? 22 : 0), r = d * 3.2;
    const glow = g.phase === 'reveal' && g.reveal && g.reveal.by === me() && g.reveal.c === c ? 'glow' : '';
    return cardHTML(c, `${on ? 'sel' : ''} ${glow}`, 'button', `type="button" data-c="${c}" ${myTurn ? '' : 'disabled'} style="left:${(x0 + i * step).toFixed(1)}px;transform:translateY(${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg)"`);
  }).join('');
}
function renderActions() {
  const g = V.g, myTurn = g.turn === me() && ACTIVE.includes(g.phase) && !sending;
  const emoBtn = `<button class="emobtn" id="aEmo" type="button" aria-label="${t('emotes')}" aria-expanded="${emoOpen}">😊</button>`;
  let hint = '', buttons = '';
  if (myTurn && g.phase === 'lead') {
    const ok = validLead(sel);
    if (sel.length && !ok) hint = t('invalidLead');
    buttons = `<button class="btn" id="aPlay" ${ok ? '' : 'disabled'}>${t('play')}${sel.length ? ' · ' + sel.length : ''}</button>`;
  } else if (myTurn) {
    const n = g.trick.n, full = sel.length === n, ok = full && canBeat(g.trick.plays[g.trick.win].cards, sel, trumpS());
    const folded = g.phase === 'follow' && g.trick.folded.includes(me());
    hint = sel.length ? (full && !ok && !folded ? t('notBeat') : t('selected', { k: sel.length, n })) : '';
    if (g.phase === 'challenge') buttons = `<button class="btn" id="aBeat" ${ok ? '' : 'disabled'}>${t('beat')}</button><button class="btn alt" id="aPass">${t('letGo')}</button>`;
    else if (folded) buttons = `<button class="btn alt" id="aDown" ${full ? '' : 'disabled'}>${t('throwDown')}</button>`;
    else buttons = `<button class="btn" id="aBeat" ${ok ? '' : 'disabled'}>${t('beat')}</button><button class="btn alt" id="aDown" ${full ? '' : 'disabled'}>${t('throwDown')}</button>`;
  }
  $('actions').innerHTML = `<div class="row">${buttons}${emoBtn}</div><div class="hint">${hint}</div>`;
}
function renderEmo() {
  const el = $('emo');
  el.hidden = !emoOpen;
  if (!emoOpen) return;
  el.innerHTML = `<div class="emogrid">${EMO.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div><div class="phr">${TXT[lang].phr.map((p, i) => `<button type="button" data-e="p${i}">${p}</button>`).join('')}</div>`;
}
let cdTimer = null;
function renderOverlay() {
  const ov = $('ov'), sh = $('sheet');
  clearInterval(cdTimer);
  let mode = ovMode;
  if (!mode && V && V.phase === 'game' && V.g && (V.g.phase === 'handEnd' || V.g.phase === 'over')) mode = V.g.phase;
  if (!mode) { ov.hidden = true; return; }
  ov.hidden = false;
  if (mode === 'rules') {
    sh.innerHTML = `<h2>${t('rulesTitle')}</h2><ol>${TXT[lang].r.map(x => `<li>${x}</li>`).join('')}</ol><div class="foot"><button class="btn" data-ov="close">${t('close')}</button></div>`;
    return;
  }
  const g = V.g, r = g.result, gpen = r.groups.map(gr => g.players[gr[0]].pen);
  const maxPen = Math.max(...gpen), minPen = Math.min(...gpen), gname = gr => gr.map(i => esc(nm(i))).join(' + ');
  const rows = r.groups.map((gr, k) => `<tr class="${mode === 'over' && gpen[k] === maxPen ? 'out' : ''} ${mode === 'over' && gpen[k] === minPen ? 'top' : ''}"><td>${gname(gr)}</td><td>${r.pts[k]}</td><td>+${r.add[k]}</td><td>${gpen[k]}</td></tr>`).join('');
  const lineNote = `<p>${t('line', { n: r.line })}${r.mult > 1 ? ' ' + t('doubled') : ''}</p>`;
  let head = `<h2>${t('handOver', { n: g.handNo })}</h2>` + lineNote, foot = '';
  if (mode === 'over') {
    const losers = r.groups.filter((gr, k) => gpen[k] === maxPen), winners = r.groups.filter((gr, k) => gpen[k] === minPen);
    head = `<h2>${t('gameOver')}</h2><p class="big-line">${losers.some(gr => gr.includes(me())) ? t('youKozel') : t('kozel', { name: losers.map(gname).join(', ') })}</p><p>${t('winner', { name: winners.map(gname).join(', ') })}</p>` + lineNote;
    foot = V.host ? `<button class="btn" data-ov="again">${t('playAgain')}</button>` : `<p class="note">${t('waitAgain', { name: esc(hostName()) })}</p>`;
  } else {
    foot = `<span class="countdown" id="cd"></span>`;
    const tick = () => { const s = Math.max(0, Math.ceil((g.nextAt - (Date.now() + skew)) / 1000)); const c = $('cd'); if (c) c.textContent = t('nextIn', { s }); };
    setTimeout(tick); cdTimer = setInterval(tick, 500);
  }
  sh.innerHTML = `${head}<table class="res"><thead><tr><th></th><th>${t('pts')}</th><th>${t('add')}</th><th>${t('total')}</th></tr></thead><tbody>${rows}</tbody></table><div class="foot">${foot}</div>`;
}
function renderGame() {
  document.documentElement.lang = lang;
  $('gCode').textContent = V.code; $('bRules').textContent = t('rules'); $('bLang').textContent = t('langBtn');
  sizes(); renderSeats(); renderDeck(); renderHand(); renderTrick(); statusText(); renderActions(); renderEmo(); renderOverlay();
  if (dealAnim) { playDeal(dealAnim); dealAnim = null; }
}

/* ---------------- motion ---------------- */
function centerOf(el) { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
const seatEl = p => (p === me() ? $('hand') : document.querySelector(`#seat-${p} .ava`));
function playDeal({ seq, myNew }) {
  if (reduce) return;
  const deck = centerOf($('deckpile'));
  if (!deck) return;
  let mine = 0;
  seq.forEach((p, k) => {
    const delay = k * 110;
    if (p === me()) {
      const c = myNew[mine++], node = c && $('hand').querySelector(`[data-c="${c}"]`);
      if (!node) return;
      const a = centerOf(node), end = node.style.transform || 'none';
      node.animate([{ transform: `translate(${deck.x - a.x}px,${deck.y - a.y}px) scale(.6)`, opacity: 0.9 }, { transform: end, opacity: 1 }], { duration: 320, delay, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
    } else {
      const b = centerOf(seatEl(p));
      if (!b) return;
      const d = document.createElement('div');
      d.className = 'card back sm flyer'; d.style.left = deck.x + 'px'; d.style.top = deck.y + 'px'; d.style.opacity = '0';
      $('fx').appendChild(d);
      d.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(calc(-50% + ${b.x - deck.x}px), calc(-50% + ${b.y - deck.y}px)) rotate(160deg) scale(.55)`, opacity: 0.9 }],
        { duration: 300, delay, easing: 'cubic-bezier(.3,.7,.3,1)' }).onfinish = () => d.remove();
    }
  });
}
function sweep(winner, done) {
  const to = centerOf(seatEl(winner)), nodes = document.querySelectorAll('#trick .layer, #trick .throw');
  if (reduce || !to || !nodes.length) { done(); return; }
  nodes.forEach(l => {
    const a = centerOf(l);
    l.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${to.x - a.x}px,${to.y - a.y}px) scale(.3)`, opacity: 0 }], { duration: 420, easing: 'ease-in', fill: 'forwards' });
  });
  setTimeout(done, 440);
}
function bubble(seat, txt) {
  const a = document.querySelector(`#seat-${seat} .ava`);
  if (!a) return;
  const r = a.getBoundingClientRect(), b = document.createElement('div');
  b.className = 'bubble' + (EMO.includes(txt) ? '' : ' txt'); b.textContent = txt;
  b.style.left = (r.left + r.width / 2) + 'px'; b.style.top = (r.top - 4) + 'px';
  $('fx').appendChild(b); setTimeout(() => b.remove(), 2700);
}
function ringTick() {
  const el = document.querySelector('#game .seat.on .tm');
  if (el && V && V.g && V.g.deadline) {
    const f = Math.max(0, Math.min(1, (V.g.deadline - (Date.now() + skew)) / TURN_MS));
    el.style.strokeDashoffset = ((1 - f) * CIRC).toFixed(1);
    el.classList.toggle('low', f < 0.25);
  }
  requestAnimationFrame(ringTick);
}
function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2200); }

/* ---------------- input ---------------- */
function myName() {
  const n = $('nameIn').value.trim().slice(0, 16);
  if (!n) { $('homeErr').textContent = t('needName'); $('nameIn').focus(); return null; }
  store.set('kozel-name', n);
  return n;
}
$('seatOpts').addEventListener('change', e => { seatsChoice = +e.target.value || 3; });
$('bCreate').addEventListener('click', async () => {
  if (!myName()) return;
  $('homeErr').textContent = ''; $('bCreate').disabled = true;
  try {
    const res = await fetch('/api/new', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seats: seatsChoice }) });
    const data = await res.json();
    if (!res.ok || !data.code) throw new Error('create');
    connect(data.code);
  } catch { $('homeErr').textContent = t('err_net'); }
  $('bCreate').disabled = false;
});
function joinFromInput() {
  if (!myName()) return;
  const c = $('codeIn').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(c)) { $('homeErr').textContent = t('needCode'); return; }
  $('homeErr').textContent = ''; connect(c);
}
$('bJoin').addEventListener('click', joinFromInput);
$('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') joinFromInput(); });
$('bShare').addEventListener('click', async () => {
  const url = `${location.origin}/?t=${V.code}`;
  if (navigator.share) { try { await navigator.share({ title: 'Kozel', text: t('shareText', { code: V.code }), url }); return; } catch { /* cancelled */ } }
  try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch { toast(url); }
});
$('bStart').addEventListener('click', () => send({ t: 'start' }));
$('bLeave').addEventListener('click', leave);
$('hand').addEventListener('click', e => {
  const b = e.target.closest('button[data-c]'); if (!b || b.disabled) return;
  const c = b.dataset.c, g = V.g;
  if (sel.includes(c)) sel = sel.filter(x => x !== c);
  else { if (g.phase !== 'lead' && sel.length >= g.trick.n) sel = sel.slice(1); sel.push(c); }
  renderHand(); renderActions();
});
$('actions').addEventListener('click', e => {
  const id = e.target.closest('button')?.id; if (!id) return;
  if (id === 'aEmo') { emoOpen = !emoOpen; renderActions(); renderEmo(); return; }
  const g = V.g; if (g.turn !== me() || sending) return;
  let ok = false;
  if (id === 'aPlay') ok = send({ t: 'play', cards: sel, down: false });
  else if (id === 'aBeat') ok = send({ t: 'play', cards: sel, down: false });
  else if (id === 'aDown') ok = send({ t: 'play', cards: sel, down: true });
  else if (id === 'aPass') ok = send({ t: 'pass' });
  if (ok) { sending = true; renderHand(); renderActions(); }
});
$('emo').addEventListener('click', e => {
  const b = e.target.closest('button[data-e]'); if (!b) return;
  send({ t: 'emote', e: b.dataset.e });
  emoOpen = false; renderActions(); renderEmo();
});
document.addEventListener('click', e => {
  if (emoOpen && !e.target.closest('#emo') && !e.target.closest('#aEmo')) { emoOpen = false; renderActions(); renderEmo(); }
});
$('sheet').addEventListener('click', e => {
  const k = e.target.closest('[data-ov]')?.dataset.ov; if (!k) return;
  if (k === 'close') { ovMode = null; if (V && V.g) renderOverlay(); else $('ov').hidden = true; }
  else if (k === 'again') send({ t: 'again' });
});
const openRules = () => { ovMode = 'rules'; renderOverlay(); };
$('bRules').addEventListener('click', openRules);
$('hRules').addEventListener('click', openRules);
const switchLang = () => {
  lang = lang === 'en' ? 'ru' : 'en'; store.set('kozel-lang', lang);
  if (!$('home').hidden) renderHome();
  if (V && V.phase === 'lobby') renderLobby();
  if (V && V.g && !$('game').hidden) renderGame();
};
for (const id of ['bLang', 'hLang', 'lLang']) $(id).addEventListener('click', switchLang);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && (ovMode || emoOpen)) { ovMode = null; emoOpen = false; if (V && V.g) renderGame(); else $('ov').hidden = true; } });
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (V && V.g && !$('game').hidden) renderGame(); }, 80); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && wantOpen && (!ws || ws.readyState > 1)) openSocket(); });

/* ---------------- start ---------------- */
requestAnimationFrame(ringTick);
const qp = new URLSearchParams(location.search).get('t');
if (qp && /^[A-Za-z0-9]{5}$/.test(qp)) {
  if (store.get('kozel-name')) connect(qp.toUpperCase());
  else { show('home'); $('codeIn').value = qp.toUpperCase(); $('nameIn').focus(); }
} else show('home');
