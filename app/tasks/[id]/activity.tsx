"use client";

import { ActivityComments } from "@/app/tasks/[id]/activity-comments";
import { ActivityEvents } from "@/app/tasks/[id]/activity-events";

type Comment = { id: string; body: string; kind: string; createdAt: string | null; author: { name: string } };
type EventRow = { id: string; action: string; field: string | null; oldValue: string | null; newValue: string | null; actorKind: string; actorName: string; createdAt: string | null };

export function TaskActivity(props: {
  comments: Comment[];
  events: EventRow[];
  writable: boolean;
  online: boolean;
  comment: string;
  onComment: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <section className="panel">
      <ActivityComments comments={props.comments} writable={props.writable} online={props.online} comment={props.comment} onComment={props.onComment} onSubmit={props.onSubmit} />
      <ActivityEvents events={props.events} />
    </section>
  );
}
