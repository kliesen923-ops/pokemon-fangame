// 키보드와 터치 버튼 입력. UI가 입력을 가로챌 수 있도록 capture 스택을 둔다.
const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  z: 'a', Z: 'a', Enter: 'a', ' ': 'a', j: 'a',
  x: 'b', X: 'b', Escape: 'b', Backspace: 'b', k: 'b',
  m: 'start', M: 'start', Shift: 'start',
};

const held = new Set();
const stack = [];

export const input = {
  held,
  // 콜백을 등록하면 해제될 때까지 모든 입력이 그쪽으로 간다
  capture(fn) {
    stack.push(fn);
    return () => {
      const i = stack.indexOf(fn);
      if (i >= 0) stack.splice(i, 1);
    };
  },
  get captured() {
    return stack.length > 0;
  },
  onPress: null, // 필드에서의 입력 처리
};

function press(k) {
  if (stack.length) stack[stack.length - 1](k);
  else if (input.onPress) input.onPress(k);
}

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = KEYMAP[e.key];
  if (!k) return;
  e.preventDefault();
  if (!held.has(k) || ['up', 'down', 'left', 'right'].includes(k)) press(k);
  held.add(k);
});
addEventListener('keyup', (e) => {
  const k = KEYMAP[e.key];
  if (k) held.delete(k);
});
addEventListener('blur', () => held.clear());

// 터치 버튼: data-key 속성. 방향키는 누르고 있으면 계속 걷는다.
export function bindTouch(root) {
  for (const b of root.querySelectorAll('[data-key]')) {
    const k = b.dataset.key;
    let rep = null;
    const down = (e) => {
      e.preventDefault();
      b.classList.add('on');
      held.add(k);
      press(k);
      if (['up', 'down', 'left', 'right'].includes(k)) {
        clearInterval(rep);
        rep = setInterval(() => input.captured && press(k), 180);
      }
    };
    const up = (e) => {
      e.preventDefault();
      b.classList.remove('on');
      held.delete(k);
      clearInterval(rep);
    };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  }
}
