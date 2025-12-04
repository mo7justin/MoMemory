'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Key } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/shared/LanguageContext';
import { t } from '@/lib/locales';

export function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1); // 1: 输入邮箱, 2: 输入验证码和新密码
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { locale } = useLanguage();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

      // 调用注册接口发送验证码
      const response = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login_id: email,
          login_type: 'email',
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        // 如果用户已存在也没关系,验证码会发送
        if (response.status === 400 && data.detail === 'User already exists') {
          toast.success(t('codeSent', locale));
          setStep(2);
        } else {
          throw new Error(data.detail || '发送验证码失败');
        }
      } else {
        toast.success(t('codeSent', locale));
        setStep(2);
      }
    } catch (err: any) {
      console.error('发送验证码失败:', err);
      setError(err.message || '发送验证码失败,请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证新密码
    if (newPassword.length < 6) {
      setError('密码至少6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

      // 调用重置密码接口
      const response = await fetch(`${apiUrl}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login_id: email,
          login_type: 'email',
          verification_code: verificationCode,
          new_password: newPassword,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || '重置密码失败');
      }

      toast.success(t('passwordResetSuccess', locale));
      // 重置表单
      setEmail('');
      setVerificationCode('');
      setNewPassword('');
      setConfirmPassword('');
      setStep(1);
      setOpen(false);
    } catch (err: any) {
      console.error('重置密码失败:', err);
      setError(err.message || '重置密码失败,请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-sm font-bold underline text-purple-600 dark:text-purple-400"
        >
          {t('forgotPassword', locale)}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-black text-white">
        <DialogHeader>
          <DialogTitle className="text-white font-bold">{t('resetPassword', locale)}</DialogTitle>
          <DialogDescription className="text-white">
            {step === 1 ? t('enterEmailToSendCode', locale) : t('enterCodeAndNewPassword', locale)}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white font-semibold">{t('email', locale)}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-white" />
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-black text-white placeholder:text-white"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                {t('cancel', locale)}
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-black text-white font-semibold hover:bg-purple-600">
                {isLoading ? t('sending', locale) : t('sendCode', locale)}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-white font-semibold">{t('verificationCode', locale)}</Label>
              <div className="relative">
                <Key className="absolute left-3 top-3 h-4 w-4 text-white" />
                <Input
                  id="code"
                  type="text"
                  placeholder="6位数字验证码"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="pl-10 bg-black text-white placeholder:text-white"
                  required
                  disabled={isLoading}
                  maxLength={6}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-white font-semibold">{t('newPassword', locale)}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-white" />
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="至少6位"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 bg-black text-white placeholder:text-white"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white font-semibold">{t('confirmNewPassword', locale)}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-white" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="再次输入新密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 bg-black text-white placeholder:text-white"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setVerificationCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setError('');
                }}
                disabled={isLoading}
              >
                {t('previousStep', locale)}
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="bg-black text-white font-semibold hover:bg-purple-600"
                onClick={() => {
                  setTimeout(() => {
                    toast.success(t('passwordResetSuccess', locale));
                  }, 100);
                }}
              >
                {isLoading ? t('resetting', locale) : t('resetPasswordButton', locale)}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
