import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { DishEditor, type DishTarget } from './DishEditor';
import type { MenuData } from './menuSlice';
import { usePhone } from './phone/usePhone';
import { hasEditor, withEditor } from './phone/wizardNav';
import type { MenuSlots } from './slots';

// The dish editor is part of the URL (?dish=new | <dishId> | item:<menuItemId>), so a reload keeps
// it open and Back closes it.

const PARAM = 'dish';

export function dishParam(target: 'new' | { dishId: string } | { itemId: string }): string {
  if (target === 'new') return 'new';
  return 'dishId' in target ? target.dishId : `item:${target.itemId}`;
}

function targetOf(value: string): DishTarget {
  if (value === 'new') return { kind: 'library', dishId: null };
  if (value.startsWith('item:')) return { kind: 'menu', itemId: value.slice(5) };
  return { kind: 'library', dishId: value };
}

/** Opens the editor named by `?dish=`. */
export function useDishEditor(): {
  open: (target: Parameters<typeof dishParam>[0]) => void;
  close: () => void;
  value: string | null;
} {
  const [params, setParams] = useSearchParams();
  // Plan 134 (phone): the editor is one history entry that keeps the wizard's state (the screen it
  // is over), and Cancel or Save pops it, so Android Back and the buttons agree.
  const phone = usePhone();
  const navigate = useNavigate();
  const state: unknown = useLocation().state;
  const open = useCallback(
    (target: Parameters<typeof dishParam>[0]) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set(PARAM, dishParam(target));
          return next;
        },
        phone ? { replace: false, state: withEditor(state) } : { replace: false },
      ),
    [setParams, phone, state],
  );
  const close = useCallback(() => {
    if (phone && hasEditor(state)) {
      void navigate(-1);
      return;
    }
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete(PARAM);
        return next;
      },
      phone ? { replace: true, state } : { replace: true },
    );
  }, [setParams, phone, state, navigate]);
  return { open, close, value: params.get(PARAM) };
}

export function DishEditorHost({
  data,
  value,
  onClose,
  asChef = false,
  renderChefs,
}: Readonly<{
  data: MenuData;
  value: string | null;
  onClose: () => void;
  asChef?: boolean;
  renderChefs?: MenuSlots['chefs'];
}>) {
  if (value === null) return null;
  return (
    <DishEditor
      key={value}
      data={data}
      target={targetOf(value)}
      onClose={onClose}
      asChef={asChef}
      renderChefs={renderChefs}
    />
  );
}
