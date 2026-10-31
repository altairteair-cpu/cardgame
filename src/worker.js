// Entry point: creates tables, connects phones to their table, and serves the website from /public.
export { Table } from './table.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const tableFor = (env, code) => env.TABLES.get(env.TABLES.idFromName(code));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/new' && request.method === 'POST') {
      let seats = 3;
      try { seats = (await request.json()).seats; } catch { /* default */ }
      for (let i = 0; i < 6; i++) {
        const code = newCode();
        const res = await tableFor(env, code).fetch('https://table/create', { method: 'POST', body: JSON.stringify({ code, seats }) });
        if (res.ok) return Response.json({ code });
      }
      return Response.json({ error: 'busy' }, { status: 503 });
    }

    const ws = url.pathname.match(/^\/ws\/([A-Z0-9]{5})$/);
    if (ws) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      return tableFor(env, ws[1]).fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
