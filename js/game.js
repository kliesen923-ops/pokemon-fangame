// 게임 본체: 필드 이동, 이벤트, 메뉴, 저장
import { MAPS, isSolidTile, isEncounterTile } from './maps.js';
import { MOVES, ITEMS, TYPES, STATUS } from './data.js';
import { DEX, setDex, makeMon, monName, healMon, evolutionTarget, evolve } from './mon.js';
import { loadData, monAssets, preload } from './assets.js';
import { TS, drawTile, drawBuilding, drawPerson, drawPC, drawMon, frameIndex, DIR_ROW } from './render.js';
import { input, bindTouch } from './input.js';
import { say, sayAll, choose, yesNo, panel, waitKey, sleep, clearUI } from './ui.js';
import { Battle, view as battleView } from './battle.js';

const SAVE_KEY = 'pkfg-save-v1';
const DX = [0, 0, -1, 1], DY = [1, -1, 0, 0]; // 0 아래 1 위 2 왼쪽 3 오른쪽
const KEY_DIR = { down: 0, up: 1, left: 2, right: 3 };
const PLAYER_LOOK = { hair: '#302018', shirt: '#d83030' };
const STARTER_LV = 5;

const canvas = document.getElementById('screen');
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;
const VW = canvas.width, VH = canvas.height;

function newState(name) {
  return {
    name, map: 'home', x: 4, y: 3, dir: 0,
    party: [], box: [], bag: { potion: 1 }, money: 3000,
    seen: [], caught: [], flags: {}, badges: [],
    heal: { map: 'home', x: 4, y: 3 }, back: [],
    playTime: 0,
  };
}

const game = {
  state: null,
  tick: 0,
  screen: 'title',
  busy: false, // 이벤트 진행 중 (이동 불가)
  move: null, // 걷는 중 { fromX, fromY, t }
  follower: null, // { x, y, dir, px, py }
  trail: [],
  turnDelay: 0,
  balloon: null,

  setScreen(s) {
    this.screen = s;
  },
  get map() {
    return MAPS[this.state.map];
  },

  // ---- 저장 ----
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      return true;
    } catch {
      return false;
    }
  },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      return s && s.party ? s : null;
    } catch {
      return null;
    }
  },

  seen(id) {
    if (!this.state.seen.includes(id)) this.state.seen.push(id);
  },
  caught(p) {
    this.seen(p.id);
    if (!this.state.caught.includes(p.id)) this.state.caught.push(p.id);
  },

  async addMon(p) {
    this.caught(p);
    if (this.state.party.length < 6) {
      this.state.party.push(p);
    } else {
      this.state.box.push(p);
      await say(`${monName(p)}은(는) PC 박스로 전송되었다.`);
    }
  },

  // ---- 맵 ----
  tileAt(x, y, map = this.map) {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return null;
    return map.tiles[y][x];
  },
  visibleNpcs(map = this.map) {
    const f = this.state.flags;
    return (map.npcs || []).filter((n) => {
      if (n.legend && f['legend_' + n.legend.id]) return false;
      if (n.action === 'starter' && f.starter) return false;
      return true;
    });
  },
  npcAt(x, y) {
    return this.visibleNpcs().find((n) => n.x === x && n.y === y);
  },
  buildingAt(x, y) {
    return (this.map.buildings || []).find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
  },
  blocked(x, y) {
    const ch = this.tileAt(x, y);
    if (ch === null) return false; // 가장자리 밖은 링크로 처리
    if (isSolidTile(ch)) return true;
    if (this.npcAt(x, y)) return true;
    const b = this.buildingAt(x, y);
    if (b) {
      const doorX = b.x + Math.floor(b.w / 2), doorY = b.y + b.h - 1;
      return !(x === doorX && y === doorY);
    }
    return false;
  },

  async warp(mapId, x, y, dir) {
    await fade(true);
    this.state.map = mapId;
    this.state.x = x;
    this.state.y = y;
    if (dir !== undefined) this.state.dir = dir;
    this.resetFollower();
    this.save();
    showMapName(MAPS[mapId].name);
    await fade(false);
  },

  resetFollower() {
    const s = this.state;
    const bx = s.x - DX[s.dir], by = s.y - DY[s.dir];
    const ok = this.tileAt(bx, by) && !isSolidTile(this.tileAt(bx, by)) && !this.buildingAt(bx, by);
    this.follower = { x: ok ? bx : s.x, y: ok ? by : s.y, dir: s.dir, fromX: null, fromY: null, hidden: !ok };
    this.trail = [];
  },

  // ---- 이동 ----
  tryMove(dir) {
    const s = this.state;
    if (s.dir !== dir) {
      s.dir = dir;
      this.turnDelay = 5;
      return;
    }
    if (this.turnDelay > 0) return;
    const nx = s.x + DX[dir], ny = s.y + DY[dir];
    const map = this.map;
    if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) {
      this.edgeExit(dir, nx, ny);
      return;
    }
    if (this.blocked(nx, ny)) {
      bump();
      return;
    }
    this.move = { fromX: s.x, fromY: s.y, t: 0 };
    const f = this.follower;
    f.fromX = f.x;
    f.fromY = f.y;
    const fdx = s.x - f.x, fdy = s.y - f.y;
    if (fdx || fdy) f.dir = fdy > 0 ? 0 : fdy < 0 ? 1 : fdx < 0 ? 2 : 3;
    f.x = s.x;
    f.y = s.y;
    f.hidden = false;
    s.x = nx;
    s.y = ny;
  },

  async edgeExit(dir, nx, ny) {
    const edge = ['s', 'n', 'w', 'e'][dir];
    const link = this.map.links && this.map.links[edge];
    if (!link) return;
    if (this.state.map === 'town' && !this.state.flags.starter) {
      this.busy = true;
      await say('잠깐! 포켓몬 없이 수풀에 들어가면 위험해!');
      await say('연구소에 계신 박사님께 먼저 가 보자.');
      this.busy = false;
      return;
    }
    const to = MAPS[link.to];
    const off = link.off || 0;
    let x = nx, y = ny;
    if (edge === 'n') y = to.h - 1;
    if (edge === 's') y = 0;
    if (edge === 'w') x = to.w - 1;
    if (edge === 'e') x = 0;
    if (edge === 'n' || edge === 's') x += off;
    else y += off;
    this.busy = true;
    await this.warp(link.to, x, y, dir);
    this.busy = false;
  },

  async afterStep() {
    const s = this.state;
    const ch = this.tileAt(s.x, s.y);
    // 문
    const b = this.buildingAt(s.x, s.y);
    if (b) {
      const inner = MAPS[b.to];
      const mx = inner.tiles.findIndex((r) => r.includes('X'));
      const ix = inner.tiles[mx].indexOf('X');
      s.back.push({ map: s.map, x: s.x, y: s.y + 1 });
      await this.warp(b.to, ix, mx - 1, 1);
      return;
    }
    // 실내 출구
    if (ch === 'X') {
      const r = s.back.pop() || { map: 'town', x: 4, y: 5 };
      await this.warp(r.map, r.x, r.y, 0);
      return;
    }
    // 트레이너 시야
    for (const n of this.visibleNpcs()) {
      if (!n.trainer || s.flags['tr_' + n.trainer.id]) continue;
      if (this.inSight(n)) {
        await this.trainerSpotted(n);
        return;
      }
    }
    // 야생 포켓몬
    const enc = this.map.enc;
    if (enc && isEncounterTile(ch) && s.party.length && Math.random() < (ch === 'c' ? 1 / 14 : 1 / 9)) {
      const p = rollWild(enc);
      if (p) await this.startBattle({ wild: p, dark: this.map.dark });
    }
  },

  inSight(n) {
    const s = this.state;
    for (let i = 1; i <= 4; i++) {
      const x = n.x + DX[n.dir] * i, y = n.y + DY[n.dir] * i;
      if (x === s.x && y === s.y) return true;
      const ch = this.tileAt(x, y);
      if (ch === null || isSolidTile(ch) || this.npcAt(x, y)) return false;
    }
    return false;
  },

  async trainerSpotted(n) {
    this.balloon = { x: n.x, y: n.y, until: this.tick + 50 };
    await sleep(800);
    this.state.dir = n.dir ^ 1;
    await this.trainerBattle(n);
  },

  async trainerBattle(n) {
    await sayAll(n.say || []);
    const r = await this.startBattle({ trainer: { ...n.trainer, lose: n.lose }, dark: this.map.dark });
    if (r === 'win') {
      this.state.flags['tr_' + n.trainer.id] = true;
      if (n.trainer.badge && !this.state.badges.includes(n.trainer.badge)) {
        this.state.badges.push(n.trainer.badge);
        await say(`${this.state.name}은(는) ${n.trainer.badge}를 받았다!`);
        if (this.state.badges.length >= 2) await say('축하해! 지금 만들어진 체육관은 모두 정복했어. 도감 151마리 완성에 도전해 보자!');
      }
      this.save();
    }
  },

  async startBattle(opts) {
    this.busy = true;
    await flash();
    const battle = new Battle(this, opts);
    const r = await battle.run();
    clearUI();
    if (r === 'lose') {
      await fade(true);
      this.setScreen('field');
      const s = this.state;
      s.money = Math.floor(s.money / 2);
      for (const p of s.party) healMon(p);
      const h = s.heal;
      s.map = h.map;
      s.x = h.x;
      s.y = h.y;
      s.dir = 1;
      s.back = h.back ? [...h.back] : [];
      this.resetFollower();
      await fade(false);
      await say('포켓몬들을 회복시켰다. 다시 힘내자!');
    } else {
      this.setScreen('field');
      await this.checkEvolutions();
    }
    this.save();
    this.busy = false;
    return r;
  },

  async checkEvolutions() {
    for (const p of this.state.party) {
      if (!p.leveled) continue;
      delete p.leveled;
      const to = p.hp > 0 && evolutionTarget(p);
      if (!to) continue;
      await preload([to]);
      const before = monName(p);
      const box = panel(`<div class="evo"><canvas width="96" height="96"></canvas></div>`, 'dim');
      const c = box.querySelector('canvas').getContext('2d');
      c.imageSmoothingEnabled = false;
      let cur = p.id, stop = false;
      const loop = () => {
        if (stop) return;
        c.clearRect(0, 0, 96, 96);
        const a = monAssets(cur);
        drawMon(c, a.Idle, a.info.Idle, 0, frameIndex(a.info.Idle.d, this.tick), 48, 52, 2);
        requestAnimationFrame(loop);
      };
      loop();
      await say(`어라…!? ${before}의 모습이…!`);
      for (let i = 0; i < 10; i++) {
        cur = i % 2 ? to : p.id;
        await sleep(300 - i * 20);
      }
      cur = to;
      evolve(p, to);
      this.caught(p);
      await say(`축하합니다! ${before}은(는) ${DEX[to].species}(으)로 진화했다!`);
      stop = true;
      box.remove();
    }
  },

  async learnMove(p, moveId) {
    const mv = MOVES[moveId];
    if (p.moves.length < 4) {
      p.moves.push({ id: moveId, pp: mv.pp });
      await say(`${monName(p)}은(는) 새로 ${mv.name}을(를) 배웠다!`);
      return;
    }
    await say(`${monName(p)}은(는) ${mv.name}을(를) 배우고 싶어 한다…`);
    if (!(await yesNo(`다른 기술을 잊게 하고 ${mv.name}을(를) 배우게 할까?`))) {
      await say(`${monName(p)}은(는) ${mv.name}을(를) 배우지 않았다.`);
      return;
    }
    const i = await choose(p.moves, { title: '잊게 할 기술', render: (m) => moveRow(m) });
    if (i < 0) {
      await say(`${monName(p)}은(는) ${mv.name}을(를) 배우지 않았다.`);
      return;
    }
    const old = MOVES[p.moves[i].id].name;
    p.moves[i] = { id: moveId, pp: mv.pp };
    await say(`1, 2, 짠! ${monName(p)}은(는) ${old}을(를) 깨끗이 잊었다!`);
    await say(`그리고… ${mv.name}을(를) 배웠다!`);
  },

  async applyItem(id, p) {
    const it = ITEMS[id], bag = this.state.bag;
    if (it.revive) {
      if (p.hp > 0) return say('효과가 없을 것 같다.').then(() => false);
      p.hp = Math.floor(p.maxhp / 2);
      p.status = null;
    } else if (it.heal) {
      if (p.hp <= 0 || p.hp >= p.maxhp) return say('효과가 없을 것 같다.').then(() => false);
      const before = p.hp;
      p.hp = Math.min(p.maxhp, p.hp + it.heal);
      bag[id]--;
      await say(`${monName(p)}의 HP가 ${p.hp - before} 회복되었다!`);
      return true;
    } else if (it.cure) {
      if (!p.status || p.hp <= 0) return say('효과가 없을 것 같다.').then(() => false);
      p.status = null;
    } else return false;
    bag[id]--;
    await say(`${monName(p)}에게 ${it.name}을(를) 사용했다!`);
    return true;
  },

  // ---- 상호작용 ----
  async interact() {
    const s = this.state;
    let tx = s.x + DX[s.dir], ty = s.y + DY[s.dir];
    if (this.tileAt(tx, ty) === 'K') {
      tx += DX[s.dir];
      ty += DY[s.dir];
    }
    const sign = this.map.signs && this.map.signs[`${tx},${ty}`];
    if (sign) return say(sign);
    const n = this.npcAt(tx, ty);
    if (!n) return;
    if (!n.mon && !n.pc && !n.faceFrom) n.dir = s.dir ^ 1;
    if (n.trainer) {
      if (s.flags['tr_' + n.trainer.id]) return say(n.lose || '…');
      return this.trainerBattle(n);
    }
    if (n.legend) {
      await sayAll(n.say);
      await preload([n.mon]);
      const r = await this.startBattle({ wild: makeMon(n.mon, n.legend.lv), legend: n.legend, dark: this.map.dark });
      if (r === 'win' || r === 'caught') s.flags['legend_' + n.legend.id] = true;
      if (r === 'win') await say('사라져 버렸다…');
      return;
    }
    if (n.action) return ACTIONS[n.action](n);
    if (n.say) return sayAll(n.say);
  },

  // ---- 메뉴 ----
  async startMenu() {
    const items = ['포켓몬', '도감', '가방', '트레이너', '저장', '닫기'];
    let last = 0;
    for (;;) {
      const c = await choose(items, { cls: 'start', start: last });
      last = c;
      if (c < 0 || c === 5) return;
      if (c === 0) await this.partyMenu({});
      if (c === 1) await this.dexMenu();
      if (c === 2) await this.bagMenu();
      if (c === 3) await this.trainerCard();
      if (c === 4) {
        await say(this.save() ? `${this.state.name}은(는) 레포트에 확실히 기록했다!` : '저장에 실패했다…');
      }
    }
  },

  // 파티 화면. 고른 인덱스 반환 (취소 -1)
  async partyMenu({ battle = false, force = false, title, current } = {}) {
    const party = this.state.party;
    for (;;) {
      const i = await choose(party, {
        cls: 'party',
        title: title || '포켓몬',
        cancel: !force,
        render: (p, idx) => partyRow(p, idx === current),
      });
      if (i < 0) return -1;
      if (battle) {
        if (title) return i;
        const c = await choose(['교체한다', '상태를 본다'], { cls: 'small right' });
        if (c === 0) return i;
        if (c === 1) await this.summary(party[i]);
        continue;
      }
      const opts = ['상태를 본다', '순서를 바꾼다', ...this.usableFieldItems().map((k) => `${ITEMS[k].name} 사용`)];
      const c = await choose(opts, { cls: 'small right' });
      if (c === 0) await this.summary(party[i]);
      if (c === 1) {
        const j = await choose(party, { cls: 'party', title: '어느 포켓몬과 바꿀까?', render: (p, idx) => partyRow(p, idx === i) });
        if (j >= 0 && j !== i) [party[i], party[j]] = [party[j], party[i]];
        this.resetFollower();
      }
      if (c >= 2) await this.applyItem(this.usableFieldItems()[c - 2], party[i]);
    }
  },

  usableFieldItems() {
    const bag = this.state.bag;
    return Object.keys(bag).filter((k) => bag[k] > 0 && !ITEMS[k].ball);
  },

  async summary(p) {
    const d = DEX[p.id];
    const names = ['HP', '공격', '방어', '특공', '특방', '스피드'];
    const nextExp = (p.lv + 1) ** 3 - p.exp;
    const box = panel(`
      <div class="summary">
        <div class="sum-head">
          <img class="portrait big" src="${monAssets(p.id).portrait}" alt="">
          <div>
            <div class="sum-name">No.${d.id} ${monName(p)} <span class="lv">Lv${p.lv}</span></div>
            <div>${d.types.map(typeTag).join('')} ${p.status ? `<span class="st st-${p.status}">${STATUS[p.status]}</span>` : ''}</div>
            <div class="small-text">다음 레벨까지 ${p.lv >= 100 ? '-' : nextExp} EXP</div>
          </div>
        </div>
        <table class="stats">${p.stats.map((v, i) => `<tr><td>${names[i]}</td><td>${i === 0 ? `${p.hp}/${v}` : v}</td><td><div class="statbar"><div style="width:${Math.min(100, v / 2.5)}%"></div></div></td></tr>`).join('')}</table>
        <div class="sum-moves">${p.moves.map((m) => `<div class="sum-move">${moveRow(m)}</div>`).join('')}</div>
        <div class="hint">A / B 닫기</div>
      </div>`);
    box.onclick = () => input.held.add('_');
    await Promise.race([waitKey(), new Promise((r) => box.addEventListener('click', r))]);
    box.remove();
  },

  async bagMenu() {
    for (;;) {
      const bag = this.state.bag;
      const ids = Object.keys(bag).filter((k) => bag[k] > 0);
      if (!ids.length) return say('가방이 비어 있다.');
      const i = await choose(ids, {
        title: `가방 · ${this.state.money.toLocaleString()}원`,
        cls: 'bag',
        render: (k) => `${ITEMS[k].name}<span class="cnt">×${bag[k]}</span><div class="desc">${ITEMS[k].desc}</div>`,
      });
      if (i < 0) return;
      const id = ids[i];
      if (ITEMS[id].ball) {
        await say('야생 포켓몬과 싸울 때 던질 수 있다.');
        continue;
      }
      const t = await this.partyMenu({ title: `${ITEMS[id].name}을(를) 누구에게?` });
      if (t >= 0) await this.applyItem(id, this.state.party[t]);
    }
  },

  async dexMenu() {
    const s = this.state;
    const cells = [];
    for (let id = 1; id <= 151; id++) {
      const seen = s.seen.includes(id), got = s.caught.includes(id);
      cells.push(`<div class="dex-cell ${got ? 'got' : seen ? 'seen' : ''}" data-id="${id}">
        ${seen ? `<img src="${monAssets(id).portrait}" alt="" loading="lazy">` : '<div class="unk">?</div>'}
        <div class="dex-no">${String(id).padStart(3, '0')}</div>
        <div class="dex-name">${seen ? DEX[id].species : '???'}</div></div>`);
    }
    const box = panel(`<div class="dex">
      <div class="dex-head">도감 · 발견 ${s.seen.length} / 잡음 ${s.caught.length} / 151</div>
      <div class="dex-grid">${cells.join('')}</div>
      <div class="menu-back">← 닫기</div></div>`);
    const grid = box.querySelector('.dex-grid');
    const off = input.capture((k) => {
      if (k === 'up') grid.scrollTop -= 60;
      if (k === 'down') grid.scrollTop += 60;
      if (k === 'b' || k === 'a') close();
    });
    let close;
    await new Promise((r) => {
      close = r;
      box.querySelector('.menu-back').onclick = r;
    });
    off();
    box.remove();
  },

  async trainerCard() {
    const s = this.state;
    const mins = Math.floor(s.playTime / 60);
    await say(`${s.name} · 소지금 ${s.money.toLocaleString()}원 · 도감 ${s.caught.length}/151 · 배지 ${s.badges.length}개${s.badges.length ? ` (${s.badges.join(', ')})` : ''} · 플레이 ${Math.floor(mins / 60)}시간 ${mins % 60}분`);
  },

  async pcMenu() {
    const s = this.state;
    for (;;) {
      const c = await choose(['포켓몬 맡기기', '포켓몬 꺼내기', '그만두기'], { title: 'PC 박스', cls: 'small' });
      if (c < 0 || c === 2) return;
      if (c === 0) {
        if (s.party.length <= 1) {
          await say('마지막 포켓몬은 맡길 수 없다!');
          continue;
        }
        const i = await choose(s.party, { cls: 'party', title: '맡길 포켓몬', render: (p) => partyRow(p) });
        if (i >= 0) {
          const [p] = s.party.splice(i, 1);
          healMon(p);
          s.box.push(p);
          await say(`${monName(p)}을(를) 박스에 맡겼다.`);
          this.resetFollower();
        }
      } else {
        if (!s.box.length) {
          await say('박스가 비어 있다.');
          continue;
        }
        if (s.party.length >= 6) {
          await say('지닌 포켓몬이 가득 찼다!');
          continue;
        }
        const i = await choose(s.box, { cls: 'party', title: `박스 (${s.box.length}마리)`, render: (p) => partyRow(p) });
        if (i >= 0) {
          const [p] = s.box.splice(i, 1);
          s.party.push(p);
          await say(`${monName(p)}을(를) 데려왔다.`);
        }
      }
    }
  },

  async shop() {
    const s = this.state;
    const stock = ['pokeball', 'potion', 'fullheal'];
    if (s.badges.length >= 1) stock.splice(1, 0, 'greatball'), stock.push('superpotion', 'revive');
    if (s.badges.length >= 2) stock.splice(2, 0, 'ultraball'), stock.push('hyperpotion');
    for (;;) {
      const i = await choose(stock, {
        title: `구입 · 소지금 ${s.money.toLocaleString()}원`,
        cls: 'bag',
        render: (k) => `${ITEMS[k].name}<span class="cnt">${ITEMS[k].price}원</span><div class="desc">${ITEMS[k].desc}</div>`,
      });
      if (i < 0) return;
      const id = stock[i], price = ITEMS[id].price;
      const qs = [1, 5, 10].filter((q) => q * price <= s.money);
      if (!qs.length) {
        await say('돈이 모자란다!');
        continue;
      }
      const q = await choose(qs.map((n) => `${n}개 · ${(n * price).toLocaleString()}원`), { cls: 'small right' });
      if (q < 0) continue;
      const n = qs[q];
      s.money -= n * price;
      s.bag[id] = (s.bag[id] || 0) + n;
      await say(`${ITEMS[id].name}을(를) ${n}개 샀다!`);
      if (id === 'pokeball' && n >= 10) {
        s.bag.greatball = (s.bag.greatball || 0) + 1;
        await say('덤으로 수퍼볼을 하나 드릴게요!');
      }
    }
  },
};

// ---- NPC 행동 ----
const ACTIONS = {
  async mom() {
    if (!game.state.flags.starter) return sayAll(['일어났구나! 박사님이 너를 찾으시던데?', '연구소는 집을 나가서 오른쪽에 있단다.']);
    await say('잘 다녀오렴! 조금 쉬었다 가렴.');
    for (const p of game.state.party) healMon(p);
    game.state.heal = { map: 'home', x: 4, y: 3, back: [{ map: 'town', x: 4, y: 5 }] };
    await say('포켓몬들이 기운을 되찾았다!');
  },
  async prof() {
    const f = game.state.flags;
    if (!f.starter) {
      return sayAll([
        '오, 왔구나! 나는 포켓몬을 연구하는 나무 박사란다.',
        '이 세계에는 포켓몬이라는 신기한 생물이 살고 있지.',
        '탁자 위의 세 마리 중에서 하나를 너에게 주마. 가까이 가서 골라 보렴!',
      ]);
    }
    if (!f.dexGiven) {
      f.dexGiven = true;
      game.state.bag.pokeball = (game.state.bag.pokeball || 0) + 5;
      await sayAll([
        '이 도감에 151마리 포켓몬의 기록을 모아 주지 않겠니?',
        `${game.state.name}은(는) 몬스터볼 5개를 받았다!`,
        '북쪽 1번도로 수풀에서 야생 포켓몬을 잡을 수 있단다. 힘내렴!',
      ]);
      return;
    }
    const n = game.state.caught.length;
    await say(`도감은 어떠니? 지금 ${n}마리를 잡았구나. ${n >= 151 ? '대단해! 도감이 완성됐어!' : n >= 50 ? '훌륭해!' : '그 기세로 계속해 보렴!'}`);
  },
  async starter(n) {
    const d = DEX[n.starter];
    const desc = { 1: '풀 타입', 4: '불꽃 타입', 7: '물 타입' }[n.starter];
    if (!(await yesNo(`${desc} 포켓몬 ${d.species}! 이 포켓몬으로 할까?`))) return;
    const p = makeMon(n.starter, STARTER_LV);
    game.state.flags.starter = n.starter;
    await game.addMon(p);
    await say(`${game.state.name}은(는) 박사님에게서 ${d.species}을(를) 받았다!`);
    game.resetFollower();
    await ACTIONS.prof();
  },
  async heal() {
    const s = game.state;
    await say('어서 오세요! 포켓몬센터입니다.');
    if (!(await yesNo('포켓몬을 회복시켜 드릴까요?'))) return say('또 오세요!');
    await fade(true, 300);
    for (const p of s.party) healMon(p);
    await sleep(400);
    await fade(false, 300);
    s.heal = { map: s.map, x: s.x, y: s.y, back: [...s.back] };
    game.save();
    await say('오래 기다리셨습니다! 맡기신 포켓몬은 모두 건강해졌어요. 또 오세요!');
  },
  pc: () => game.pcMenu(),
  async shop() {
    await say('어서 오세요! 무엇을 드릴까요?');
    await game.shop();
    await say('감사합니다!');
  },
};

// ---- 야생 출현 ----
const minLevel = {};
function computeMinLevels() {
  for (const m of DEX) if (m) minLevel[m.id] ??= 1;
  for (const m of DEX) {
    if (!m || !m.evo) continue;
    for (const e of m.evo) minLevel[e.to] = Math.max(minLevel[m.id], e.lv);
  }
}
const STARTER_LINES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

function rollWild(enc) {
  const pool = [];
  for (const m of DEX) {
    if (!m || m.legend || !enc.habs.includes(m.hab)) continue;
    const ml = minLevel[m.id];
    if (ml > enc.max) continue;
    let w = ml <= 1 ? 10 : ml <= 20 ? 4 : 1;
    if (STARTER_LINES.has(m.id)) w = 0.5;
    if (m.catch <= 45 && ml <= 1) w = Math.min(w, 3);
    pool.push([m, w]);
  }
  if (!pool.length) return null;
  let r = Math.random() * pool.reduce((a, [, w]) => a + w, 0);
  let pick = pool[0][0];
  for (const [m, w] of pool) {
    r -= w;
    if (r <= 0) {
      pick = m;
      break;
    }
  }
  const lo = Math.max(enc.min, minLevel[pick.id]);
  const lv = lo + Math.floor(Math.random() * (Math.max(lo, enc.max) - lo + 1));
  return makeMon(pick.id, lv);
}

// ---- 표시 도우미 ----
const typeTag = (t) => `<span class="type" style="background:${TYPES[t][1]}">${TYPES[t][0]}</span>`;
function moveRow(m) {
  const mv = MOVES[m.id];
  return `<span class="mv-name">${mv.name}</span>${typeTag(mv.type)}<span class="pp">${mv.power ? '위력 ' + mv.power + ' · ' : ''}PP ${m.pp}/${mv.pp}</span>`;
}
function partyRow(p, active) {
  const pct = Math.max(0, p.hp / p.maxhp) * 100;
  const col = pct > 50 ? '#48c048' : pct > 20 ? '#e8c020' : '#e04030';
  return `<div class="prow ${p.hp <= 0 ? 'fainted' : ''} ${active ? 'active' : ''}">
    <img class="portrait" src="${monAssets(p.id).portrait}" alt="">
    <div class="prow-body">
      <div>${monName(p)} <span class="lv">Lv${p.lv}</span> ${p.status ? `<span class="st st-${p.status}">${STATUS[p.status]}</span>` : ''}</div>
      <div class="hp"><span>HP</span><div class="bar"><div style="width:${pct}%;background:${col}"></div></div></div>
      <div class="hpnum">${Math.max(0, p.hp)} / ${p.maxhp}</div>
    </div></div>`;
}

let bumpT = 0;
function bump() {
  bumpT = 6;
}

function fade(toBlack, ms = 250) {
  const f = document.getElementById('fade');
  f.style.transitionDuration = ms + 'ms';
  f.style.opacity = toBlack ? '1' : '0';
  return sleep(ms + 20);
}
async function flash() {
  const f = document.getElementById('fade');
  for (let i = 0; i < 3; i++) {
    f.style.transitionDuration = '80ms';
    f.style.opacity = '1';
    await sleep(100);
    f.style.opacity = '0';
    await sleep(100);
  }
}
let mapNameTimer;
function showMapName(name) {
  const e = document.getElementById('mapname');
  e.textContent = name;
  e.classList.add('show');
  clearTimeout(mapNameTimer);
  mapNameTimer = setTimeout(() => e.classList.remove('show'), 1600);
}

// ---- 그리기 ----
function drawField() {
  const s = game.state, map = game.map;
  const m = game.move;
  const prog = m ? m.t / 8 : 1;
  const px = m ? (m.fromX + (s.x - m.fromX) * prog) * TS : s.x * TS;
  const py = m ? (m.fromY + (s.y - m.fromY) * prog) * TS : s.y * TS;
  let camX = px + TS / 2 - VW / 2, camY = py + TS / 2 - VH / 2;
  const mw = map.w * TS, mh = map.h * TS;
  camX = mw <= VW ? (mw - VW) / 2 : Math.max(0, Math.min(mw - VW, camX));
  camY = mh <= VH ? (mh - VH) / 2 : Math.max(0, Math.min(mh - VH, camY));
  camX = Math.round(camX);
  camY = Math.round(camY);
  if (bumpT > 0) bumpT--;

  g.fillStyle = '#000';
  g.fillRect(0, 0, VW, VH);
  const x0 = Math.floor(camX / TS), y0 = Math.floor(camY / TS);
  for (let y = y0; y <= y0 + Math.ceil(VH / TS); y++) {
    for (let x = x0; x <= x0 + Math.ceil(VW / TS); x++) {
      const ch = game.tileAt(x, y);
      if (ch === null) continue;
      drawTile(g, ch, x, y, x * TS - camX, y * TS - camY, map.inside, game.tick);
    }
  }
  for (const b of map.buildings || []) drawBuilding(g, b, b.x * TS - camX, b.y * TS - camY);

  // 엔티티를 y순으로
  const ents = [];
  for (const n of game.visibleNpcs()) ents.push({ y: n.y * TS, draw: () => drawNpc(n, n.x * TS - camX, n.y * TS - camY) });
  const f = game.follower;
  const lead = s.party.find((p) => p.hp > 0);
  if (lead && f && !f.hidden && !map.inside) {
    const fx = f.fromX !== null && m ? (f.fromX + (f.x - f.fromX) * prog) * TS : f.x * TS;
    const fy = f.fromY !== null && m ? (f.fromY + (f.y - f.fromY) * prog) * TS : f.y * TS;
    ents.push({
      y: fy - 1,
      draw: () => {
        const a = monAssets(lead.id);
        const anim = m ? 'Walk' : 'Idle';
        drawMon(g, a[anim], a.info[anim], DIR_ROW[f.dir], frameIndex(a.info[anim].d, game.tick), fx - camX + 8, fy - camY + 6);
      },
    });
  }
  const step = m ? (Math.floor(game.tick / 8) % 4) : 0;
  ents.push({ y: py, draw: () => drawPerson(g, PLAYER_LOOK, s.dir, step, Math.round(px - camX), Math.round(py - camY) - (bumpT ? 1 : 0)) });
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) e.draw();

  // 수풀 위에서는 발이 가려진다
  const ch = game.tileAt(s.x, s.y);
  if (ch === ',' && !m) drawTile(g, ',', s.x, s.y, s.x * TS - camX, s.y * TS - camY + 10, false, 0) ;

  if (game.balloon && game.tick < game.balloon.until) {
    const bx = game.balloon.x * TS - camX + 4, by = game.balloon.y * TS - camY - 22;
    g.fillStyle = '#fff';
    g.fillRect(bx, by, 9, 11);
    g.strokeStyle = '#000';
    g.strokeRect(bx + 0.5, by + 0.5, 8, 10);
    g.fillStyle = '#e02020';
    g.fillRect(bx + 3, by + 2, 3, 5);
    g.fillRect(bx + 3, by + 8, 3, 2);
  }

  if (map.dark) {
    const grd = g.createRadialGradient(px - camX + 8, py - camY + 8, 20, px - camX + 8, py - camY + 8, 90);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = grd;
    g.fillRect(0, 0, VW, VH);
  }
}

function drawNpc(n, sx, sy) {
  if (n.pc) return drawPC(g, sx, sy);
  if (n.mon) {
    const a = monAssets(n.mon);
    const big = !!n.legend;
    drawMon(g, a.Idle, a.info.Idle, DIR_ROW[n.dir], frameIndex(a.info.Idle.d, game.tick + n.x * 7), sx + 8, sy + (n.action === 'starter' ? 2 : 6), big ? 1 : 1);
    return;
  }
  drawPerson(g, n.look, n.dir, 0, sx, sy);
}

// ---- 메인 루프 ----
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) {
    update();
    acc -= 1000 / 60;
  }
  if (game.screen === 'field') drawField();
  else if (game.screen === 'battle' && battleView.active) battleView.draw(g, game.tick);
  requestAnimationFrame(frame);
}

function update() {
  game.tick++;
  if (game.state && game.tick % 60 === 0) game.state.playTime++;
  if (game.screen !== 'field' || !game.state) return;
  if (game.turnDelay > 0) game.turnDelay--;
  const m = game.move;
  if (m) {
    m.t++;
    if (m.t >= 8) {
      game.move = null;
      game.follower.fromX = game.follower.fromY = null;
      game.busy = true;
      game.afterStep().finally(() => {
        game.busy = false;
      });
    }
    return;
  }
  if (game.busy || input.captured) return;
  for (const [k, d] of Object.entries(KEY_DIR)) {
    if (input.held.has(k)) {
      game.tryMove(d);
      break;
    }
  }
}

input.onPress = async (k) => {
  if (game.screen !== 'field' || game.busy || game.move) return;
  if (k === 'a') {
    game.busy = true;
    try {
      await game.interact();
    } finally {
      game.busy = false;
    }
  } else if (k === 'start' || k === 'b') {
    game.busy = true;
    try {
      await game.startMenu();
    } finally {
      game.busy = false;
    }
  } else if (KEY_DIR[k] !== undefined && game.state.dir !== KEY_DIR[k]) {
    game.state.dir = KEY_DIR[k];
    game.turnDelay = 5;
  }
};

// ---- 타이틀 ----
async function title() {
  game.setScreen('title');
  const saved = game.load();
  const box = panel(`<div class="title">
      <div class="logo">포켓몬<br><span>새싹 모험</span></div>
      <div class="title-sub">비공식 팬게임 · 1세대 151마리</div>
      <canvas class="title-mons" width="240" height="64"></canvas>
    </div>`, 'title-panel');
  const c = box.querySelector('canvas').getContext('2d');
  c.imageSmoothingEnabled = false;
  const showcase = [1, 4, 7, 25];
  await preload(showcase);
  let alive = true;
  (function loop() {
    if (!alive) return;
    c.clearRect(0, 0, 240, 64);
    showcase.forEach((id, i) => {
      const a = monAssets(id);
      drawMon(c, a.Walk, a.info.Walk, 0, frameIndex(a.info.Walk.d, game.tick + i * 9), 36 + i * 56, 34, 1.5);
    });
    requestAnimationFrame(loop);
  })();
  const items = saved ? ['이어서 하기', '처음부터 하기', '크레딧'] : ['처음부터 하기', '크레딧'];
  for (;;) {
    const i = await choose(items, { cls: 'title-menu', cancel: false });
    const pick = items[i];
    if (pick === '크레딧') {
      await sayAll([
        '몬스터 그림: PMD Sprite Repository (sprites.pmdcollab.org) — 대부분 『포켓몬 불가사의 던전』(Spike Chunsoft) 원본이며 일부는 커뮤니티 작가 작품입니다. 자세한 내용은 CREDITS.md 참고.',
        '글꼴: Galmuri (SIL Open Font License).',
        'Pokémon은 Nintendo / Creatures / GAME FREAK의 상표입니다. 이 게임은 비공식·비상업 팬게임입니다.',
      ]);
      continue;
    }
    if (pick === '처음부터 하기' && saved && !(await yesNo('저장된 기록이 지워집니다. 정말 처음부터 할까요?'))) continue;
    alive = false;
    box.remove();
    if (pick === '이어서 하기') {
      game.state = saved;
      game.state.party.forEach((p) => delete p.leveled);
    } else {
      const name = await askName();
      game.state = newState(name);
    }
    break;
  }
  await preload(game.state.party.map((p) => p.id));
  game.resetFollower();
  game.setScreen('field');
  showMapName(game.map.name);
  await fade(false);
  if (!game.state.flags.intro) {
    game.state.flags.intro = true;
    game.busy = true;
    await sayAll([`${game.state.name}, 드디어 오늘이구나!`, '연구소의 나무 박사님께 가 보렴. 첫 포켓몬을 주실 거야.']);
    game.busy = false;
  }
}

function askName() {
  return new Promise((resolve) => {
    const box = panel(`<form class="name-form">
      <div>당신의 이름은?</div>
      <input maxlength="6" value="레드" autocomplete="off">
      <button>결정</button></form>`, 'dim');
    const f = box.querySelector('form');
    const inp = f.querySelector('input');
    const off = input.capture(() => {});
    f.onsubmit = (e) => {
      e.preventDefault();
      const v = inp.value.trim() || '레드';
      off();
      box.remove();
      resolve(v);
    };
    inp.focus();
    inp.select();
  });
}

// ---- 시작 ----
async function boot() {
  bindTouch(document);
  const monsters = await loadData();
  setDex(monsters);
  computeMinLevels();
  requestAnimationFrame(frame);
  document.getElementById('loading').remove();
  await title();
}

window.__game = game; // 디버그용
boot();
