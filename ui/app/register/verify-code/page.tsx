"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, ChevronLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { setUserId } from '@/store/profileSlice';
import { useAuth } from '@/hooks/useAuth';

const VerifyCodePage = () => {
  const { setTheme, theme } = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // 从URL参数获取邮箱、用户名和密码
  const email = searchParams.get('email') || '';
  const username = searchParams.get('username') || '';
  const password = searchParams.get('password') || '';

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

  const handleCodeChange = (index: number, value: string) => {
    // 只允许数字
    if (value && !/^\d$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(''); // 清除错误信息

    // 自动跳转到下一个输入框
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // 如果所有6位都填写完成,自动提交
    if (value && index === 5) {
      const fullCode = [...newCode.slice(0, 5), value].join('');
      if (fullCode.length === 6) {
        // 延迟一点提交,让用户看到最后一个数字
        setTimeout(() => {
          verifyCode(fullCode);
        }, 300);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // 处理退格键
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    const digits = pastedData.replace(/\D/g, '').split('');
    
    const newCode = [...code];
    digits.forEach((digit, index) => {
      if (index < 6) {
        newCode[index] = digit;
      }
    });
    setCode(newCode);

    // 聚焦到最后填充的位置
    const lastFilledIndex = Math.min(digits.length, 5);
    inputRefs.current[lastFilledIndex]?.focus();
  };

  const verifyCode = async (verificationCode: string) => {
    setIsVerifying(true);
    setError('');

    // 获取API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

    try {
      // 调用后端API验证验证码并登录
      const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login_id: email,
          login_type: 'email',
          verification_code: verificationCode
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        // 翻译错误信息为中文
        let errorMessage = '验证失败,请重试';
        if (data.detail) {
          if (data.detail.includes('Invalid verification code') || data.detail.includes('verification code')) {
            errorMessage = '验证码不正确,请重新输入';
          } else if (data.detail.includes('required')) {
            errorMessage = '请输入验证码';
          } else if (data.detail.includes('User not found')) {
            errorMessage = '用户不存在';
          } else {
            errorMessage = data.detail;
          }
        }
        throw new Error(errorMessage);
      }

      console.log('Login successful:', data);
      
      // 保存用户信息
      const userInfo = {
        name: data.user.name || username,
        email: data.user.email || email,
        loginType: data.user.login_type || 'email',
        userId: data.user.id || email // 确保包含userId
      };
      
      try {
        // 等待login方法完成，确保认证状态更新
        await login(userInfo);
        
        // 登录成功后更新Redux store的userId
        dispatch(setUserId(email));
        
        console.log('认证状态已更新，即将跳转到dashboard');
        
        // 再添加一个小延迟确保所有状态更新完成
        setTimeout(() => {
          router.push('/dashboard');
        }, 100);
      } catch (error) {
        console.error('登录状态更新失败:', error);
        throw new Error('登录成功但状态更新失败，请重试');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setError(error.message || '验证失败,请重试');
      setIsVerifying(false);
      // 清空验证码输入
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const verificationCode = code.join('');
    if (verificationCode.length === 6) {
      verifyCode(verificationCode);
    }
  };

  const handleGoBack = () => {
    router.push('/register');
  };

  return (
    <div className={`fixed inset-0 w-full h-full overflow-hidden ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-gray-900'} font-sans`}>
      <div className="flex h-full w-full overflow-hidden">
        {/* 左侧验证码区域 */}
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
              <h1 className="text-2xl font-semibold" style={{ fontFamily: '"AlimamaShuHeiTi", sans-serif' }}>注册</h1>
            </div>

            <div className="space-y-6">
              {/* 验证说明 */}
              <div className="text-center space-y-2">
                <h2 className="text-lg font-medium">验证您的邮箱</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  输入发送到 {email} 的验证码:
                </p>
                {error && (
                  <p className="text-sm text-red-500">
                    {error}
                  </p>
                )}
              </div>

              {/* 验证码输入框 */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-center gap-3">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      disabled={isVerifying}
                      className={`w-14 h-14 text-center text-2xl font-semibold rounded-lg border-2 ${
                        theme === 'light' 
                          ? 'border-gray-300 bg-white text-gray-900 focus:border-purple-600' 
                          : 'border-gray-700 bg-gray-900 text-white focus:border-purple-400'
                      } outline-none transition-colors ${isVerifying ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  ))}
                </div>

                {/* 返回按钮 */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleGoBack}
                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    <ChevronLeft size={16} />
                    返回
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex lg:w-0 xl:w-0" />
      </div>
    </div>
  );
};

export default VerifyCodePage;