'use client';

import { TestPasswordDialogs } from '@/components/TestPasswordDialogs';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function TestPasswordPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  
  // 如果还在加载认证状态，显示加载状态
  if (isLoading) {
    return <div className="fixed inset-0 w-full h-full flex items-center justify-center">Loading...</div>;
  }
  
  // 如果用户未认证，重定向到登录页面
  if (!isAuthenticated) {
    router.push('/login');
    return <div className="fixed inset-0 w-full h-full flex items-center justify-center">Redirecting...</div>;
  }
  
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">密码管理功能测试</h1>
        <TestPasswordDialogs />
      </div>
    </div>
  );
}