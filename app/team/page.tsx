"use client";

import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { Team } from "@/components/team";

export default function Page() {
  return (
    <Suspense fallback={<p className="loading">불러오는 중</p>}>
      <Shell><Team /></Shell>
    </Suspense>
  );
}
