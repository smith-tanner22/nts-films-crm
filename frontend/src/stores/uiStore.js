import { create } from 'zustand';

const useUIStore = create((set) => ({
  sidebarOpen: true,
  modalOpen: null,
  modalData: null,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  openModal: (modalId, data = null) => set({ modalOpen: modalId, modalData: data }),
  closeModal: () => set({ modalOpen: null, modalData: null }),
}));

export default useUIStore;
