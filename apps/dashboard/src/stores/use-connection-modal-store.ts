import { create } from "zustand";

type NetworkType =
  | "whatsapp"
  | "whatsapp_official"
  | "facebook"
  | "instagram"
  | null;

type ConnectionMethod = "qr" | "pairing" | null;

type ModalStep = "network" | "method" | "qrcode" | "pairing" | "connected" | "syncing";

interface ConnectionModalState {
  // Modal control
  isOpen: boolean;
  open: () => void;
  close: () => void;

  // Steps navigation
  currentStep: ModalStep;
  setStep: (step: ModalStep) => void;
  goBack: () => void;

  // Selections
  selectedNetwork: NetworkType;
  setNetwork: (network: NetworkType) => void;

  selectedMethod: ConnectionMethod;
  setMethod: (method: ConnectionMethod) => void;

  // Channel data
  channelId: string | null;
  setChannelId: (id: string | null) => void;

  phoneNumber: string | null;
  setPhoneNumber: (phone: string | null) => void;

  // Reset all state
  reset: () => void;
}

const STEP_HISTORY: Record<ModalStep, ModalStep> = {
  network: "network", // First step, no back
  method: "network",
  qrcode: "method",
  pairing: "method",
  syncing: "method", // Can go back to method selection
  connected: "network", // Can go back to start or close
};

export const useConnectionModalStore = create<ConnectionModalState>(
  (set, get) => ({
    // Initial state
    isOpen: false,
    currentStep: "network",
    selectedNetwork: null,
    selectedMethod: null,
    channelId: null,
    phoneNumber: null,

    // Actions
    open: () => set({ isOpen: true }),

    close: () => {
      const state = get();
      set({ isOpen: false });
      // Reset after animation completes
      setTimeout(() => {
        if (!state.isOpen) {
          state.reset();
        }
      }, 300);
    },

    setStep: (step) => set({ currentStep: step }),

    goBack: () => {
      const { currentStep } = get();
      const previousStep = STEP_HISTORY[currentStep];
      set({ currentStep: previousStep });
    },

    setNetwork: (network) => set({ selectedNetwork: network }),

    setMethod: (method) => set({ selectedMethod: method }),

    setChannelId: (id) => set({ channelId: id }),

    setPhoneNumber: (phone) => set({ phoneNumber: phone }),

    reset: () =>
      set({
        currentStep: "network",
        selectedNetwork: null,
        selectedMethod: null,
        channelId: null,
        phoneNumber: null,
      }),
  }),
);
