import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface PlanInfo {
  id: string;
  name: string;
  tier: string;
  quota: number;
  price: number;
  currency: string;
  billing_cycle: string;
  status: string;
  purchase_date?: string;
  renewal_date?: string;
}

interface ProfileState {
  userId: string;
  totalMemories: number;
  totalApps: number;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  apps: any[];
  plan: PlanInfo | null;
}

function readCookieUserId(): string {
  try {
    if (typeof document === 'undefined') return '';
    const cookies = document.cookie || '';
    const match = cookies.match(/(?:^|; )userInfo=([^;]+)/);
    if (match && match[1]) {
      const json = decodeURIComponent(match[1]);
      const info = JSON.parse(json);
      return info.email || info.userId || info.unionid || info.openid || '';
    }
  } catch {}
  return '';
}

const initialState: ProfileState = {
  userId: typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || readCookieUserId() || '') : '',
  totalMemories: 0,
  totalApps: 0,
  status: 'idle',
  error: null,
  apps: [],
  plan: null,
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    setUserId: (state, action: PayloadAction<string>) => {
      state.userId = action.payload;
      // 同时保存到localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('userEmail', action.payload);
      }
    },
    setProfileLoading: (state) => {
      state.status = 'loading';
      state.error = null;
    },
    setProfileError: (state, action: PayloadAction<string>) => {
      state.status = 'failed';
      state.error = action.payload;
    },
    resetProfileState: (state) => {
      state.status = 'idle';
      state.error = null;
      // 优先使用localStorage中的用户邮箱，其次读取cookie中的userInfo
      if (typeof window !== 'undefined') {
        state.userId = localStorage.getItem('userEmail') || readCookieUserId() || state.userId || '';
      }
    },
    setTotalMemories: (state, action: PayloadAction<number>) => {
      state.totalMemories = action.payload;
    },
    setTotalApps: (state, action: PayloadAction<number>) => {
      state.totalApps = action.payload;
    },
    setApps: (state, action: PayloadAction<any[]>) => {
      state.apps = action.payload;
    },
    setPlan: (state, action: PayloadAction<PlanInfo | null>) => {
      state.plan = action.payload;
    },
  },
});

export const {
  setUserId,
  setProfileLoading,
  setProfileError,
  resetProfileState,
  setTotalMemories,
  setTotalApps,
  setApps,
  setPlan,
} = profileSlice.actions;

export default profileSlice.reducer;