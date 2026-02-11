import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../utils/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login({ email, password });
          const { token, user } = response.data;
          
          localStorage.setItem('token', token);
          set({ user, token, isLoading: false });
          
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.error || 'Login failed';
          set({ error: message, isLoading: false });
          return { success: false, error: message };
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register(data);
          const { token, user } = response.data;
          
          localStorage.setItem('token', token);
          set({ user, token, isLoading: false });
          
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.error || 'Registration failed';
          set({ error: message, isLoading: false });
          return { success: false, error: message };
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, error: null });
      },

      refreshUser: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
          const response = await authApi.getProfile();
          set({ user: response.data.user, token });
        } catch (error) {
          get().logout();
        }
      },

      updateProfile: async (data) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.updateProfile(data);
          await get().refreshUser();
          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.error || 'Update failed';
          set({ error: message, isLoading: false });
          return { success: false, error: message };
        }
      },

      isAdmin: () => get().user?.role === 'admin',
      isClient: () => get().user?.role === 'client',
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

export default useAuthStore;
