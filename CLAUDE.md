# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 목적

React 19 + TypeScript + Vite 기반 **노트 앱 실습(강의용) 프로젝트**. 노트 CRUD(목록/생성/편집/삭제)를
JSON Server 목 API로 구현한다. 강의에서 기능을 단계적으로 추가하는 것이 전제다.
예: `src/types/note.ts`의 `tags` 필드는 의도적으로 비워 둔 상태이며 "강의에서 추가할 것"으로 표시돼 있다.
코드 안의 TODO성 주석은 지우지 말고, 요청받은 단계만 구현한다.

## 명령어

| 명령                              | 비고                                                           |
| --------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                     | `concurrently`로 Vite(5173)와 json-server(3001)를 함께 실행    |
| `npm run server`                  | json-server만 실행                                             |
| `npm run build`                   | `tsc && vite build` — 타입 에러가 있으면 빌드 실패             |
| `npm run lint`                    | **`eslint . --fix`** — 검사만 하지 않고 파일을 자동 수정함     |
| `npm run format`                  | `prettier --write .` — 전체 파일을 다시 씀                     |
| `npm test` / `npm run test:watch` | Vitest (jsdom, globals, `src/test-setup.ts`에서 jest-dom 로드) |
| `npx vitest run <파일 또는 패턴>` | 단일 테스트 실행                                               |

- 검사만 하려면 `npx eslint .`, `npx prettier --check .`를 쓴다.
- git 훅(husky): pre-commit은 `lint-staged`(staged된 ts/tsx에 eslint --fix + prettier), commit-msg는 commitlint(`commitlint.config.mjs`, Conventional Commits + `init` 타입 허용), pre-push는 `tsc --noEmit`. 훅이 실패하면 `--no-verify`로 우회하지 말고 원인을 고친다.
- 현재 테스트 파일은 **하나도 없다**. 테스트를 추가할 때는 대상 파일 옆에 `*.test.tsx`로 두고
  `@testing-library/react` + `user-event`를 쓴다. API는 `fetch`를 mock한다. json-server에 의존하지 않는다.

## 구조와 데이터 흐름

```
main.tsx → App.tsx (선택 상태: selectedNoteId, isCreating)
             └─ NotesProvider (context/NotesContext.tsx: notes/loading/error + add/edit/removeNote)
                  └─ Layout (header + sidebar/main 슬롯)
                       ├─ sidebar: NoteList → NoteItem
                       └─ main:    NoteEditor
api/notes.ts  ← fetch 래퍼. NotesContext만 호출함
types/note.ts ← Note 인터페이스
db.json       ← json-server 데이터 파일
```

## 컴포넌트 구현 패턴

- **named export 함수 선언**(`export function NoteList(...)`)을 쓴다. 화살표 함수 컴포넌트는 쓰지 않는다.
  default export는 `App`만 사용한다. 파일 하나에 컴포넌트 하나를 둔다.
- Props는 컴포넌트 바로 위에 `interface XxxProps`로 선언하고, 매개변수에서 구조분해한다
  (`{ note, isSelected, onSelect }: NoteItemProps`). 자식이 하나뿐인 Provider는 인라인 타입
  `{ children }: { children: ReactNode }`을 쓴다.
- **역할 분리**
  - 컨테이너(`NoteList`, `NoteEditor`)는 `useNotes()`로 context를 직접 읽는다.
  - 프레젠테이션(`NoteItem`, `Layout`)은 props만 받고 context를 모른다.
  - 리스트 항목처럼 재사용되는 말단 컴포넌트에는 데이터와 콜백을 props로 내려준다.
- **레이아웃 합성**: `Layout`은 `children`이 아니라 이름 있는 `ReactNode` 슬롯(`sidebar`, `main`)으로 받는다.
- **상태별 early return**: 로딩, 에러, 빈 목록, 미선택 상태를 각각 `if (...) return <p ...>`로 먼저 반환하고,
  정상 UI는 마지막에 둔다(`NoteList`, `NoteEditor`). 안내 문구는 `text-sm text-muted-foreground text-center py-8`.
- 빈 값 대체 문구는 `{note.title || '(제목 없음)'}`처럼 `||`로 처리한다.
- 비동기 버튼은 로컬 `saving` 상태 + `disabled={saving}` + 라벨 교체(`'저장 중...'`)로 표시한다.

## 상태 관리 방식

- 외부 라이브러리 없이 **React Context + `useState`**만 쓴다(Redux, Zustand, React Query 없음, `useReducer` 미사용).
- 상태는 세 계층에 둔다.
  1. **서버 데이터**: `NotesContext`가 `notes`, `loading`, `error`와 변경 함수를 소유한다.
  2. **화면 선택 상태**: `App.tsx`가 `selectedNoteId: string | null`, `isCreating`을 소유하고 props로 내린다.
  3. **폼 입력**: `NoteEditor` 내부 `useState`(`title`, `content`, `saving`).
- 선택된 노트 객체는 상태로 저장하지 않고 `notes.find((n) => n.id === selectedNoteId)`로 **매 렌더 계산**한다.
  id만 상태로 들고 객체는 파생시킨다.
- 상태 갱신은 항상 함수형 업데이트로 불변하게 한다. 추가는 `[...prev, x]`, 수정은 `prev.map`, 삭제는 `prev.filter`.
- 변경 흐름은 **API 성공 → 응답값으로 로컬 상태 갱신**이다. 낙관적 업데이트나 refetch는 하지 않는다.
- context 훅은 `useNotes()`로 감싸고, Provider 밖에서 호출하면 `throw new Error(...)`로 막는다.
  새 context를 추가할 때도 `createContext<T | null>(null)` + 가드 훅 형태를 따른다.
- `useMemo`, `useCallback`은 현재 쓰지 않는다. 성능 문제가 없는 한 새로 도입하지 않는다.

## API 호출 패턴

- 네트워크 호출은 전부 `src/api/notes.ts`의 함수를 거친다. 컴포넌트에서 `fetch`를 직접 호출하지 않는다.
  context에서는 `import * as api from '../api/notes'` 네임스페이스 import로 쓴다.
- 함수 형태는 `export async function`이다. 매번 `fetch` → `if (!res.ok) throw new Error('Failed to ...')`
  → `return res.json()` 순서이고, 반환 타입을 `Promise<Note>`처럼 명시한다. 공통 fetch 헬퍼는 없다.
- `API_URL = 'http://localhost:3001'`이 하드코딩돼 있다(env 변수 없음).
- REST 메서드: 목록 `GET /notes`, 생성 `POST`, 수정 **`PATCH`**(PUT 아님), 삭제 `DELETE /notes/:id`.
  body가 있으면 `headers: { 'Content-Type': 'application/json' }`와 `JSON.stringify`를 쓴다.
- `createdAt`/`updatedAt`은 서버가 아니라 **API 함수에서** `new Date().toISOString()`으로 채운다.
  생성 입력 타입은 `Omit<Note, 'id' | 'createdAt' | 'updatedAt'>`, 수정 입력 타입은 `Partial<Note>`이다.
- 에러 처리는 이렇게 나뉜다.
  - API 계층은 throw만 한다.
  - context는 초기 로드 에러만 `error` 상태(string)에 담는다.
  - 변경 작업의 에러는 호출한 컴포넌트가 `try/catch/finally` + `console.error` + `alert('...실패했습니다')`로 처리한다.
- 새 필드(예: `tags`)를 추가할 때는 `types/note.ts` → `api/notes.ts` → `NotesContext` 시그니처
  (`addNote(title, content)`는 위치 인자임) → 컴포넌트 → `db.json` 시드 순으로 함께 갱신한다.

## 네이밍 패턴

- 파일 이름: 컴포넌트와 context는 PascalCase(`NoteEditor.tsx`, `NotesContext.tsx`).
  그 밖에는 소문자(`api/notes.ts`는 리소스 복수형, `types/note.ts`는 엔티티 단수형).
- 타입: 엔티티는 단수 `Note`, props는 `XxxProps`, context 값은 `XxxContextType`. 모두 `interface`로 쓴다.
- **계층별 CRUD 동사가 다르다.** 의도된 구분이므로 섞지 않는다.
  - API: `fetchNotes` / `createNote` / `updateNote` / `deleteNote`
  - Context: `addNote` / `editNote` / `removeNote`
- 이벤트: 컴포넌트 내부 핸들러는 `handleXxx`(`handleSave`, `handleSelectNote`), props 콜백은 `onXxx`
  (`onSelect`, `onDelete`, `onDone`, `onNewNote`). id를 받는 콜백 시그니처는 `(id: string) => void`.
- 상태 id는 `selectedNoteId`처럼 `xxxId`, 값이 없으면 `null`로 둔다(`undefined` 아님).
- 콜백 인자는 짧게 `n`, `e`, `prev`를 쓴다.

## 기타 컨벤션

- Prettier: 세미콜론 사용, 작은따옴표, 2칸 들여쓰기, trailing comma `all`, printWidth 100.
- TS `strict`, `noUnusedLocals`, `noUnusedParameters`가 켜져 있다. 미사용 import나 변수가 있으면 빌드가 실패한다.
- 타입도 `import { Note } from '../types/note'`처럼 일반 import로 가져온다(`import type` 미사용).
- UI 문구, 주석, 날짜 표기(`toLocaleDateString('ko-KR')`)는 한국어로 쓴다. JSX에 `{/* 헤더 */}`처럼 영역 주석을 단다.

## 스타일링 (Tailwind CSS v4)

- `tailwind.config.js`가 **없다**. 디자인 토큰은 `src/index.css`의 `@theme` 블록에 정의돼 있다
  (`@tailwindcss/vite` 플러그인 사용).
- 색상은 시맨틱 토큰 클래스만 쓴다: `bg-background`, `bg-card`, `text-foreground`, `bg-muted`,
  `text-muted-foreground`, `border-border`, `text-destructive`. `gray-500` 같은 원시 팔레트는 쓰지 않는다.
  새 색이 필요하면 `@theme`에 `--color-*`를 추가한다.
- 폰트: 본문은 Pretendard(`--font-sans`), 로고는 Boogaloo. 둘 다 `index.html`에서 CDN으로 불러온다.
- 반복되는 시각 패턴은 다음과 같다.
  - 카드: `rounded-2xl`/`rounded-3xl` + `border border-border` + `shadow-[0_2px_12px_rgba(0,0,0,0.07)]`
  - 주 버튼: `bg-foreground text-card rounded-xl hover:opacity-75`
  - 섹션 라벨: `text-xs font-semibold tracking-widest uppercase text-muted-foreground`
  - 클릭 가능한 요소에는 `cursor-pointer`를 붙인다.

## 주의사항

- `npm run dev` 중에는 json-server가 `db.json`을 **직접 수정**한다(앱에서 생성/수정/삭제할 때마다).
  의도하지 않은 `db.json` 변경을 커밋하지 않는다. json-server v1 beta는 새 항목에 `"dP_NPYuHV94"` 같은
  랜덤 문자열 id를 부여하므로 `id`는 항상 `string`으로 다룬다.
- `NoteEditor`의 폼 동기화 `useEffect`는 `selectedNoteId`, `isCreating`에만 의존하도록 일부러
  `exhaustive-deps`를 비활성화했다. 의존성에 `selectedNote`를 넣으면 저장 후 입력이 덮어써질 수 있다.
- `NoteItem`의 삭제 버튼은 `e.stopPropagation()`으로 카드 선택 클릭과 분리돼 있다. 이 처리를 유지한다.
- 삭제할 때 확인 절차가 없고, 삭제된 노트가 선택 중이어도 `selectedNoteId`가 초기화되지 않는다(현재 동작).
- README의 clone URL(`frongt/ccwork`)은 실제 origin(`jaejinu/ccwork`)과 다르다.
- 커밋 메시지는 `type: 한국어 설명` 형식을 따른다(예: `docs: README 추가`, `init: ...`).

## 일관성 없는 패턴 (요청 없이 리팩터링하지 말 것)

- boolean 이름: `isSelected`, `isCreating`(is- 접두사)와 `loading`, `saving`(접두사 없음)이 섞여 있다. 새 코드는 같은 파일의 기존 형태를 따른다.
- Promise 스타일: 초기 로드는 `.then/.catch/.finally` 체인, 나머지는 `async/await`이다. 새 코드는 `async/await`로 쓴다.
- 에러 처리 누락: `removeNote`는 `NoteList`/`NoteItem` 어디에서도 `try/catch`가 없다(삭제 실패 시 unhandled rejection).
- 에러 문구 언어: API 메시지는 영어(`'Failed to fetch notes'`)인데, 그대로 `오류: {error}`로 화면에 노출된다.
- 핸들러: `App`, `NoteEditor`는 `handleXxx`를 정의하지만, `NoteItem`은 JSX 안에 인라인 화살표 함수를 쓴다.
- 스타일: 대부분 Tailwind 클래스인데 `Layout`만 `style={{ fontFamily: 'Boogaloo...' }}`(`--font-display` 토큰이 있음)와
  `calc(100vh - 65px)`(헤더 높이 하드코딩) 인라인 스타일을 쓴다. `--radius` 토큰은 정의만 되고 쓰이지 않는다.
- 함수 시그니처: `addNote(title, content)`는 위치 인자, `editNote(id, updates: Partial<Note>)`는 객체 인자다.
