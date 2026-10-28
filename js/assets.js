// 스프라이트 이미지와 데이터 로딩
export let ANIMS = {};
const cache = new Map();

export async function loadData() {
  const [anims, monsters] = await Promise.all([
    fetch('assets/pmd/anims.json').then((r) => r.json()),
    fetch('data/monsters.json').then((r) => r.json()),
  ]);
  ANIMS = anims;
  return monsters;
}

const pad = (id) => String(id).padStart(4, '0');

function img(src) {
  const i = new Image();
  i.src = src;
  return i;
}

// 종 번호의 스프라이트 묶음 { info, Walk, Idle, Attack, Hurt, portrait }
export function monAssets(id) {
  const dex = pad(id);
  let a = cache.get(dex);
  if (!a) {
    const base = `assets/pmd/${dex}/`;
    a = { info: ANIMS[dex], portrait: base + 'p_Normal.png' };
    for (const k of ['Walk', 'Idle', 'Attack', 'Hurt']) a[k] = img(base + k + '.png');
    cache.set(dex, a);
  }
  return a;
}

export function preload(ids) {
  return Promise.all(
    ids.flatMap((id) => {
      const a = monAssets(id);
      return ['Walk', 'Idle', 'Attack', 'Hurt'].map((k) => (a[k].complete ? null : new Promise((r) => { a[k].onload = a[k].onerror = r; })));
    }),
  );
}

export const animLength = (id, anim) => monAssets(id).info[anim].d.reduce((a, b) => a + b, 0);
