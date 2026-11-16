"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

type Project = { id: string; name: string; active: boolean; all: number; done: number; overdue: number; progress: number };

export function Projects() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  function load() {
    api<{ projects: Project[] }>("/api/projects").then((data) => setProjects(data.projects)).catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : "프로젝트를 불러오지 못했습니다."));
  }
  useEffect(load, []);
  if (error) return <div className="error"><p>{error}</p><button className="solid" onClick={load}>다시 시도</button></div>;
  if (!projects) return <p className="loading">불러오는 중</p>;
  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>프로젝트</h1>
      <p className="meta">분류별 전체, 완료, 기한 지남입니다. 진행률은 완료 건수를 전체로 나눈 값입니다.</p>
      {projects.length === 0 ? <p className="empty">분류가 없습니다.</p> : null}
      <div className="cards">
        {projects.map((project) => (
          <article key={project.id} className="card">
            <h3>{project.name}{project.active ? "" : " (숨김)"}</h3>
            <div className="meta"><span>전체 {project.all}</span><span>완료 {project.done}</span><span>기한 지남 {project.overdue}</span><span>{project.progress}%</span></div>
            <div className="progress"><span style={{ width: `${project.progress}%` }} /></div>
          </article>
        ))}
      </div>
    </div>
  );
}
