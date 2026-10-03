const KEY = 'meme-clash-online';

export class MatchClient {
  constructor(onState, onError) {
    this.onState = onState; this.onError = onError; this.pending = false; this.leaving = false;
    this.chain = Promise.resolve();
    try { this.token = sessionStorage.getItem(KEY); } catch {}
  }
  async join(payload) {
    if (!this.token) {
      this.token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      try { sessionStorage.setItem(KEY, this.token); } catch { this.token = null; throw new Error('無法儲存對局連線'); }
    }
    return this.send('join', payload);
  }
  send(action, data = {}) {
    clearTimeout(this.timer);
    if (action === 'leave' && this.token) this.leaving = true;
    const task = async () => {
      if (!this.token) return;
      if (this.leaving) { action = 'leave'; data = {}; }
      this.pending = action !== 'state';
      try {
        const response = await fetch(`/api/match/${action}`, { method: action === 'state' ? 'GET' : 'POST',
          headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
          ...(action === 'state' ? {} : { body: JSON.stringify(data) }), signal: AbortSignal.timeout(10000) });
        const rejected = response.status === 401;
        const state = rejected ? { status: 'idle' } : await response.json();
        if (!response.ok && !rejected) throw new Error(state.error || '匹配服務暫時無法連線');
        if (state.status === 'idle') {
          this.token = null; this.leaving = false;
          try { sessionStorage.removeItem(KEY); } catch {}
        }
        this.pending = false; this.onState(state);
        if (rejected) this.onError('連線憑證無效');
        return state;
      } catch (error) { this.onError(error.message); }
      finally {
        this.pending = false;
        clearTimeout(this.timer);
        if (this.token) this.timer = setTimeout(() => this.send('state'), 1500);
      }
    };
    this.chain = this.chain.then(task, task);
    return this.chain;
  }
}
