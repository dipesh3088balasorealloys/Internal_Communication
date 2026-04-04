import { create } from 'zustand';

type SidebarTab = 'chat' | 'contacts' | 'calls' | 'calendar' | 'email';

interface UIState {
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  profilePanelOpen: boolean;
  profileUserId: string | null;
  createGroupOpen: boolean;
  searchOpen: boolean;
  callModalOpen: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  openProfilePanel: (userId: string) => void;
  closeProfilePanel: () => void;
  setCreateGroupOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setCallModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarTab: 'chat',
  profilePanelOpen: false,
  profileUserId: null,
  createGroupOpen: false,
  searchOpen: false,
  callModalOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  openProfilePanel: (userId) => set({ profilePanelOpen: true, profileUserId: userId }),
  closeProfilePanel: () => set({ profilePanelOpen: false, profileUserId: null }),
  setCreateGroupOpen: (open) => set({ createGroupOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setCallModalOpen: (open) => set({ callModalOpen: open }),
}));
