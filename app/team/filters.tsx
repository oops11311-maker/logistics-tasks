"use client";

import { type Category, type Person } from "@/components/api";
import { FilterPeople } from "@/app/team/filter-people";
import { FilterStatus } from "@/app/team/filter-status";

export function TeamFilters(props: {
  q: string;
  assigneeId: string;
  categoryId: string;
  status: string;
  priority: string;
  kind: string;
  due: string;
  categories: Category[];
  members: Person[];
  onParam: (key: string, value: string) => void;
}) {
  return (
    <form className="filters" onSubmit={(event) => event.preventDefault()}>
      <FilterPeople q={props.q} assigneeId={props.assigneeId} categoryId={props.categoryId} categories={props.categories} members={props.members} onParam={props.onParam} />
      <FilterStatus status={props.status} priority={props.priority} kind={props.kind} due={props.due} onParam={props.onParam} />
    </form>
  );
}
