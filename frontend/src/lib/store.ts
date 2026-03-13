import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "admin" | "lab_staff" | "student";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, access: string, refresh: string) => void;
  logout: () => void;
  isAdmin: () => boolean;
  isStaff: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken });
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", accessToken);
          localStorage.setItem("refresh_token", refreshToken);
        }
      },

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null });
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
      },

      isAdmin: () => get().user?.role === "admin",
      isStaff: () =>
        get().user?.role === "admin" || get().user?.role === "lab_staff",
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
