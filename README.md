# 포켓몬 새싹 모험 (비공식 팬게임)

개인 포켓몬 팬게임 프로젝트(비상업, 개인 용도). 폰 브라우저에서 바로 플레이하는 웹 게임입니다.

**플레이:** https://kliesen923-ops.github.io/pokemon-fangame/

- 1세대 151마리, 18타입 상성, 포획·진화·체육관 2곳·트레이너 배틀·도감·자동 저장(브라우저)
- 조작: 화면 십자키/A/B/MENU, PC는 방향키 · Z(결정) · X(취소/메뉴)
- 빌드 과정 없음. 정적 파일만으로 동작 (GitHub Pages)

## 로컬 실행

```bash
python3 -m http.server 8000
```

브라우저에서 http://localhost:8000 을 엽니다. (ES 모듈이라 파일을 바로 열면 동작하지 않습니다)

## 구조

- `js/game.js` 필드·메뉴·저장 / `js/battle.js` 배틀 / `js/maps.js` 맵 / `js/data.js` 타입·기술·도구
- `data/monsters.json` 151마리 데이터 (PokeAPI CSV에서 생성)
- `assets/pmd/` 스프라이트. `python3 tools/fetch_sprites.py`로 다시 받을 수 있음

## 크레딧

[CREDITS.md](CREDITS.md) 참고. Pokémon은 Nintendo / Creatures / GAME FREAK의 상표이며, 이 프로젝트는 이들과 관련 없는 비공식·비상업 팬게임입니다.
