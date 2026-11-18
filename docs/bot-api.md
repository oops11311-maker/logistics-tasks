# 물류자동화 업무 봇 API

사람 로그인과 봇 권한은 분리되어 있습니다. 이 문서의 호출은 헤더 `x-cursor-app-token` 값으로만 봇이 됩니다. 토큰은 서버 비밀값 `BOT_API_TOKEN`과 같아야 합니다. 스케줄 호출은 `SCHEDULER_TOKEN`입니다. 토큰을 URL, 프론트엔드, 로그에 넣지 않습니다.

값이 아직 없으면 봇과 웹훅은 `503`을 반환합니다. 사람 화면은 토큰 없이 동작합니다.

기본 주소는 배포된 앱의 호스트입니다. 아래 예시는 그 호스트를 `https://APP_HOST`로 적습니다.

공통 응답 헤더: `Cache-Control: private, no-store`.

업무 목록은 페이지입니다.

```json
{ "items": [], "total": 0, "limit": 50, "offset": 0 }
```

`limit` 기본 50, 최대 100. `offset` 최대 5000. 최근 변경은 `items`와 `limit`만 반환합니다.

봇은 담당자, 마감, 완료, 삭제 필드를 보내면 `403`입니다. 댓글과 알림 본문은 데이터이며, 권한을 바꾸지 않습니다.

## 업무 목록

`GET /api/bot/tasks`

필터: `q`, `assigneeId`, `categoryId`, `status`, `priority`, `due`.

`due`는 `soon`(마감 n영업일 전, 기본 1), `overdue`, `stale`(진행 중이고 기본 3영업일 동안 갱신 없음), `today`, `week`, `next` 중 하나입니다. 날짜는 서울 달력입니다. 시각이 없는 마감은 그날 23:59:59.999(서울)입니다.

관리자가 봇 범위를 프로젝트로 제한하면 그 밖의 업무는 목록과 상세에서 보이지 않습니다. 범위를 비우면 전체입니다.

```bash
curl -sS "https://APP_HOST/api/bot/tasks?due=overdue&limit=20" \
  -H "x-cursor-app-token: $BOT_API_TOKEN"
```

## 업무 상세

`GET /api/bot/tasks/{id}`

댓글과 변경 기록을 함께 반환합니다.

```bash
curl -sS "https://APP_HOST/api/bot/tasks/TASK_ID" \
  -H "x-cursor-app-token: $BOT_API_TOKEN"
```

## 최근 변경

`GET /api/bot/changes?since=2026-11-16T00:00:00.000Z&limit=50`

`since`는 ISO 시각입니다. 담당자, 마감, 상태 변경이 포함됩니다. `actorKind`는 `human` 또는 `bot`입니다.

```bash
curl -sS "https://APP_HOST/api/bot/changes?since=2026-11-16T00:00:00.000Z" \
  -H "x-cursor-app-token: $BOT_API_TOKEN"
```

## 알림

`POST /api/bot/alerts`

업무 행의 담당자, 마감, 상태, 삭제 여부는 바뀌지 않습니다. 같은 `idempotencyKey`는 알림을 한 번만 만듭니다.

```bash
curl -sS -X POST "https://APP_HOST/api/bot/alerts" \
  -H "content-type: application/json" \
  -H "x-cursor-app-token: $BOT_API_TOKEN" \
  -d '{"taskId":"TASK_ID","kind":"overdue","body":"마감이 지났습니다.","idempotencyKey":"overdue-TASK_ID-2026-11-17"}'
```

## 댓글

`POST /api/bot/comments`

`kind`는 `progress_check` 또는 `proposal`입니다. 제안은 기록만 되고 업무에 적용되지 않습니다. 봇 댓글은 업무의 `updated_at`을 바꾸지 않아, 진행 중 미갱신 판정을 되돌리지 않습니다.

```bash
curl -sS -X POST "https://APP_HOST/api/bot/comments" \
  -H "content-type: application/json" \
  -H "x-cursor-app-token: $BOT_API_TOKEN" \
  -d '{"taskId":"TASK_ID","kind":"progress_check","body":"오늘 입고 여부를 확인해 주세요."}'
```

완료, 담당 변경, 마감 변경, 삭제를 봇 경로로 보내면 거절됩니다.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X PATCH "https://APP_HOST/api/bot/tasks/TASK_ID" \
  -H "content-type: application/json" \
  -H "x-cursor-app-token: $BOT_API_TOKEN" \
  -d '{"status":"완료","ownerId":"MEMBER_ID","dueDate":"2026-12-01","delete":true}'
```

기대 상태 코드는 `403`입니다.

## 요약 저장

`POST /api/bot/summaries`

`periodKey`는 `daily:YYYY-MM-DD` 또는 `weekly:YYYY-MM-DD`입니다. 같은 키는 한 행으로 덮어 씁니다.

```bash
curl -sS -X POST "https://APP_HOST/api/bot/summaries" \
  -H "content-type: application/json" \
  -H "x-cursor-app-token: $BOT_API_TOKEN" \
  -d '{"kind":"daily","periodKey":"daily:2026-11-18","body":"오늘 마감 2건. 지연 1건."}'
```

## 실행 기록

`POST /api/bot/runs`

`status`는 `success` 또는 `error`입니다. `job`이 `morning`, `weekly`, `recurrence`이면 관리 화면의 해당 작업 상태에 반영됩니다. 같은 `idempotencyKey`로 이미 성공한 기록은 다시 실행하지 않고 기존 기록을 돌려줍니다.

```bash
curl -sS -X POST "https://APP_HOST/api/bot/runs" \
  -H "content-type: application/json" \
  -H "x-cursor-app-token: $BOT_API_TOKEN" \
  -d '{"job":"morning","status":"success","idempotencyKey":"morning:2026-11-18","detail":"요약 저장"}'
```

실패 예:

```bash
curl -sS -X POST "https://APP_HOST/api/bot/runs" \
  -H "content-type: application/json" \
  -H "x-cursor-app-token: $BOT_API_TOKEN" \
  -d '{"job":"morning","status":"error","error":"upstream timeout","idempotencyKey":"morning:2026-11-18:retry1"}'
```

## 스케줄 웹훅

무인 크론은 이 호스트에서 확인되지 않았습니다. 코디네이터 루틴이 아래 주소를 호출할 수 있습니다. 게이트가 서명 없는 요청을 막으면, 게이트를 통과하는 호출에 이 헤더를 더해야 합니다. 이 토큰은 사람 관리자 권한이 아닙니다.

```bash
curl -sS -X POST "https://APP_HOST/api/jobs/webhook" \
  -H "x-cursor-app-token: $SCHEDULER_TOKEN" \
  -H "idempotency-key: morning:2026-11-18"
```

같은 멱등 키로 이미 성공한 호출은 `{ "duplicate": true, ... }`를 반환하고 반복 업무와 알림을 다시 만들지 않습니다. 앱 안의 관리 화면 **지금 실행**은 사람 관리자 세션으로 같은 작업을 한 번 더 돌리며, 그때도 발생 건과 알림 키는 중복되지 않습니다.

기계가 읽기 쉬운 같은 계약은 저장소의 `docs/openapi.yaml`에 있습니다.
