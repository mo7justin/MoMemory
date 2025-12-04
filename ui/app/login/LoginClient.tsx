'use client';
import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Mail, Lock, Languages } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { setUserId } from '@/store/profileSlice';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useLanguage } from '@/components/shared/LanguageContext';
import { t } from '@/lib/locales';

export default function LoginClient() {
  const { setTheme, theme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const { login } = useAuth();
  const { locale, setLocale } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | undefined>(undefined);
  const [authType, setAuthType] = useState<'wx' | 'qq' | undefined>(undefined);

  useEffect(() => { setMounted(true); console.log('LoginClient v4 loaded'); }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const oauth = searchParams?.get('oauth');
      if (oauth === 'github' || oauth === 'google' || oauth === 'qq' || oauth === 'wechat' || oauth === 'facebook' || oauth === 'whatsapp' || oauth === 'gitee') {
        const nameParam = searchParams.get('name') || '';
        const emailParam = searchParams.get('email') || '';
        const avatarParam = searchParams.get('avatar') || '';
        const fallbackName = emailParam ? emailParam.split('@')[0] : (oauth === 'github' ? 'GitHubUser' : oauth === 'google' ? 'GoogleUser' : oauth === 'qq' ? 'QQUser' : oauth === 'wechat' ? 'WeChatUser' : oauth === 'facebook' ? 'FacebookUser' : oauth === 'whatsapp' ? 'WhatsAppUser' : 'GiteeUser');
        const info: any = { name: nameParam || fallbackName, email: emailParam || undefined, loginType: oauth, avatar: avatarParam || undefined };
        try { localStorage.setItem('userInfo', JSON.stringify(info)); } catch {}
        try { localStorage.setItem('userEmail', emailParam || ''); } catch {}
        dispatch(setUserId(emailParam || nameParam || (oauth === 'github' ? 'github_user' : oauth === 'google' ? 'google_user' : oauth === 'qq' ? 'qq_user' : 'wechat_user')));
        login(info).then(() => { router.replace('/dashboard'); }).catch((e: any) => { toast.error(e?.message || t('authLoginFailed', locale)); });
      }
    } catch {}
  }, [mounted, searchParams]);

  const isOAuthRedirecting = typeof window !== 'undefined' && (searchParams?.get('oauth') ? true : false);
  useEffect(() => {
    if (!mounted) return;
    return () => {};
  }, [mounted]);

  useEffect(() => { return () => {}; }, [mounted]);
  if (!mounted) {
    return (
      <div className="fixed inset-0 w-full h-full overflow-hidden bg-white">
        <div className="flex h-full w-full overflow-hidden">
          <div className="flex-1 flex flex-col justify-center items-center p-8 relative overflow-hidden">
            <div className="w-full max-w-md space-y-8">
              <div className="flex justify-center mb-6">
                <div className="w-40 h-10 flex items-center justify-center">
                  <img src="/logo.svg" alt="Mem0 Logo" className="object-contain w-full h-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const oauthParam = searchParams?.get('oauth');
  if (oauthParam) return <div className={`fixed inset-0 w-full h-full overflow-hidden ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}></div>;

  const handleThemeChange = (newTheme: string) => { setTheme(newTheme); };

  const startAggAuthorize = async (t: 'wx' | 'qq') => {
    window.location.href = `/api/v1/auth/oauth/agg/${t}/authorize`;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiUrl = envUrl || '';
    try {
      const requestBody = { login_id: email, login_type: 'email', password };
      const response = await fetch(`${apiUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody), credentials: 'include' });
      
      // 首先尝试解析 JSON
      let data: any = null;
      const text = await response.text();
      try {
        if (text) data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse login response:', text);
      }

      if (!response.ok) {
        // 如果没有 data，直接抛出状态码错误
        if (!data) {
            throw new Error(`Login failed: ${response.status} ${response.statusText}`);
        }
        
        const detail = data.detail;
        let errorMessage = detail || t('loginFailed', locale);
        if (detail === 'User not found') errorMessage = t('userNotFound', locale);
        if (detail === 'Invalid password') errorMessage = t('invalidPassword', locale);
        if (detail === 'Invalid verification code') errorMessage = t('invalidVerificationCode', locale);
        if (detail === 'Password not set. Please use verification code login') errorMessage = t('passwordNotSet', locale);
        if (detail === 'Password or verification code required') errorMessage = t('passwordOrCodeRequired', locale);
        if (detail === 'User not found. Please register first') errorMessage = t('userNotFoundRegisterFirst', locale);
        // 如果是 "User not found"，我们给用户更友好的提示或直接跳转到注册
        if (detail === 'User not found') {
            // 暂时还是显示错误，或者你可以改成 router.push('/register')
            errorMessage = t('userNotFound', locale);
        }
        throw new Error(errorMessage);
      }
      
      if (!data.user && !data.data?.user) throw new Error(t('loginSuccessNoUser', locale));
      const userData = data.user || data.data.user;
      const userInfo = { name: userData?.name || userData?.user_id?.split('@')[0] || email.split('@')[0], email: userData?.email || userData?.user_id || email, loginType: userData?.login_type || 'email', userId: userData?.user_id || email, ...userData };
      await login(userInfo);
      dispatch(setUserId(userData?.user_id || email));
      setTimeout(() => { router.replace('/dashboard'); }, 100);
    } catch (error: any) { toast.error(error.message || t('loginFailedRetry', locale)); }
  };

  const inputTextClasses = theme === 'light'
    ? 'bg-white text-gray-600 placeholder:text-gray-400'
    : 'bg-black text-gray-200 placeholder:text-gray-400';

  const renderSocialButtons = () => {
    // 如果是简体中文环境
    if (locale === 'zh-CN') {
        return (
            <>
              <button onClick={() => startAggAuthorize('wx')} className={`w-full flex items-center justify-center space-x-3 p-3 rounded-md cursor-pointer ${theme === 'light' ? 'bg-white border border-gray-300 text-black hover:bg-gray-50' : 'bg-black border border-gray-700 text-white hover:bg-gray-900'}`}>
                <svg viewBox="0 0 24 24" width="30" height="30" fill="#07C160"><path d="M2.224 21.667s4.24-1.825 4.788-2.056C15.029 23.141 22 17.714 22 11.898 22 6.984 17.523 3 12 3S2 6.984 2 11.898c0 1.86.64 3.585 1.737 5.013-.274.833-1.513 4.756-1.513 4.756zm5.943-9.707c.69 0 1.25-.569 1.25-1.271a1.26 1.26 0 0 0-1.25-1.271c-.69 0-1.25.569-1.25 1.27 0 .703.56 1.272 1.25 1.272zm7.583 0c.69 0 1.25-.569 1.25-1.271a1.26 1.26 0 0 0-1.25-1.271c-.69 0-1.25.569-1.25 1.27 0 .703.56 1.272 1.25 1.272z" fillRule="evenodd"/></svg>
                <span className="text-base font-semibold">{t('wechatLogin', locale)}</span>
              </button>
              <a href={`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/auth/oauth/qq/authorize`} className={`w-full flex items-center justify-center space-x-3 p-3 rounded-md cursor-pointer ${theme === 'light' ? 'bg-white border border-gray-300 text-black hover:bg-gray-50' : 'bg-black border border-gray-700 text-white hover:bg-gray-900'}`}>
                <svg viewBox="0 0 24 24" width="30" height="30" fill="#12B7F5"><path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-1.77 1.182 0 .686 4.078.43 6.29 0 2.239.425 6.287.687 6.287 0 0-.688-1.768-1.182-1.768-1.182 2.085-1.77 1.905-3.967 1.905-3.967.845 1.588 1.634 2.072 1.746 2.072.111 0 .283-.36.283-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.29 3.364 14.268 2 12.003 2z" fillRule="evenodd"/></svg>
                <span className="text-base font-semibold flex items-center justify-center h-full">{t('qqLogin', locale)}</span>
              </a>
              <a href={`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/auth/oauth/gitee/authorize`} className={`w-full flex items-center justify-center space-x-3 p-3 rounded-md cursor-pointer ${theme === 'light' ? 'bg-white border border-gray-300 text-black hover:bg-gray-50' : 'bg-black border border-gray-700 text-white hover:bg-gray-900'}`}>
                <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.592-.593h-4.15a.592.592 0 0 1-.592-.592v-1.482a.593.593 0 0 1 .593-.592h6.815c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.445-4.444h8.296z"/>
                </svg>
                <span className="text-base font-semibold flex items-center justify-center h-full">{t('giteeLogin', locale)}</span>
              </a>
            </>
        );
    }
    
    // 非中文环境 (English, zh-TW, etc.)
    return (
        <>
            {/* Google */}
            <a 
            href={`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/auth/oauth/google/authorize`}
            className={`w-full flex items-center justify-center space-x-3 p-3 rounded-md cursor-pointer ${theme === 'light' ? 'bg-white border border-gray-300 text-black hover:bg-gray-50' : 'bg-black border border-gray-700 text-white hover:bg-gray-900'}`}
            >
            <svg width="22" height="22" viewBox="0 0 256 262" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M255.86 133.45c0-10.63-.86-18.37-2.72-26.4H130.5v47.93h72.29c-1.46 11.86-9.36 29.77-26.87 41.83l-.24 1.6 39.02 30.25 2.7.27c24.78-22.84 38.44-56.42 38.44-95.48"/>
                <path fill="#34A853" d="M130.5 261c35.48 0 65.27-11.66 87.01-31.65l-41.49-32.12c-11.11 7.75-26.03 13.17-45.52 13.17-34.78 0-64.34-22.85-74.88-54.56l-1.55.13-40.57 31.38-.53 1.47C35.49 229.61 79.76 261 130.5 261"/>
                <path fill="#FBBC05" d="M55.62 156.84c-2.81-8.03-4.42-16.59-4.42-25.53 0-8.93 1.61-17.5 4.31-25.53l-.07-1.71-41.06-31.82-1.35.64C4.71 88.63 0 108.24 0 128.81c0 20.58 4.71 40.18 13.03 56.71l42.59-33.43"/>
                <path fill="#EB4335" d="M130.5 50.43c24.67 0 41.28 10.67 50.75 19.6l36.98-36.15C195.71 15.5 165.98 0 130.5 0 79.76 0 35.49 31.4 13.03 72.09l42.59 33.43C66.16 73.8 95.72 50.43 130.5 50.43"/>
            </svg>
            <span className="text-base font-semibold">{t('googleLogin', locale)}</span>
            </a>

            {/* Facebook */}
            <a 
            href={`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/auth/oauth/facebook/authorize`}
            className={`w-full flex items-center justify-center space-x-3 p-3 rounded-md cursor-pointer ${theme === 'light' ? 'bg-white border border-gray-300 text-black hover:bg-gray-50' : 'bg-black border border-gray-700 text-white hover:bg-gray-900'}`}
            >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.962.925-1.962 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span className="text-base font-semibold">{t('facebookLogin', locale)}</span>
            </a>

            {/* GitHub */}
            <a 
            href={`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/auth/oauth/github/authorize`}
            className={`w-full flex items-center justify-center space-x-3 p-3 rounded-md cursor-pointer ${theme === 'light' ? 'bg-white border border-gray-300 text-black hover:bg-gray-50' : 'bg-black border border-gray-700 text-white hover:bg-gray-900'}`}
            >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.41 7.86 10.94.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.29-1.69-1.29-1.69-1.06-.73.08-.72.08-.72 1.17.08 1.78 1.2 1.78 1.2 1.04 1.77 2.74 1.26 3.41.96.11-.75.41-1.26.75-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.2-3.09-.12-.29-.52-1.46.11-3.05 0 0 .98-.31 3.2 1.18.93-.26 1.93-.39 2.93-.4 1 .01 2 .14 2.93.4 2.22-1.49 3.2-1.18 3.2-1.18.64 1.59.24 2.76.12 3.05.75.8 1.2 1.83 1.2 3.09 0 4.43-2.69 5.41-5.25 5.69.42.37.8 1.1.8 2.22 0 1.6-.01 2.89-.01 3.29 0 .31.2.68.8.56C20.21 21.41 23.5 17.09 23.5 12 23.5 5.73 18.27.5 12 .5z"/>
            </svg>
            <span className="text-base font-semibold">{t('githubLogin', locale)}</span>
            </a>
        </>
    );
  };

  return (
    <div className={`fixed inset-0 w-full h-full overflow-hidden ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-gray-900'} font-sans`}>
      <div className="flex h-full w-full overflow-hidden">
        <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-12 pt-16 md:pt-12 pb-20 md:pb-0 relative overflow-y-auto md:overflow-hidden">
          
          <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
            <button onClick={() => handleThemeChange(theme === 'light' ? 'dark' : 'light')} className={`p-2 rounded-full transition-all ${theme === 'light' ? 'bg-white shadow-sm border border-gray-200' : 'bg-black shadow-sm border border-gray-800'}`} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              {theme === 'light' ? <Sun size={18} className="text-gray-800" /> : <Moon size={18} className="text-white" />}
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
            <div className="flex flex-col items-start md:items-center mb-6">
              <div className="w-48 h-12 md:w-64 md:h-16 flex items-center justify-start md:justify-center text-current mb-2 mt-0 md:mt-0">
                <img src="/logo.svg" alt="Mem0 Logo" className="object-contain w-full h-full" style={{ filter: theme === 'dark' ? 'brightness(0) invert(1)' : 'none' }} />
              </div>
              <h1 className="text-xl font-semibold mt-2 md:mt-0">{t('login', locale)}</h1>
            </div>
            <div className="space-y-4">
              
              {renderSocialButtons()}

              <div className="flex items-center space-x-4">
                <Separator className="flex-1" />
                <span className="text-sm font-bold text-gray-500 dark:text-white">{t('loginWithEmail', locale)}</span>
                <Separator className="flex-1" />
              </div>
              <div>
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <div className={`group flex items-center border ${theme === 'light' ? 'border-gray-500' : 'border-gray-500'} rounded-md overflow-hidden focus-within:border-gray-500`} style={{ height: '48px' }}>
                      <div className={`flex items-center justify-center px-3 ${theme === 'light' ? 'bg-transparent' : 'bg-transparent'}`}>
                        <Mail size={24} className={theme === 'light' ? 'text-gray-600' : 'text-white'} />
                      </div>
                      <div className="w-[2px] h-full bg-gray-200 dark:bg-gray-700 group-focus-within:!bg-[#7634F9] transition-colors duration-200"></div>
                      <Input id="email" type="email" placeholder={t('emailPlaceholder', locale)} value={email} onChange={(e) => setEmail(e.target.value)} required className={`w-full h-full px-4 py-2 rounded-none border-0 outline-none ${inputTextClasses} font-bold focus-visible:ring-0 focus-visible:ring-offset-0`} style={{ caretColor: 'transparent' }} />
                    </div>
                  </div>
                  <div>
                    <div className={`group flex items-center border ${theme === 'light' ? 'border-gray-500' : 'border-gray-500'} rounded-md overflow-hidden focus-within:border-gray-500`} style={{ height: '48px' }}>
                      <div className={`flex items-center justify-center px-3 ${theme === 'light' ? 'bg-transparent' : 'bg-transparent'}`}>
                        <Lock size={24} className={theme === 'light' ? 'text-gray-600' : 'text-white'} />
                      </div>
                      <div className="w-[2px] h-full bg-gray-200 dark:bg-gray-700 group-focus-within:!bg-[#7634F9] transition-colors duration-200"></div>
                      <Input id="password" type="password" placeholder={t('passwordPlaceholder', locale)} value={password} onChange={(e) => setPassword(e.target.value)} required className={`w-full h-full px-4 py-2 rounded-none border-0 outline-none ${inputTextClasses} font-bold focus-visible:ring-0 focus-visible:ring-offset-0`} style={{ caretColor: 'transparent' }} />
                    </div>
                  </div>
                  <Button type="submit" className={`w-full h-12 px-4 py-2 rounded-md ${theme === 'light' ? 'bg-black text-white hover:bg-purple-600' : 'bg-white text-black hover:bg-purple-700'} font-bold`}>{t('loginButton', locale)}</Button>
                  
                  {/* Mobile Layout: Forgot (Left) -- Register (Right) | Privacy Hidden */}
                  <div className="flex items-center justify-between mt-6 md:hidden">
                    <div className="flex-shrink-0">
                      <ForgotPasswordDialog />
                    </div>
                    <div className="flex items-center gap-0">
                      <span className="text-sm">{String(locale).toLowerCase().startsWith('zh') ? '没有账户？' : 'No account?'}</span>
                      <a href="/register" className={`text-sm font-bold underline ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}>{t('register', locale)}</a>
                    </div>
                  </div>
                  
                  {/* Desktop Layout: Forgot (Left) -- Register (Right) */}
                  <div className="hidden md:flex items-center justify-between mt-6">
                    <div className="flex-shrink-0">
                      <ForgotPasswordDialog />
                    </div>
                    <div className="flex items-center gap-0">
                      <span className="text-sm">{String(locale).toLowerCase().startsWith('zh') ? '没有账户？' : 'No account?'}</span>
                      <a href="/register" className={`text-sm font-bold underline ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}>{t('register', locale)}</a>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex lg:w-0 xl:w-0" />
        </div>
      </div>
      
    </div>
  );
}
