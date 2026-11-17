import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestWithHeaders, setupAccess, setupCsrf } from "@/src/lib/auth";

const ERRORS: Record<string, string> = {
  csrf: "요청을 확인하지 못했습니다. 다시 열어 주세요.",
  invalid: "비밀번호 확인이 일치하지 않거나 형식이 맞지 않습니다.",
  forbidden: "이 단계를 사용할 수 없습니다.",
  conflict: "이미 설정된 비밀번호입니다.",
  rate: "시도가 너무 많습니다. 잠시 후 다시 시도하세요.",
  cross_site: "다른 사이트의 요청은 거절했습니다.",
};

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const note = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const request = requestWithHeaders(await headers());
  const access = await setupAccess(request);
  if (access.open) {
    const csrf = await setupCsrf(request);
    if (!csrf) redirect("/api/auth/setup-entry");
    return (
      <main className="login-wrap">
        <form className="login-card" method="POST" action="/api/auth/admin-setup">
          <h1>최초 관리자 비밀번호 설정</h1>
          <p className="hint">한 번만 설정합니다. 설정한 뒤에는 이 단계가 닫히고, 사용자 이름 limjaeyeol로 로그인합니다.</p>
          <input type="hidden" name="csrf" value={csrf} />
          <label className="stack">비밀번호
            <input className="field" name="password" type="password" autoComplete="new-password" aria-label="최초 비밀번호" minLength={10} required />
          </label>
          <label className="stack">비밀번호 확인
            <input className="field" name="confirm" type="password" autoComplete="new-password" aria-label="최초 비밀번호 확인" minLength={10} required />
          </label>
          {note ? <p className="hint">{note}</p> : null}
          <button className="btn primary" type="submit">비밀번호 설정</button>
        </form>
      </main>
    );
  }
  const closed = access.reason === "hash_present"
    ? "이미 비밀번호가 설정되어 있습니다."
    : access.reason === "no_admin_row"
      ? "설정할 관리자 계정을 찾지 못했습니다."
      : "이 단계를 사용할 수 없습니다.";
  return (
    <main className="login-wrap">
      <section className="login-card">
        <h1>최초 관리자 비밀번호 설정</h1>
        <p className="hint">{note ?? closed}</p>
        <a className="btn" href="/login?form=1">로그인</a>
      </section>
    </main>
  );
}
