"use client";

import { STATUSES, type Person } from "@/components/api";

export { applyBulk } from "@/app/team/bulk-apply";

export function BulkBar(props: {
  role: string;
  online: boolean;
  members: Person[];
  bulkStatus: string;
  bulkOwner: string;
  onStatus: (value: string) => void;
  onOwner: (value: string) => void;
  onApply: (kind: "status" | "owner") => void;
}) {
  return (
    <div className="filters">
      <select className="control" value={props.bulkStatus} onChange={(event) => props.onStatus(event.target.value)} aria-label="일괄 상태">
        {STATUSES.map((status) => <option key={status}>{status}</option>)}
      </select>
      <button className="btn mutate" disabled={!props.online} onClick={() => props.onApply("status")}>상태 적용</button>
      {props.role === "admin" ? (
        <>
          <select className="control" value={props.bulkOwner} onChange={(event) => props.onOwner(event.target.value)} aria-label="일괄 담당자">
            <option value="">담당자</option>
            {props.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <button className="btn mutate" disabled={!props.online || !props.bulkOwner} onClick={() => props.onApply("owner")}>담당 적용</button>
        </>
      ) : null}
    </div>
  );
}
