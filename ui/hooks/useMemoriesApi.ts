import { useState, useCallback } from 'react';
import axios from 'axios';
import { Memory, Client, Category } from '@/components/types';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { setAccessLogs, setMemoriesSuccess, setSelectedMemory, setRelatedMemories } from '@/store/memoriesSlice';

// Define the new simplified memory type
export interface SimpleMemory {
  id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  state: string;
  categories: string[];
  app_name: string;
  app_id?: string;
  metadata?: Record<string, any>;
}

// Define the shape of the API response item
interface ApiMemoryItem {
  id: string;
  content: string;
  created_at: string;
  state: string;
  app_id: string;
  categories: string[];
  metadata_?: Record<string, any>;
  app_name: string;
}

// Define the shape of the API response
interface ApiResponse {
  items: ApiMemoryItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

interface AccessLogEntry {
  id: string;
  app_name: string;
  accessed_at: string;
  metadata_?: Record<string, any>;
}

interface AccessLogResponse {
  total: number;
  page: number;
  page_size: number;
  logs: AccessLogEntry[];
}

interface RelatedMemoryItem {
  id: string;
  content: string;
  created_at: number;
  state: string;
  app_id: string;
  app_name: string;
  categories: string[];
  metadata_: Record<string, any>;
}

interface RelatedMemoriesResponse {
  items: RelatedMemoryItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

interface UserEndpointItem {
  endpoint_url: string;
  device_name?: string;
  app_name?: string;
  agent_id?: string;
}

interface UserAppItem {
  id: string;
  name: string;
  device_name?: string;
  websocket_url?: string;
  agent_id?: string;
  metadata_?: Record<string, any>;
}

interface UseMemoriesApiReturn {
  fetchMemories: (
    query?: string,
    page?: number,
    size?: number,
    filters?: {
      apps?: string[];
      categories?: string[];
      sortColumn?: string;
      sortDirection?: 'asc' | 'desc';
      showArchived?: boolean;
    }
  ) => Promise<{ memories: Memory[]; total: number; pages: number }>;
  fetchMemoryById: (memoryId: string) => Promise<void>;
  fetchAccessLogs: (memoryId: string, page?: number, pageSize?: number) => Promise<void>;
  fetchRelatedMemories: (memoryId: string) => Promise<void>;
  createMemory: (text: string) => Promise<void>;
  deleteMemories: (memoryIds: string[]) => Promise<void>;
  updateMemory: (memoryId: string, content: string) => Promise<void>;
  updateMemoryState: (memoryIds: string[], state: string) => Promise<void>;
  fetchUserEndpoints: () => Promise<UserEndpointItem[]>;
  isLoading: boolean;
  error: string | null;
  hasUpdates: number;
  memories: Memory[];
  selectedMemory: SimpleMemory | null;
  userEndpoints: UserEndpointItem[];
}

// TypeScript declaration for Node.js process
interface ProcessEnv {
  NODE_ENV?: string;
  NEXT_PUBLIC_API_URL?: string;
}

declare const process: {
  env: ProcessEnv;
};

export const useMemoriesApi = (): UseMemoriesApiReturn => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUpdates, setHasUpdates] = useState<number>(0);
  const [userEndpoints, setUserEndpoints] = useState<UserEndpointItem[]>([]);
  const dispatch = useDispatch<AppDispatch>();
  const user_id = useSelector((state: RootState) => state.profile.userId);
  const memories = useSelector((state: RootState) => state.memories.memories);
  const selectedMemory = useSelector((state: RootState) => state.memories.selectedMemory);

  const URL = typeof process.env.NEXT_PUBLIC_API_URL === 'string' && process.env.NEXT_PUBLIC_API_URL.trim() ? process.env.NEXT_PUBLIC_API_URL.trim() : '';

  const fetchMemories = useCallback(async (
    query?: string,
    page: number = 1,
    size: number = 10,
    filters?: {
      apps?: string[];
      categories?: string[];
      sortColumn?: string;
      sortDirection?: 'asc' | 'desc';
      showArchived?: boolean;
    }
  ): Promise<{ memories: Memory[], total: number, pages: number }> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post<ApiResponse>(
        `${URL}/api/v1/memories/filter`,
        {
          user_id: user_id,
          page: page,
          size: size,
          search_query: query,
          app_ids: filters?.apps,
          category_ids: filters?.categories,
          sort_column: filters?.sortColumn?.toLowerCase(),
          sort_direction: filters?.sortDirection,
          show_archived: filters?.showArchived
        }
      );

      const adaptedMemories: Memory[] = response.data.items.map((item: ApiMemoryItem) => ({
        id: item.id,
        memory: item.content,
        created_at: (function(){
          try {
            const ts = new Date(item.created_at).getTime();
            return Number.isFinite(ts) ? ts : Date.now();
          } catch { return Date.now(); }
        })(),
        state: item.state as "active" | "paused" | "archived" | "deleted",
        metadata: item.metadata_,
        categories: item.categories as Category[],
        client: 'api',
        app_name: item.app_name
      }));
      setIsLoading(false);
      dispatch(setMemoriesSuccess(adaptedMemories));
      return {
        memories: adaptedMemories,
        total: response.data.total,
        pages: response.data.pages
      };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch memories';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  }, [user_id, dispatch]);

  const createMemory = async (text: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      // 检查user_id是否存在
      if (!user_id) {
        throw new Error('User ID is required');
      }
      
      // 获取用户名，如果不存在则使用user_id
      let username = user_id;
      try {
        const response = await axios.get(`${URL}/api/v1/auth/profile?user_id=${user_id}`);
        if (response.data && response.data.name) {
          username = response.data.name;
        }
      } catch (err) {
        console.warn('Failed to fetch user profile, using user_id as username');
      }
      
      // 为每个用户创建特定的应用名称
      const userAppName = `MoMemory-${username}`;
      
      const memoryData = {
        user_id: user_id,
        text: text,
        infer: true,
        app: userAppName,
        metadata: {}
      };
      
      const response = await axios.post<ApiMemoryItem>(`${URL}/api/v1/memories/`, memoryData);
      
      // 处理各种可能的错误响应格式
      if (response.data) {
        if (typeof response.data === 'string') {
          throw new Error(response.data);
        } else if (typeof response.data === 'object' && 'error' in response.data) {
          throw new Error(String(response.data.error));
        } else if (typeof response.data === 'object' && 'message' in response.data) {
          throw new Error(String(response.data.message));
        }
      }
      
      setIsLoading(false);
      setHasUpdates(hasUpdates + 1);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create memory';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  };

  const deleteMemories = async (memory_ids: string[]) => {
    try {
      await axios.delete(`${URL}/api/v1/memories/`, {
        data: { memory_ids, user_id }
      });
      dispatch(setMemoriesSuccess(memories.filter((memory: Memory) => !memory_ids.includes(memory.id))));
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete memories';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  };

  const fetchMemoryById = async (memoryId: string): Promise<void> => {
    if (memoryId === "") {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<SimpleMemory>(
        `${URL}/api/v1/memories/${memoryId}?user_id=${user_id}`
      );
      
      // Transform the API response to match SimpleMemory interface
      const transformedMemory: SimpleMemory = {
        id: response.data.id,
        content: response.data.content,
        created_at: response.data.created_at,
        updated_at: (response.data as any).updated_at,
        state: response.data.state,
        categories: response.data.categories,
        app_name: response.data.app_name,
        app_id: (response.data as any).app_id,
        metadata: (response.data as any).metadata_
      };
      
      setIsLoading(false);
      dispatch(setSelectedMemory(transformedMemory));
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch memory';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  };

  const fetchAccessLogs = async (memoryId: string, page: number = 1, pageSize: number = 10): Promise<void> => {
    if (memoryId === "") {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<AccessLogResponse>(
        `${URL}/api/v1/memories/${memoryId}/access-log?user_id=${encodeURIComponent(user_id)}&page=${page}&page_size=${pageSize}`
      );
      setIsLoading(false);
      // 保留服务端返回的完整字段（含 metadata_）供详情页使用
      dispatch(setAccessLogs(response.data.logs as any));
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch access logs';
      setError(errorMessage);
      setIsLoading(false);
      // 不抛错，避免阻断对话渲染
    }
  };

  const fetchRelatedMemories = async (memoryId: string): Promise<void> => {
    if (memoryId === "") {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<RelatedMemoriesResponse>(
        `${URL}/api/v1/memories/${memoryId}/related?user_id=${user_id}`
      );

      const adaptedMemories: Memory[] = response.data.items.map((item: RelatedMemoryItem) => ({
        id: item.id,
        memory: item.content,
        created_at: item.created_at,
        state: item.state as "active" | "paused" | "archived" | "deleted",
        metadata: item.metadata_,
        categories: item.categories as Category[],
        client: 'api',
        app_name: item.app_name
      }));

      setIsLoading(false);
      dispatch(setRelatedMemories(adaptedMemories));
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch related memories';
      setError(errorMessage);
      setIsLoading(false);
      dispatch(setRelatedMemories([]));
      // 不抛出错误，避免阻断抽屉打开
    }
  };

  const fetchUserEndpoints = async (): Promise<UserEndpointItem[]> => {
    try {
      const response = await axios.get(`${URL}/api/v1/auth/user/${encodeURIComponent(user_id || '')}/endpoints`);
      const raw = (response.data?.items ?? response.data?.endpoints) as any[] | undefined;
      const items: UserEndpointItem[] = Array.isArray(raw)
        ? raw.map((it: any) => ({
            endpoint_url: it.endpoint_url || it.websocket_url || '',
            device_name: it.device_name || it.name,
            app_name: it.app_name || it.name,
            agent_id: it.agent_id || it.metadata_?.agent_id,
          }))
        : [];
      setUserEndpoints(items);
      return items;
    } catch (err: any) {
      setUserEndpoints([]);
      return [];
    }
  };

  const fetchUserApps = async (): Promise<UserAppItem[]> => {
    try {
      const resp = await axios.get(`${URL}/api/v1/apps/`, {
        params: { user_id: user_id, page: 1, page_size: 50, sort_by: 'name', sort_direction: 'asc' }
      });
      const raw = (resp.data?.items ?? resp.data?.apps) as any[] | undefined;
      const items: UserAppItem[] = Array.isArray(raw)
        ? raw.map((it: any) => ({
            id: it.id,
            name: it.name,
            device_name: it.device_name || it.metadata_?.device_name,
            websocket_url: it.websocket_url || it.metadata_?.device_identifier,
            agent_id: it.agent_id || it.metadata_?.agent_id,
            metadata_: it.metadata_
          }))
        : [];
      return items;
    } catch {
      return [];
    }
  };

  const fetchAppById = async (appId: string): Promise<UserAppItem | null> => {
    try {
      const resp = await axios.get(`${URL}/api/v1/apps/${appId}`);
      const it: any = resp.data || {};
      return {
        id: it.id,
        name: it.name,
        device_name: it.device_name || it.metadata_?.device_name,
        websocket_url: it.websocket_url || it.metadata_?.device_identifier,
        agent_id: it.agent_id || it.metadata_?.agent_id,
        metadata_: it.metadata_
      } as UserAppItem;
    } catch {
      return null;
    }
  };

  const updateMemory = async (memoryId: string, content: string): Promise<void> => {
    if (memoryId === "") {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await axios.put(`${URL}/api/v1/memories/${memoryId}`, {
        memory_id: memoryId,
        memory_content: content,
        user_id: user_id
      });
      setIsLoading(false);
      await fetchMemoryById(memoryId);
      // 同步更新列表中的该记忆文本
      dispatch(setMemoriesSuccess(memories.map((m: Memory) => (m.id === memoryId ? { ...m, memory: content } : m))));
      // 刷新该记忆的访问日志
      await fetchAccessLogs(memoryId, 1, 10);
      setHasUpdates(hasUpdates + 1);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update memory';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  };

  const updateMemoryState = async (memoryIds: string[], state: string): Promise<void> => {
    if (memoryIds.length === 0) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await axios.post(`${URL}/api/v1/memories/actions/update-state`, {
        memory_ids: memoryIds.map(id => id), // 确保转换为UUID格式
        state: state,
        user_id: user_id
      });
      dispatch(setMemoriesSuccess(memories.map((memory: Memory) => {
        if (memoryIds.includes(memory.id)) {
          return { ...memory, state: state as "active" | "paused" | "archived" | "deleted" };
        }
        return memory;
      })));

      // If archive, delete the memory
      if (state === "archived") {
        dispatch(setMemoriesSuccess(memories.filter((memory: Memory) => !memoryIds.includes(memory.id))));
      }

      // if selected memory, update it
      if (selectedMemory?.id && memoryIds.includes(selectedMemory.id)) {
        dispatch(setSelectedMemory({ ...selectedMemory, state: state as "active" | "paused" | "archived" | "deleted" }));
      }

      setIsLoading(false);
      setHasUpdates(hasUpdates + 1);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update memory state';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  };

  return {
    fetchMemories,
    fetchMemoryById,
    fetchAccessLogs,
    fetchRelatedMemories,
    fetchUserEndpoints,
    fetchUserApps,
    fetchAppById,
    createMemory,
    deleteMemories,
    updateMemory,
    updateMemoryState,
    isLoading,
    error,
    hasUpdates,
    memories,
    selectedMemory,
    userEndpoints
  };
};