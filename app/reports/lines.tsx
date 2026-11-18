import Link from "next/link";

export type ReportLine = { id: string; href: string; title: string; ownerName: string; status: string; dueDate: string | null; delayReason: string | null };

export function ReportLines({ rows, delay }: { rows: ReportLine[]; delay: boolean }) {
  if (rows.length === 0) return <p className="state">없음</p>;
  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr><th>업무</th><th>담당</th><th>상태</th><th>마감</th>{delay ? <th>지연 사유</th> : null}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><Link href={row.href}>{row.title}</Link></td>
              <td>{row.ownerName}</td>
              <td>{row.status}</td>
              <td>{row.dueDate ?? "—"}</td>
              {delay ? <td>{row.delayReason?.trim() ? row.delayReason : "사유 미입력"}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
