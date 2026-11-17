# 물류자동화 업무

물류자동화팀의 업무를 서울 시간으로 추적하는 앱입니다. 데이터는 배포 시 Cursor Apps Postgres에 저장됩니다. 이 저장소의 로컬 실행은 `DATABASE_URL`이 없을 때 PGlite를 사용합니다.

## 로컬 실행

```bash
npm install
env -u DATABASE_URL npm run dev
```

브라우저에서 `http://127.0.0.1:3000`을 열면 로그인 화면이 나옵니다. 세션 없이 업무 데이터는 나오지 않습니다.

테스트:

```bash
env -u DATABASE_URL npm test
```

마이그레이션:

```bash
env -u DATABASE_URL npm run migrate
```

`DATABASE_URL`이 없으면 이 명령은 아무 것도 적용하지 않습니다. 로컬 PGlite는 프로세스가 시작될 때 `migrations/*.sql`을 다시 적용하며, 그 SQL은 기존 데이터를 지우지 않습니다. 배포 빌드(`npm run build`)는 Next 빌드 뒤에 같은 스크립트를 실행하고, 그때 `DATABASE_URL`이 있으면 아직 적용되지 않은 파일만 `schema_migrations`에 기록합니다.

## 비밀값

봇 API는 `BOT_API_TOKEN`, 스케줄 웹훅은 `SCHEDULER_TOKEN`, 기존 관리자 비밀번호가 비어 있을 때의 처음 값은 `INITIAL_ADMIN_PASSWORD`입니다. 값은 코드에 없습니다. 운영 설명은 `docs/operations.md`, 봇 호출 예시는 `docs/bot-api.md`입니다.
