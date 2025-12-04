import axios from 'axios'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'

export interface AdminUserItem {
  id: string
  user_id: string
  email?: string
  name?: string
  apps_count: number
  memories_count: number
  created_at: string
}

export function useAdminApi() {
  const user_id = useSelector((state: RootState) => state.profile.userId)
  const URL = typeof process.env.NEXT_PUBLIC_API_URL === 'string' && process.env.NEXT_PUBLIC_API_URL.trim() ? process.env.NEXT_PUBLIC_API_URL.trim() : ''

  const fetchUsers = async (page = 1, size = 20): Promise<{items: AdminUserItem[]; total: number; pages: number}> => {
    let uid = user_id
    if (!uid && typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('userInfo')
        if (raw) {
          const obj = JSON.parse(raw)
          uid = obj?.userId || obj?.email || ''
        }
      } catch {}
    }
    const tryFetch = async (path: string) => {
      const res = await axios.get(`${URL}${path}`, { params: { user_id: uid, page, size } })
      const data = res.data ?? {}
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.list)
            ? data.list
            : Array.isArray(data.data)
              ? data.data
              : []
      const total = data.total ?? data.count ?? list.length
      const pages = data.pages ?? (size > 0 ? Math.ceil(total / size) : 1)
      return { items: list, total, pages }
    }
    try {
      return await tryFetch('/api/v1/admin/users')
    } catch (e: any) {
      if (e?.response?.status === 404 || e?.response?.status === 405 || e?.response?.status === 400) {
        try {
          return await tryFetch('/api/admin/users/list')
        } catch {
          return await tryFetch('/api/v1/users')
        }
      }
      throw e
    }
  }

  return { fetchUsers }
}