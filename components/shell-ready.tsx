"use client";

import { api } from "./api";
import { AppFrame } from "./frame";
import { Ctx } from "./shell-state";
import { type useShellStore } from "./shell-store";

export function ShellReady(props: {
  state: ReturnType<typeof useShellStore>;
  title: string;
  logout: () => void;
  load: () => Promise<void>;
  children: React.ReactNode;
}) {
  const state = props.state;
  const me = state.me;
  if (!me) return null;
  const value = {
    me, categories: state.categories, members: state.members, today: state.today, unread: state.unread, notes: state.notes,
    online: state.online, revision: state.revision, dirty: state.dirty, setDirty: state.setDirty, toast: state.toast,
    reload: () => state.setRevision((item) => item + 1),
  };
  return (
    <Ctx.Provider value={value}>
      <AppFrame
        pathname={state.pathname}
        online={state.online}
        today={state.today}
        me={me}
        title={props.title}
        unread={state.unread}
        remote={state.remote}
        openNotes={state.openNotes}
        notes={state.notes}
        more={state.more}
        message={state.message}
        install={state.install}
        onLogout={() => void props.logout()}
        onNotes={state.setOpenNotes}
        onRefresh={() => { state.setRemote(false); state.setDirty(false); state.setRevision((item) => item + 1); }}
        onMore={state.setMore}
        onReadAll={() => void api("/api/notifications/read", { method: "POST", mutate: true, body: JSON.stringify({ all: true }) }).then(props.load)}
      >{props.children}</AppFrame>
    </Ctx.Provider>
  );
}
