import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null); // Add user state
  const router = useRouter();
  const AUTH_EVENT = 'userInfoUpdated';

  // 安全地操作localStorage的辅助函数
  const safeLocalStorage = {
    get: function(key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error('获取localStorage项' + key + '失败:', error);
        return null;
      }
    },
    set: function(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.error('设置localStorage项' + key + '失败:', error);
        return false;
      }
    },
    remove: function(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error('删除localStorage项' + key + '失败:', error);
        return false;
      }
    }
  };

  useEffect(function() {
    // 检查用户是否已认证
    var checkAuth = function() {
      try {
        // 从localStorage获取用户信息
        var userInfoStr = safeLocalStorage.get('userInfo');
        // 兼容：如果localStorage暂时不可用或尚未写入，尝试从cookie读取
        if (!userInfoStr && typeof document !== 'undefined') {
          try {
            var cookies = document.cookie || '';
            var match = cookies.match(/(?:^|; )userInfo=([^;]+)/);
            if (match && match[1]) {
              userInfoStr = decodeURIComponent(match[1]);
            }
          } catch {}
        }
        
        if (userInfoStr) {
          try {
            var parsedUserInfo = JSON.parse(userInfoStr);
            // 检查用户信息是否有效
            if (parsedUserInfo && (parsedUserInfo.email || parsedUserInfo.name || parsedUserInfo.userId)) {
              setIsAuthenticated(true);
              setUser(parsedUserInfo); // Set user state
              // console.log('认证检查: 用户已登录');
            } else {
              setIsAuthenticated(false);
              setUser(null);
              // console.log('认证检查: 用户信息无效');
            }
          } catch (e) {
            console.error('解析用户信息失败:', e);
            setIsAuthenticated(false);
            setUser(null);
            // 清除损坏的用户信息
            safeLocalStorage.remove('userInfo');
          }
        } else {
          // 明确设置为未认证状态
          setIsAuthenticated(false);
          setUser(null);
          // console.log('认证检查: 未找到用户信息');
        }
      } catch (error) {
        console.error('认证检查过程中发生错误:', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    // 延迟执行检查，确保DOM完全加载
    var timer = setTimeout(function() {
      checkAuth();
    }, 100);
    
    // 监听localStorage变化
    var handleStorageChange = function(e) {
      if (e.key === 'userInfo') {
        // console.log('检测到localStorage变化，重新检查认证状态');
        checkAuth();
      }
    };
    
    // 监听同页内的用户信息更新事件
    var handleAuthEvent = function() {
      // console.log('收到同页用户信息更新事件，刷新认证状态');
      checkAuth();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(AUTH_EVENT, handleAuthEvent as EventListener);
    
    return function() {
      clearTimeout(timer);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(AUTH_EVENT, handleAuthEvent as EventListener);
    };
  }, []);

  var login = function(userInfo) {
    // 移除async/await，使用Promise
    return new Promise(function(resolve, reject) {
      var userData = {};
      if (userInfo && userInfo.name) userData.name = userInfo.name;
      if (userInfo && userInfo.email) userData.email = userInfo.email;
      if (userInfo && userInfo.loginType) userData.loginType = userInfo.loginType;
      if (userInfo && userInfo.userId) userData.userId = userInfo.userId;
      
      console.log('开始登录流程，用户信息:', userData);
      
      try {
        // 确保用户信息有效
        if (!userInfo || (!userInfo.email && !userInfo.name && !userInfo.userId)) {
          throw new Error('无效的用户信息');
        }
        
        // 规范化 userId
        var normalizedUserId = userInfo.email || userInfo.userId || userInfo.unionid || userInfo.openid || '';
        var enrichedUserInfo = Object.assign({}, userInfo, { userId: normalizedUserId });
        // 保存用户信息到localStorage
        var savedToLocalStorage = safeLocalStorage.set('userInfo', JSON.stringify(enrichedUserInfo));
        // 同时保存身份ID（优先邮箱，其次 unionid/openid）
        safeLocalStorage.set('userEmail', normalizedUserId);
        
        // 设置 cookie，自动适配当前域名/协议
        try {
          var hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
          var isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
          var isLocal = hostname === 'localhost' || hostname.endsWith('.local');
          var parts = hostname.split('.');
          var topLevelDomain = parts.length >= 2 ? ('.' + parts.slice(-2).join('.')) : ''; // e.g. .momemory.com
          var useDomain = (!isIP && !isLocal && topLevelDomain) ? ('; domain=' + topLevelDomain) : '';
          var isSecure = (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:');
          var sameSite = isSecure ? '; SameSite=None; Secure' : '; SameSite=Lax';
          var cookieValue = 'userInfo=' + encodeURIComponent(JSON.stringify(enrichedUserInfo)) + '; path=/; max-age=86400' + useDomain + sameSite;
          document.cookie = cookieValue;
          // 兼容不带 domain 的场景
          if (useDomain) {
            document.cookie = 'userInfo=' + encodeURIComponent(JSON.stringify(enrichedUserInfo)) + '; path=/; max-age=86400' + sameSite;
          }
          console.log('Cookie设置成功');
        } catch (cookieError) {
          console.error('设置cookie失败:', cookieError);
        }
        
        // 立即设置认证状态为true
        setIsAuthenticated(true);
        setUser(enrichedUserInfo); // Update user state
        console.log('认证状态已更新为true');
        try {
          window.dispatchEvent(new CustomEvent(AUTH_EVENT));
          console.log('已广播同页用户信息更新事件');
        } catch (evtError) {
          console.error('广播认证事件失败:', evtError);
        }
        
        // 使用setTimeout确保状态更新和DOM渲染完成
        setTimeout(function() {
          // 再次确认localStorage中是否保存了用户信息
          var savedUserInfo = safeLocalStorage.get('userInfo');
          if (savedUserInfo) {
            console.log('登录流程成功完成，用户信息已保存');
          } else {
            console.warn('登录状态已更新，但用户信息可能未正确保存到localStorage');
          }
          resolve(undefined);
        }, 300);
        
      } catch (error) {
        console.error('登录过程中发生错误:', error);
        // 发生错误时标记为未认证，避免误判导致重定向回摆
        setIsAuthenticated(false);
        setUser(null);
        // 抛出错误让调用方知道有问题发生
        reject(error);
      }
    });
  };

  var logout = function() {
    // 移除async/await，使用Promise
    return new Promise(function(resolve, reject) {
      console.log('开始退出登录流程');
      
      try {
        // 清除所有可能的用户信息
        safeLocalStorage.remove('userInfo');
        safeLocalStorage.remove('userEmail');
        
        // 同时删除cookie
        try {
          var past = 'Thu, 01 Jan 1970 00:00:00 GMT';
          var hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
          var isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
          var isLocal = hostname === 'localhost' || hostname.endsWith('.local');
          var parts = hostname.split('.');
          var topLevelDomain = parts.length >= 2 ? ('.' + parts.slice(-2).join('.')) : '';
          var useDomain = (!isIP && !isLocal && topLevelDomain) ? ('; domain=' + topLevelDomain) : '';
          // 删除不带 domain 的 cookie
          document.cookie = 'userInfo=; path=/; expires=' + past;
          // 删除带顶级域的 cookie
          if (useDomain) {
            document.cookie = 'userInfo=; path=/; expires=' + past + useDomain;
          }
          console.log('Cookie已清除');
        } catch (cookieError) {
          console.error('清除cookie失败:', cookieError);
        }
        
        // 设置认证状态为false
        setIsAuthenticated(false);
        setUser(null); // Clear user state
        console.log('认证状态已更新为false');
        
        // 使用replace避免历史回退引起的回摆
        setTimeout(function() {
          console.log('执行跳转到登录页面');
          router.replace('/login');
          resolve(undefined);
        }, 200);
        
      } catch (error) {
        console.error('退出登录过程中发生错误:', error);
        // 即使发生错误，也尝试设置未认证状态并重定向
        setIsAuthenticated(false);
        setUser(null);
        
        // 延迟后重定向，避免循环
        setTimeout(function() {
          router.replace('/login');
        }, 500);
        reject(error);
      }
    });
  };

  return { isAuthenticated: isAuthenticated, isLoading: isLoading, user: user, login: login, logout: logout };
};
