import { create } from "zustand";

type ProfileDraft = {
  dailyRequestLimit?: number | null;
  canEmergency?: boolean;
};

type DocumentDraft =
  | {
      value?: string;
      file?: File | null;
    }
  | undefined;

type ProviderOnboardingState = {
  currentStep: number;
  documentDrafts: Record<string, DocumentDraft>;
  profileDraft: ProfileDraft;
  setStep: (step: number) => void;
  setDocumentDraft: (requirementId: string, draft: DocumentDraft) => void;
  clearDocumentDraft: (requirementId: string) => void;
  setProfileDraft: (draft: Partial<ProfileDraft>) => void;
  clearProfileDraft: () => void;
  reset: () => void;
};

const initialProfileDraft: ProfileDraft = {};

export const useProviderOnboardingStore = create<ProviderOnboardingState>((set) => ({
  currentStep: 0,
  documentDrafts: {},
  profileDraft: initialProfileDraft,
  setStep: (step) =>
    set(() => ({
      currentStep: step < 0 ? 0 : step,
    })),
  setDocumentDraft: (requirementId, draft) =>
    set((state) => ({
      documentDrafts: {
        ...state.documentDrafts,
        [requirementId]: draft,
      },
    })),
  clearDocumentDraft: (requirementId) =>
    set((state) => {
      if (!(requirementId in state.documentDrafts)) {
        return state;
      }
      const next = { ...state.documentDrafts };
      delete next[requirementId];
      return { documentDrafts: next };
    }),
  setProfileDraft: (draft) =>
    set((state) => ({
      profileDraft: {
        ...state.profileDraft,
        ...draft,
      },
    })),
  clearProfileDraft: () =>
    set(() => ({
      profileDraft: initialProfileDraft,
    })),
  reset: () =>
    set(() => ({
      currentStep: 0,
      documentDrafts: {},
      profileDraft: initialProfileDraft,
    })),
}));
