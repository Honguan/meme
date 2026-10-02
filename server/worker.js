import { matchRequest } from './matches.js';
import index from '../dist/client/index.html';

export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/match/')) return matchRequest(request, env.DB);
    if (path === '/') return new Response(index, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  },
};
