import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  isReportingAuthority?: boolean;
}

interface AuthState {
  user: User | null;
  hasHydrated: boolean;
  setAuth: (user: User) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      hasHydrated: false,
      setAuth: (user) => set({ user }),
      logout: () => set({ user: null }),
      hasPermission: (permission: string) =>
        get().user?.permissions?.includes(permission) ?? false,
      hasRole: (role: string) => get().user?.role === role,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
