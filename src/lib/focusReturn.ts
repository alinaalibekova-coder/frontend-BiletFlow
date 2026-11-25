// Remembers which element opened a dialog and gives focus back to it when the dialog closes.
// DOM-free so it can be unit-tested: anything with focus() and isConnected works.
export interface Focusable { focus(): void; readonly isConnected: boolean }

export interface OpenerTracker<T extends Focusable> {
  // Call during render. On the closed → open transition it records `active`, the element that
  // has focus before the dialog's DOM exists, i.e. before children with autoFocus take it.
  render(open: boolean, active: T | null): void;
  // Call when the dialog's effect mounts: cancels a restore scheduled by a cleanup that turned out
  // not to be a real close (React StrictMode runs effect cleanup + setup once on mount).
  mounted(): void;
  // Call from the effect cleanup: after the current tick, focus the opener if it is still on the page.
  closed(): void;
  readonly opener: T | null;
}

type Schedule = (callback: () => void) => unknown;
type Cancel = (handle: unknown) => void;

export function createOpenerTracker<T extends Focusable>(
  schedule: Schedule = callback => setTimeout(callback, 0),
  cancel: Cancel = handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
): OpenerTracker<T> {
  let wasOpen = false;
  let opener: T | null = null;
  let pending: unknown = null;
  return {
    render(open, active) {
      if (open && !wasOpen) opener = active;
      wasOpen = open;
    },
    mounted() {
      if (pending !== null) { cancel(pending); pending = null; }
    },
    closed() {
      const target = opener;
      pending = schedule(() => {
        pending = null;
        if (target?.isConnected) target.focus();
      });
    },
    get opener() { return opener; },
  };
}
