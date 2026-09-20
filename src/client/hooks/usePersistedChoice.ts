import { useCallback, useState } from 'react';

/** Reads and writes never throw: with blocked or cleared site data the value is just not remembered. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // not remembered, and that is fine
  }
}

/** A string that survives page reloads when the browser allows it. */
export function usePersistedChoice(key: string): [string | null, (value: string) => void] {
  const [value, setValue] = useState<string | null>(() => read(key));
  const update = useCallback(
    (next: string) => {
      setValue(next);
      write(key, next);
    },
    [key],
  );
  return [value, update];
}
