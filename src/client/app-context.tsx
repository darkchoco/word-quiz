import { createContext, useContext } from 'react';
import type { SessionState, Stats } from '../shared/api';
import { ApiError } from './api';

export interface AppContextValue {
  session: SessionState;
  setSession: (session: SessionState) => void;
  /**
   * Common handling of API errors for every screen. Session errors send the user back to the
   * start screen; everything else is shown as a message. The caller does not need to do anything after.
   */
  handleApiError: (error: unknown) => void;
  /** The status bar numbers, which every answer changes. */
  updateStats: (stats: Stats) => void;
  /**
   * The Wrong tab (M7) asks for a retest and the quiz tab shows the retest banner and starts
   * a retest round. The request is used up by the next round start.
   */
  retestRequested: boolean;
  requestRetest: () => void;
  clearRetest: () => void;
  /** Ends the session on the server and goes back to the start screen. */
  switchDb: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside the app');
  return value;
}

export type ErrorAction = { kind: 'start'; noDbNotice: boolean } | { kind: 'message'; text: string };

/** What the app does about an API error (TECH-SPEC 7): session errors lead back to the start screen. */
export function classifyApiError(error: unknown): ErrorAction {
  if (error instanceof ApiError) {
    if (error.code === 'NO_SESSION') return { kind: 'start', noDbNotice: false };
    if (error.code === 'DB_NOT_FOUND') return { kind: 'start', noDbNotice: true };
    if (error.code === 'NETWORK_ERROR') return { kind: 'message', text: 'Cannot reach the server.' };
    if (error.message) return { kind: 'message', text: error.message };
  }
  return { kind: 'message', text: 'Something went wrong.' };
}
