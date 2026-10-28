// 그래픽: 코드로 그리는 타일·건물·사람, PMD 스프라이트 그리기
export const TS = 16;

const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function px(g, c, x, y, w = 1, h = 1) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

const TILE_CACHE = new Map();
function tileCanvas(key, draw) {
  let c = TILE_CACHE.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = TS;
    draw(c.getContext('2d'));
    TILE_CACHE.set(key, c);
  }
  return c;
}

function grassBase(g, v) {
  px(g, '#78c060', 0, 0, 16, 16);
  const r = (i) => hash(v * 31 + i, i * 7 + v);
  for (let i = 0; i < 6; i++) px(g, '#68b050', Math.floor(r(i) * 15), Math.floor(r(i + 9) * 15), 2, 1);
  for (let i = 0; i < 3; i++) px(g, '#90d070', Math.floor(r(i + 20) * 15), Math.floor(r(i + 30) * 15), 1, 1);
}

const DRAW = {
  '.': (g, v) => grassBase(g, v),
  ',': (g, v) => {
    grassBase(g, v);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const ox = col * 8, oy = row * 8 + 1;
        px(g, '#307830', ox + 0, oy + 2, 8, 5);
        px(g, '#48a040', ox + 1, oy + 0, 1, 3);
        px(g, '#48a040', ox + 3, oy + 1, 1, 2);
        px(g, '#48a040', ox + 5, oy + 0, 1, 3);
        px(g, '#48a040', ox + 7, oy + 1, 1, 2);
        px(g, '#60b858', ox + 2, oy + 3, 1, 2);
        px(g, '#60b858', ox + 6, oy + 3, 1, 2);
      }
    }
  },
  '=': (g, v) => {
    px(g, '#e0c890', 0, 0, 16, 16);
    for (let i = 0; i < 5; i++) px(g, '#c8b078', Math.floor(hash(v, i) * 15), Math.floor(hash(i, v) * 15), 2, 1);
  },
  f: (g, v) => {
    grassBase(g, v);
    const cols = ['#f05050', '#f8e048', '#ffffff', '#f080c0'];
    for (const [x, y] of [[3, 3], [10, 5], [5, 11], [12, 12]]) {
      const c = cols[Math.floor(hash(x + v, y) * 4)];
      px(g, c, x - 1, y, 3, 1);
      px(g, c, x, y - 1, 1, 3);
      px(g, '#f8c030', x, y);
    }
  },
  T: (g, v) => {
    grassBase(g, v);
    px(g, '#704828', 6, 11, 4, 5);
    px(g, '#205828', 1, 1, 14, 11);
    px(g, '#205828', 3, 0, 10, 13);
    px(g, '#307838', 2, 2, 11, 8);
    px(g, '#48a048', 4, 2, 5, 4);
    px(g, '#60b858', 5, 3, 2, 1);
  },
  '~': (g, v) => {
    px(g, '#4880e0', 0, 0, 16, 16);
    px(g, '#78a8f0', (v * 3) % 10, 4, 5, 1);
    px(g, '#78a8f0', (v * 5 + 6) % 10, 11, 5, 1);
  },
  '~2': (g, v) => {
    px(g, '#4880e0', 0, 0, 16, 16);
    px(g, '#78a8f0', ((v * 3) % 10) + 2, 5, 5, 1);
    px(g, '#78a8f0', ((v * 5 + 6) % 10) + 1, 12, 5, 1);
  },
  R: (g, v) => {
    grassBase(g, v);
    px(g, '#606068', 1, 4, 14, 11);
    px(g, '#606068', 3, 2, 10, 14);
    px(g, '#9090a0', 3, 4, 9, 7);
    px(g, '#b0b0c0', 4, 4, 4, 2);
  },
  F: (g, v) => {
    grassBase(g, v);
    px(g, '#a07040', 0, 5, 16, 2);
    px(g, '#a07040', 0, 10, 16, 2);
    px(g, '#805028', 2, 3, 3, 12);
    px(g, '#805028', 11, 3, 3, 12);
  },
  S: (g, v) => {
    grassBase(g, v);
    px(g, '#704828', 7, 9, 2, 6);
    px(g, '#805028', 2, 2, 12, 8);
    px(g, '#d8b070', 3, 3, 10, 6);
    px(g, '#805028', 5, 5, 6, 1);
  },
  c: (g, v) => {
    px(g, '#6a5040', 0, 0, 16, 16);
    for (let i = 0; i < 4; i++) px(g, '#58402f', Math.floor(hash(v, i) * 15), Math.floor(hash(i, v) * 15), 2, 2);
  },
  W: (g, v, inside) => {
    if (inside) {
      px(g, '#e8d8b0', 0, 0, 16, 16);
      px(g, '#c8b088', 0, 12, 16, 4);
      px(g, '#a89068', 0, 15, 16, 1);
    } else {
      px(g, '#3a2a20', 0, 0, 16, 16);
      px(g, '#4a382a', 1, 1, 6, 5);
      px(g, '#4a382a', 9, 8, 6, 6);
    }
  },
  o: (g, v) => {
    px(g, '#d8a868', 0, 0, 16, 16);
    px(g, '#c09050', 0, 7, 16, 1);
    px(g, '#c09050', 0, 15, 16, 1);
    px(g, '#c09050', (v % 2) * 8, 0, 1, 7);
    px(g, '#c09050', ((v + 1) % 2) * 8 + 4, 8, 1, 7);
  },
  K: (g) => {
    px(g, '#a05030', 0, 0, 16, 16);
    px(g, '#d07848', 0, 0, 16, 5);
    px(g, '#803820', 0, 15, 16, 1);
  },
  B: (g) => {
    px(g, '#704020', 0, 0, 16, 16);
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 6; i++) px(g, ['#c04040', '#4060c0', '#40a060', '#d0b040'][(i + r) % 4], 2 + i * 2, 2 + r * 5, 2, 4);
    }
  },
  t: (g) => {
    px(g, '#d8a868', 0, 0, 16, 16);
    px(g, '#905828', 1, 3, 14, 9);
    px(g, '#b07040', 1, 3, 14, 3);
    px(g, '#704020', 2, 12, 2, 3);
    px(g, '#704020', 12, 12, 2, 3);
  },
  X: (g) => {
    px(g, '#d8a868', 0, 0, 16, 16);
    px(g, '#c04848', 2, 3, 12, 10);
    px(g, '#e07070', 3, 4, 10, 8);
  },
};

export function drawTile(g, ch, x, y, sx, sy, inside, t) {
  let key = ch;
  if (ch === '~' && Math.floor(t / 40) % 2) key = '~2';
  const v = Math.floor(hash(x, y) * 4);
  const fn = DRAW[key] || DRAW['.'];
  const base = ch === 'W' && inside ? 'Wi' : key;
  g.drawImage(tileCanvas(base + v, (c) => fn(c, v, inside)), sx, sy);
}

const BUILD = {
  house: { roof: '#c04838', roofD: '#902818', wall: '#f0e0c0' },
  lab: { roof: '#6888b0', roofD: '#486890', wall: '#f0f0f0' },
  center: { roof: '#e04848', roofD: '#a82828', wall: '#ffffff', mark: 'P' },
  mart: { roof: '#4870d0', roofD: '#2850a8', wall: '#f0f0f0', mark: 'M' },
  gym: { roof: '#c08838', roofD: '#906010', wall: '#d8d0c0', mark: 'G' },
};

export function drawBuilding(g, b, sx, sy) {
  const s = BUILD[b.kind];
  const W = b.w * TS, H = b.h * TS;
  const roofH = Math.floor(H * 0.5);
  px(g, 'rgba(0,0,0,0.2)', sx + 3, sy + H - 2, W - 2, 4);
  px(g, s.wall, sx + 1, sy + roofH, W - 2, H - roofH);
  px(g, '#00000022', sx + 1, sy + H - 3, W - 2, 3);
  px(g, s.roofD, sx, sy + 2, W, roofH);
  px(g, s.roof, sx, sy, W, roofH - 1);
  for (let i = 4; i < roofH - 2; i += 4) px(g, s.roofD, sx + 1, sy + i, W - 2, 1);
  // 창문
  const doorX = sx + Math.floor(b.w / 2) * TS;
  for (let wx = sx + 6; wx + 10 < sx + W - 4; wx += 18) {
    if (Math.abs(wx - doorX) < 16) continue;
    px(g, '#6090c0', wx, sy + roofH + 5, 10, 8);
    px(g, '#a0c8f0', wx + 1, sy + roofH + 6, 4, 3);
  }
  // 문
  px(g, '#503018', doorX + 3, sy + H - 13, 10, 13);
  px(g, '#704828', doorX + 4, sy + H - 12, 8, 12);
  if (s.mark) {
    const mx = sx + W / 2 - 6, my = sy + 3;
    px(g, '#ffffff', mx, my, 12, 9);
    g.fillStyle = s.roofD;
    g.font = 'bold 9px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText(s.mark, mx + 6, my);
  }
}

// 사람 (16x20). dir 0 아래 1 위 2 왼쪽 3 오른쪽, step: 걷기 프레임 0~3
export function drawPerson(g, look, dir, step, sx, sy) {
  const skin = '#f8d0a8', hair = look.hair, shirt = look.shirt, pants = '#384068';
  const bob = step % 2 ? 1 : 0;
  const y = sy - 6 + bob;
  px(g, 'rgba(0,0,0,0.25)', sx + 3, sy + 12, 10, 3);
  // 다리
  const legA = step === 1 ? 2 : 0, legB = step === 3 ? 2 : 0;
  px(g, pants, sx + 4, y + 13, 3, 4 - legA);
  px(g, pants, sx + 9, y + 13, 3, 4 - legB);
  px(g, '#202020', sx + 4, y + 17 - legA, 3, 1);
  px(g, '#202020', sx + 9, y + 17 - legB, 3, 1);
  // 몸
  px(g, shirt, sx + 3, y + 8, 10, 6);
  px(g, skin, sx + 2, y + 9, 1, 3);
  px(g, skin, sx + 13, y + 9, 1, 3);
  // 머리
  px(g, skin, sx + 4, y + 1, 8, 7);
  px(g, hair, sx + 3, y, 10, 3);
  if (dir === 1) px(g, hair, sx + 3, y, 10, 7);
  else if (dir === 0) {
    px(g, hair, sx + 3, y + 3, 1, 3);
    px(g, hair, sx + 12, y + 3, 1, 3);
    px(g, '#202020', sx + 6, y + 4, 1, 2);
    px(g, '#202020', sx + 9, y + 4, 1, 2);
  } else {
    const back = dir === 2 ? sx + 9 : sx + 3;
    px(g, hair, back, y + 2, 4, 5);
    px(g, '#202020', dir === 2 ? sx + 5 : sx + 10, y + 4, 1, 2);
  }
}

export function drawPC(g, sx, sy) {
  px(g, '#505868', sx + 2, sy + 1, 12, 14);
  px(g, '#70e0a0', sx + 4, sy + 3, 8, 6);
  px(g, '#303840', sx + 4, sy + 11, 8, 2);
}

// ---- PMD 스프라이트 ----
// PMD 시트의 행 순서: 아래, 오른아래, 오른, 오른위, 위, 왼위, 왼, 왼아래
export const DIR_ROW = [0, 4, 6, 2];

export function frameIndex(durs, tick) {
  const total = durs.reduce((a, b) => a + b, 0);
  let t = tick % total;
  for (let i = 0; i < durs.length; i++) {
    if (t < durs[i]) return i;
    t -= durs[i];
  }
  return 0;
}

// 프레임 중심을 (cx, cy)에 맞춰 그린다
export function drawMon(g, sprite, info, row, frame, cx, cy, scale = 1) {
  if (!sprite || !sprite.complete || !sprite.naturalWidth) return;
  const rows = Math.floor(sprite.naturalHeight / info.h);
  const r = rows >= 8 ? row : 0;
  const w = info.w * scale, h = info.h * scale;
  g.drawImage(sprite, frame * info.w, r * info.h, info.w, info.h, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
}
