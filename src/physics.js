import Matter from 'matter-js';
import { collide, units } from './game.js';

export const WIDTH = 1100, HEIGHT = 470;
const { Engine, Bodies, Body, Composite, Events } = Matter;
export function createBattle(game, onImpact = () => {}) {
  const engine = Engine.create({ gravity: { x: 0, y: 0 } });
  const bodies = new Map(), lastHits = new Map();
  let tick = 0;
  Composite.add(engine.world, [
    Bodies.rectangle(WIDTH / 2, -15, WIDTH, 70, { isStatic: true }),
    Bodies.rectangle(WIDTH / 2, HEIGHT + 15, WIDTH, 70, { isStatic: true }),
    Bodies.rectangle(-15, HEIGHT / 2, 70, HEIGHT, { isStatic: true }),
    Bodies.rectangle(WIDTH + 15, HEIGHT / 2, 70, HEIGHT, { isStatic: true }),
  ]);
  for (let side = 0; side < 2; side++) {
    const team = units(game, side);
    team.forEach((unit, i) => {
      const body = Bodies.circle(side ? WIDTH - 200 : 200, HEIGHT * (i + 1) / (team.length + 1), 36,
        { restitution: 0.9, friction: 0, frictionAir: 0, label: unit.uid });
      Body.setVelocity(body, { x: (side ? -1 : 1) * unit.speed, y: (i - (team.length - 1) / 2) * 0.5 });
      Composite.add(engine.world, body); bodies.set(unit.uid, body);
    });
  }
  Events.on(engine, 'collisionStart', ({ pairs }) => {
    for (const { bodyA, bodyB } of pairs) {
      const a = game.units.find(u => u.uid === bodyA.label), b = game.units.find(u => u.uid === bodyB.label);
      if (!a || !b || a.side === b.side || a.dead || b.dead) continue;
      const key = [a.uid, b.uid].sort().join(':');
      if (tick - (lastHits.get(key) ?? -100) < 22) continue;
      lastHits.set(key, tick);
      const before = game.units.map(u => ({ uid: u.uid, hp: u.hp, shield: u.shield, dead: u.dead }));
      const traps = game.players.flatMap(p => p.traps.map(id => game.cards[id].name));
      collide(game, a, b);
      const changes = before.flatMap(prev => {
        const u = game.units.find(u => u.uid === prev.uid), body = bodies.get(prev.uid);
        if (!body || (u.hp === prev.hp && u.shield === prev.shield && u.dead === prev.dead)) return [];
        return [{ uid: u.uid, name: u.name, tag: u.tag, side: u.side, x: body.position.x, y: body.position.y,
          hp: u.hp - prev.hp, shield: u.shield - prev.shield, ko: !prev.dead && u.dead }];
      });
      onImpact((bodyA.position.x + bodyB.position.x) / 2, (bodyA.position.y + bodyB.position.y) / 2, a, b, { changes, traps });
    }
  });
  return {
    bodies,
    step() {
      tick++;
      for (const unit of game.units) {
        const body = bodies.get(unit.uid);
        if (!body) continue;
        if (unit.dead) { Composite.remove(engine.world, body); bodies.delete(unit.uid); continue; }
        const enemy = units(game, 1 - unit.side).map(u => bodies.get(u.uid)).filter(Boolean)
          .sort((a, b) => Math.hypot(a.position.x - body.position.x, a.position.y - body.position.y) - Math.hypot(b.position.x - body.position.x, b.position.y - body.position.y))[0];
        const speed = unit.speed * (game.field === 'moon' ? 1.35 : 1);
        if (enemy && tick % 12 === 0) {
          const dx = enemy.position.x - body.position.x, dy = enemy.position.y - body.position.y, length = Math.hypot(dx, dy) || 1;
          Body.setVelocity(body, { x: body.velocity.x * .45 + dx / length * speed * .55, y: body.velocity.y * .45 + dy / length * speed * .55 });
        }
        if (body.speed > speed * 1.5) Body.setVelocity(body, { x: body.velocity.x / body.speed * speed, y: body.velocity.y / body.speed * speed });
      }
      Engine.update(engine, 1000 / 60);
      return tick >= 300 || !units(game, 0).length || !units(game, 1).length;
    },
    dispose() { Events.off(engine); Composite.clear(engine.world, false); Engine.clear(engine); },
  };
}
