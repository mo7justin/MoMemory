"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Lock, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const SetPasswordPage = () => {
  // Captcha State
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { setTheme, theme } = useTheme();
  const router = useRouter();
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 从URL参数获取邮箱和用户名
  const email = searchParams.get('email') || '';
  const username = searchParams.get('username') || '';

  // 防止hydration错误
  useEffect(() => {
    setMounted(true);
  }, []);

  // 如果组件未挂载，返回一个简单的div避免hydration错误
  if (!mounted) {
    return (
      <div className="fixed inset-0 w-full h-full overflow-hidden bg-black">
        <div className="flex h-full w-full overflow-hidden">
          <div className="flex-1 flex flex-col justify-center items-center p-8 relative overflow-hidden">
            <div className="w-full max-w-md space-y-8">
              <div className="flex justify-center mb-6">
                <div className="w-40 h-10 flex items-center justify-center">
                  <img 
                    src="/logo.svg" 
                    alt="Mem0 Logo" 
                    className="object-contain w-full h-full" 
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
  };

  const fetchCaptcha = async () => {
    setLoadingCaptcha(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/v1/auth/captcha`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load captcha');

      const id = response.headers.get('X-Captcha-ID');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      setCaptchaId(id || '');
      setCaptchaUrl(url);
      setCaptchaInput('');
    } catch (error) {
      console.error('Error fetching captcha:', error);
      alert('无法加载验证码，请重试');
      // 关闭验证码弹窗
      setShowCaptcha(false);
    } finally {
      setLoadingCaptcha(false);
    }
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setShowCaptcha(true);
    fetchCaptcha();
  };

  const handleConfirmCaptcha = async () => {
    if (!captchaInput) return;

    // 获取API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    
    try {
      setIsSubmitting(true);
      // 调用后端API发送验证码(带上密码和图形验证码)
      const response = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login_id: email,
          login_type: 'email',
          name: username,
          password: password,
          captcha_id: captchaId,
          captcha_code: captchaInput
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        // 如果是验证码错误，刷新验证码
        if (data.detail && (data.detail.includes('验证码') || data.detail.includes('Captcha'))) {
            alert(data.detail);
            fetchCaptcha();
            setIsSubmitting(false);
            return;
        }

        // 根据不同的错误类型抛出具体错误
        if (data.detail && (data.detail.includes('User already exists') || data.detail.includes('用户已存在'))) {
          throw new Error('该邮箱已被注册，请直接登录');
        }
        throw new Error(data.detail || '发送验证码失败');
      }

      console.log('Verification code sent:', data);
      
      // 关闭验证码弹窗
      setShowCaptcha(false);

      // 保存用户信息
      const userInfo = {
        name: username || email.split('@')[0],
        email: email,
        loginType: 'email'
      };
      
      try {
        // 等待login方法完成，确保认证状态更新
        await login(userInfo);
        
        console.log('用户预登录成功，即将跳转到验证码页面');
        // 跳转到验证码页面
        router.push(`/register/verify-code?email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
      } catch (error) {
        // 即使状态更新失败，也尝试跳转到验证码页面，因为API调用已成功
        router.push(`/register/verify-code?email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
      }
    } catch (error) {
      console.error('Error sending verification code:', error);
      // 显示错误对象中的具体消息
      if (error instanceof Error) {
        // 对于用户已存在的错误，显示特定消息
        if (error.message.includes('User already exists') || error.message.includes('用户已存在') || error.message.includes('邮箱已被注册')) {
          alert('该邮箱已被注册，请直接登录');
        } else {
          alert(error.message);
        }
      } else {
        alert('发送验证码失败，请稍后再试');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`fixed inset-0 w-full h-full overflow-hidden ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-gray-900'} font-sans`}>
      <div className="flex h-full w-full overflow-hidden">
        {/* 左侧设置密码区域 */}
        <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-12 relative overflow-hidden">
          {/* 主题切换按钮 */}
          <div className="absolute top-6 right-6 z-50">
            <button
              onClick={() => handleThemeChange(theme === 'light' ? 'dark' : 'light')}
              className={`p-2 rounded-full transition-all ${theme === 'light' ? 'bg-white shadow-sm border border-gray-200' : 'bg-black shadow-sm border border-gray-800'}`}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <Sun size={18} className="text-gray-800" />
              ) : (
                <Moon size={18} className="text-white" />
              )}
            </button>
          </div>
          
          <div className="w-full max-w-md space-y-8">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-64 h-16 flex items-center justify-center text-current mb-4">
                <img 
                  src="/logo.svg" 
                  alt="Mem0 Logo" 
                  className="object-contain w-full h-full" 
                  style={{ 
                    filter: theme === 'dark' ? 'brightness(0) invert(1)' : 'none'
                  }}
                />
              </div>
              <h1 className="text-2xl font-semibold" style={{ fontFamily: '"AlimamaShuHeiTi", sans-serif' }}>设置密码</h1>
            </div>

            <div>
                <form onSubmit={handlePreSubmit} className="space-y-4">
                  {/* 显示邮箱(只读) */}
                  <div>
                    <div className={`flex items-center border ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} rounded-md overflow-hidden`} style={{ height: '48px' }}>
                      <div className={`flex items-center justify-center px-3 ${theme === 'light' ? 'bg-transparent' : 'bg-transparent'}`}>
                      </div>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        readOnly
                        className={`w-full h-full px-4 py-2 rounded-none border-0 outline-none ${theme === 'light' ? 'bg-gray-100 text-gray-500' : 'bg-gray-900 text-gray-400'} cursor-not-allowed`}
                      />
                    </div>
                  </div>

                  {/* 密码输入框 */}
                  <div>
                    <div className={`flex items-center border ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} rounded-md overflow-hidden`} style={{ height: '48px' }}>
                      <div className={`flex items-center justify-center px-3 ${theme === 'light' ? 'bg-transparent' : 'bg-transparent'}`}>
                        <Lock size={24} className={theme === 'light' ? 'text-gray-600' : 'text-gray-300'} />
                      </div>
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="输入密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={`w-full h-full px-4 py-2 rounded-none border-0 outline-none ${theme === 'light' ? 'bg-white text-gray-900' : 'bg-black text-white'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="px-3 flex items-center justify-center"
                      >
                        {showPassword ? (
                          <EyeOff size={20} className={theme === 'light' ? 'text-gray-600' : 'text-gray-300'} />
                        ) : (
                          <Eye size={20} className={theme === 'light' ? 'text-gray-600' : 'text-gray-300'} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 下一步按钮 */}
                  <Button 
                    type="submit" 
                    className={`w-full h-12 px-4 py-2 rounded-md font-medium ${theme === 'light' ? 'bg-black text-white hover:bg-purple-600' : 'bg-white text-black hover:bg-purple-700'}`}
                    style={{ fontFamily: '"AlimamaShuHeiTi", sans-serif' }}
                  >
                    下一步
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>

      {/* Captcha Dialog */}
      <Dialog open={showCaptcha} onOpenChange={setShowCaptcha}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>安全验证</DialogTitle>
            <DialogDescription>
              请输入下方的图形验证码以继续
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center gap-2 justify-center">
               {/* Captcha Image */}
               <div className="h-12 bg-muted rounded overflow-hidden flex items-center justify-center relative w-32">
                 {loadingCaptcha ? (
                   <span className="text-xs text-muted-foreground">Loading...</span>
                 ) : (
                   captchaUrl && <img src={captchaUrl} alt="Captcha" className="w-full h-full object-cover" />
                 )}
               </div>
               <Button variant="outline" size="icon" onClick={fetchCaptcha} disabled={loadingCaptcha}>
                 <RefreshCw className={`h-4 w-4 ${loadingCaptcha ? 'animate-spin' : ''}`} />
               </Button>
            </div>
            
            <Input
              placeholder="输入4位验证码"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              className="text-center text-lg tracking-widest"
              maxLength={4}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    handleConfirmCaptcha();
                }
              }}
            />
          </div>
          
          <DialogFooter className="sm:justify-end">
            <Button variant="secondary" onClick={() => setShowCaptcha(false)}>
              取消
            </Button>
            <Button type="button" onClick={handleConfirmCaptcha} disabled={!captchaInput || isSubmitting}>
              {isSubmitting ? '提交中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SetPasswordPage;
