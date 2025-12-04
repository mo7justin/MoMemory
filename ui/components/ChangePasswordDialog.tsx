'use client';

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Key } from 'lucide-react';

interface ChangePasswordDialogProps {
  trigger?: React.ReactNode;
}

export function ChangePasswordDialog({ trigger }: ChangePasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const userId = useSelector((state: RootState) => state.profile.userId);

  // 简单判断：GitHub/OAuth 登录的 userId 不是邮箱格式
  const isEmailUser = typeof userId === 'string' && /.+@.+\..+/.test(userId);
  const [loginType, setLoginType] = useState<string | null>(null);
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('userInfo') : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.loginType === 'string') setLoginType(parsed.loginType);
      }
    } catch {}
  }, [open]);
  const isOauthUser = loginType && loginType !== 'email';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证新密码
    if (newPassword.length < 6) {
      setError('新密码至少6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    if (oldPassword === newPassword) {
      setError('新密码不能与旧密码相同');
      return;
    }

    setIsLoading(true);

    try {
      // 从 localStorage 获取用户邮箱
      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) {
        setError('请先登录');
        setIsLoading(false);
        return;
      }

      const user = JSON.parse(userInfo);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

      // 调用修改密码接口
      const response = await fetch(`${apiUrl}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login_id: user.email,
          old_password: oldPassword,
          new_password: newPassword,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || '修改密码失败');
      }

      alert('密码修改成功!');
      // 重置表单
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOpen(false);
    } catch (err: any) {
      console.error('修改密码失败:', err);
      setError(err.message || '修改密码失败,请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="w-full px-4 py-2 text-sm text-left text-foreground hover:bg-violet-50 dark:hover:bg-violet-900/20 flex items-center gap-2">
            <Key size={16} />
            修改密码
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>
            {isEmailUser && !isOauthUser
              ? '请输入旧密码和新密码'
              : '你已通过授权登录，无需密码。若需要本地密码，请到登录页用“Forgot password?”通过邮箱验证码设置。'}
          </DialogDescription>
        </DialogHeader>
        {isEmailUser && !isOauthUser ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oldPassword">旧密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="oldPassword"
                type="password"
                placeholder="输入当前密码"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="pl-10"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">新密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="newPassword"
                type="password"
                placeholder="至少6位"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setError('');
              }}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '修改中...' : '确认修改'}
            </Button>
          </div>
        </form>
        ) : (
          <div className="mt-4 text-sm">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              我知道了
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
