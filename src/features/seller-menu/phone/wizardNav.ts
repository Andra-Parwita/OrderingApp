// Plan 134: on the phone the wizard is a stack of history entries, so Android Back goes one step back
// and a Close pops them all. The navigation state carries how many wizard entries are open (`depth`)
// and the step the seller came from (`prev`, so a Back button can pop instead of pushing again).

const record = (state: unknown): Record<string, unknown> =>
  typeof state === 'object' && state !== null ? (state as Record<string, unknown>) : {};

/** How many wizard entries sit above the screen the wizard was opened over (0 = unknown). */
export function wizardDepth(state: unknown): number {
  const { depth } = record(state);
  return typeof depth === 'number' && depth > 0 ? depth : 0;
}

/** The step the seller came from, when that step is the previous history entry. */
export function cameFrom(state: unknown): string | undefined {
  const { prev } = record(state);
  return typeof prev === 'string' ? prev : undefined;
}

/** The state of the next step's entry: one deeper, remembering where it came from. */
export function nextStepState(state: unknown, from: string): Record<string, unknown> {
  return { ...record(state), depth: wizardDepth(state) + 1, prev: from };
}

/** The first entry of a wizard opened from a screen. */
export function firstStepState(background: unknown): Record<string, unknown> {
  return { background, depth: 1 };
}

/** The dish editor's own entry on the phone (it pops with Back or Cancel). */
export function withEditor(state: unknown): Record<string, unknown> {
  return { ...record(state), dishEditor: true };
}
export function hasEditor(state: unknown): boolean {
  return record(state).dishEditor === true;
}

// The Orders screen under the wizard shows the menu card; it reloads when the wizard (or the edit
// sheet) closes, so a publish or a Save shows there. A tiny publish / subscribe, as the two do not
// share a component.
const closedListeners = new Set<() => void>();
export function onWizardClosed(listener: () => void): () => void {
  closedListeners.add(listener);
  return () => closedListeners.delete(listener);
}
export function announceWizardClosed(): void {
  closedListeners.forEach((listener) => listener());
}
