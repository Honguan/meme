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
    this.onEnd = onEnd; this.onUpdate = onUpdate; this.particles = []; this.running = false;
    this.last = 0; this.accumulator = 0; this.frame = 0; this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = WIDTH * ratio; canvas.height = HEIGHT * ratio;
    this.ctx.scale(ratio, ratio);
    this.animate = this.animate.bind(this); this.frame = requestAnimationFrame(this.animate);
  }
  start() {
    if (this.running) return;
    this.running = true; this.accumulator = 0;
    this.battle = createBattle(this.game, (x, y, a, b) => {
      if (!this.reduced) for (let i = 0; i < 14; i++) this.particles.push({ x, y, dx: Math.cos(i) * 5, dy: Math.sin(i) * 5, life: 1, color: i % 2 ? '#d4f75b' : '#fb8aac' });
      this.onUpdate(a, b);
    });
  }
  animate(now) {
    const delta = Math.min(now - (this.last || now), 100); this.last = now;
    if (this.running) {
      this.accumulator += delta;
      while (this.accumulator >= 1000 / 60) {
        this.accumulator -= 1000 / 60;
        if (this.battle.step()) {
          this.running = false;
          this.battle.dispose(); this.battle = null;
          this.onEnd(); break;
        }
      }
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
        this.drawUnit(u, x, y + (!this.running && !this.reduced ? Math.sin(now / 600 + index + side) * 4 : 0));
      });
    }
    for (const p of this.particles) {
      p.x += p.dx; p.y += p.dy; p.life -= .035; c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.color; c.fillRect(p.x, p.y, 5, 5);
    }
    this.particles = this.particles.filter(p => p.life > 0); c.globalAlpha = 1;
  }
  drawUnit(u, x, y) {
    const c = this.ctx, color = u.side ? '#fb8aac' : '#d4f75b';
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
    c.font = '600 14px Arial'; c.textAlign = 'center'; c.fillStyle = '#f2f5ed'; c.fillText(u.name.length > 14 ? `${u.name.slice(0, 13)}…` : u.name, x, y + 84);
    c.font = '12px Arial'; c.fillStyle = '#b0b8af'; c.fillText(`ATK ${u.attack}  /  HP ${u.hp}${u.shield ? `  +${u.shield}` : ''}`, x, y + 101);
    c.fillStyle = color; c.beginPath(); c.arc(x + 36, y - 36, 13, 0, 7); c.fill(); c.fillStyle = '#111'; c.font = 'bold 12px Arial'; c.fillText(String(u.attack), x + 36, y - 32);
  }
  destroy() { this.disposed = true; cancelAnimationFrame(this.frame); this.battle?.dispose(); }
}
