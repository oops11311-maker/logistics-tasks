import Link from "next/link";

export default function NotFound() {
  return (
    <main className="main">
      <h1>없는 화면입니다</h1>
      <Link href="/">현황으로</Link>
    </main>
  );
}
