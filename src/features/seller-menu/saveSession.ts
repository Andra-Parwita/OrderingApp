import type { Store } from '@reduxjs/toolkit';
import type { UpdateMenuRequest } from '../../../shared/menusContract';
import { diffSession, type DraftSession, type SessionState } from './draftSession';
import { sendOpRaw } from './menuShared';
import type { MenuData, MenuRootState } from './menuSlice';

// Plan 103 fix 8: Save sends a session's changes with the endpoints the screens already used:
// one menu update (details and the dish list), then one update per changed dish.

export type SaveOutcome = { ok: true } | { ok: false; code: string };

const dataOf = (store: Store<MenuRootState>): MenuData | null => store.getState().sellerMenu.data;

/** A dish just ticked had its library id in place of an item id; once saved it has a real one. */
function rekeyed(state: SessionState, fresh: MenuData): SessionState {
  const items: SessionState['items'] = {};
  for (const [id, edit] of Object.entries(state.items)) {
    const real = fresh.view.dishes.find((item) => item.id === id || item.dishId === id);
    if (real) items[real.id] = edit;
  }
  return { dishIds: null, menu: {}, items };
}

export async function saveSession(
  session: DraftSession,
  store: Store<MenuRootState>,
): Promise<SaveOutcome> {
  const before = dataOf(store);
  if (!before) return { ok: false, code: 'network' };
  const state = session.getState();
  const diff = diffSession(before, state);
  if (diff.total === 0) {
    session.reset();
    return { ok: true };
  }
  const request: UpdateMenuRequest = {};
  for (const key of diff.menuKeys)
    Object.assign(request, { [key]: state.menu[key as keyof typeof state.menu] });
  if ((diff.added.length > 0 || diff.removed.length > 0) && state.dishIds) {
    request.dishIds = state.dishIds;
  }
  if (Object.keys(request).length > 0) {
    const answer = await sendOpRaw(store, { kind: 'updateMenu', request });
    if (!answer.ok) return { ok: false, code: answer.code };
  }
  const fresh = dataOf(store);
  if (!fresh) return { ok: false, code: 'network' };
  // What reached the server is out of the session; the dish edits are still to send.
  const rest = rekeyed(state, fresh);
  session.replace(rest);
  const edits = diffSession(fresh, rest).edited;
  const ids = Object.keys(edits);
  const answers = await Promise.all(
    ids.map((id) =>
      sendOpRaw(store, {
        kind: 'updateMenuDish',
        id,
        request: rest.items[id]?.request ?? {},
        ...(rest.items[id]?.alsoDishId ? { alsoDishId: rest.items[id].alsoDishId } : {}),
      }),
    ),
  );
  const left: SessionState['items'] = {};
  let failure: SaveOutcome = { ok: true };
  answers.forEach((answer, index) => {
    const id = ids[index];
    if (id === undefined) return;
    if (answer.ok) return;
    const edit = rest.items[id];
    if (edit) left[id] = edit;
    if (failure.ok) failure = { ok: false, code: answer.code };
  });
  session.replace({ dishIds: null, menu: {}, items: left });
  return failure;
}
