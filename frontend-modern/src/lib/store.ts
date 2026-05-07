import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser } from './types';

interface UserState {
  isLoggedIn: boolean;
  userDetails: AuthUser | null;
  activeRoute: string;
}

const getInitialUser = (): AuthUser | null => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('user');
    try {
      return saved ? (JSON.parse(saved) as AuthUser) : null;
    } catch {
      return null;
    }
  }
  return null;
};

const initialState: UserState = {
  isLoggedIn: !!getInitialUser(),
  userDetails: getInitialUser(),
  activeRoute: '0',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<AuthUser>) => {
      state.isLoggedIn = true;
      state.userDetails = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(action.payload));
      }
    },
    logout: (state) => {
      state.isLoggedIn = false;
      state.userDetails = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
      }
    },
    setActiveRoute: (state, action: PayloadAction<string>) => {
      state.activeRoute = action.payload;
    },
  },
});

export const { login, logout, setActiveRoute } = authSlice.actions;

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
