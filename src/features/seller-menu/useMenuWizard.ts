import { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router';
import { useMenuData, useOpWatch, useRunOp } from './menuShared';
import type { MenuOp } from './menuSlice';
import { STEPS, stepPath, type Step, type Tab } from './steps';

// The menu wizard is a layer over the screen it was opened from (plan 037). It is opened by
// navigating to its address with the current location as `state.background`; the app renders the
// background screen and, over it, the wizard. This hook opens it from anywhere (Home, Menu).

/** Where a new menu's dishes come from (the same shape as Home's `StartSource`). */
export type NewMenuSource =
  | Readonly<{ kind: 'empty' }>
  | Readonly<{ kind: 'past'; weekId: string }>
  | Readonly<{ kind: 'set'; setId: string }>;

/** What the New menu dialog asks for (the same shape as Home's `NewMenuInput`). */
export type NewMenuRequest = Readonly<{
  /** Local date, YYYY-MM-DD. */
  cookingDate: string;
  /** ISO instant with the cook's offset. */
  cutoffAt: string;
  source: NewMenuSource;
}>;

/** The ops that follow the first one, in order: the cut-off, then the dishes to start with. */
function followUps(input: NewMenuRequest, firstIsCreate: boolean): Array<MenuOp> {
  const ops: Array<MenuOp> = [];
  // createMenu takes the cooking day only; the cut-off the seller chose goes in right after.
  if (firstIsCreate) ops.push({ kind: 'updateMenu', request: { cutoffAt: input.cutoffAt } });
  if (input.source.kind === 'past') ops.push({ kind: 'usePast', weekId: input.source.weekId });
  if (input.source.kind === 'set') ops.push({ kind: 'useSet', setId: input.source.setId });
  return ops;
}

export function useMenuWizard(): {
  /** Opens the layer at a step (a name, or the saved `wizardStep` number); Dishes by default. */
  open: (step?: Step | number) => void;
  /** Opens the layer on a live menu's tab. */
  edit: (tab: Tab) => void;
  /** Creates or sets up the menu from the New menu dialog, then opens Dishes. */
  start: (input: NewMenuRequest) => void;
  /** The last start failed. */
  failed: boolean;
} {
  const navigate = useNavigate();
  const location = useLocation();
  const { data } = useMenuData();
  const { run } = useRunOp();
  const [failed, setFailed] = useState(false);
  const pending = useRef<Array<MenuOp>>([]);
  const starting = useRef(false);

  const go = useCallback(
    (path: string) => void navigate(path, { state: { background: location } }),
    [navigate, location],
  );
  const open = useCallback(
    (step: Step | number = 'dishes') => {
      const name =
        typeof step === 'number' ? (STEPS[Math.min(step, STEPS.length - 1)] ?? 'dishes') : step;
      go(stepPath('make', name));
    },
    [go],
  );
  const edit = useCallback((tab: Tab) => go(stepPath('edit', tab)), [go]);

  // One op at a time: when one is done, the next waits its turn; the last opens Dishes.
  useOpWatch(['createMenu', 'updateMenu', 'usePast', 'useSet'], {
    onDone: () => {
      if (!starting.current) return;
      const next = pending.current.shift();
      if (next) {
        run(next);
        return;
      }
      starting.current = false;
      open('dishes');
    },
    onFail: () => {
      if (!starting.current) return;
      starting.current = false;
      pending.current = [];
      setFailed(true);
    },
  });

  const state = data?.view.menu.state;
  const start = useCallback(
    (input: NewMenuRequest) => {
      setFailed(false);
      starting.current = true;
      // A kitchen's first menu already exists, empty and not published: it gets the day and cut-off.
      // After a finished menu, a new one is created.
      const create = state === 'finished';
      pending.current = followUps(input, create);
      run(
        create
          ? { kind: 'createMenu', cookingDate: input.cookingDate }
          : {
              kind: 'updateMenu',
              request: { cookingDate: input.cookingDate, cutoffAt: input.cutoffAt },
            },
      );
    },
    [run, state],
  );

  return { open, edit, start, failed };
}

/** The screen a wizard layer was opened over, from the navigation state. */
export function wizardBackground(state: unknown): Location | undefined {
  if (typeof state !== 'object' || state === null || !('background' in state)) return undefined;
  const { background } = state;
  if (typeof background !== 'object' || background === null) return undefined;
  return 'pathname' in background && typeof background.pathname === 'string'
    ? (background as Location)
    : undefined;
}

/** Closes the wizard: back to the screen it was opened over; opened directly, to the Menu screen. */
export function useCloseWizard(): () => void {
  const navigate = useNavigate();
  const state: unknown = useLocation().state;
  const background = wizardBackground(state);
  return useCallback(() => {
    if (background) {
      const behind: unknown = background.state;
      void navigate(background, { replace: true, state: behind });
    } else void navigate('/seller/menu', { replace: true });
  }, [navigate, background]);
}
