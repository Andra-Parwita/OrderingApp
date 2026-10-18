import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import { MAX_MENU_ITEMS } from '../../../shared/limits';
import { applySession, type DraftSession, type SessionDiff } from './draftSession';
import { matchPastDishes } from './pastMenus';
import { opDone, type MenuData, type MenuOp } from './menuSlice';

// Plan 103 fix 8: while a session is open (the edit sheet of a live menu, the draft wizard) the
// screens work as before, but their menu changes land in the session instead of the server. The
// screens ask `useRunOp` / `useSendOp`, which pass each op here first.

export const SessionContext = createContext<DraftSession | null>(null);

/** What the session changed against the saved menu, for the Added / Removed / Edited marks (live edit only). */
export const MarksContext = createContext<SessionDiff | null>(null);

export function useMarks(): SessionDiff | null {
  return useContext(MarksContext);
}

export function useSession(): DraftSession | null {
  return useContext(SessionContext);
}

/** The menu with the session's changes in; `data` itself when there is no session. */
export function useSessionData(data: MenuData, session: DraftSession | null): MenuData {
  const state = useSyncExternalStore(
    session ? session.subscribe : noSubscribe,
    session ? session.getState : noState,
  );
  if (!session || !state) return data;
  return applySession(data, state);
}
const noSubscribe = () => () => undefined;
const noState = () => null;

/**
 * Takes the ops a session keeps (the menu, its dishes, ticks from a set or a past menu) and answers
 * them as done; returns what is left for the server (nothing, or a sold-out switch, or the op as it was).
 */
export function interceptOp(
  session: DraftSession,
  data: MenuData | null,
  dispatch: Dispatch<UnknownAction>,
  op: MenuOp,
): MenuOp | null {
  const done = (extra: { added?: number; missing?: number } = {}) => {
    dispatch(
      opDone({ kind: op.kind, ...('ref' in op && op.ref ? { ref: op.ref } : {}), ...extra }),
    );
    return null;
  };
  switch (op.kind) {
    case 'updateMenu': {
      const { wizardStep, ...rest } = op.request;
      // Where the wizard stopped is bookkeeping, not an edit: it goes to the server as it is.
      if (Object.keys(rest).length === 0) return wizardStep === undefined ? done() : op;
      session.patchMenu(rest);
      return wizardStep === undefined ? done() : { ...op, request: { wizardStep } };
    }
    case 'updateMenuDish': {
      const { soldOut, ...rest } = op.request;
      // The Sold out switch stays instant.
      if (Object.keys(rest).length === 0) return op;
      session.patchItem(op.id, rest, op.alsoDishId);
      if (soldOut === undefined) return done();
      const { alsoDishId, ...bare } = op;
      void alsoDishId;
      return { ...bare, request: { soldOut } };
    }
    case 'useSet':
    case 'usePast': {
      if (!data) return op;
      const current = session.getState().dishIds ?? savedIds(data);
      const wanted =
        op.kind === 'useSet'
          ? { ids: data.sets.find((set) => set.id === op.setId)?.dishIds ?? [], missing: 0 }
          : matchPastDishes(
              data.past.find((week) => week.id === op.weekId)?.totals.items ?? [],
              data.dishes,
            );
      const next = [...current, ...wanted.ids.filter((id) => !current.includes(id))].slice(
        0,
        MAX_MENU_ITEMS,
      );
      session.patchMenu({ dishIds: next });
      return done({ added: next.length - current.length, missing: wanted.missing });
    }
    case 'createDish':
      // The new dish goes on the menu as a tick in the session, not behind its back.
      if (!op.addToMenu) return op;
      session.wantNextCreated();
      return { ...op, addToMenu: false };
    default:
      return op;
  }
}

function savedIds(data: MenuData): Array<string> {
  return data.view.dishes.flatMap((dish) => (dish.dishId ? [dish.dishId] : []));
}
