"use client";

import { useEffect, useState } from "react";
import { useAdminApi } from "@/hooks/useAdminApi";

export default function AdminUsersPage() {
  const { fetchUsers } = useAdminApi();
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const columns = [
    { key: 'login_type', label: '登录方式' },
    { key: 'user_id', label: '用户ID' },
    { key: 'apps_count', label: '应用数量' },
    { key: 'memories_count', label: '记忆数量' },
    { key: 'device_names', label: '设备名称' },
    { key: 'device_urls', label: 'WebSocket URL' },
    { key: 'created_at', label: '注册时间' },
    { key: 'last_login_at', label: '最近登录时间' },
  ];

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchUsers(1, 50);
        const items = Array.isArray(res.items) ? res.items : [];
        setUsers(items);
      } catch (e: any) {
        const msg = e?.response?.data?.detail || e?.message || "加载失败";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  if (loading) {
    return <div className="p-6">加载中...</div>;
  }
  if (error) {
    return (
      <div className="p-6">
        <div className="text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">管理员用户列表未启用</div>
        <div className="mt-2 text-muted-foreground text-sm">{String(error)}</div>
      </div>
    );
  }

  return (
    <div className="container p-6">
      <h1 className="text-xl font-semibold mb-4">注册用户</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            {columns.map(c => (
              <th key={c.key} className="py-2">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.isArray(users) && users.map((u: any, idx: number) => (
            <tr key={u.user_id || u.id || idx} className="border-b">
              <td className="py-2">
                <span className="capitalize">{u.login_type || 'Email'}</span>
              </td>
              <td className="py-2">{u.user_id || '-'}</td>
              <td className="py-2">{u.apps_count ?? '-'}</td>
              <td className="py-2">{u.memories_count ?? '-'}</td>
              <td className="py-2">
                {u.devices && u.devices.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {u.devices.map((d: any, i: number) => (
                      <span key={i} className="block whitespace-nowrap text-xs text-muted-foreground">
                        {d.name || '-'}
                      </span>
                    ))}
                  </div>
                ) : '-'}
              </td>
              <td className="py-2">
                {u.devices && u.devices.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {u.devices.map((d: any, i: number) => (
                      <span key={i} className="block max-w-[300px] break-all text-xs text-muted-foreground">
                        {d.url || '-'}
                      </span>
                    ))}
                  </div>
                ) : '-'}
              </td>
              <td className="py-2">{u.created_at ? new Date(u.created_at).toLocaleString() : '-'}</td>
              <td className="py-2">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}