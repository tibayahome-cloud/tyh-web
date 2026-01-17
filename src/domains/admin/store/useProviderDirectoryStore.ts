import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CustomProviderSavedView = {
  id: string;
  label: string;
  description?: string;
  status: string;
  onlyEmergency: boolean;
  search?: string;
};

type ProviderDirectoryState = {
  savedViews: CustomProviderSavedView[];
  defaultViewId?: string;
  addView: (view: CustomProviderSavedView) => void;
  removeView: (id: string) => void;
  setDefaultView: (id: string | undefined) => void;
};

export const useProviderDirectoryStore = create<ProviderDirectoryState>()(
  persist(
    (set) => ({
      savedViews: [],
      defaultViewId: undefined,
      addView: (view) =>
        set((state) => {
          const existingIndex = state.savedViews.findIndex((item) => item.id === view.id);
          if (existingIndex >= 0) {
            const next = [...state.savedViews];
            next[existingIndex] = view;
            return { savedViews: next };
          }
          return { savedViews: [...state.savedViews, view] };
        }),
      removeView: (id) =>
        set((state) => ({
          savedViews: state.savedViews.filter((item) => item.id !== id),
          defaultViewId: state.defaultViewId === id ? undefined : state.defaultViewId,
        })),
      setDefaultView: (id) =>
        set(() => ({
          defaultViewId: id,
        })),
    }),
    {
      name: "provider-directory-store",
    },
  ),
);
