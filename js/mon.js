// 포켓몬 개체 생성, 능력치, 경험치, 기술 습득, 진화
import { MOVES, learnset } from './data.js';

export let DEX = []; // DEX[id] = 종 데이터
export function setDex(list) {
  DEX = [];
  for (const m of list) DEX[m.id] = m;
}

export const expForLevel = (lv) => lv * lv * lv;
const rnd = (n) => Math.floor(Math.random() * n);

export function calcStats(p) {
  const b = DEX[p.id].base;
  const s = b.map((base, i) => {
    const v = Math.floor(((2 * base + p.iv[i]) * p.lv) / 100);
    return i === 0 ? v + p.lv + 10 : v + 5;
  });
  const oldMax = p.maxhp || s[0];
  p.maxhp = s[0];
  p.stats = s; // [hp, atk, def, spa, spd, spe]
  if (p.hp === undefined) p.hp = s[0];
  else if (p.hp > 0) p.hp = Math.max(1, Math.min(s[0], p.hp + (s[0] - oldMax)));
}

export function movesAt(id, lv) {
  return learnset(DEX[id]).filter(([l]) => l <= lv).map(([, m]) => m);
}

export function makeMon(id, lv) {
  const p = { id, lv, iv: Array.from({ length: 6 }, () => rnd(32)), exp: expForLevel(lv), status: null, uid: Date.now().toString(36) + rnd(1e6) };
  const known = [...new Set(movesAt(id, lv))].slice(-4);
  p.moves = known.map((m) => ({ id: m, pp: MOVES[m].pp }));
  calcStats(p);
  return p;
}

export const monName = (p) => p.nick || DEX[p.id].species;

export function healMon(p) {
  p.hp = p.maxhp;
  p.status = null;
  for (const m of p.moves) m.pp = MOVES[m.id].pp;
}

// 경험치를 더하고 레벨업 이벤트 목록을 돌려준다
export function gainExp(p, amount) {
  const events = [];
  p.exp += amount;
  while (p.lv < 100 && p.exp >= expForLevel(p.lv + 1)) {
    p.lv++;
    calcStats(p);
    events.push({ type: 'level', lv: p.lv });
    for (const [l, m] of learnset(DEX[p.id])) {
      if (l === p.lv && !p.moves.some((x) => x.id === m)) events.push({ type: 'move', move: m });
    }
  }
  return events;
}

export function evolutionTarget(p) {
  const evo = DEX[p.id].evo;
  if (!evo) return null;
  const ok = evo.filter((e) => p.lv >= e.lv);
  if (!ok.length) return null;
  // 이브이처럼 갈래가 여럿이면 개체값으로 결정 (같은 개체는 항상 같은 진화)
  return ok[p.iv[1] % ok.length].to;
}

export function evolve(p, to) {
  p.id = to;
  calcStats(p);
  for (const [l, m] of learnset(DEX[to])) {
    if (l <= p.lv && p.moves.length < 4 && !p.moves.some((x) => x.id === m)) p.moves.push({ id: m, pp: MOVES[m].pp });
  }
}
