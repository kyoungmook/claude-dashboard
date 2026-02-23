# Pixel Office - 에이전트 실시간 시각화 통합 계획

## Context

pixel-agents(https://github.com/pablodelucca/pixel-agents)는 VS Code 확장으로 Claude Code 에이전트를 픽셀 아트 캐릭터로 시각화한다. 우리 claude-dashboard에는 이미 JSONL 파싱, SSE 스트리밍, 에이전트/팀 분석 기능이 있다. 이 계획은 pixel-agents의 핵심 아이디어를 웹 대시보드에 적용하여, 활성 에이전트를 가상 오피스에서 Canvas 2D 픽셀 아트로 실시간 시각화한다.

---

## Phase 1: 기반 구축 — 데이터 모델 + 상태 감지 서비스

### 1-1. 데이터 모델
- [ ] `app/models/schemas.py`에 `PixelAgentState` frozen dataclass 추가
  - 필드: agent_id, project_name, state, tool_name, tool_status, model, desk_index, last_activity_ts, session_id, is_subagent
  - state 값: `"idle"` | `"typing"` | `"reading"` | `"waiting"`

### 1-2. 상태 감지 서비스 (TDD)
- [ ] `tests/test_pixel_agents_service.py` 테스트 먼저 작성
  - [ ] `TestFindActiveFiles` — mtime 기반 활성 파일 감지, 오래된 파일 무시, 빈 디렉토리
  - [ ] `TestDetectState` — Edit→typing, Read→reading, AskUserQuestion→waiting, 빈 파일→idle, 잘못된 JSON→idle
  - [ ] `TestToolStateMapping` — reading/typing 도구 매핑 전체 검증
  - [ ] `TestDeskAssignment` — 안정적 할당, 고유 인덱스
  - [ ] `TestGetActiveAgents` — 반환 타입 tuple[PixelAgentState, ...] 검증
- [ ] `app/services/pixel_agents_service.py` 구현
  - [ ] `_find_active_jsonl_files()` — PROJECTS_DIR 스캔, mtime < 5분 필터
  - [ ] `_detect_state_from_tail()` — JSONL 끝 ~4KB 읽기 → 상태 판별
  - [ ] `TOOL_STATE_MAP` — pixel-agents의 `formatToolStatus` 기반 도구→상태 매핑
  - [ ] `_assign_desk()` — 인메모리 dict로 안정적 책상 위치 할당
  - [ ] `get_active_agents()` — `@ttl_cache(ttl_seconds=5)` 캐시된 메인 함수
  - [ ] 재사용: `file_watcher.py`의 `_project_name_from_dir()` 패턴, tail-read 기법

### 1-3. 테스트 통과 확인
- [ ] `uv run pytest tests/test_pixel_agents_service.py -v` 전체 통과

---

## Phase 2: SSE 엔드포인트 + 라우터

### 2-1. 라우터 생성
- [ ] `app/routers/pixel_office.py` 생성 (기존 `live.py` 패턴 따름)
  - [ ] `GET /pixel-office` — 전체 페이지 렌더링
  - [ ] `GET /pixel-office/stream` — SSE 스트림 (3초 간격, 전체 에이전트 배열 전송)

### 2-2. 라우터 등록
- [ ] `main.py`에 import + include_router + 템플릿 필터 등록 추가 (3줄)

### 2-3. 라우터 테스트
- [ ] `tests/test_pixel_office_router.py` 작성
  - [ ] 페이지 200 응답 + `officeCanvas` 요소 존재 확인
  - [ ] SSE 스트림 Content-Type `text/event-stream` 확인
- [ ] `uv run pytest tests/test_pixel_office_router.py -v` 통과

---

## Phase 3: Canvas 게임 엔진 — 기본 렌더링

### 3-1. 절차적 캐릭터 시스템
- [ ] `static/js/pixel-office.js` 생성
  - [ ] `CharacterFactory` — 6가지 색상 팔레트 (피부, 머리, 셔츠)
  - [ ] 16x16 2D 배열로 프레임 정의 (외부 에셋 불필요)
  - [ ] 상태별 프레임: idle(1), type(2), read(2)
  - [ ] 3x 스케일 렌더링 (48x48 화면 픽셀)

### 3-2. 오피스 렌더링
- [ ] `OfficeRenderer` 클래스
  - [ ] 바닥: 어두운 그리드 패턴
  - [ ] 벽: 상단 벽 + 창문
  - [ ] 책상: 4열 그리드, 모니터 포함
  - [ ] 라벨: 프로젝트명 + 도구 상태 말풍선
  - [ ] 활성 에이전트 모니터 발광 효과

### 3-3. 게임 루프 + SSE 연결
- [ ] `PixelOffice` 메인 컨트롤러
  - [ ] `EventSource`로 `/pixel-office/stream` SSE 연결
  - [ ] `requestAnimationFrame` 게임 루프 (렌더 60fps, 애니 프레임 300ms)
  - [ ] SSE 데이터 → 에이전트 Map 갱신
  - [ ] `devicePixelRatio` 고해상도 지원
  - [ ] `image-rendering: pixelated` CSS

### 3-4. 반응형 레이아웃
- [ ] 캔버스 리사이즈 핸들러
  - [ ] <600px → 2열, 600-1000px → 3열, >1000px → 4열
  - [ ] 에이전트 수에 따라 세로 확장

---

## Phase 4: 템플릿 + 네비게이션

### 4-1. 페이지 템플릿
- [ ] `app/templates/pixel_office.html` 생성
  - [ ] `base.html` 확장
  - [ ] 캔버스 컨테이너 (height: calc(100vh - 200px))
  - [ ] 실시간 연결 토글 버튼 (시작/정지)
  - [ ] 활동 중 에이전트 수 표시
  - [ ] 하단 에이전트 상태 패널 (텍스트 보조 정보)

### 4-2. 네비게이션
- [ ] `app/templates/components/nav.html`에 "오피스" 링크 추가 (팀 다음)

### 4-3. 통합 테스트
- [ ] 서버 실행 후 http://localhost:8000/pixel-office 접속 확인
- [ ] Claude Code 세션 실행 → 캐릭터 표시 + 상태 변화 확인
- [ ] 전체 테스트: `uv run pytest tests/ -v` 통과

---

## Phase 5 (확장): 걷기 애니메이션 + 경로 탐색

### 5-1. BFS 경로 탐색
- [ ] `pixel-office.js`에 `Pathfinder` 클래스 추가
  - [ ] 그리드 기반 BFS pathfinding (pixel-agents의 `findPath` 참고)
  - [ ] 장애물 회피 (책상, 벽)
  - [ ] 타일맵 walkable 영역 계산

### 5-2. 캐릭터 걷기 상태
- [ ] `SpriteEngine`에 walk 프레임 추가 (4프레임)
- [ ] 상태 머신: WALK → 목표 도달 → TYPE/READ/IDLE
- [ ] 에이전트 활성화 시: 입구에서 책상까지 걸어감
- [ ] 에이전트 비활성(idle > 2분) 시: 책상에서 일어나 돌아다님
- [ ] pixel-agents의 wanderTimer 패턴 적용

### 5-3. 걷기 애니메이션 세부
- [ ] 방향별 스프라이트 (UP, DOWN, LEFT, RIGHT)
- [ ] 타일 간 보간 이동 (WALK_SPEED_PX_PER_SEC)
- [ ] 경로 완료 시 자연스러운 착석

---

## Phase 6 (확장): 서브에이전트 시각화

### 6-1. 서브에이전트 감지
- [ ] `pixel_agents_service.py`에 서브에이전트 JSONL 파일 스캔 추가
  - [ ] `projects/*/session_dir/subagents/*.jsonl` 경로 탐색
  - [ ] 부모 에이전트 연결 (is_subagent=True, parent_session_id)

### 6-2. 서브에이전트 캐릭터
- [ ] 부모와 같은 팔레트 + 약간 다른 밝기
- [ ] 부모 에이전트 옆 책상에 배치 (가장 가까운 빈 자리)
- [ ] pixel-agents의 spawn 매트릭스 이펙트 구현 (등장/퇴장 시)
- [ ] 서브에이전트 완료 시 자동 제거

### 6-3. 연결 시각화
- [ ] 부모-자식 에이전트 사이에 점선 연결선 표시

---

## Phase 7 (확장): 말풍선 + 알림

### 7-1. 말풍선 시스템
- [ ] 에이전트가 사용자 입력 대기 중일 때 말풍선 표시
  - [ ] 권한 요청 말풍선 (느낌표 아이콘)
  - [ ] 대기 말풍선 (말줌표 아이콘)
  - [ ] 페이드인/페이드아웃 애니메이션

### 7-2. 도구 상태 상세 표시
- [ ] 말풍선에 구체적 도구 상태 표시 (예: "main.py 수정 중", "Running: npm test")
- [ ] pixel-agents의 `formatToolStatus` 한국어 버전

### 7-3. 알림 사운드 (선택)
- [ ] 에이전트 턴 종료 시 차임 사운드 옵션
- [ ] 사운드 토글 버튼

---

## Phase 8 (확장): 인터랙션 + 오피스 커스터마이징

### 8-1. 캐릭터 클릭 인터랙션
- [ ] 캐릭터 클릭 → 해당 세션 상세 페이지(`/sessions/{id}`)로 이동
- [ ] 캐릭터 호버 → 도구 상태 + 프로젝트명 + 모델 정보 툴팁
- [ ] 캐릭터 선택 시 아웃라인 하이라이트

### 8-2. 오피스 테마
- [ ] 오피스 색상 테마 프리셋 (야간, 카페, 우주, 정글 등)
- [ ] localStorage에 선택된 테마 저장

### 8-3. 기본 가구 배치
- [ ] 화분, 책장, 커피머신 등 장식 오브젝트
- [ ] 에이전트 수에 맞게 자동 레이아웃 조정

---

## Phase 9 (확장): 팀 시각화 + 통신

### 9-1. 팀 모드 연동
- [ ] `~/.claude/teams/` 감시 → 활성 팀 감지
- [ ] 팀원들을 같은 오피스 공간에 그룹핑
- [ ] 팀 리더 캐릭터에 왕관 표시

### 9-2. 메시지 시각화
- [ ] 에이전트 간 SendMessage → 캐릭터 사이에 메시지 날아가는 애니메이션
- [ ] 브로드캐스트 → 동심원 파동 효과

### 9-3. 태스크 진행 표시
- [ ] 각 에이전트 위에 태스크 진행 바 (TaskList 연동)
- [ ] 완료된 태스크 수 / 전체 태스크 수 표시

---

## 수정/생성 파일 요약

### Phase 1-4 (초기 구현)
| 파일 | 작업 | 예상 라인 |
|------|------|----------|
| `app/models/schemas.py` | 수정 | +15 |
| `app/services/pixel_agents_service.py` | **생성** | ~200 |
| `tests/test_pixel_agents_service.py` | **생성** | ~200 |
| `app/routers/pixel_office.py` | **생성** | ~60 |
| `main.py` | 수정 | +3 |
| `tests/test_pixel_office_router.py` | **생성** | ~40 |
| `static/js/pixel-office.js` | **생성** | ~500 |
| `app/templates/pixel_office.html` | **생성** | ~50 |
| `app/templates/components/nav.html` | 수정 | +4 |

### Phase 5-9 (확장)
| 파일 | 작업 | 예상 라인 |
|------|------|----------|
| `static/js/pixel-office.js` | 확장 | +300~400 |
| `app/services/pixel_agents_service.py` | 확장 | +100~150 |
| `static/js/pixel-office-sprites.js` | **생성** (걷기 스프라이트) | ~200 |
| `static/js/pixel-office-effects.js` | **생성** (이펙트/알림) | ~150 |

## 핵심 기술 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 캐릭터 렌더링 | 절차적 Canvas | 외부 에셋 불필요, 빌드 단계 없음 |
| 상태 전송 | 전체 배열 (delta X) | 페이로드 소량 (~2KB), 클라이언트 극단적 단순화 |
| 캐시 TTL | 5초 (기존 30초 대비) | 실시간성 필요, tail-read는 가벼움 |
| 걷기 애니메이션 | Phase 5로 연기 | Phase 1-4에서 핵심 가치 먼저 검증 |
| 캔버스 해상도 | 고정 논리 해상도 + CSS 스케일 | `pixelated` 렌더링으로 선명도 보장 |

## 검증 방법

1. `uv run pytest tests/test_pixel_agents_service.py -v` — 서비스 테스트
2. `uv run pytest tests/test_pixel_office_router.py -v` — 라우터 테스트
3. `uv run uvicorn main:app --reload --port 8000` → http://localhost:8000/pixel-office
4. Claude Code 세션 실행 → 캐릭터 상태 변화 확인
5. 여러 세션 동시 실행 → 복수 캐릭터 배치 확인
6. `uv run pytest tests/ -v` — 전체 테스트 회귀 없음
