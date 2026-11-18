"use client";

import { roleLabel } from "@/components/api";
import { type MemberRow } from "@/app/admin/types";

export function AccountTable(props: { members: MemberRow[]; onEdit: (member: MemberRow) => void }) {
  return (
    <div className="table-wrap">
      <table className="grid">
        <thead><tr><th>이름</th><th>사용자 이름</th><th>이메일</th><th>역할</th><th>상태</th><th /></tr></thead>
        <tbody>
          {props.members.map((member) => (
            <tr key={member.id}>
              <td>{member.name}</td>
              <td>{member.username || "—"}</td>
              <td>{member.email || "—"}</td>
              <td>{roleLabel(member.role)}</td>
              <td>{member.active ? "사용 중" : "비활성"}</td>
              <td><button className="btn" type="button" onClick={() => props.onEdit(member)}>편집</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

