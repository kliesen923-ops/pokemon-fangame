// 턴제 배틀
import { MOVES, ITEMS, STATUS, TYPES, effectiveness } from './data.js';
import { DEX, monName, gainExp, calcStats, makeMon } from './mon.js';
import { monAssets, animLength, preload } from './assets.js';
import { drawMon, frameIndex } from './render.js';
import { say, choose, sleep } from './ui.js';

const STAGE_NAMES = { atk: '공격', def: '방어', spa: '특수공격', spd: '특수방어', spe: '스피드', acc: '명중률' };
const STAT_IDX = { atk: 1, def: 2, spa: 3, spd: 4, spe: 5 };
const rand = (n) => Math.floor(Math.random() * n);
const chance = (pct) => Math.random() * 100 < pct;

function stageMul(s) {
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

class Battler {
  constructor(mon, side) {
    this.mon = mon;
    this.side = side; // 'me' | 'foe'
    this.reset();
  }
  reset() {
    this.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0 };
    this.view = this.mon.id;
    this.types = DEX[this.mon.id].types;
    this.moves = this.mon.moves;
    this.statsOverride = null;
    this.sleep = this.mon.status === 'slp' ? 1 + rand(3) : 0;
  }
  get name() {
    return (this.side === 'foe' ? '상대 ' : '') + monName(this.mon);
  }
  stat(key) {
    const base = (this.statsOverride || this.mon.stats)[STAT_IDX[key]];
    let v = base * stageMul(this.stages[key]);
    if (key === 'spe' && this.mon.status === 'par') v /= 2;
    return v;
  }
}

// 화면 상태 (game.js의 렌더 루프가 draw를 부른다)
export const view = {
  active: false,
  dark: false,
  me: null,
  foe: null,
  ball: null,
  draw(g, tick) {
    const W = 240, H = 176;
    const sky = g.createLinearGradient(0, 0, 0, H);
    if (this.dark) {
      sky.addColorStop(0, '#2a2030');
      sky.addColorStop(1, '#4a3a38');
    } else {
      sky.addColorStop(0, '#a8d8f8');
      sky.addColorStop(0.55, '#e8f4d0');
      sky.addColorStop(1, '#a8d088');
    }
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    g.fillStyle = this.dark ? '#5a4a40' : '#88c070';
    ellipse(g, 176, 78, 50, 11);
    ellipse(g, 60, 130, 58, 13);
    g.fillStyle = this.dark ? '#6a5a50' : '#a0d888';
    ellipse(g, 176, 76, 44, 8);
    ellipse(g, 60, 128, 52, 10);
    drawSide(g, this.foe, tick, 176, 60, 7);
    drawSide(g, this.me, tick, 60, 110, 3);
    if (this.ball) drawBall(g, this.ball, tick);
  },
};

function ellipse(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

function drawSide(g, s, tick, x, y, row) {
  if (!s || s.hidden) return;
  const a = monAssets(s.id);
  const anim = s.anim || 'Idle';
  const info = a.info[anim];
  let frame, local = tick - (s.start || 0);
  if (anim === 'Idle' || anim === 'Walk') frame = frameIndex(info.d, local);
  else {
    frame = frameIndex(info.d, Math.min(local, info.d.reduce((p, c) => p + c, 0) - 1));
  }
  if (s.flash && Math.floor(tick / 4) % 2) return;
  g.save();
  g.globalAlpha = s.alpha ?? 1;
  drawMon(g, a[anim], info, row, frame, x + (s.dx || 0), y + (s.dy || 0), 2);
  g.restore();
}

function drawBall(g, b, tick) {
  const wob = b.shake ? Math.sin(tick / 3) * 3 : 0;
  const x = b.x + wob, y = b.y;
  g.fillStyle = '#202020';
  ellipse(g, x, y, 7, 7);
  g.fillStyle = b.color || '#e83838';
  g.beginPath();
  g.arc(x, y, 6, Math.PI, 0);
  g.fill();
  g.fillStyle = '#f8f8f8';
  g.beginPath();
  g.arc(x, y, 6, 0, Math.PI);
  g.fill();
  g.fillStyle = '#202020';
  g.fillRect(x - 6, y - 1, 12, 2);
  g.fillStyle = '#f8f8f8';
  ellipse(g, x, y, 2, 2);
}

// ---- HUD ----
function hudHTML(b, isMe) {
  const p = b.mon;
  const pct = Math.max(0, p.hp / p.maxhp) * 100;
  const col = pct > 50 ? '#48c048' : pct > 20 ? '#e8c020' : '#e04030';
  const st = p.status ? `<span class="st st-${p.status}">${STATUS[p.status]}</span>` : '';
  let expBar = '';
  if (isMe) {
    const lo = p.lv ** 3, hi = (p.lv + 1) ** 3;
    expBar = `<div class="exp"><div style="width:${Math.min(100, ((p.exp - lo) / (hi - lo)) * 100)}%"></div></div>`;
  }
  return `<img class="portrait" src="${monAssets(b.view).portrait}" alt="">
    <div class="hud-body">
      <div class="hud-name">${monName(p)} <span class="lv">Lv${p.lv}</span>${st}</div>
      <div class="hp"><span>HP</span><div class="bar"><div style="width:${pct}%;background:${col}"></div></div></div>
      ${isMe ? `<div class="hpnum">${Math.max(0, p.hp)}/${p.maxhp}</div>` : ''}
      ${expBar}
    </div>`;
}

export class Battle {
  constructor(game, opts) {
    this.game = game;
    this.trainer = opts.trainer || null;
    this.foeParty = opts.trainer ? opts.trainer.team.map(([id, lv]) => makeMon(id, lv)) : [opts.wild];
    this.legend = opts.legend || null;
    this.dark = !!opts.dark;
    this.runs = 0;
    this.tick = () => game.tick;
    this.participants = new Set();
    this.result = null;
  }

  get party() {
    return this.game.state.party;
  }

  updateHud() {
    const ui = document.getElementById('ui');
    let e = ui.querySelector('.hud.foe'), m = ui.querySelector('.hud.me');
    if (!e) {
      e = document.createElement('div');
      e.className = 'hud foe';
      m = document.createElement('div');
      m.className = 'hud me';
      ui.prepend(e, m);
    }
    e.innerHTML = this.foe && !view.foe?.hidden ? hudHTML(this.foe, false) : '';
    e.style.visibility = this.foe && !view.foe?.hidden ? 'visible' : 'hidden';
    m.innerHTML = this.me && !view.me?.hidden ? hudHTML(this.me, true) : '';
    m.style.visibility = this.me && !view.me?.hidden ? 'visible' : 'hidden';
  }

  async animate(side, anim, extra = {}) {
    const s = side === 'me' ? view.me : view.foe;
    Object.assign(s, { anim, start: this.tick(), ...extra });
    const len = animLength(s.id, anim);
    await sleep((len / 60) * 1000 + 60);
    Object.assign(s, { anim: 'Idle', start: this.tick(), dx: 0, dy: 0 });
  }

  async hpTo(b, target) {
    const from = b.mon.hp;
    target = Math.max(0, Math.min(b.mon.maxhp, Math.round(target)));
    const steps = Math.min(20, Math.abs(target - from));
    for (let i = 1; i <= steps; i++) {
      b.mon.hp = Math.round(from + ((target - from) * i) / steps);
      this.updateHud();
      await sleep(25);
    }
    b.mon.hp = target;
    this.updateHud();
  }

  setView(side, b) {
    const v = { id: b.view, anim: 'Idle', start: this.tick(), alpha: 1 };
    if (side === 'me') view.me = v;
    else view.foe = v;
  }

  async run() {
    view.active = true;
    view.dark = this.dark;
    view.ball = null;
    this.game.setScreen('battle');
    await preload([...this.foeParty.map((p) => p.id), ...this.party.map((p) => p.id)]);
    const foeMon = this.foeParty[0];
    this.foe = new Battler(foeMon, 'foe');
    this.setView('foe', this.foe);
    view.me = null;
    this.game.seen(foeMon.id);
    this.updateHud();
    if (this.trainer) {
      await say(`${this.trainer.name}이(가) 승부를 걸어왔다!`);
      await say(`${this.trainer.name}은(는) ${monName(foeMon)}을(를) 내보냈다!`);
    } else {
      await say(this.legend ? `${monName(foeMon)}이(가) 덤벼들었다!` : `앗! 야생 ${monName(foeMon)}이(가) 튀어나왔다!`);
    }
    const first = this.party.findIndex((p) => p.hp > 0);
    await this.sendOut(first);

    while (!this.result) await this.turn();

    view.active = false;
    document.getElementById('ui').innerHTML = '';
    for (const p of this.party) delete p.battleId;
    return this.result;
  }

  async sendOut(i) {
    this.me = new Battler(this.party[i], 'me');
    this.meIndex = i;
    this.participants.add(this.party[i]);
    this.setView('me', this.me);
    this.updateHud();
    await say(`가랏! ${monName(this.me.mon)}!`, { auto: 600 });
  }

  // ---- 한 턴 ----
  async turn() {
    const act = await this.chooseAction();
    if (!act) return;
    if (this.result) return;
    const foeMove = this.foeChoose();
    const order = [];
    if (act.type === 'move') {
      const mm = MOVES[this.me.moves[act.index].id];
      const fm = MOVES[foeMove];
      const mePri = mm.fx === 'first' ? 1 : 0, foePri = fm.fx === 'first' ? 1 : 0;
      const meFirst = mePri !== foePri ? mePri > foePri : this.me.stat('spe') === this.foe.stat('spe') ? Math.random() < 0.5 : this.me.stat('spe') > this.foe.stat('spe');
      const mine = { who: this.me, target: this.foe, slot: this.me.moves[act.index] };
      const theirs = { who: this.foe, target: this.me, move: foeMove };
      order.push(...(meFirst ? [mine, theirs] : [theirs, mine]));
    } else {
      order.push({ who: this.foe, target: this.me, move: foeMove });
    }
    for (const o of order) {
      if (this.result) return;
      if (o.who.mon.hp <= 0 || o.target.mon.hp <= 0) continue;
      let moveId = o.move;
      if (o.slot) {
        o.slot.pp = Math.max(0, o.slot.pp - 1);
        moveId = o.slot.id;
      }
      await this.useMove(o.who, o.target, moveId);
      if (await this.checkFaints()) return;
    }
    for (const b of [this.me, this.foe]) {
      if (this.result) return;
      if (b.mon.hp <= 0) continue;
      if (b.mon.status === 'psn' || b.mon.status === 'brn') {
        await say(`${b.name}은(는) ${b.mon.status === 'psn' ? '독' : '화상'} 데미지를 입었다!`, { auto: 500 });
        await this.hpTo(b, b.mon.hp - Math.max(1, Math.floor(b.mon.maxhp / 8)));
        if (await this.checkFaints()) return;
      }
    }
  }

  async chooseAction() {
    for (;;) {
      await say(`${monName(this.me.mon)}은(는) 무엇을 할까?`, { keep: true, auto: 1 });
      const c = await choose(['싸운다', '가방', '포켓몬', '도망간다'], { cls: 'battle-cmd', cols: 2, cancel: false });
      if (c === 0) {
        const noPP = this.me.moves.every((m) => m.pp <= 0);
        if (noPP) return { type: 'move', index: 0, struggle: true };
        const i = await choose(this.me.moves, {
          cls: 'moves',
          cols: 2,
          render: (m) => {
            const mv = MOVES[m.id];
            return `<span class="mv-name">${mv.name}</span><span class="type" style="background:${TYPES[mv.type][1]}">${TYPES[mv.type][0]}</span><span class="pp">PP ${m.pp}/${mv.pp}</span>`;
          },
        });
        if (i < 0) continue;
        if (this.me.moves[i].pp <= 0) {
          await say('그 기술은 PP가 없다!');
          continue;
        }
        return { type: 'move', index: i };
      }
      if (c === 1) {
        const r = await this.useBag();
        if (r) return r;
      }
      if (c === 2) {
        const i = await this.game.partyMenu({ battle: true, current: this.meIndex });
        if (i < 0 || i === this.meIndex) continue;
        if (this.party[i].hp <= 0) {
          await say('기절한 포켓몬은 싸울 수 없다!');
          continue;
        }
        await say(`돌아와, ${monName(this.me.mon)}!`, { auto: 500 });
        await this.sendOut(i);
        return { type: 'switch' };
      }
      if (c === 3) {
        if (this.trainer) {
          await say('트레이너와의 승부에서는 도망칠 수 없다!');
          continue;
        }
        this.runs++;
        const a = this.me.stat('spe'), b = this.foe.stat('spe');
        const odds = a >= b ? 256 : ((a * 128) / b + 30 * this.runs) % 256;
        if (this.legend ? Math.random() < 0.3 : rand(256) < odds) {
          await say('무사히 도망쳤다!');
          this.result = 'run';
          return null;
        }
        await say('도망칠 수 없었다!');
        return { type: 'run' };
      }
    }
  }

  async useBag() {
    const bag = this.game.state.bag;
    const ids = Object.keys(bag).filter((k) => bag[k] > 0);
    if (!ids.length) {
      await say('가방이 비어 있다!');
      return null;
    }
    const i = await choose(ids, { title: '가방', cls: 'bag', render: (k) => `${ITEMS[k].name}<span class="cnt">×${bag[k]}</span>` });
    if (i < 0) return null;
    const id = ids[i], item = ITEMS[id];
    if (item.ball) {
      if (this.trainer) {
        await say('남의 포켓몬은 잡을 수 없어!');
        return null;
      }
      bag[id]--;
      await this.throwBall(item);
      return this.result ? null : { type: 'item' };
    }
    const t = await this.game.partyMenu({ battle: true, title: `${item.name}을(를) 누구에게?` });
    if (t < 0) return null;
    const ok = await this.game.applyItem(id, this.party[t]);
    if (!ok) return null;
    if (this.party[t] === this.me.mon) {
      this.me.sleep = this.me.mon.status === 'slp' ? this.me.sleep : 0;
      this.updateHud();
    }
    return { type: 'item' };
  }

  async throwBall(item) {
    await say(`${this.game.state.name}은(는) ${item.name}을(를) 던졌다!`, { auto: 400 });
    const p = this.foe.mon;
    const ball = { x: 60, y: 110, color: item.ball >= 2 ? '#f0c020' : item.ball > 1 ? '#3860e0' : '#e83838' };
    view.ball = ball;
    for (let i = 0; i <= 12; i++) {
      ball.x = 60 + (116 * i) / 12;
      ball.y = 110 - Math.sin((i / 12) * Math.PI) * 50 - (i / 12) * 42;
      await sleep(25);
    }
    view.foe.hidden = true;
    this.updateHud();
    ball.y = 72;
    const rate = DEX[p.id].catch;
    const statusMul = p.status === 'slp' ? 2.5 : p.status ? 1.5 : 1;
    const a = (((3 * p.maxhp - 2 * p.hp) * rate * item.ball) / (3 * p.maxhp)) * statusMul;
    const shakeP = a >= 255 ? 1 : Math.pow(a / 255, 0.25);
    let shakes = 0;
    while (shakes < 3 && Math.random() < shakeP) {
      ball.shake = true;
      await sleep(500);
      ball.shake = false;
      await sleep(250);
      shakes++;
    }
    if (shakes === 3 && Math.random() < shakeP) {
      await sleep(200);
      await say(`신난다! ${monName(p)}을(를) 붙잡았다!`);
      view.ball = null;
      this.game.caught(p);
      this.result = 'caught';
      await this.game.addMon(p);
      return;
    }
    view.ball = null;
    view.foe.hidden = false;
    this.updateHud();
    await say(['아깝다! 조금만 더 하면 잡을 수 있었는데!', '앗! 볼에서 나와 버렸다!', '아아! 거의 잡았다고 생각했는데!', '아깝다! 조금만 더…'][shakes]);
  }

  foeChoose() {
    const usable = this.foe.moves.filter((m) => m.pp > 0);
    if (!usable.length) return 'tackle';
    let best = null, bestScore = -1;
    for (const m of usable) {
      const mv = MOVES[m.id];
      let s;
      if (mv.power) {
        const stab = this.foe.types.includes(mv.type) ? 1.5 : 1;
        s = mv.power * effectiveness(mv.type, this.me.types) * stab * (mv.acc / 100);
      } else s = /psn|par|slp|brn/.test(mv.fx) ? (this.me.mon.status ? 0 : 45) : 25;
      s += Math.random() * 40;
      if (s > bestScore) [best, bestScore] = [m, s];
    }
    if (this.trainer) best.pp--;
    return best.id;
  }

  async useMove(user, target, moveId) {
    const mv = MOVES[moveId];
    const mon = user.mon;
    if (mon.status === 'slp') {
      if (user.sleep > 0) {
        user.sleep--;
        await say(`${user.name}은(는) 쿨쿨 잠들어 있다.`);
        return;
      }
      mon.status = null;
      this.updateHud();
      await say(`${user.name}은(는) 잠에서 깨어났다!`);
    }
    if (mon.status === 'par' && chance(25)) {
      await say(`${user.name}은(는) 몸이 저려서 움직일 수 없다!`);
      return;
    }
    await say(`${user.name}의 ${mv.name}!`, { auto: 350 });
    if (mv.fx === 'none') {
      await say('그러나 아무 일도 일어나지 않았다!');
      return;
    }
    const isSelf = /@self|heal|transform/.test(mv.fx);
    if (!isSelf && mv.acc < 100) {
      const acc = mv.acc * stageMul(user.stages.acc);
      if (!chance(acc)) {
        await this.animate(user.side, 'Attack');
        await say(`그러나 ${user.name}의 공격은 빗나갔다!`);
        return;
      }
    }
    await this.animate(user.side, 'Attack', { dx: user.side === 'me' ? 6 : -6 });

    if (mv.cat === 'x') {
      await this.applyEffect(user, target, mv.fx, true);
      return;
    }
    const eff = effectiveness(mv.type, target.types);
    if (eff === 0) {
      await say(`${target.name}에게는 효과가 없는 것 같다…`);
      return;
    }
    const phys = mv.cat === 'p';
    let A = user.stat(phys ? 'atk' : 'spa');
    const D = target.stat(phys ? 'def' : 'spd');
    if (phys && mon.status === 'brn') A /= 2;
    const crit = chance(6.25);
    const stab = user.types.includes(mv.type) ? 1.5 : 1;
    let dmg = (((2 * mon.lv) / 5 + 2) * mv.power * (A / D)) / 50 + 2;
    dmg *= stab * eff * (crit ? 1.5 : 1) * (0.85 + Math.random() * 0.15);
    dmg = Math.max(1, Math.floor(dmg));
    dmg = Math.min(dmg, target.mon.hp);

    const tv = target.side === 'me' ? view.me : view.foe;
    tv.flash = true;
    const hurt = this.animate(target.side, 'Hurt');
    await this.hpTo(target, target.mon.hp - dmg);
    await hurt;
    tv.flash = false;
    if (crit) await say('급소에 맞았다!', { auto: 500 });
    if (eff > 1) await say('효과가 굉장했다!', { auto: 600 });
    if (eff < 1) await say('효과가 별로인 듯하다…', { auto: 600 });

    if (mv.fx === 'drain') {
      const h = Math.max(1, Math.floor(dmg / 2));
      await this.hpTo(user, mon.hp + h);
      await say(`${target.name}에게서 체력을 흡수했다!`, { auto: 500 });
    } else if (mv.fx === 'recoil' && mon.hp > 0) {
      await this.hpTo(user, mon.hp - Math.max(1, Math.floor(dmg / 4)));
      await say(`${user.name}은(는) 반동으로 데미지를 입었다!`, { auto: 500 });
    } else if (mv.fx && target.mon.hp > 0) {
      await this.applyEffect(user, target, mv.fx, false);
    }
  }

  async applyEffect(user, target, fx, primary) {
    if (fx === 'heal') {
      if (user.mon.hp >= user.mon.maxhp) return say('그러나 HP는 이미 가득 차 있다!');
      await this.hpTo(user, user.mon.hp + user.mon.maxhp / 2);
      return say(`${user.name}의 HP가 회복되었다!`);
    }
    if (fx === 'transform') {
      user.view = target.view;
      user.types = target.types;
      user.statsOverride = [...target.mon.stats];
      user.statsOverride[0] = user.mon.maxhp;
      user.moves = target.moves.map((m) => ({ id: m.id, pp: 5 }));
      user.stages = { ...target.stages };
      const v = user.side === 'me' ? view.me : view.foe;
      v.id = user.view;
      await preload([user.view]);
      this.updateHud();
      return say(`${user.name}은(는) ${monName(target.mon)}(으)로 변신했다!`);
    }
    let m = fx.match(/^(psn|par|slp|brn)(\d+)$/);
    if (m) {
      const [, st, pct] = m;
      if (!chance(+pct)) return;
      const t = target.mon;
      if (t.status) return primary ? say('그러나 실패했다!') : null;
      if ((st === 'psn' && (target.types.includes('poison') || target.types.includes('steel'))) ||
          (st === 'brn' && target.types.includes('fire')) ||
          (st === 'par' && target.types.includes('electric'))) {
        return primary ? say(`${target.name}에게는 효과가 없는 것 같다…`) : null;
      }
      t.status = st;
      if (st === 'slp') target.sleep = 1 + rand(3);
      this.updateHud();
      const msg = { psn: '독에 걸렸다!', par: '마비되어 기술이 나오기 어려워졌다!', slp: '잠들어 버렸다!', brn: '화상을 입었다!' }[st];
      return say(`${target.name}은(는) ${msg}`);
    }
    m = fx.match(/^(atk|def|spa|spd|spe|acc)([+-]\d)@(self|foe)(\d*)$/);
    if (m) {
      const [, stat, deltaS, who, pct] = m;
      if (pct && !chance(+pct)) return;
      const b = who === 'self' ? user : target;
      const delta = +deltaS;
      const cur = b.stages[stat];
      const next = Math.max(-6, Math.min(6, cur + delta));
      if (next === cur) return primary ? say(`${b.name}의 ${STAGE_NAMES[stat]}은(는) 더 이상 ${delta > 0 ? '오르지' : '떨어지지'} 않는다!`) : null;
      b.stages[stat] = next;
      const amt = Math.abs(delta) >= 2 ? (delta > 0 ? '크게 올라갔다!' : '크게 떨어졌다!') : delta > 0 ? '올라갔다!' : '떨어졌다!';
      return say(`${b.name}의 ${STAGE_NAMES[stat]}이(가) ${amt}`);
    }
  }

  // 기절 처리. 배틀이 끝나면 true
  async checkFaints() {
    if (this.foe.mon.hp <= 0) {
      await this.animate('foe', 'Hurt');
      await this.fadeOut('foe');
      await say(`${this.foe.name}은(는) 쓰러졌다!`);
      await this.giveExp();
      const next = this.foeParty.findIndex((p) => p.hp > 0);
      if (next < 0) {
        if (this.trainer) {
          await say(`${this.trainer.name}과(와)의 승부에서 이겼다!`);
          if (this.trainer.lose) await say(this.trainer.lose);
          this.game.state.money += this.trainer.money;
          await say(`상금으로 ${this.trainer.money}원을 받았다!`);
        }
        this.result = 'win';
        return true;
      }
      this.foe = new Battler(this.foeParty[next], 'foe');
      this.setView('foe', this.foe);
      this.game.seen(this.foe.mon.id);
      this.participants = new Set([this.me.mon]);
      this.updateHud();
      await say(`${this.trainer.name}은(는) ${monName(this.foe.mon)}을(를) 내보냈다!`);
    }
    if (this.me.mon.hp <= 0) {
      await this.fadeOut('me');
      await say(`${monName(this.me.mon)}은(는) 쓰러졌다!`);
      this.participants.delete(this.me.mon);
      if (!this.party.some((p) => p.hp > 0)) {
        await say(`${this.game.state.name}에게는 싸울 수 있는 포켓몬이 없다!`);
        await say(`${this.game.state.name}은(는) 눈앞이 캄캄해졌다…`);
        this.result = 'lose';
        return true;
      }
      let i;
      do {
        i = await this.game.partyMenu({ battle: true, force: true, title: '다음 포켓몬을 고르세요' });
      } while (i < 0 || this.party[i].hp <= 0);
      await this.sendOut(i);
    }
    return false;
  }

  async fadeOut(side) {
    const v = side === 'me' ? view.me : view.foe;
    for (let i = 0; i <= 10; i++) {
      v.alpha = 1 - i / 10;
      v.dy = i * 2;
      await sleep(30);
    }
    v.hidden = true;
    this.updateHud();
  }

  async giveExp() {
    const f = this.foe.mon;
    const total = Math.floor((DEX[f.id].exp * f.lv) / 7 * (this.trainer ? 1.5 : 1));
    const alive = [...this.participants].filter((p) => p.hp > 0 && this.party.includes(p));
    if (!alive.length) return;
    const each = Math.max(1, Math.floor(total / alive.length));
    for (const p of alive) {
      await say(`${monName(p)}은(는) 경험치를 ${each} 얻었다!`, { auto: 500 });
      const events = gainExp(p, each);
      this.updateHud();
      for (const e of events) {
        if (e.type === 'level') {
          p.leveled = true;
          this.updateHud();
          await say(`${monName(p)}의 레벨이 ${e.lv}(으)로 올랐다!`);
        } else await this.game.learnMove(p, e.move);
      }
    }
  }
}

export { calcStats };
