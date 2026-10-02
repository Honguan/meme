import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, CORE, TAGS, validateCustom, templateCards, DEFAULT_DECK } from '../src/catalog.js';
import { createGame, createDailyGame, randomWorldDeck, playCard, summon, collide, cleanup, finishRound, planAI, checkWinner, combos, draw, units } from '../src/game.js';
import { previewGame } from '../src/preview.js';
import { createBattle } from '../src/physics.js';
import { parseProfile, freshProfile } from '../src/storage.js';
import world from '../src/data/world-memes.json' with { type: 'json' };
import { ARCHETYPES, classifyMeme } from '../src/semantics.js';
import { LANGUAGES, setLocale, getLocale, tr } from '../src/i18n.js';
import { MESSAGES } from '../src/locales.js';
import { effectText } from '../src/catalog.js';

function setup() { const g=createGame({seed:123}); g.units=[]; g.players.forEach(p=>{p.hand=[];p.energy=9;p.deck=[];p.discard=[];}); return g; }
const card=id=>CORE.find(c=>c.id===id);

test('localization translates rules while preserving canonical data and dynamic card names',()=>{
  const before=JSON.stringify(CATALOG),name='魔法陷阱的角色';
  try {
    for(const locale of Object.keys(LANGUAGES)) {
      setLocale(locale);assert.equal(getLocale(),locale);
      assert.ok(effectText(card('doge')).length);
      if(locale==='zh-Hant')continue;
      for(const [key,value] of Object.entries(MESSAGES))assert.equal(tr(key),value[locale]);
      assert.ok(tr(`玩家 01 打出 ${name}`).includes(name));
      assert.ok(tr(`${name} 被擊倒`).includes(name));
      assert.ok(tr(`友軍 · ${name} (12 HP)`).includes(name));
      assert.equal(tr(`${name} + ${name} → ${name}`),`${name} + ${name} → ${name}`);
      if(locale!=='ja')assert.doesNotMatch(effectText(card('doge')),/\p{Script=Han}/u);
      assert.equal(setLocale('__proto__'),false);assert.equal(getLocale(),locale);
    }
    assert.equal(JSON.stringify(CATALOG),before);
  } finally { setLocale('zh-Hant'); }
});

test('catalog includes 100 actual web templates and all six card types',()=>{
  assert.equal(CATALOG.filter(c=>c.origin==='網路').length,100);
  assert.equal(new Set(CATALOG.map(c=>c.type)).size,6);
  assert.equal(new Set(CATALOG.map(c=>c.id)).size,CATALOG.length);
});

test('global catalog has over 3000 unique sourced templates with bounded semantic effects and language provenance',()=>{
  const cards=CATALOG.filter(c=>c.origin==='全球');
  assert.ok(cards.length>=3000);assert.equal(cards.length,world.cards.length);
  assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
  assert.equal(new Set(cards.map(c=>c.image)).size,cards.length);
  assert.equal(new Set(cards.map(c=>c.sourceName.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,''))).size,cards.length);
  assert.ok(new Set(cards.flatMap(c=>c.languages)).size>=15);
  assert.ok(new Set(cards.flatMap(c=>c.countries)).size>=30);
  for(const c of cards){
    assert.ok(ARCHETYPES[c.archetype]);assert.ok(c.evidence.value);
    assert.equal(new URL(c.source).hostname,'api.templates.meme');
    assert.equal(new URL(c.image).protocol,'https:');
    assert.ok(c.effects.length>0&&c.effects.length<=4);
    assert.equal(validateCustom(c).tag,c.tag);
  }
  const p=freshProfile();p.deck=[...DEFAULT_DECK,cards[0].id];
  assert.deepEqual(parseProfile(p).deck,p.deck);
});

test('semantic classification prioritizes primary meaning over misleading search aliases and never hashes IDs',()=>{
  const samples=[
    [{name:"Mario's Belt Threat",aliases:['one for the money']},'bonk'],
    [{name:'Chinese Rapping Dog',aliases:['Brainrot Chinese'],emotions:[{name:'Absurdity'}]},'dance'],
    [{name:'Martial Arts Prairie Dog',emotions:[{name:'focused'}]},'bonk'],
    [{name:'I Don’t Give a F*ck',emotions:[{name:'Surprise'}]},'calm'],
    [{name:'Gwenchana Crying Guy'},'sad'],
  ];
  for(const [input,id] of samples)assert.equal(classifyMeme(input).id,id);
  assert.equal(classifyMeme({name:'Unlabelled Template'}),null);
  const a=templateCards([{id:'unknown-a',name:'Dancing Celebration',url:'https://example.com/a.png'}])[0];
  const b=templateCards([{id:'unknown-b',name:'Dancing Celebration',url:'https://example.com/b.png'}])[0];
  assert.equal(a.archetype,'dance');assert.deepEqual(a.effects,b.effects);assert.equal(a.attack,b.attack);
});

test('card demonstrations isolate every card type from the real match and original definitions',()=>{
  const live=createGame({seed:123}),before=JSON.stringify(live);
  for(const c of [...CORE,CATALOG.find(c=>c.origin==='全球')]){
    const original=JSON.stringify(c),demo=previewGame(c);
    assert.equal(demo.players[0].hand[0],c.id);assert.equal(demo.goal,'sandbox');
    const target=demo.units.find(u=>u.side===(c.effects.some(e=>e.target==='enemy'||e.target==='enemies')?1:0));
    assert.equal(playCard(demo,0,0,target.uid).ok,true,c.id);
    const sim=createBattle(demo);for(let i=0;i<301;i++)if(sim.step())break;sim.dispose();finishRound(demo);
    assert.equal(JSON.stringify(c),original);assert.equal(JSON.stringify(live),before);
  }
});

test('global random decks are valid sets and daily opponents, hands and fields are reproducible',()=>{
  for(let seed=1;seed<=20;seed++){
    const result=randomWorldDeck(CATALOG,seed);
    assert.equal(result.deck.length,20);assert.equal(new Set(result.deck).size,20);
    assert.ok(result.deck.slice(0,12).every(id=>CATALOG.find(c=>c.id===id)?.tag===result.tag));
    assert.doesNotThrow(()=>parseProfile({...freshProfile(),deck:result.deck}));
  }
  const a=createDailyGame(CATALOG,'2026-10-02'),b=createDailyGame(CATALOG,'2026-10-02'),c=createDailyGame(CATALOG,'2026-10-03');
  assert.deepEqual(a.players,b.players);assert.deepEqual(a.units,b.units);assert.equal(a.field,b.field);
  assert.notDeepEqual(a.players,c.players);assert.equal(a.challenge,'2026-10-02');
  assert.ok(a.players[1].deck.some(id=>id.startsWith('world-')));
  assert.throws(()=>createGame({opponentDeck:['missing']}));
});

test('daily global matchups finish complete games without stalled rounds',()=>{
  for(const date of ['2026-10-02','2026-10-03','2026-10-04']){
    const g=createDailyGame(CATALOG,date);
    while(g.phase!=='over'&&g.round<=35){
      const p=g.players[0];
      for(let i=0;i<p.hand.length;){if(!playCard(g,0,i).ok)i++;if(g.phase==='over')break;}
      if(g.phase==='over')break;planAI(g);if(g.phase==='over')break;
      g.phase='battle';const sim=createBattle(g);
      for(let i=0;i<301;i++)if(sim.step())break;
      sim.dispose();finishRound(g);
      assert.ok(g.players.every(p=>p.hp>=0&&p.energy>=0&&p.hand.length<=9));
    }
    assert.equal(g.phase,'over',date);
  }
});
test('play validation never spends a card or energy on rejected actions',()=>{
  const g=setup();g.players[0].hand=['doge'];g.players[0].energy=0;
  assert.equal(playCard(g,0,0).ok,false);assert.deepEqual(g.players[0].hand,['doge']);
  g.players[0].energy=9;g.phase='battle';assert.equal(playCard(g,0,0).ok,false);
  g.phase='plan';g.active=1;assert.equal(playCard(g,0,0).ok,false);
});
test('summoning respects slots and equipment buffs the selected ally',()=>{
  const g=setup();const a=summon(g,card('doge'),0),b=summon(g,card('harold'),0);
  g.players[0].hand=['suit','doge','cat'];assert.equal(playCard(g,0,0,b.uid).ok,true);
  assert.equal(a.attack,4);assert.equal(b.attack,4);assert.equal(b.shield,2);
  assert.equal(playCard(g,0,0).ok,true);assert.equal(playCard(g,0,0).ok,false);
  assert.deepEqual(combos(g,0),['bonk']);
});
test('trap chain consumes once and applies before regular collision',()=>{
  const g=setup();const a=summon(g,card('harold'),0),b=summon(g,card('drake'),1);
  g.players[0].hand=['reverse'];playCard(g,0,0);assert.equal(g.players[0].traps.length,1);
  collide(g,a,b);assert.equal(b.hp,5);assert.equal(a.hp,13);assert.equal(g.players[0].traps.length,0);
  collide(g,a,b);assert.equal(b.hp,3);assert.equal(g.players[0].discard.filter(id=>id==='reverse').length,1);
});
test('fusion consumes two same-tag units without counting them as knockouts',()=>{
  const g=setup();summon(g,card('doge'),0);g.players[0].hand=['fusion'];
  assert.equal(playCard(g,0,0).ok,false);summon(g,card('cat'),0);
  assert.equal(playCard(g,0,0).ok,true);assert.equal(units(g,0).length,1);
  assert.equal(units(g,0)[0].attack,11);assert.equal(units(g,0)[0].tag,'bonk');
  assert.equal(g.players[1].ko,0);assert.equal(g.players[0].hp,20);
});
test('death cascades resolve each knockout exactly once',()=>{
  const g=setup();const a=summon(g,card('girl'),0),b=summon(g,card('girl'),1);
  a.hp=0;b.hp=1;cleanup(g);cleanup(g);
  assert.equal(g.players[0].ko,1);assert.equal(g.players[1].ko,1);
  assert.equal(g.players[0].hp,18);assert.equal(g.players[1].hp,18);
});
test('round rules apply field hazards, shields, healing, draws and synergy',()=>{
  const g=setup();const a=summon(g,card('doge'),0),b=summon(g,card('cat'),0);
  summon(g,card('girl'),1);g.field='fine';finishRound(g);assert.equal(a.hp,11);assert.equal(b.hp,9);
  assert.equal(units(g,1)[0].hp,12);g.field='backrooms';finishRound(g);assert.equal(a.shield,1);
  g.field='xp';finishRound(g);assert.equal(a.hp,12);
  g.players[0].hand=[];g.players[0].discard=['bonk'];draw(g,0);assert.deepEqual(g.players[0].hand,['bonk']);
});
test('all victory goals work, including simultaneous draw and endless sandbox',()=>{
  const g=setup();g.players[0].hp=0;checkWinner(g);assert.equal(g.winner,1);
  const tie=setup();tie.players.forEach(p=>p.hp=0);checkWinner(tie);assert.equal(tie.winner,'draw');
  const ko=setup();ko.goal='knockout';ko.players[0].ko=5;checkWinner(ko);assert.equal(ko.winner,0);
  const sand=setup();sand.goal='sandbox';sand.players[0].hp=0;sand.players[0].energy=0;sand.players[0].hand=['doge'];
  assert.equal(playCard(sand,0,0).ok,true);checkWinner(sand);assert.equal(sand.winner,null);
});
test('Matter.js produces genuine opposing-body contacts and bounded rounds',()=>{
  const g=setup();summon(g,card('doge'),0);summon(g,card('kermit'),1);g.phase='battle';
  const sim=createBattle(g);let ticks=0;while(!sim.step()&&ticks++<400){}sim.dispose();
  assert.ok(g.collisions>0);assert.ok(ticks<=300);assert.ok(g.units.some(u=>u.hp<u.maxHp));
});

test('impact reports include actual HP, shield, trap and off-contact area damage without changing combat',()=>{
  const build=()=>{
    const g=setup(),base={...card('doge'),effects:[],attack:20,hp:100};
    summon(g,base,0);
    const victim=summon(g,{...base,attack:0,hp:6},1);victim.shield=2;
    summon(g,{...base,attack:0},1);g.players[0].traps=['pikachu'];g.phase='battle';
    return g;
  };
  const g=build(),reports=[];
  const sim=createBattle(g,(x,y,a,b,report)=>reports.push({x,y,a:a.uid,b:b.uid,...structuredClone(report)}));
  for(let i=0;i<301;i++)if(sim.step())break;
  sim.dispose();
  assert.ok(reports.length>0);
  assert.ok(reports.some(r=>r.traps.includes('驚訝皮卡丘')));
  assert.ok(reports.some(r=>r.changes.some(c=>c.ko&&c.uid==='u4')));
  assert.ok(reports.some(r=>r.changes.some(c=>c.shield===-2)));
  assert.ok(reports.some(r=>r.changes.some(c=>c.uid!==r.a&&c.uid!==r.b&&c.hp<0)));
  assert.ok(reports.flatMap(r=>r.changes).every(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)));
  const control=build(),plain=createBattle(control);
  for(let i=0;i<301;i++)if(plain.step())break;
  plain.dispose();
  assert.deepEqual(g.units,control.units);assert.deepEqual(g.players,control.players);
});
test('AI completes seeded matches without invalid cards, frozen rounds or overflow',()=>{
  for(let seed=1;seed<=12;seed++){
    const g=createGame({seed});
    while(g.phase!=='over'&&g.round<=35){
      const p=g.players[0];
      for(let i=0;i<p.hand.length;){const result=playCard(g,0,i);if(!result.ok)i++;if(g.phase==='over')break;}
      if(g.phase==='over')break;
      planAI(g);if(g.phase==='over')break;g.phase='battle';
      const sim=createBattle(g);for(let tick=0;tick<301;tick++)if(sim.step())break;sim.dispose();finishRound(g);
      for(const p of g.players){assert.ok(p.hp>=0);assert.ok(p.hand.length<=9);assert.ok(p.energy>=0);}
    }
    assert.equal(g.phase,'over',`seed ${seed}`);
  }
});
test('custom card validation blocks executable URLs, invalid effects and prototype keys',()=>{
  const input={...card('doge'),name:'自訂迷因',hp:20,effects:[{trigger:'hit',action:'damage',target:'enemy',amount:7}]};
  const c=validateCustom(input);assert.equal(c.effects[0].amount,7);assert.ok(c.id.startsWith('custom-'));
  assert.throws(()=>validateCustom({...input,image:'javascript:alert(1)'}));
  assert.throws(()=>validateCustom({...input,type:'toString'}));
  assert.throws(()=>validateCustom({...input,hp:Infinity}));
  assert.throws(()=>validateCustom({...input,type:'spell'}));
  assert.throws(()=>validateCustom({...input,effects:[{...input.effects[0],action:'eval'}]}));
  assert.deepEqual(templateCards([{id:'evil',name:'test',url:'javascript:alert(1)'}]),[]);
});
test('export/import round trip preserves custom IDs and deck while rejecting broken references',()=>{
  const profile=freshProfile(),c=validateCustom({...card('doge'),name:'自訂卡'});
  profile.custom.push(c);profile.deck=[...DEFAULT_DECK,c.id];
  const roundtrip=parseProfile(JSON.parse(JSON.stringify(profile)));assert.deepEqual(roundtrip.deck,profile.deck);
  assert.equal(roundtrip.custom[0].id,c.id);assert.throws(()=>parseProfile({...profile,deck:['missing']}));
  assert.throws(()=>parseProfile({...profile,custom:[c,c]}));
});

test('three-piece sets apply all six bonuses and lose their threshold when a member falls',()=>{
  for(const tag of Object.keys(TAGS)){
    const g=setup();
    const base={...card('doge'),tag,attack:2,hp:100,effects:[]};
    const friends=Array.from({length:3},()=>summon(g,base,0));
    const enemy=summon(g,{...base,attack:0},1);
    assert.deepEqual(combos(g,0,3),[tag]);
    assert.deepEqual(combos(g,1,3),[]);
    if(tag==='chaos'||tag==='bonk'){
      collide(g,friends[0],enemy);
      assert.equal(enemy.hp,tag==='chaos'?95:94);
      const hp=enemy.hp;collide(g,friends[0],enemy);
      assert.equal(hp-enemy.hp,tag==='chaos'?5:3);
    }else{
      friends.forEach(u=>u.hp=80);g.players[0].deck=Array(9).fill('doge');
      finishRound(g);
      if(tag==='wholesome') assert.ok(friends.every(u=>u.hp===85));
      if(tag==='glitch') assert.ok(friends.every(u=>u.shield===5));
      if(tag==='brain') assert.equal(g.players[0].hand.length,3);
      if(tag==='stonks') assert.equal(g.players[0].energy,6);
    }
    friends[2].hp=0;cleanup(g);
    assert.deepEqual(combos(g,0,3),[]);assert.deepEqual(combos(g,0),[tag]);
    const hp=enemy.hp;friends[0].hitUsed=false;collide(g,friends[0],enemy);
    assert.equal(hp-enemy.hp,tag==='chaos'||tag==='bonk'?3:2);
    friends[0].hp=80;friends[0].shield=0;g.players[0].hand=[];g.players[0].deck=Array(9).fill('doge');
    finishRound(g);
    if(tag==='wholesome') assert.equal(friends[0].hp,82);
    if(tag==='glitch') assert.equal(friends[0].shield,2);
    if(tag==='brain') assert.equal(g.players[0].hand.length,2);
    if(tag==='stonks') assert.equal(g.players[0].energy,2+g.round+1);
  }
});

test('full sets activate for imported/custom units, reset first-hit bonuses, and break on fusion',()=>{
  const g=setup(),custom=validateCustom({...card('doge'),effects:[],attack:2,hp:100});
  const a=summon(g,custom,0);summon(g,custom,0);
  g.cards[custom.id]=custom;g.players[0].hand=[custom.id];
  assert.equal(playCard(g,0,0).ok,true);
  assert.ok(g.log.some(l=>l.text.includes('全員 BONK 3 件套啟動')));
  const enemy=summon(g,{...custom,attack:0},1);
  collide(g,a,enemy);finishRound(g);
  const hp=enemy.hp;collide(g,a,enemy);assert.equal(hp-enemy.hp,6);
  g.players[0].hand=['fusion'];g.players[0].energy=9;
  assert.equal(playCard(g,0,0).ok,true);
  assert.deepEqual(combos(g,0,3),[]);assert.deepEqual(combos(g,0),['bonk']);
  const web=CATALOG.find(c=>c.origin==='網路');
  const imported=setup();Array.from({length:3},()=>summon(imported,web,0));
  assert.deepEqual(combos(imported,0,3),[web.tag]);
});
