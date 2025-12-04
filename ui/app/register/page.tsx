"use client";

import React, { useState, useEffect } from 'react';
import { Languages } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/components/shared/LanguageContext';
import { t } from '@/lib/locales';
import { useTheme } from 'next-themes';
import { Moon, Sun, User, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';

const RegisterPage = () => {
  const { setTheme, theme } = useTheme();
  const { locale, setLocale } = useLanguage();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

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

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Register attempt with:', { username, email });
    // 跳转到设置密码页面,携带邮箱参数
    router.push(`/register/set-password?email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}`);
  };

  const handleSignInClick = () => {
    router.push('/login');
  };

  return (
    <div className={`fixed inset-0 w-full h-full overflow-hidden ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-gray-900'} font-sans`}>
      <div className="flex h-full w-full overflow-hidden">
        {/* 左侧注册区域 */}
        <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-12 relative overflow-hidden">
          {/* 主题切换按钮 */}
          <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`p-2 rounded-full transition-all ${theme === 'light' ? 'bg-white shadow-sm border border-gray-200' : 'bg-black shadow-sm border border-gray-800'}`} aria-label="Switch language">
                  <Languages size={18} className={theme === 'light' ? 'text-gray-800' : 'text-white'} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" className={theme === 'light' ? 'bg-white' : 'bg-black'}>
                <DropdownMenuItem onClick={() => setLocale('en')}>English</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocale('zh-CN')}>中文（简体）</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocale('zh-TW')}>中文（繁體）</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="w-full max-w-md space-y-8">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-64 h-16 flex items-center justify-center text-current mb-4">
                <img src="/logo.svg" alt="Mem0 Logo" className="object-contain w-full h-full" style={{ filter: theme === 'dark' ? 'brightness(0) invert(1)' : 'none' }} />
              </div>
              <h1 className="text-2xl font-semibold">{t('register', locale)}</h1>
            </div>

            <div className="space-y-4">
              {/* 注册表单 */}
              <div>
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  {/* 用户名 */}
                  <div>
                    <div className={`group flex items-center border ${theme === 'light' ? 'border-gray-500' : 'border-gray-500'} rounded-md overflow-hidden focus-within:border-gray-500`} style={{ height: '48px' }}>
                      <div className={`flex items-center justify-center px-3 ${theme === 'light' ? 'bg-transparent' : 'bg-transparent'}`}>
                        <User size={24} className={theme === 'light' ? 'text-gray-600' : 'text-white'} />
                      </div>
                      <div className="w-[2px] h-full bg-gray-200 dark:bg-gray-700 group-focus-within:!bg-[#7634F9] transition-colors duration-200"></div>
                      <Input
                        id="username"
                        type="text"
                        placeholder={String(locale).toLowerCase().startsWith('zh') ? '输入用户名' : 'Username'}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className={`w-full h-full px-4 py-2 rounded-none border-0 outline-none ${theme === 'light' ? 'bg-white text-gray-900' : 'bg-black text-white placeholder:text-white'} font-bold focus-visible:ring-0 focus-visible:ring-offset-0`}
                        style={{ caretColor: 'transparent' }}
                      />
                    </div>
                  </div>

                  {/* 邮箱 */}
                  <div>
                    <div className={`group flex items-center border ${theme === 'light' ? 'border-gray-500' : 'border-gray-500'} rounded-md overflow-hidden focus-within:border-gray-500`} style={{ height: '48px' }}>
                      <div className={`flex items-center justify-center px-3 ${theme === 'light' ? 'bg-transparent' : 'bg-transparent'}`}>
                        <Mail size={24} className={theme === 'light' ? 'text-gray-600' : 'text-white'} />
                      </div>
                      <div className="w-[2px] h-full bg-gray-200 dark:bg-gray-700 group-focus-within:!bg-[#7634F9] transition-colors duration-200"></div>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t('emailPlaceholder', locale)}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={`w-full h-full px-4 py-2 rounded-none border-0 outline-none ${theme === 'light' ? 'bg-white text-gray-900' : 'bg-black text-white placeholder:text-white'} font-bold focus-visible:ring-0 focus-visible:ring-offset-0`}
                        style={{ caretColor: 'transparent' }}
                      />
                    </div>
                  </div>

                  {/* 同意服务条款 */}
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="terms"
                      required
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-600"
                    />
                    <label htmlFor="terms" className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      {String(locale).toLowerCase().startsWith('zh') ? '同意 ' : 'Agree to '}
                      <a href="/privacypolicy" className="text-purple-600 hover:underline">
                        {String(locale).toLowerCase().startsWith('zh') ? '隐私政策' : 'Privacy Policy'}
                      </a>
                    </label>
                  </div>

                  {/* 继续按钮 */}
                  <Button 
                    type="submit" 
                    className={`w-full h-12 px-4 py-2 rounded-md ${theme === 'light' ? 'bg-black text-white hover:bg-purple-600' : 'bg-white text-black hover:bg-purple-700'} font-bold`}
                  >
                    {String(locale).toLowerCase().startsWith('zh') ? '继续' : 'Continue'}
                  </Button>
                </form>

                {/* 社交媒体注册选项 */}
                {/* 移除社交登录，仅保留邮箱注册 */}
            
                <div className="flex items-center justify-center mt-6 gap-1">
                  <span className="text-sm">
                    {String(locale).toLowerCase().startsWith('zh') ? '已有账号？' : 'Have an account?'}
                  </span>
                  <button
                    type="button"
                    onClick={handleSignInClick}
                    className={`text-sm font-bold underline ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}
                  >
                    {t('login', locale)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RegisterPage;
