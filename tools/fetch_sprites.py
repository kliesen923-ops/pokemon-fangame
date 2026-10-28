#!/usr/bin/env python3
"""PMD Collab SpriteCollab(https://sprites.pmdcollab.org/)에서 스프라이트를 내려받는다.

커뮤니티 제작물은 CC BY-NC 4.0 (비상업 + 크레딧 표기).
CHUNSOFT 크레딧은 공식 게임 원본이라 CC 라이선스 대상이 아니다. 크레딧에 그대로 표시한다.

  python3 tools/fetch_sprites.py            # data/monsters.json 목록 전체
결과: assets/pmd/<dex>/... , assets/pmd/anims.json, CREDITS.md
"""
import json, os, urllib.request, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

BASE = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "pmd")
ANIMS = ["Walk", "Idle", "Attack", "Hurt"]
PORTRAITS = ["Normal"]


def get(path):
    with urllib.request.urlopen(f"{BASE}/{path}", timeout=60) as r:
        return r.read()


def credits(kind, dex, names, used):
    """credits.txt를 읽어 사용하는 파일에 기여한 작가 목록을 돌려준다."""
    authors = []
    for line in get(f"{kind}/{dex}/credits.txt").decode().splitlines():
        cols = line.split("\t")
        if len(cols) < 5:
            continue
        who, files = cols[1], set(cols[4].split(","))
        if not files & used:
            continue
        name = names.get(who, (who, ""))
        if name not in authors:
            authors.append(name)
    return authors


def main():
    names = {}
    for line in get("credit_names.txt").decode().splitlines()[1:]:
        cols = line.split("\t")
        if len(cols) >= 2:
            names[cols[1]] = (cols[0], cols[2] if len(cols) > 2 else "")
    monsters = json.load(open(os.path.join(ROOT, "data", "monsters.json"), encoding="utf-8"))
    def fetch(m):
        dex = m["dex"]
        d = os.path.join(OUT, dex)
        os.makedirs(d, exist_ok=True)
        root = ET.fromstring(get(f"sprite/{dex}/AnimData.xml"))
        table = {a.findtext("Name"): a for a in root.iter("Anim")}
        info = {}
        for name in ANIMS:
            a = table[name]
            while a.find("CopyOf") is not None:
                a = table[a.findtext("CopyOf")]
            src = a.findtext("Name")
            info[name] = {
                "w": int(a.findtext("FrameWidth")),
                "h": int(a.findtext("FrameHeight")),
                "d": [int(x.text) for x in a.iter("Duration")],
                "hit": int(a.findtext("HitFrame") or -1),
            }
            open(os.path.join(d, f"{name}.png"), "wb").write(get(f"sprite/{dex}/{src}-Anim.png"))
        for p in PORTRAITS:
            open(os.path.join(d, f"p_{p}.png"), "wb").write(get(f"portrait/{dex}/{p}.png"))
        sa = credits("sprite", dex, names, set(ANIMS))
        pa = credits("portrait", dex, names, set(PORTRAITS))
        fmt = lambda xs: ", ".join(f"[{n}]({c})" if c.startswith("http") else n for n, c in xs if n)
        print(dex, m["species"], "ok")
        return dex, info, f"| #{dex} | {m['species']} | {fmt(sa)} | {fmt(pa)} |"

    with ThreadPoolExecutor(8) as ex:
        results = list(ex.map(fetch, monsters))
    anims = {dex: info for dex, info, _ in results}
    md = [row for _, _, row in results]
    json.dump(anims, open(os.path.join(OUT, "anims.json"), "w"), separators=(",", ":"))
    with open(os.path.join(ROOT, "CREDITS.md"), "w", encoding="utf-8") as f:
        f.write(
            "# Credits\n\n"
            "몬스터 스프라이트와 초상화는 [PMD Sprite Repository (SpriteCollab)](https://sprites.pmdcollab.org/)"
            "에서 받았습니다. 프레임을 잘라 쓰는 것 외에 수정하지 않았습니다.\n\n"
            "- 작가가 **CHUNSOFT**로 표시된 그림은 『포켓몬 불가사의 던전』 시리즈의 공식 원본으로, "
            "저작권은 Nintendo / Creatures / GAME FREAK / Spike Chunsoft에 있으며 CC 라이선스 대상이 아닙니다.\n"
            "- 그 밖의 작가가 그린 그림은 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 라이선스를 따릅니다.\n"
            "- 이 프로젝트는 비상업 개인 팬게임이며, 어떤 형태로도 판매·후원·광고 수익을 받지 않습니다.\n\n"
            "| No. | 종 | 스프라이트 | 초상화 |\n|---|---|---|---|\n" + "\n".join(md) + "\n\n"
            "Pokémon은 Nintendo / Creatures Inc. / GAME FREAK inc.의 상표입니다. "
            "이 프로젝트는 비공식·비상업 팬게임이며 이들과 관련이 없습니다.\n"
        )


if __name__ == "__main__":
    main()
