"use client";

import { useParams } from "next/navigation";
import { TaskDetail } from "@/components/detail";
import { Shell } from "@/components/shell";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <Shell><TaskDetail id={params.id} /></Shell>;
}
