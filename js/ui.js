// DOM으로 그리는 대화창과 메뉴. 모든 함수는 Promise를 돌려준다.
import { input } from './input.js';

const layer = () => document.getElementById('ui');

let typing = null;

export function clearUI() {
  layer().innerHTML = '';
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// 대화창에 글자를 하나씩 찍고 A/B 입력을 기다린다
export function say(text, { keep = false, auto = 0 } = {}) {
  return new Promise((resolve) => {
    let box = layer().querySelector('.dialog');
    if (!box) {
      box = el('div', 'dialog');
      layer().appendChild(box);
    }
    box.innerHTML = '';
    const p = el('div', 'text');
    const arrow = el('div', 'arrow', '▼');
    box.append(p, arrow);
    let i = 0;
    const chars = [...text];
    let done = false;
    clearInterval(typing);
    typing = setInterval(() => {
      i += 2;
      p.textContent = chars.slice(0, i).join('');
      if (i >= chars.length) finishType();
    }, 22);
    const finishType = () => {
      clearInterval(typing);
      p.textContent = text;
      done = true;
      arrow.style.visibility = auto ? 'hidden' : 'visible';
      if (auto) setTimeout(finish, auto);
    };
    const finish = () => {
      off();
      if (!keep) box.remove();
      resolve();
    };
    const off = input.capture((k) => {
      if (k !== 'a' && k !== 'b') return;
      if (!done) finishType();
      else if (!auto) finish();
    });
    box.onclick = () => (done ? !auto && finish() : finishType());
  });
}

export async function sayAll(lines) {
  for (const l of lines) await say(l);
}

// 선택지 메뉴. 고른 인덱스, 취소하면 -1
// opts: { cls, title, cancel: true, start, render(item, i) }
export function choose(items, opts = {}) {
  return new Promise((resolve) => {
    const menu = el('div', 'menu ' + (opts.cls || ''));
    if (opts.title) menu.appendChild(el('div', 'menu-title', opts.title));
    const list = el('div', 'menu-list');
    menu.appendChild(list);
    const rows = items.map((it, i) => {
      const r = el('div', 'menu-item' + (it && it.disabled ? ' disabled' : ''));
      r.innerHTML = opts.render ? opts.render(it, i) : typeof it === 'string' ? it : it.label;
      r.onclick = () => {
        if (sel === i) pick();
        else set(i);
      };
      list.appendChild(r);
      return r;
    });
    let sel = Math.min(opts.start || 0, items.length - 1);
    const cols = opts.cols || 1;
    const set = (i) => {
      sel = (i + items.length) % items.length;
      rows.forEach((r, j) => r.classList.toggle('sel', j === sel));
      rows[sel].scrollIntoView({ block: 'nearest' });
      if (opts.onMove) opts.onMove(sel);
    };
    const close = (v) => {
      off();
      menu.remove();
      resolve(v);
    };
    const pick = () => {
      const it = items[sel];
      if (it && it.disabled) return;
      close(sel);
    };
    if (opts.cancel !== false) {
      const back = el('div', 'menu-back', '← 뒤로');
      back.onclick = () => close(-1);
      menu.appendChild(back);
    }
    const off = input.capture((k) => {
      if (k === 'up') set(sel - cols);
      else if (k === 'down') set(sel + cols);
      else if (k === 'left' && cols > 1) set(sel - 1);
      else if (k === 'right' && cols > 1) set(sel + 1);
      else if (k === 'a') pick();
      else if (k === 'b' && opts.cancel !== false) close(-1);
    });
    layer().appendChild(menu);
    set(sel);
  });
}

export const yesNo = async (q) => {
  await say(q, { keep: true });
  const r = await choose(['예', '아니요'], { cls: 'small right', cancel: false });
  layer().querySelector('.dialog')?.remove();
  return r === 0;
};

// 화면 전체를 덮는 패널 (파티, 도감 등). 닫힐 때 resolve
export function panel(html, cls = '') {
  const p = el('div', 'panel ' + cls, html);
  layer().appendChild(p);
  return p;
}

export function waitKey(keys = ['a', 'b']) {
  return new Promise((resolve) => {
    const off = input.capture((k) => {
      if (keys.includes(k)) {
        off();
        resolve(k);
      }
    });
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
