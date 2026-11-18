import Link from "next/link";

export default function NotFound() {
  return (
    <div className="state">
      <p>없는 화면입니다.</p>
      <Link className="btn" href="/">대시보드로</Link>
    </div>
  );
}
