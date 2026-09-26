/** UI store (M09 `ui`, FR-1): which surface the shell shows. Session-scoped, never persisted. */
import { create } from 'zustand';

export type Surface = 'roll' | 'world' | 'character' | 'fight' | 'combat';

export interface UiState {
  surface: Surface;
  navigate(surface: Surface): void;
}

export const useUiStore = create<UiState>()((set) => ({
  surface: 'roll',
  navigate: (surface) => set({ surface }),
}));
