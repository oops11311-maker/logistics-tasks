"use client";

import { type ProjectRow } from "@/app/projects/board";

export function ArchiveDialog(props: {
  pending: ProjectRow;
  online: boolean;
  onCancel: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="scrim" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="archive-title">
        <h2 id="archive-title">게시판 보관</h2>
        <p>「{props.pending.name}」을 목록에서 뺍니다. 연결된 업무 {props.pending.linked}건은 지우지 않고 그대로 둡니다.</p>
        <div className="row">
          <button className="btn" type="button" onClick={props.onCancel}>취소</button>
          <button className="btn primary mutate" type="button" disabled={!props.online} onClick={props.onArchive}>보관</button>
        </div>
      </div>
    </div>
  );
}
