---
name: mermaid-diagram
description: src/ 디렉토리를 분석해 컴포넌트 의존성 관계와 상태 흐름을 Mermaid 다이어그램으로 그린
  docs/architecture/index.html 을 생성하고 브라우저로 바로 연다. "구조 시각화", "아키텍처 다이어그램",
  "컴포넌트 의존성 그려줘", "상태 흐름 보여줘", "mermaid 로 정리" 같은 요청이나, 코드 구조를 그림으로
  보고 싶다는 요청이 오면 명시적으로 Mermaid 를 언급하지 않아도 이 스킬을 사용한다. 구조가 바뀐 뒤
  다이어그램을 갱신해 달라는 요청에도 사용한다.
---

# Mermaid 아키텍처 다이어그램

`src/` 를 분석해 **컴포넌트 의존성(최우선)** 과 **상태 흐름** 을 Mermaid 로 시각화한 단일 HTML 을
`docs/architecture/index.html` 에 만들고 브라우저로 연다.

이 문서는 사람이 브라우저에서 "어떤 컴포넌트가 무엇에 의존하고, 상태가 어디서 생겨 어디로 흐르는가"를
한눈에 파악하기 위한 것이다. 그래서 정확성이 예쁜 모양보다 중요하다 — 실제 코드에 없는 화살표가 하나라도
있으면 문서 전체를 신뢰할 수 없게 된다.

## 1. src/ 분석

코드는 계속 바뀌므로 이전 결과나 CLAUDE.md 의 구조 설명을 그대로 옮기지 말고, **매번 실제 파일을 읽어서**
관계를 뽑는다.

1. `src/` 아래 모든 `.ts`/`.tsx` 파일을 나열하고 각 파일을 끝까지 읽는다 (테스트/셋업 파일은 제외).
2. 파일을 계층으로 분류한다: **Entry**(main, App) · **Components** · **Context** · **API** · **Types**.
   새 디렉토리(hooks/, utils/ 등)가 생겼으면 계층을 추가한다.
3. 파일마다 아래를 기록한다. import 문만 보면 놓치는 관계가 있으므로 JSX 와 훅 호출까지 확인한다.
   - **import**: 어떤 로컬 모듈을 가져오는가
   - **render**: JSX 에서 직접 렌더하는 자식 컴포넌트
   - **slot**: 다른 컴포넌트의 `ReactNode` props(예: `sidebar={<NoteList/>}`)로 주입하는 컴포넌트 —
     import 는 부모가 하지만 실제로 화면에서 감싸는 것은 슬롯을 받는 컴포넌트라는 점이 import 그래프만으로는
     안 보이므로 따로 구분한다
   - **context 사용**: `useXxx()` 로 읽는 context 와 꺼내 쓰는 필드/함수
   - **state 소유**: `useState` 로 가진 상태
   - **props 하향 / 콜백 상향**: 내려주는 데이터 props, 올려받는 `onXxx` 콜백
4. Context 는 상태 필드, 노출 함수, 각 함수가 호출하는 API 함수를 기록한다.
   API 는 함수명, HTTP 메서드, 엔드포인트를 기록한다.

## 2. 다이어그램 구성

아래 순서로 섹션을 만든다. 1번이 이 문서의 핵심이므로 가장 공들여 정확하게 그린다.

### ① 컴포넌트 의존성 — `flowchart TD`

- 노드 = 파일(모듈). 계층별 `subgraph`.
- 화살표 의미를 구분한다(범례를 HTML 에 함께 표시):
  - `A --> B` : A 가 B 를 import 하고 렌더
  - `L -.->|slot 이름| B` : 슬롯을 받는 L 이 화면에서 B 를 감싸 렌더함. B 를 import 해서 슬롯에 넣는 부모(A)는
    `A --> B` 로 따로 그린다. 예: `App --> NoteList` + `Layout -.->|sidebar| NoteList`
  - `A ==>|useNotes| Ctx` : context 훅 사용
  - `Ctx -->|api.xxx| Api` : API 호출
- Types 는 거의 모든 곳에서 참조해 화살표가 엉키므로, 노드는 두되 연결은 점선으로 흐리게(`linkStyle` 또는 별도 classDef) 처리한다.
- `classDef` 로 계층별 색을 준다.

### ② 상태 흐름 — `flowchart LR`

- 상태 소유자(Context 상태, App 의 UI 상태, 컴포넌트 로컬 상태)를 노드로 두고, 소비자 컴포넌트로 흐름을 그린다.
- 데이터 하향(props, context 읽기)은 실선, 이벤트 상향(`onXxx` 콜백, context 변경 함수 호출)은 점선으로 구분한다.
- 파생 상태(예: `notes.find(...)` 로 계산되는 값)가 있으면 상태가 아니라 계산값임을 라벨로 드러낸다.

### ③ 변경 시퀀스 — `sequenceDiagram`

- 가장 대표적인 쓰기 시나리오 1개(예: 노트 저장)를 사용자 → 컴포넌트 → Context → API → 서버 → setState → 리렌더 순으로 그린다.
- 시나리오가 여러 개 의미 있으면 추가해도 되지만 3개를 넘기지 않는다.

## 3. HTML 생성

`assets/template.html` 을 읽어 플레이스홀더를 채운 뒤 `docs/architecture/index.html` 로 저장한다
(디렉토리가 없으면 만든다). 템플릿에는 Mermaid CDN 로드, 라이트/다크 테마, 범례 스타일이 이미 들어 있다.

- `{{TITLE}}`: 프로젝트 이름 (package.json 의 name 또는 README 제목)
- `{{GENERATED_AT}}`: 생성 일시, `{{FILE_COUNT}}`: 분석한 파일 수
- `{{SECTIONS}}`: 다이어그램 섹션들. 섹션마다 `<section>` 안에 제목(h2), 1~2줄 한국어 설명, 범례(필요 시), `<pre class="mermaid">` 를 둔다.
- `{{NOTES}}`: 분석 중 발견한 특이점 목록 (`<li>`). 없으면 "특이사항 없음".
- 치환이 끝났는지 검사할 때는 `\{\{[A-Z_]+\}\}` 패턴으로만 찾는다. Mermaid 육각형 노드 문법(`id{{"..."}}`)도
  `{{` 를 쓰므로 단순히 `{{` 존재 여부로 검사하면 오탐이 난다.

Mermaid 는 UMD 스크립트(`mermaid.min.js`)로 로드한다. ESM `import` 는 `file://` 로 열 때 브라우저 정책에
막힐 수 있기 때문이다. CDN 을 쓰므로 렌더링에는 인터넷 연결이 필요하다.

## 4. Mermaid 문법 주의

문법 오류 하나면 그 다이어그램 전체가 렌더되지 않는다. 저장 전에 다시 훑어본다.

- 노드 ID 는 영문/숫자만(`NoteList`), 표시 이름은 따옴표 라벨: `NoteList["NoteList.tsx"]`
- 라벨에 `()`, `[]`, `{}`, `<>`, `|` 가 들어가면 반드시 따옴표 라벨을 쓰고, 큰따옴표는 `#quot;` 로 쓴다
- 엣지 라벨은 짧고 특수문자 없이: `-->|onSelect|`
- `end` 는 예약어이므로 노드 ID 로 쓰지 않는다
- `<pre class="mermaid">` 내부의 `<` 는 `&lt;` 로 이스케이프한다 (`>` 는 그대로 둬도 된다)
- `sequenceDiagram` 의 participant 별칭에 공백이 있으면 `participant C as "NotesContext"` 처럼 쓴다

## 5. 브라우저로 열기

파일을 저장한 뒤 현재 OS 에 맞는 명령으로 바로 연다.

| 환경               | 명령                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Windows PowerShell | `Start-Process "docs/architecture/index.html"`                                                               |
| Windows Git Bash   | `start "" "docs/architecture/index.html"`                                                                    |
| macOS              | `open docs/architecture/index.html`                                                                          |
| Linux / WSL        | `xdg-open docs/architecture/index.html` (WSL 은 `explorer.exe "$(wslpath -w docs/architecture/index.html)"`) |

## 6. 보고

짧게 보고한다:

- 생성 파일 경로와 포함한 다이어그램
- 분석한 파일 수
- 발견한 특이점 (순환 의존성, 슬롯 주입, context 를 직접 읽는 컴포넌트, 사용되지 않는 export 등)
- 사용자가 직접 다시 열 때 쓸 명령 한 줄
