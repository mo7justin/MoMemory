import { useState } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { setApps, setPlan, setTotalApps, setTotalMemories, PlanInfo } from '@/store/profileSlice';

export interface StatsTrendItem {
  date: string;
  apiUsage: number;
  memoryGrowth: number;
}

interface APIStatsResponse {
  total_memories: number;
  total_apps: number;
  apps: any[];
  plan?: PlanInfo;
}

interface UseStatsReturn {
  fetchStats: () => Promise<void>;
  fetchTrends: (days?: number) => Promise<StatsTrendItem[]>;
  isLoading: boolean;
  error: string | null;
  stats: {
      total_memories: number;
      total_apps: number;
  };
  plan: PlanInfo | null;
}

export const useStats = (): UseStatsReturn => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((state: RootState) => state.profile.userId);
  const profile = useSelector((state: RootState) => state.profile);

  // 优先使用环境变量，否则使用相对路径（依赖 Nginx 代理），避免移动端访问 localhost 失败
  const URL = process.env.NEXT_PUBLIC_API_URL || "";

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const uid = userId || (typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null);
      if (!uid) {
          setIsLoading(false);
          return;
      }
      const response = await axios.get<APIStatsResponse>(
        `${URL}/api/v1/stats?user_id=${uid}`
      );
      dispatch(setTotalMemories(response.data.total_memories));
      dispatch(setTotalApps(response.data.total_apps));
      dispatch(setApps(response.data.apps));
      dispatch(setPlan(response.data.plan || null));
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch stats';
      setError(errorMessage);
      // throw new Error(errorMessage); // Don't throw, just log
      console.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrends = async (days: number = 365): Promise<StatsTrendItem[]> => {
      try {
        const uid = userId || (typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null);
        if (!uid) return [];
        const response = await axios.get<StatsTrendItem[]>(
            `${URL}/api/v1/stats/trends?user_id=${uid}&days=${days}`
        );
        return response.data;
      } catch (err) {
        console.error(err);
        return [];
    }
  };

  return { 
      fetchStats, 
      fetchTrends,
      isLoading, 
      error,
      stats: {
          total_memories: profile.totalMemories,
          total_apps: profile.totalApps
      },
      plan: profile.plan,
  };
};