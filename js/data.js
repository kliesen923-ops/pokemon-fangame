// 타입, 기술, 도구, 기술 습득표 등 게임 규칙 데이터

export const TYPES = {
  normal: ['노말', '#a8a878'], fire: ['불꽃', '#f08030'], water: ['물', '#6890f0'],
  grass: ['풀', '#78c850'], electric: ['전기', '#f8d030'], ice: ['얼음', '#98d8d8'],
  fighting: ['격투', '#c03028'], poison: ['독', '#a040a0'], ground: ['땅', '#e0c068'],
  flying: ['비행', '#a890f0'], psychic: ['에스퍼', '#f85888'], bug: ['벌레', '#a8b820'],
  rock: ['바위', '#b8a038'], ghost: ['고스트', '#705898'], dragon: ['드래곤', '#7038f8'],
  dark: ['악', '#705848'], steel: ['강철', '#b8b8d0'], fairy: ['페어리', '#ee99ac'],
};

// [효과 굉장함, 효과 별로, 효과 없음]
const CHART = {
  normal: [[], ['rock', 'steel'], ['ghost']],
  fire: [['grass', 'ice', 'bug', 'steel'], ['fire', 'water', 'rock', 'dragon'], []],
  water: [['fire', 'ground', 'rock'], ['water', 'grass', 'dragon'], []],
  grass: [['water', 'ground', 'rock'], ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'], []],
  electric: [['water', 'flying'], ['electric', 'grass', 'dragon'], ['ground']],
  ice: [['grass', 'ground', 'flying', 'dragon'], ['fire', 'water', 'ice', 'steel'], []],
  fighting: [['normal', 'ice', 'rock', 'dark', 'steel'], ['poison', 'flying', 'psychic', 'bug', 'fairy'], ['ghost']],
  poison: [['grass', 'fairy'], ['poison', 'ground', 'rock', 'ghost'], ['steel']],
  ground: [['fire', 'electric', 'poison', 'rock', 'steel'], ['grass', 'bug'], ['flying']],
  flying: [['grass', 'fighting', 'bug'], ['electric', 'rock', 'steel'], []],
  psychic: [['fighting', 'poison'], ['psychic', 'steel'], ['dark']],
  bug: [['grass', 'psychic', 'dark'], ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'], []],
  rock: [['fire', 'ice', 'flying', 'bug'], ['fighting', 'ground', 'steel'], []],
  ghost: [['psychic', 'ghost'], ['dark'], ['normal']],
  dragon: [['dragon'], ['steel'], ['fairy']],
  dark: [['psychic', 'ghost'], ['fighting', 'dark', 'fairy'], []],
  steel: [['ice', 'rock', 'fairy'], ['fire', 'water', 'electric', 'steel'], []],
  fairy: [['fighting', 'dragon', 'dark'], ['fire', 'poison', 'steel'], []],
};

export function effectiveness(atk, defTypes) {
  let m = 1;
  const [se, nve, imm] = CHART[atk];
  for (const t of defTypes) {
    if (imm.includes(t)) return 0;
    if (se.includes(t)) m *= 2;
    if (nve.includes(t)) m *= 0.5;
  }
  return m;
}

// id: [이름, 타입, 분류(p 물리/s 특수/x 변화), 위력, 명중, PP, 효과]
// 효과: 'atk-1@foe' 같은 능력 랭크 변화, 'psn30'(30% 독) 같은 상태이상, 'drain', 'heal', 'recoil'
const M = {
  tackle: ['몸통박치기', 'normal', 'p', 40, 100, 35],
  scratch: ['할퀴기', 'normal', 'p', 40, 100, 35],
  pound: ['막치기', 'normal', 'p', 40, 100, 35],
  growl: ['울음소리', 'normal', 'x', 0, 100, 40, 'atk-1@foe'],
  tailwhip: ['꼬리흔들기', 'normal', 'x', 0, 100, 30, 'def-1@foe'],
  quickattack: ['전광석화', 'normal', 'p', 40, 100, 30, 'first'],
  headbutt: ['박치기', 'normal', 'p', 70, 100, 15],
  bodyslam: ['누르기', 'normal', 'p', 85, 100, 15, 'par30'],
  doubleedge: ['이판사판태클', 'normal', 'p', 120, 100, 15, 'recoil'],
  hyperbeam: ['파괴광선', 'normal', 'p', 150, 90, 5],
  swordsdance: ['칼춤', 'normal', 'x', 0, 100, 20, 'atk+2@self'],
  recover: ['HP회복', 'normal', 'x', 0, 100, 10, 'heal'],
  ember: ['불꽃세례', 'fire', 's', 40, 100, 25, 'brn10'],
  firefang: ['불꽃엄니', 'fire', 'p', 65, 95, 15, 'brn10'],
  flamethrower: ['화염방사', 'fire', 's', 90, 100, 15, 'brn10'],
  fireblast: ['불대문자', 'fire', 's', 110, 85, 5, 'brn10'],
  watergun: ['물대포', 'water', 's', 40, 100, 25],
  bubblebeam: ['거품광선', 'water', 's', 65, 100, 20, 'spe-1@foe30'],
  waterfall: ['폭포오르기', 'water', 'p', 80, 100, 15],
  surf: ['파도타기', 'water', 's', 90, 100, 15],
  hydropump: ['하이드로펌프', 'water', 's', 110, 80, 5],
  vinewhip: ['덩굴채찍', 'grass', 'p', 45, 100, 25],
  absorb: ['흡수', 'grass', 's', 20, 100, 25, 'drain'],
  razorleaf: ['잎날가르기', 'grass', 'p', 55, 95, 25],
  gigadrain: ['기가드레인', 'grass', 's', 75, 100, 10, 'drain'],
  solarbeam: ['솔라빔', 'grass', 's', 120, 100, 10],
  thundershock: ['전기쇼크', 'electric', 's', 40, 100, 30, 'par10'],
  spark: ['스파크', 'electric', 'p', 65, 100, 20, 'par30'],
  thunderbolt: ['10만볼트', 'electric', 's', 90, 100, 15, 'par10'],
  thunder: ['번개', 'electric', 's', 110, 70, 10, 'par30'],
  thunderwave: ['전기자석파', 'electric', 'x', 0, 90, 20, 'par100'],
  powdersnow: ['눈싸라기', 'ice', 's', 40, 100, 25],
  aurorabeam: ['오로라빔', 'ice', 's', 65, 100, 20, 'atk-1@foe10'],
  icebeam: ['냉동빔', 'ice', 's', 90, 100, 10],
  blizzard: ['눈보라', 'ice', 's', 110, 70, 5],
  karatechop: ['태권당수', 'fighting', 'p', 50, 100, 25],
  lowkick: ['로킥', 'fighting', 'p', 60, 100, 20],
  submission: ['지옥의바퀴', 'fighting', 'p', 80, 80, 20, 'recoil'],
  crosschop: ['크로스촙', 'fighting', 'p', 100, 80, 5],
  poisonsting: ['독침', 'poison', 'p', 15, 100, 35, 'psn30'],
  acid: ['용해액', 'poison', 's', 40, 100, 30, 'def-1@foe10'],
  sludge: ['오물공격', 'poison', 's', 65, 100, 20, 'psn30'],
  sludgebomb: ['오물폭탄', 'poison', 's', 90, 100, 10, 'psn30'],
  poisonpowder: ['독가루', 'poison', 'x', 0, 75, 35, 'psn100'],
  mudslap: ['진흙뿌리기', 'ground', 's', 20, 100, 10, 'acc-1@foe'],
  bonemerang: ['뼈다귀부메랑', 'ground', 'p', 60, 90, 10],
  dig: ['구멍파기', 'ground', 'p', 80, 100, 10],
  earthquake: ['지진', 'ground', 'p', 100, 100, 10],
  gust: ['바람일으키기', 'flying', 's', 40, 100, 35],
  peck: ['쪼기', 'flying', 'p', 35, 100, 35],
  wingattack: ['날개치기', 'flying', 'p', 60, 100, 35],
  drillpeck: ['회전부리', 'flying', 'p', 80, 100, 20],
  skyattack: ['불새', 'flying', 'p', 120, 90, 5],
  confusion: ['염동력', 'psychic', 's', 50, 100, 25],
  psybeam: ['환상빔', 'psychic', 's', 65, 100, 20],
  psychic: ['사이코키네시스', 'psychic', 's', 90, 100, 10, 'spd-1@foe10'],
  hypnosis: ['최면술', 'psychic', 'x', 0, 60, 20, 'slp100'],
  bugbite: ['벌레먹음', 'bug', 'p', 60, 100, 20],
  stringshot: ['실뿜기', 'bug', 'x', 0, 95, 40, 'spe-1@foe'],
  leechlife: ['흡혈', 'bug', 'p', 80, 100, 10, 'drain'],
  signalbeam: ['시그널빔', 'bug', 's', 75, 100, 15],
  xscissor: ['시저크로스', 'bug', 'p', 80, 100, 15],
  rockthrow: ['돌떨구기', 'rock', 'p', 50, 90, 15],
  rocktomb: ['암석봉인', 'rock', 'p', 60, 95, 15, 'spe-1@foe'],
  rockslide: ['스톤샤워', 'rock', 'p', 75, 90, 10],
  stoneedge: ['스톤에지', 'rock', 'p', 100, 80, 5],
  lick: ['핥기', 'ghost', 'p', 30, 100, 30, 'par30'],
  nightshade: ['나이트헤드', 'ghost', 's', 50, 100, 15],
  shadowball: ['섀도볼', 'ghost', 's', 80, 100, 15, 'spd-1@foe20'],
  twister: ['회오리', 'dragon', 's', 40, 100, 20],
  dragonbreath: ['용의숨결', 'dragon', 's', 60, 100, 20, 'par30'],
  dragonclaw: ['드래곤크루', 'dragon', 'p', 80, 100, 15],
  outrage: ['역린', 'dragon', 'p', 120, 100, 10],
  bite: ['물기', 'dark', 'p', 60, 100, 25],
  crunch: ['깨물어부수기', 'dark', 'p', 80, 100, 15, 'def-1@foe20'],
  metalclaw: ['메탈크로우', 'steel', 'p', 50, 95, 35],
  irontail: ['아이언테일', 'steel', 'p', 100, 75, 15],
  fairywind: ['요정의바람', 'fairy', 's', 40, 100, 30],
  disarmingvoice: ['차밍보이스', 'fairy', 's', 40, 100, 15],
  dazzlinggleam: ['매지컬샤인', 'fairy', 's', 80, 100, 10],
  moonblast: ['문포스', 'fairy', 's', 95, 100, 15],
  sing: ['노래하기', 'normal', 'x', 0, 55, 15, 'slp100'],
  splash: ['튀어오르기', 'normal', 'x', 0, 100, 40, 'none'],
  transform: ['변신', 'normal', 'x', 0, 100, 10, 'transform'],
};

export const MOVES = {};
for (const [id, [name, type, cat, power, acc, pp, fx]] of Object.entries(M)) {
  MOVES[id] = { id, name, type, cat, power, acc, pp, fx: fx || '' };
}

// 타입별 기술을 습득 레벨 순으로 (자동 생성 습득표에 사용)
const POOL = {
  normal: ['quickattack', 'headbutt', 'bodyslam', 'doubleedge', 'hyperbeam'],
  fire: ['ember', 'firefang', 'flamethrower', 'fireblast'],
  water: ['watergun', 'bubblebeam', 'waterfall', 'surf', 'hydropump'],
  grass: ['vinewhip', 'absorb', 'razorleaf', 'gigadrain', 'solarbeam'],
  electric: ['thundershock', 'thunderwave', 'spark', 'thunderbolt', 'thunder'],
  ice: ['powdersnow', 'aurorabeam', 'icebeam', 'blizzard'],
  fighting: ['karatechop', 'lowkick', 'submission', 'crosschop'],
  poison: ['poisonsting', 'poisonpowder', 'acid', 'sludge', 'sludgebomb'],
  ground: ['mudslap', 'bonemerang', 'dig', 'earthquake'],
  flying: ['gust', 'peck', 'wingattack', 'drillpeck', 'skyattack'],
  psychic: ['confusion', 'hypnosis', 'psybeam', 'psychic'],
  bug: ['stringshot', 'bugbite', 'leechlife', 'signalbeam', 'xscissor'],
  rock: ['rockthrow', 'rocktomb', 'rockslide', 'stoneedge'],
  ghost: ['lick', 'nightshade', 'shadowball'],
  dragon: ['twister', 'dragonbreath', 'dragonclaw', 'outrage'],
  dark: ['bite', 'crunch'],
  steel: ['metalclaw', 'irontail'],
  fairy: ['fairywind', 'disarmingvoice', 'dazzlinggleam', 'moonblast'],
};
const TIER_LV = [1, 8, 15, 24, 34, 44];

// 특별한 습득표 (자동 생성으로는 어색한 종)
const SPECIAL = {
  129: [[1, 'splash'], [15, 'tackle']],
  132: [[1, 'transform']],
  39: [[1, 'sing'], [1, 'pound'], [9, 'disarmingvoice'], [20, 'bodyslam'], [32, 'dazzlinggleam'], [44, 'doubleedge']],
  151: [[1, 'pound'], [10, 'confusion'], [20, 'recover'], [30, 'psychic'], [40, 'moonblast']],
  150: [[1, 'confusion'], [1, 'recover'], [40, 'psychic'], [50, 'shadowball'], [60, 'hyperbeam']],
};

export function learnset(mon) {
  if (SPECIAL[mon.id]) return SPECIAL[mon.id];
  const [a, b] = mon.types;
  const out = [[1, mon.id % 3 ? 'tackle' : 'scratch'], [1, mon.id % 2 ? 'growl' : 'tailwhip']];
  const pa = POOL[a], pb = b ? POOL[b] : POOL.normal;
  let ia = 0, ib = 0;
  for (let t = 1; t < 12; t++) {
    const lv = Math.round(TIER_LV[Math.min(5, t >> 1)] + (t & 1 ? 4 : 0) + (mon.id % 3));
    const fromA = t % 2 === 1 || ib >= pb.length;
    if (fromA && ia < pa.length) out.push([lv, pa[ia++]]);
    else if (ib < pb.length) out.push([lv, pb[ib++]]);
  }
  if (mon.base[1] >= 100) out.push([30, 'swordsdance']);
  return out;
}

export const ITEMS = {
  pokeball: { name: '몬스터볼', price: 200, ball: 1, desc: '야생 포켓몬을 잡는다.' },
  greatball: { name: '수퍼볼', price: 600, ball: 1.5, desc: '몬스터볼보다 잘 잡힌다.' },
  ultraball: { name: '하이퍼볼', price: 1200, ball: 2, desc: '아주 잘 잡히는 볼.' },
  potion: { name: '상처약', price: 300, heal: 20, desc: 'HP를 20 회복한다.' },
  superpotion: { name: '좋은상처약', price: 700, heal: 60, desc: 'HP를 60 회복한다.' },
  hyperpotion: { name: '고급상처약', price: 1500, heal: 150, desc: 'HP를 150 회복한다.' },
  fullheal: { name: '만병통치제', price: 600, cure: true, desc: '상태이상을 모두 고친다.' },
  revive: { name: '기력의조각', price: 2000, revive: true, desc: '기절한 포켓몬을 절반 HP로 되살린다.' },
};

export const STATUS = { psn: '독', par: '마비', slp: '잠듦', brn: '화상' };
