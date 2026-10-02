import { TAGS } from './catalog.js';
import { units } from './game.js';
import { createBattle, WIDTH, HEIGHT } from './physics.js';

const images = new Map();
function imageFor(url) {
  if (!url) return null;
  if (!images.has(url)) { const image = new Image(); image.crossOrigin = 'anonymous'; image.src = url; images.set(url, image); }
  const image = images.get(url);
  return image.complete && image.naturalWidth ? image : null;
}
export class Arena {
  constructor(canvas, game, onEnd, onUpdate) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.game = game;
    const theme = getComputedStyle(document.documentElement);
    this.colors = [theme.getPropertyValue('--accent').trim() || '#d4f75b',theme.getPropertyValue('--pink').trim() || '#fb8aac'];
    this.onEnd = onEnd; this.onUpdate = onUpdate; this.impacts = []; this.running = false;
    this.last = 0; this.accumulator = 0; this.frame = 0; this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = WIDTH * ratio; canvas.height = HEIGHT * ratio;
    this.ctx.scale(ratio, ratio);
    this.animate = this.animate.bind(this); this.frame = requestAnimationFrame(this.animate);
  }
  start() {
    if (this.running) return;
    this.running = true; this.accumulator = 0; this.started = performance.now();
    this.battle = createBattle(this.game, (...args) => this.presentImpact(...args));
  }
  presentImpact(x, y, a, b, report) {
      const at = performance.now();
      this.impacts = this.impacts.filter(p => p.kind !== 'hit' && at - p.at < 850);
      this.impacts.push({ kind: 'hit', x, y, tag: a.tag, secondTag: b.tag, motif: a.motif || a.tag, secondMotif: b.motif || b.tag, at });
      for (const change of report.changes) {
        const previous = this.impacts.find(p => p.kind === 'result' && p.uid === change.uid);
        this.impacts = this.impacts.filter(p => p !== previous);
        this.impacts.push({ ...change, hp: change.hp + (previous?.hp || 0), shield: change.shield + (previous?.shield || 0), kind: 'result', at });
      }
      if (report.traps.length) this.impacts.push({ kind: 'trap', text: report.traps.join(' + '), at });
      this.impacts = this.impacts.slice(-60);
      this.hitStopUntil = this.reduced ? 0 : at + 65;
      this.shakeUntil = this.reduced ? 0 : at + 180;
      this.canvas.setAttribute('aria-label', `迷因對決：${report.changes.map(v => `${v.name}${v.ko ? ' 擊倒' : ''}${v.hp ? ` HP ${v.hp > 0 ? '+' : ''}${v.hp}` : ''}${v.shield ? ` 護盾 ${v.shield > 0 ? '+' : ''}${v.shield}` : ''}`).join('；')}`);
      this.onUpdate?.(a, b);
  }
  animate(now) {
    const delta = Math.min(now - (this.last || now), 100); this.last = now;
    if (this.running && !this.endingAt && now >= (this.hitStopUntil || 0)) {
      this.accumulator += delta;
      while (this.accumulator >= 1000 / 60) {
        this.accumulator -= 1000 / 60;
        if (this.battle.step()) {
          // Keep the last positions until the final damage/KO presentation has finished.
          this.endingAt = now + 850;
          break;
        }
        if (performance.now() < (this.hitStopUntil || 0)) { this.accumulator = 0; break; }
      }
    }
    if (this.endingAt && now >= this.endingAt) {
      this.running = false; this.battle.dispose(); this.battle = null;
      this.onEnd();
    }
    if (this.disposed) return;
    this.draw(now);
    this.frame = requestAnimationFrame(this.animate);
  }
  draw(now) {
    const c = this.ctx, field = this.game.field;
    const palette = { grid: ['#171d1c','#556a55'], fine: ['#271f1b','#966446'], moon: ['#182027','#526b85'], backrooms: ['#292a21','#92905a'], xp: ['#182923','#478e71'] };
    const [bg, line] = palette[field] || palette.grid;
    c.clearRect(0, 0, WIDTH, HEIGHT); c.fillStyle = bg; c.fillRect(0, 0, WIDTH, HEIGHT);
    const art = imageFor('/art/memeverse-arena.png');
    if (art) {
      c.drawImage(art, 0, 0, WIDTH, HEIGHT);
      c.fillStyle = bg; c.globalAlpha = field === 'grid' ? .16 : .55; c.fillRect(0, 0, WIDTH, HEIGHT); c.globalAlpha = 1;
    }
    c.save();
    if (now < (this.shakeUntil || 0)) c.translate(Math.sin(now * .09) * 3, Math.cos(now * .11) * 2);
    c.strokeStyle = line; c.globalAlpha = .19; c.lineWidth = 1;
    const horizon = 105;
    for (let x = -1100; x <= 2200; x += 130) { c.beginPath(); c.moveTo(WIDTH / 2 + (x - WIDTH / 2) * .22, horizon); c.lineTo(x, HEIGHT); c.stroke(); }
    for (let y = 0; y < 10; y++) { const at = horizon + y * y * 4.7; c.beginPath(); c.moveTo(0, at); c.lineTo(WIDTH, at); c.stroke(); }
    c.globalAlpha = 1;
    if (field === 'moon') {
      c.fillStyle = '#b7ccdc'; c.globalAlpha = .65;
      for (let i = 0; i < 54; i++) c.fillRect((i * 173 + 34) % WIDTH, (i * 53 + 19) % 190, i % 3 === 0 ? 2 : 1, 2);
      c.beginPath(); c.arc(940, 95, 42, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
      c.fillStyle = '#8096a7'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(914 + i * 11, 74 + i % 2 * 34, 7 + i % 3 * 3, 0, 7); c.fill(); }
    }
    if (field === 'fine') {
      for (let i = 0; i < 18; i++) {
        const x = i * 70, h = 35 + (Math.sin(i * 6 + (this.reduced ? 0 : now / 400)) + 1) * 25;
        c.fillStyle = i % 2 ? '#b55233' : '#dc8144'; c.globalAlpha = .45;
        c.beginPath(); c.moveTo(x - 24, HEIGHT); c.quadraticCurveTo(x - 24, HEIGHT - h / 2, x + 4, HEIGHT - h); c.quadraticCurveTo(x + 14, HEIGHT - h / 3, x + 35, HEIGHT); c.fill();
      } c.globalAlpha = 1;
    }
    if (field === 'backrooms') {
      c.strokeStyle = '#b2a767'; c.lineWidth = 6; c.globalAlpha = .35;
      for (let i = 0; i < 4; i++) c.strokeRect(90 + i * 274, 34, 85, 73);
      c.globalAlpha = 1;
    }
    if (field === 'xp') {
      c.fillStyle = '#609653'; c.globalAlpha = .22;
      c.beginPath(); c.moveTo(0, 180); c.bezierCurveTo(220, -20, 500, 220, 750, 70); c.bezierCurveTo(940, 0, 1000, 120, WIDTH, 80); c.lineTo(WIDTH, 230); c.lineTo(0, 230); c.fill(); c.globalAlpha = 1;
    }
    c.save(); c.translate(WIDTH / 2, HEIGHT / 2 + 10); c.scale(1, .63);
    c.strokeStyle = '#9cba94'; c.globalAlpha = .22; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 172, 0, Math.PI * 2); c.stroke();
    c.setLineDash([6, 12]); c.beginPath(); c.arc(0, 0, 186, 0, Math.PI * 2); c.stroke(); c.restore();
    c.textAlign = 'center'; c.font = '900 77px Arial'; c.fillStyle = '#d5e1d1'; c.globalAlpha = .07;
    c.fillText(this.running ? 'CLASH!' : 'VS', WIDTH / 2, HEIGHT / 2 + 37); c.globalAlpha = 1;
    c.strokeStyle = '#d4f75b'; c.lineWidth = 3;
    for (const [x, dir] of [[37, 1], [WIDTH - 37, -1]]) {
      for (const [y, ydir] of [[28, 1], [HEIGHT - 28, -1]]) { c.beginPath(); c.moveTo(x + 28 * dir, y); c.lineTo(x, y); c.lineTo(x, y + 20 * ydir); c.stroke(); }
    }
    for (let side = 0; side < 2; side++) {
      const team = units(this.game, side);
      team.forEach((u, index) => {
        const body = this.battle?.bodies.get(u.uid);
        const x = body?.position.x ?? (side ? WIDTH - 235 : 235) + (team.length > 1 ? index % 2 * (side ? -45 : 45) : 0);
        const y = body?.position.y ?? HEIGHT * (index + 1) / (team.length + 1);
        if (body && !this.reduced && !this.endingAt) {
          c.save(); c.strokeStyle = TAGS[u.tag].color; c.lineCap = 'round';
          for (let i = 1; i <= 3; i++) {
            c.globalAlpha = .25 / i; c.lineWidth = 16 / i;
            c.beginPath(); c.moveTo(x - body.velocity.x * 6 * i, y - body.velocity.y * 6 * i); c.lineTo(x, y); c.stroke();
          }
          c.restore();
        }
        this.drawUnit(u, x, y + (!this.running && !this.reduced ? Math.sin(now / 600 + index + side) * 4 : 0));
      });
    }
    this.drawImpacts(now);
    if (this.running && now - this.started < 650) this.caption('DUEL!', WIDTH / 2, HEIGHT / 2, '#d4f75b', 60);
    c.restore();
  }
  caption(text, x, y, color, size = 28) {
    const c = this.ctx;
    c.font = `900 ${size}px Arial`; c.textAlign = 'center'; c.lineJoin = 'round';
    c.strokeStyle = '#101313'; c.lineWidth = 7; c.strokeText(text, x, y, WIDTH - 80);
    c.fillStyle = color; c.fillText(text, x, y, WIDTH - 80);
  }
  drawImpacts(now) {
    const c = this.ctx;
    this.impacts = this.impacts.filter(p => now - p.at < 850);
    for (const p of this.impacts) {
      const age = Math.max(0, (now - p.at) / 850), rise = this.reduced ? 0 : age * 12;
      c.save(); c.globalAlpha = this.reduced ? 1 : Math.min(1, (1 - age) * 3);
      if (p.kind === 'trap') {
        this.caption(`陷阱連鎖：${p.text}`, WIDTH / 2, 70, '#c3aaff', 26);
      } else if (p.kind === 'hit') {
        if (!this.reduced) {
          const radius = 22 + age * 125;
          c.strokeStyle = TAGS[p.secondTag].color; c.lineWidth = 5 * (1 - age);
          c.beginPath(); c.arc(p.x, p.y, radius, 0, Math.PI * 2); c.stroke();
          c.strokeStyle = TAGS[p.tag].color; c.lineWidth = 3;
          for (let i = 0; i < 12; i++) {
            const angle = i * Math.PI / 6;
            c.beginPath(); c.moveTo(p.x + Math.cos(angle) * radius, p.y + Math.sin(angle) * radius);
            c.lineTo(p.x + Math.cos(angle) * (radius + 22), p.y + Math.sin(angle) * (radius + 22)); c.stroke();
          }
          this.drawMotif(p.motif, p.x, Math.max(100, p.y - 95), age, p.tag);
          if (p.secondMotif !== p.motif) this.drawMotif(p.secondMotif, p.x, Math.min(HEIGHT - 70, p.y + 95), age, p.secondTag);
        }
      } else {
        const lane = this.impacts.filter(v => v.kind === 'result' && v.side === p.side).indexOf(p);
        const x = p.side ? WIDTH - 125 : 125, y = 150 + lane * 110;
        this.caption(p.name.length > 14 ? `${p.name.slice(0, 13)}…` : p.name, x, y - 90 - rise, '#f2f5ed', 16);
        if (p.hp) this.caption(`${p.hp > 0 ? '+' : ''}${p.hp} HP`, x, y - 60 - rise, p.hp > 0 ? '#76dec5' : '#ffb0ba');
        if (p.shield) {
          c.strokeStyle = '#8bdcff'; c.lineWidth = 5;
          c.beginPath(); c.arc(p.x, p.y, 61 + (this.reduced ? 0 : age * 16), -.8, Math.PI * 1.7); c.stroke();
          this.caption(`護盾 ${p.shield > 0 ? '+' : ''}${p.shield}`, x, y - 28 - rise, '#8bdcff', 22);
        }
        if (p.ko) {
          this.caption('K.O.', x, y + 3 - rise, '#ffd278', 30);
          if (!this.reduced) {
            c.strokeStyle = '#ffd278'; c.lineWidth = 3;
            const r = 52 + age * 55;
            c.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
          }
        }
      }
      c.restore();
    }
  }
  drawMotif(motif, x, y, age, tag = motif) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.rotate((age - .3) * .4);
    c.fillStyle = TAGS[tag].color; c.strokeStyle = TAGS[tag].color; c.lineWidth = 4;
    if (motif === 'wholesome' || motif === 'heart') {
      c.beginPath(); c.moveTo(0, 15); c.bezierCurveTo(-42, -10, -12, -39, 0, -17); c.bezierCurveTo(12, -39, 42, -10, 0, 15); c.fill();
    } else if (motif === 'stonks' || motif === 'coin') {
      c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.stroke(); this.caption('$', 0, 10, TAGS[tag].color, 29);
    } else if (motif === 'glitch') {
      for (let i = 0; i < 4; i++) c.fillRect((i % 2 ? -1 : 1) * age * 20 - 28, i * 9 - 20, 56, 4);
      this.caption('404', 0, 5, TAGS[tag].color, 25);
    } else if (motif === 'chaos' || motif === 'fire') {
      c.beginPath(); c.moveTo(-22, 20); c.quadraticCurveTo(-32, -5, -7, -35); c.lineTo(0, -8); c.lineTo(18, -24); c.quadraticCurveTo(43, 22, -22, 20); c.fill();
    } else if (motif === 'tears') {
      c.fillStyle = '#8fc9f9'; c.beginPath(); c.moveTo(0, -30); c.bezierCurveTo(-32, 8, -12, 31, 0, 24); c.bezierCurveTo(24, 28, 28, 7, 0, -30); c.fill();
    } else if (motif === 'shield') {
      c.beginPath(); c.moveTo(-22,-22); c.lineTo(22,-22); c.lineTo(19,9); c.lineTo(0,27); c.lineTo(-19,9); c.closePath(); c.stroke();
    } else if (motif === 'dance') {
      c.beginPath(); c.moveTo(-6,16); c.lineTo(-6,-22); c.lineTo(20,-28); c.lineTo(20,8); c.stroke();
      for(const [px,py] of [[-13,17],[13,9]]){c.beginPath();c.ellipse(px,py,9,6,-.3,0,Math.PI*2);c.fill();}
    } else this.caption(({bonk:'BONK!',brain:'BIG BRAIN',shock:'?!',roast:'ROAST!'})[motif] || 'CLASH!', 0, 0, TAGS[tag].color, motif === 'bonk' ? 28 : 22);
    c.restore();
  }
  drawUnit(u, x, y) {
    const c = this.ctx, color = this.colors[u.side];
    c.fillStyle = '#0007'; c.beginPath(); c.ellipse(x, y + 56, 47, 11, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(x, y); c.beginPath(); c.arc(0, 0, 46, 0, Math.PI * 2); c.clip();
    const image = imageFor(u.image);
    c.fillStyle = TAGS[u.tag].color; c.fillRect(-46, -46, 92, 92);
    if (image) {
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      c.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, -46, -46, 92, 92);
    } else { c.fillStyle = '#181b1b'; c.font = '900 28px Arial'; c.textAlign = 'center'; c.fillText(u.name.slice(0, 2), 0, 10); }
    c.restore(); c.strokeStyle = color; c.lineWidth = 4; c.beginPath(); c.arc(x, y, 49, 0, Math.PI * 2); c.stroke();
    if (u.shield) { c.strokeStyle = '#87d9ff'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 55, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#101313'; c.fillRect(x - 49, y + 57, 98, 6); c.fillStyle = color; c.fillRect(x - 49, y + 57, 98 * u.hp / u.maxHp, 6);
    c.fillStyle = '#101313e6'; c.fillRect(x - 77, y + 68, 154, 39);
    c.font = '600 14px Arial'; c.textAlign = 'center'; c.fillStyle = '#f2f5ed'; c.fillText(u.name.length > 14 ? `${u.name.slice(0, 13)}…` : u.name, x, y + 84, 146);
    c.font = '12px Arial'; c.fillStyle = '#b0b8af'; c.fillText(`ATK ${u.attack}  /  HP ${u.hp}${u.shield ? `  +${u.shield}` : ''}`, x, y + 101);
    c.fillStyle = color; c.beginPath(); c.arc(x + 36, y - 36, 13, 0, 7); c.fill(); c.fillStyle = '#111'; c.font = 'bold 12px Arial'; c.fillText(String(u.attack), x + 36, y - 32);
  }
  destroy() { this.disposed = true; cancelAnimationFrame(this.frame); this.battle?.dispose(); }
}
