import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: (() => {
    try { return JSON.parse(localStorage.getItem('alsel_dashboard_user')); }
    catch { return null; }
  })(),
  token: localStorage.getItem('alsel_dashboard_token'),

  login: (user, token) => {
    localStorage.setItem('alsel_dashboard_token', token);
    localStorage.setItem('alsel_dashboard_user', JSON.stringify(user));
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('alsel_dashboard_token');
    localStorage.removeItem('alsel_dashboard_user');
    set({ user: null, token: null });
  },

  isSuperAdmin: () => {
    const state = useAuthStore.getState();
    return state.user?.role === 'superadmin';
  },

  isModerator: () => {
    const state = useAuthStore.getState();
    return ['superadmin', 'moderator'].includes(state.user?.role);
  },
}));

export default useAuthStore;