# API 예시

사람 요청은 브라우저가 `x-logistics-client: 1`을 보냅니다. 신원 토큰은 서버가 게이트에서 읽으며, 예시에는 넣지 않습니다.

봇은 이 헤더만 사용합니다.

```http
Authorization: Bearer $BOT_API_TOKEN
```

`x-bot-token`은 받지 않습니다. 토큰 값을 저장소나 채팅에 넣지 마세요.

## 작업 만들기

```http
POST /api/tasks
Content-Type: application/json
x-logistics-client: 1

{
  "title": "신규 공급사 계약",
  "body": "견적 비교",
  "priority": "high",
  "dueDate": "2026-11-20",
  "recurrence": { "frequency": "weekly" }
}
```

시각이 없으면 마감은 그 날짜 23:59:59.999 Asia/Seoul 입니다.

## 상태 변경

```http
PATCH /api/tasks/TASK_ID
Content-Type: application/json
x-logistics-client: 1

{ "version": 1, "status": "in_progress" }
```

버전이 다르면 `409`와 `error: "conflict"` 입니다.

## 봇 댓글

```http
POST /api/bot/tasks/TASK_ID/comments
Authorization: Bearer $BOT_API_TOKEN
Content-Type: application/json

{ "body": "진행 확인이 필요합니다.", "kind": "checkin", "idempotencyKey": "checkin:TASK_ID:2026-11-16" }
```

봇이 담당자, 마감, 완료, 휴지통을 바꾸면 `403` 입니다.

## 알림 재시도

```http
POST /api/bot/notifications
Authorization: Bearer $BOT_API_TOKEN
Content-Type: application/json

{
  "taskId": "TASK_ID",
  "title": "내일 마감",
  "body": "신규 공급사 계약",
  "idempotencyKey": "due-soon:TASK_ID:2026-11-20"
}
```

같은 키의 두 번째 호출은 `duplicate: true` 이고 알림은 하나뿐입니다.

## 예약 실행

스케줄러는 아직 연결되어 있지 않습니다. 연결할 주소는 아래입니다.

```http
POST /api/jobs/run
Authorization: Bearer $SCHEDULER_TOKEN
Content-Type: application/json

{ "force": false }
```

관리자는 화면의 ‘지금 실행’으로 같은 경로를 `{ "force": true, "only": "daily_summary" }`처럼 호출합니다. 같은 슬롯의 성공 기록은 다시 알림을 만들지 않습니다.
