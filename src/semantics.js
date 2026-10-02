const effect = (action, amount, target = 'self', trigger = 'play') => ({ action, amount, target, trigger });

// Source labels are evidence for a game interpretation, not an assertion about a person.
export const ARCHETYPES = {
  fire: { name: '火上加油', tag: 'chaos', motif: 'fire', explanation: '失控與燃燒的場面化為離場時波及全場的火焰。', attack: 4, hp: 12, speed: 5, cost: 3, effects: [effect('damage', 3, 'enemies', 'death')], words: /\b(fire|burning|explosion|exploding|disaster|disastrous)\b/i, labels: /^(chaos|destruction|disaster|disasters|explosions)$/i },
  money: { name: '財富密碼', tag: 'stonks', motif: 'coin', explanation: '交易、金錢與成功的梗轉成額外能量，投資下一張卡。', attack: 2, hp: 12, speed: 5, cost: 2, effects: [effect('energy', 1)], words: /\b(stonks|money|cash|rich|buy|shopping|payday|salary|trade|business|profit|billionaire|millionaire)\b/i, labels: /^(money|wealth|finance|business|economics|capitalism|greed|financial struggles|success)$/i },
  dance: { name: '節奏上頭', tag: 'wholesome', motif: 'dance', explanation: '舞步與音樂帶動全隊節奏，每輪為隊友回復生命。', attack: 2, hp: 11, speed: 8, cost: 2, effects: [effect('heal', 1, 'allies', 'round')], words: /\b(danc\w*|groov\w*|singing|drumming|rapping|beatbox\w*|vibing)\b/i, labels: /^(dance|music|rhythm|groove|singing)$/i },
  food: { name: '先吃再說', tag: 'wholesome', motif: 'heart', explanation: '吃喝與補充體力的情境化為每輪自我回復。', attack: 2, hp: 15, speed: 4, cost: 2, effects: [effect('heal', 2, 'self', 'round')], words: /\b(eating|drinking|munching|snacking|hungry|hunger|coffee sip|tea sip)\b/i, labels: /^(food|hunger|eating|food & drinks|cooking)$/i },
  sleep: { name: '待機充電', tag: 'glitch', motif: 'shield', explanation: '睡眠、疲憊與下線的梗以護盾爭取喘息空間。', attack: 1, hp: 16, speed: 3, cost: 2, effects: [effect('shield', 4)], words: /\b(sleep\w*|tired|exhaust\w*|burnout|passed out|pass-out)\b/i, labels: /^(exhaustion|burnout|fatigue|sleep|sleepiness|tiredness)$/i },
  bonk: { name: '正面硬碰', tag: 'bonk', motif: 'bonk', explanation: '敲打、打鬥與對抗的動作化為首次碰撞的追加傷害。', attack: 4, hp: 11, speed: 6, cost: 3, effects: [effect('damage', 2, 'enemy', 'hit')], words: /\b(bonk|punch\w*|kick\w*|slap\w*|fight\w*|wrestl\w*|smash\w*|attack\w*)\b/i, labels: /^(confrontation|combat|fighting|dominance|aggression|violence|strength)$/i },
  care: { name: '溫柔接住', tag: 'wholesome', motif: 'heart', explanation: '安慰、關愛與療癒的情境轉成全隊回復。', attack: 1, hp: 16, speed: 4, cost: 3, effects: [effect('heal', 2, 'allies', 'round')], words: /\b(hug\w*|comfort\w*|wholesome|kindness|love|caring|healing)\b/i, labels: /^(comfort|love|affection|kindness|warmth|empathy|compassion|wholesome|tenderness|care)$/i },
  team: { name: '一起扛住', tag: 'wholesome', motif: 'shield', explanation: '團結、合作與支持讓全隊在登場時取得護盾。', attack: 2, hp: 13, speed: 5, cost: 2, effects: [effect('shield', 2, 'allies')], words: /\b(handshake|teamwork|together|friendship|solidarity|supporting)\b/i, labels: /^(teamwork|solidarity|unity|friendship|loyalty|support|cooperation)$/i },
  think: { name: '大腦運轉', tag: 'brain', motif: 'brain', explanation: '思考、解釋與解題的梗化為每輪多一個手牌選項。', attack: 2, hp: 11, speed: 4, cost: 3, effects: [effect('draw', 1, 'self', 'round')], words: /\b(brain|thinking|explaining|calculat\w*|knowledge|genius|scientist|logic|philosoph\w*)\b/i, labels: /^(thinking|curiosity|problem solving|explaining|big brain moments|logic & paradoxes|intelligence|focused|focus)$/i },
  fear: { name: '求生反應', tag: 'glitch', motif: 'shield', explanation: '害怕、逃跑與緊張帶來保命護盾。', attack: 2, hp: 10, speed: 8, cost: 1, effects: [effect('shield', 3)], words: /\b(scared|terrified|fear|panic\w*|running away|escape|anxious|anxiety|nervous)\b/i, labels: /^(fear|panic|anxiety|nervousness|terror|stress & pressure|overwhelmed|desperation)$/i },
  sad: { name: '眼淚接力', tag: 'wholesome', motif: 'tears', explanation: '哭泣、失落與告別化為離場後留給隊友的回復。', attack: 2, hp: 14, speed: 4, cost: 2, effects: [effect('heal', 4, 'allies', 'death')], words: /\b(cry\w*|sad|sadness|tear\w*|grief|heartbroken|depressed|lonely)\b/i, labels: /^(sadness|grief|regret|disappointment|loneliness|agony|defeat|sorrow|emotional)$/i },
  rage: { name: '怒氣爆發', tag: 'chaos', motif: 'fire', explanation: '憤怒、抓狂與吼叫在首次碰撞時爆發。', attack: 4, hp: 10, speed: 6, cost: 2, effects: [effect('damage', 3, 'enemy', 'hit')], words: /\b(angry|anger|rage|furious|scream\w*|yelling|outrage|frustrat\w*)\b/i, labels: /^(anger|frustration|hilarious outrage|rage|outrage|fury|intensity|defiance)$/i },
  mock: { name: '嘴上不饒人', tag: 'chaos', motif: 'roast', explanation: '嘲諷、吐槽與諷刺化為直指對手的碰撞傷害。', attack: 3, hp: 12, speed: 5, cost: 2, effects: [effect('damage', 2, 'enemy', 'hit')], words: /\b(mock\w*|roast\w*|taunt\w*|sarcas\w*|smirk\w*|judging)\b/i, labels: /^(mockery|sarcasm|irony|smugness|judgment|satire|disgust|contempt)$/i },
  confidence: { name: '氣勢拉滿', tag: 'bonk', motif: 'bonk', explanation: '自信、決心與勝利姿態讓攻擊力隨回合成長。', attack: 3, hp: 13, speed: 5, cost: 2, effects: [effect('buff', 1, 'self', 'round')], words: /\b(confiden\w*|victory|winner|triumph\w*|chad|sigma|determined|motivator|epic win)\b/i, labels: /^(confidence|determination|triumph|pride|authority|power|audacity|resilience|dominance)$/i },
  glitch: { name: '理解不能', tag: 'glitch', motif: 'glitch', explanation: '混亂、錯誤與不可理解的反應，在碰撞時化為防護。', attack: 2, hp: 12, speed: 6, cost: 2, effects: [effect('shield', 3, 'self', 'hit')], words: /\b(glitch\w*|error|404|confus\w*|broken|bugged|what the|identity swap)\b/i, labels: /^(confusion|disbelief|tech fails|awkwardness|social awkwardness|suspicion|betrayal|whiplash)$/i },
  calm: { name: '不為所動', tag: 'glitch', motif: 'shield', explanation: '淡定、冷漠與無奈的反應讓每輪防線更穩固。', attack: 2, hp: 15, speed: 4, cost: 2, effects: [effect('shield', 2, 'self', 'round')], words: /\b(calm|unbothered|nobody cares|indifferen\w*|whatever|relax\w*)\b/i, labels: /^(calm|resignation|relief|detachment|indifference|composure|serenity|satisfaction)$/i },
  discovery: { name: '突然懂了', tag: 'brain', motif: 'brain', explanation: '醒悟、發現與恍然大悟轉成登場時的額外手牌。', attack: 3, hp: 11, speed: 5, cost: 2, effects: [effect('draw', 1)], words: /\b(realiz\w*|realis\w*|revelation|discovery|epiphany|enlighten\w*)\b/i, labels: /^(realization|realizations|awe|insight|understanding|nostalgia|anticipation)$/i },
  absurd: { name: '荒謬擴散', tag: 'chaos', motif: 'glitch', explanation: '荒誕與失控的笑點在首次碰撞時波及敵方全隊。', attack: 2, hp: 12, speed: 6, cost: 3, effects: [effect('damage', 1, 'enemies', 'hit')], words: /\b(absurd\w*|brainrot|nonsense|unhinged|chaotic)\b/i, labels: /^(absurdity|absurd humor|chaos|mischief|playfulness|weirdness|chaotic energy)$/i },
  surprise: { name: '嚇到防禦', tag: 'glitch', motif: 'shock', explanation: '驚訝與震驚的反應，在首次碰撞時啟動應急護盾。', attack: 3, hp: 11, speed: 6, cost: 2, effects: [effect('shield', 2, 'self', 'hit')], words: /\b(surpris\w*|shocked|shock|startled|gasp\w*)\b/i, labels: /^(surprise|shock|astonishment)$/i },
  joy: { name: '笑到回血', tag: 'wholesome', motif: 'heart', explanation: '歡笑、喜悅與慶祝化為每輪自我回復。', attack: 2, hp: 13, speed: 5, cost: 2, effects: [effect('heal', 2, 'self', 'round')], words: /\b(laugh\w*|happy|smil\w*|joy\w*|celebrat\w*)\b/i, labels: /^(joy|excitement|amusement|happiness|celebration|hope|humor|fun)$/i },
};

export function classifyMeme(meme) {
  const names = [meme.name].filter(Boolean);
  const labels = [...(meme.emotions || []), ...(meme.topics || [])].map(v => typeof v === 'string' ? v : v.name);
  const matches = Object.entries(ARCHETYPES).map(([id, rule]) => {
    const explicit = { bonk: /\b(martial arts|belt threat)\b/i, calm: /\b(don['’]?t give|do not care|don't care)\b/i, discovery: /\b(evolution|transformation|before and after)\b/i, sad: /\bfriendship ended\b/i };
    const name = names.find(n => rule.words.test(n) || explicit[id]?.test(n));
    const evidence = labels.filter(n => rule.labels.test(n));
    // Generic source reactions are lower priority than a specific named action or emotion.
    const generic = id === 'joy' || id === 'surprise';
    return { id, score: (name ? 20 : 0) + evidence.length * (generic ? 1 : 3), evidence: name ? { field: 'name', value: name } : evidence.length ? { field: 'label', value: evidence[0] } : null };
  }).filter(v => v.score).sort((a, b) => b.score - a.score);
  return matches[0] || null;
}

export function semanticCard(meme) {
  const rule = ARCHETYPES[meme.archetype];
  return { id: meme.id, name: meme.name.length > 72 ? `${meme.name.slice(0,69)}...` : meme.name, sourceName: meme.name, type: 'monster', tag: rule.tag, cost: rule.cost, attack: rule.attack,
    hp: rule.hp, speed: rule.speed, effects: structuredClone(rule.effects), motif: rule.motif,
    image: meme.image, source: meme.source, origin: '全球', flavor: rule.explanation,
    archetype: meme.archetype, evidence: meme.evidence, languages: meme.languages, countries: meme.countries };
}
