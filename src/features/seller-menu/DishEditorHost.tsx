import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { DishEditor, type DishTarget } from './DishEditor';
import type { MenuData } from './menuSlice';

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
  const open = useCallback(
    (target: Parameters<typeof dishParam>[0]) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set(PARAM, dishParam(target));
          return next;
        },
        { replace: false },
      ),
    [setParams],
  );
  const close = useCallback(
    () =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete(PARAM);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  return { open, close, value: params.get(PARAM) };
}

export function DishEditorHost({
  data,
  value,
  onClose,
}: Readonly<{ data: MenuData; value: string | null; onClose: () => void }>) {
  if (value === null) return null;
  return <DishEditor key={value} data={data} target={targetOf(value)} onClose={onClose} />;
}
