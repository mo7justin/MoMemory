from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
import re
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import datetime
import hashlib
import base64
import json
import uuid

from app.dependencies import get_current_user, get_db
from app.models import User, ApiKey, Memory, App, MemoryAccessLog, PaymentOrder

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


class RegisterRequest(BaseModel):
    """用户注册请求"""
    login_id: str  # 可以是邮箱、微信号、QQ号
    login_type: str  # email, wechat, qq
    name: Optional[str] = None
    password: Optional[str] = None  # 邮箱注册时的密码
    
    @validator('login_type')
    def validate_login_type(cls, v):
        if v not in ['email', 'wechat', 'qq']:
            raise ValueError('login_type must be one of: email, wechat, qq')
        return v
    
    @validator('login_id')
    def validate_login_id(cls, v, values):
        login_type = values.get('login_type')
        if login_type == 'email':
            # 简单的邮箱验证
            if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', v):
                raise ValueError('Invalid email format')
        elif login_type in ['wechat', 'qq']:
            # 微信号和QQ号的简单验证
            if not v or len(v) < 3:
                raise ValueError(f'Invalid {login_type} format')
        return v


class LoginRequest(BaseModel):
    """用户登录请求"""
    login_id: str
    login_type: str
    verification_code: Optional[str] = None  # 验证码(邮箱登录时使用)
    password: Optional[str] = None  # 密码(邮箱+密码登录时使用)


class UserResponse(BaseModel):
    """用户响应"""
    id: str
    user_id: str
    name: Optional[str]
    email: Optional[str]
    login_type: str
    
    class Config:
        from_attributes = True


class BindMacRequest(BaseModel):
    """绑定MAC地址请求"""
    mac_address: str
    device_name: Optional[str] = None
    
    @validator('mac_address')
    def validate_mac_address(cls, v):
        # 验证MAC地址格式
        pattern = r'^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$'
        if not re.match(pattern, v):
            raise ValueError('Invalid MAC address format')
        return v.lower().replace('-', ':')


class BindEndpointRequest(BaseModel):
    """绑定Endpoint URL请求"""
    endpoint_url: str
    device_name: str
    
    @validator('endpoint_url')
    def validate_endpoint_url(cls, v):
        # 简单验证URL格式
        if not v.startswith(('http://', 'https://', 'ws://', 'wss://')):
            raise ValueError('Invalid endpoint URL format')
        return v


# 临时存储验证码(生产环境应使用Redis)
verification_codes = {}

# 临时存储注册时的密码(在验证码验证成功前)
registration_passwords = {}


def hash_password(password: str) -> str:
    """密码hash"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """验证密码"""
    return hash_password(password) == hashed


def send_verification_email(email: str, code: str):
    try:
        smtp_server = os.getenv("SMTP_SERVER", "smtp.mxhichina.com")
        smtp_port = int(os.getenv("SMTP_PORT", "465"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_password = os.getenv("SMTP_PASSWORD", "")

        if not smtp_user or not smtp_password:
            print("SMTP not configured, verification code:", code)
            return

        msg = MIMEMultipart("alternative")
        msg['From'] = f"Momemory <{smtp_user}>"
        msg['To'] = email
        msg['Subject'] = 'Momemory 登录验证码'

        text_body = f"您的验证码是: {code}\n有效期10分钟。若非本人操作请忽略。"
        html_body = f"""
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', sans-serif; background:#f7f7f8; padding:24px;">
            <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
              <div style="padding:20px 24px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px;">
                <img src="https://www.momemory.com/logo-s.svg" alt="Momemory" style="width:28px;height:28px;object-fit:contain"/>
                <div style="font-size:16px;font-weight:600;color:#111">Momemory</div>
              </div>
              <div style="padding:24px;color:#111;">
                <div style="font-size:15px;">您的登录验证码：</div>
                <div style="font-size:28px;font-weight:700;letter-spacing:4px;margin:12px 0;color:#5b21b6;">{code}</div>
                <div style="font-size:13px;color:#555;">验证码有效期为 <strong>10分钟</strong>。请尽快完成验证。</div>
                <div style="font-size:12px;color:#777;margin-top:16px;">若非本人操作，请忽略此邮件。</div>
              </div>
              
            </div>
          </body>
        </html>
        """

        msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))

        # 抄送到发件人以便留痕
        try:
            msg['Bcc'] = os.getenv("SMTP_BCC", smtp_user)
        except Exception:
            pass

        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_server, smtp_port)
        else:
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)
        server.quit()

        print(f"Verification email sent to {email}, code: {code}")

        # 可选：保存一份到发件箱
        try:
            if os.getenv("IMAP_SAVE_SENT", "false").lower() in ("1", "true", "yes"): 
                import imaplib, email as emailpkg, datetime as dt
                imap_server = os.getenv("IMAP_SERVER", "imap.mxhichina.com")
                imap_port = int(os.getenv("IMAP_PORT", "993"))
                sent_box = os.getenv("IMAP_SENT_MAILBOX", "Sent")
                imap = imaplib.IMAP4_SSL(imap_server, imap_port)
                imap.login(smtp_user, smtp_password)
                imap.append(sent_box, '\\Seen', dt.datetime.now().strftime('%d-%b-%Y %H:%M:%S +0000'), msg.as_bytes())
                imap.logout()
        except Exception as e:
            print(f"IMAP save sent failed: {str(e)}")
    except Exception as e:
        print(f"Failed to send email: {str(e)}")


@router.get("/oauth/{provider}/authorize")
async def oauth_authorize(provider: str):
    """
    OAuth授权 - 重定向到第三方授权页面
    provider: wechat 或 qq
    
    流程:
    1. 生成state参数(防CSRF)
    2. 构建授权URL
    3. 重定向到微信/QQ授权页面
    """
    print(f"DEBUG: oauth_authorize called with provider='{provider}'")
    if provider not in ['wechat', 'qq', 'github', 'google', 'gitee']:
        print(f"DEBUG: provider '{provider}' not in list")
        raise HTTPException(status_code=400, detail="Unsupported OAuth provider")
    
    # 从环境变量读取配置
    if provider == 'wechat':
        app_id = os.getenv("WECHAT_APP_ID")
        redirect_uri = os.getenv("WECHAT_REDIRECT_URI", "http://yourdomain.com/api/v1/auth/oauth/wechat/callback")
        
        if not app_id:
            raise HTTPException(
                status_code=500, 
                detail="WeChat OAuth not configured. Please set WECHAT_APP_ID and WECHAT_APP_SECRET"
            )
        
        # 生成state参数(防CSRF攻击)
        state = secrets.token_urlsafe(32)
        # TODO: 将state存储到Redis或数据库,5分钟过期
        
        # 构建微信授权URL
        # 微信开放平台文档: https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
        auth_url = (
            f"https://open.weixin.qq.com/connect/qrconnect?"
            f"appid={app_id}&"
            f"redirect_uri={redirect_uri}&"
            f"response_type=code&"
            f"scope=snsapi_login&"
            f"state={state}#wechat_redirect"
        )
        
        return {
            "auth_url": auth_url,
            "provider": "wechat",
            "state": state,
            "redirect_uri": redirect_uri
        }
    
    elif provider == 'qq':
        app_id = os.getenv("QQ_APP_ID")
        redirect_uri = os.getenv("QQ_REDIRECT_URI", "http://yourdomain.com/api/v1/auth/oauth/qq/callback")
        
        if not app_id:
            raise HTTPException(
                status_code=500,
                detail="QQ OAuth not configured. Please set QQ_APP_ID and QQ_APP_KEY"
            )
        
        # 生成state参数
        state = secrets.token_urlsafe(32)
        # TODO: 将state存储到Redis或数据库,5分钟过期
        
        # 构建QQ授权URL
        # QQ互联文档: https://wiki.connect.qq.com/
        auth_url = (
            f"https://graph.qq.com/oauth2.0/authorize?"
            f"response_type=code&"
            f"client_id={app_id}&"
            f"redirect_uri={redirect_uri}&"
            f"state={state}&"
            f"scope=get_user_info"
        )
        return RedirectResponse(auth_url)

    elif provider == 'github':
        app_id = os.getenv("GITHUB_CLIENT_ID")
        redirect_uri = os.getenv("GITHUB_REDIRECT_URI", "https://www.momemory.com/api/v1/auth/oauth/github/callback")
        if not app_id:
            raise HTTPException(status_code=500, detail="GitHub OAuth not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET")
        state = secrets.token_urlsafe(32)
        auth_url = (
            f"https://github.com/login/oauth/authorize?client_id={app_id}&redirect_uri={redirect_uri}&scope=read:user user:email&state={state}"
        )
        return RedirectResponse(auth_url)

    elif provider == 'google':
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "https://www.momemory.com/api/v1/auth/oauth/google/callback")
        if not client_id:
            raise HTTPException(status_code=500, detail="Google OAuth not configured. Please set GOOGLE_CLIENT_ID/SECRET")
        state = secrets.token_urlsafe(32)
        auth_url = (
            "https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={client_id}"
            f"&redirect_uri={redirect_uri}"
            "&response_type=code"
            "&scope=openid%20email%20profile"
            "&access_type=online"
            "&include_granted_scopes=true"
            f"&state={state}"
        )
        return RedirectResponse(auth_url)

    elif provider == 'gitee':
        client_id = os.getenv("GITEE_CLIENT_ID")
        redirect_uri = os.getenv("GITEE_REDIRECT_URI", "https://www.momemory.com/api/v1/auth/oauth/gitee/callback")
        if not client_id:
            raise HTTPException(status_code=500, detail="Gitee OAuth not configured. Please set GITEE_CLIENT_ID and GITEE_CLIENT_SECRET")
        state = secrets.token_urlsafe(32)
        auth_url = (
            f"https://gitee.com/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=user_info&state={state}"
        )
        return RedirectResponse(auth_url)
    
    raise HTTPException(status_code=400, detail="Invalid provider")


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    OAuth回调 - 处理第三方授权回调
    
    流程:
    1. 验证state参数(防CSRF)
    2. 用code换取access_token
    3. 获取用户信息
    4. 创建或登录用户
    """
    import httpx
    
    # 聚合平台误写成 /oauth/agg/callback，直接走聚合回调逻辑
    # 注意：QQ 授权不走聚合登录，只有 WeChat 可能走聚合
    if provider.lower() in ['agg', 'aggregator'] or (provider.lower() == 'wechat' and not os.getenv("WECHAT_APP_ID")):
        return await oauth_agg_callback(request=request, code=code or "", type=request.query_params.get("type"), db=db)
    
    # 标准 OAuth 提供商
    if provider not in ['wechat', 'qq', 'github', 'google', 'gitee']:
        raise HTTPException(status_code=400, detail="Unsupported OAuth provider")
    
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    
    # TODO: 验证state参数(从Redis或数据库中取出并比对)
    # if not verify_state(state):
    #     raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    try:
        if provider == 'wechat':
            # 1. 用code换取access_token
            app_id = os.getenv("WECHAT_APP_ID")
            app_secret = os.getenv("WECHAT_APP_SECRET")
            
            if not app_id or not app_secret:
                raise HTTPException(status_code=500, detail="WeChat OAuth not configured")
            
            async with httpx.AsyncClient() as client:
                # 获取access_token
                token_response = await client.get(
                    "https://api.weixin.qq.com/sns/oauth2/access_token",
                    params={
                        "appid": app_id,
                        "secret": app_secret,
                        "code": code,
                        "grant_type": "authorization_code"
                    }
                )
                token_data = token_response.json()
                
                if "errcode" in token_data:
                    raise HTTPException(
                        status_code=400,
                        detail=f"WeChat OAuth error: {token_data.get('errmsg')}"
                    )
                
                access_token = token_data.get("access_token")
                openid = token_data.get("openid")
                
                # 2. 获取用户信息
                user_response = await client.get(
                    "https://api.weixin.qq.com/sns/userinfo",
                    params={
                        "access_token": access_token,
                        "openid": openid
                    }
                )
                user_data = user_response.json()
                
                if "errcode" in user_data:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to get WeChat user info: {user_data.get('errmsg')}"
                    )
                
                # 3. 创建或登录用户
                wechat_id = user_data.get("unionid") or openid  # 优先使用unionid
                nickname = user_data.get("nickname")
                
                user = db.query(User).filter(User.user_id == wechat_id).first()
                
                if not user:
                    # 创建新用户
                    user = User(
                        user_id=wechat_id,
                        name=nickname or f"WeChat_{wechat_id[:8]}",
                        metadata_={
                            "login_type": "wechat",
                            "openid": openid,
                            "unionid": user_data.get("unionid"),
                            "avatar": user_data.get("headimgurl"),
                            "last_login_at": datetime.datetime.now(datetime.UTC).isoformat()
                        }
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                else:
                    # 更新现有用户
                    meta = user.metadata_ or {}
                    meta["last_login_at"] = datetime.datetime.now(datetime.UTC).isoformat()
                    if nickname and not user.name:
                        user.name = nickname
                    if user_data.get("headimgurl"):
                        meta["avatar"] = user_data.get("headimgurl")
                    user.metadata_ = meta
                    db.commit()
                
                return {
                    "status": "success",
                    "message": "WeChat login successful",
                    "user": {
                        "id": str(user.id),
                        "user_id": user.user_id,
                        "name": user.name,
                        "login_type": "wechat",
                        "avatar": user.metadata_.get("avatar")
                    }
                }
        
        elif provider == 'qq':
            # 1. 用code换取access_token
            app_id = os.getenv("QQ_APP_ID")
            app_key = os.getenv("QQ_APP_KEY")
            redirect_uri = os.getenv("QQ_REDIRECT_URI")
            
            if not app_id or not app_key:
                raise HTTPException(status_code=500, detail="QQ OAuth not configured")
            
            async with httpx.AsyncClient() as client:
                # 获取access_token
                token_response = await client.get(
                    "https://graph.qq.com/oauth2.0/token",
                    params={
                        "grant_type": "authorization_code",
                        "client_id": app_id,
                        "client_secret": app_key,
                        "code": code,
                        "redirect_uri": redirect_uri,
                        "fmt": "json"
                    }
                )
                token_data = token_response.json()
                
                if "error" in token_data:
                    raise HTTPException(
                        status_code=400,
                        detail=f"QQ OAuth error: {token_data.get('error_description')}"
                    )
                
                access_token = token_data.get("access_token")
                
                # 2. 获取OpenID
                openid_response = await client.get(
                    "https://graph.qq.com/oauth2.0/me",
                    params={
                        "access_token": access_token,
                        "fmt": "json",
                        "unionid": 1 if os.getenv("QQ_UNIONID_ENABLED", "true").lower() in ("1", "true", "yes") else 0
                    }
                )
                openid_data = openid_response.json()
                
                if "error" in openid_data:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to get QQ OpenID: {openid_data.get('error_description')}"
                    )
                
                openid = openid_data.get("openid")
                unionid = openid_data.get("unionid")
                
                # 3. 获取用户信息
                user_response = await client.get(
                    "https://graph.qq.com/user/get_user_info",
                    params={
                        "access_token": access_token,
                        "oauth_consumer_key": app_id,
                        "openid": openid
                    }
                )
                user_data = user_response.json()
                
                if user_data.get("ret") != 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to get QQ user info: {user_data.get('msg')}"
                    )
                
                # 4. 创建或登录用户
                qq_id = unionid or openid
                nickname = user_data.get("nickname")
                
                user = db.query(User).filter(User.user_id == qq_id).first()
                
                if not user:
                    # 创建新用户
                    user = User(
                        user_id=qq_id,
                        name=nickname or f"QQ_{qq_id[:8]}",
                        metadata_={
                            "login_type": "qq",
                            "openid": openid,
                            "unionid": unionid,
                            "avatar": user_data.get("figureurl_qq_2") or user_data.get("figureurl_qq_1")
                        }
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                else:
                    meta = user.metadata_ or {}
                    meta["login_type"] = "qq"
                    meta["openid"] = openid
                    if unionid:
                        meta["unionid"] = unionid
                    avatar_url = user_data.get("figureurl_qq_2") or user_data.get("figureurl_qq_1")
                    if avatar_url:
                        meta["avatar"] = avatar_url
                    user.metadata_ = meta
                    if nickname and not user.name:
                        user.name = nickname
                    # Update last login time
                    meta["last_login_at"] = datetime.datetime.now(datetime.UTC).isoformat()
                    user.metadata_ = meta
                    db.commit()
                host = request.headers.get("host") or "www.momemory.com"
                scheme = "https" if (request.headers.get("x-forwarded-proto") == "https" or host.startswith("www.")) else "http"
                from urllib.parse import quote_plus
                avatar = user_data.get("figureurl_qq_2") or user_data.get("figureurl_qq_1") or ""
                redirect_url = f"{scheme}://{host}/login?oauth=qq&name={quote_plus(nickname or qq_id[:8])}&avatar={quote_plus(avatar)}&email={quote_plus(qq_id)}"
                import json
                resp = RedirectResponse(redirect_url)
                try:
                    cookie_payload = json.dumps({
                        "name": nickname or f"QQ_{qq_id[:8]}",
                        "loginType": "qq",
                        "userId": qq_id,
                        "email": qq_id,
                        "avatar": avatar
                    }, ensure_ascii=False)
                    resp.set_cookie(
                        key="userInfo",
                        value=cookie_payload,
                        max_age=86400,
                        path="/",
                        samesite="lax"
                    )
                except Exception:
                    pass
                return resp

        elif provider == 'github':
            client_id = os.getenv("GITHUB_CLIENT_ID")
            client_secret = os.getenv("GITHUB_CLIENT_SECRET")
            redirect_uri = os.getenv("GITHUB_REDIRECT_URI", "https://www.momemory.com/api/v1/auth/oauth/github/callback")
            if not client_id or not client_secret:
                raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

            async with httpx.AsyncClient() as client:
                token_resp = await client.post(
                    "https://github.com/login/oauth/access_token",
                    headers={"Accept": "application/json"},
                    data={
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "code": code,
                        "redirect_uri": redirect_uri,
                    },
                )
                token_data = token_resp.json()
                access_token = token_data.get("access_token")
                if not access_token:
                    raise HTTPException(status_code=400, detail="Failed to exchange code")

                user_resp = await client.get(
                    "https://api.github.com/user",
                    headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                )
                gh_user = user_resp.json()
                if user_resp.status_code != 200:
                    raise HTTPException(status_code=400, detail="Failed to fetch GitHub user")

                email = gh_user.get("email")
                if not email:
                    emails_resp = await client.get(
                        "https://api.github.com/user/emails",
                        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                    )
                    if emails_resp.status_code == 200:
                        emails = emails_resp.json()
                        primary = next((e for e in emails if e.get("primary")), None)
                        email = (primary or (emails[0] if emails else {})).get("email")

                login_id = email or f"github_{gh_user.get('id')}"
                name = gh_user.get("name") or gh_user.get("login") or (login_id.split('@')[0] if '@' in login_id else login_id)

                user = db.query(User).filter(func.lower(User.user_id) == func.lower(login_id)).first()
                if not user:
                    user = User(
                        user_id=login_id,
                        name=name,
                        email=email,
                        metadata_={"login_type": "github", "github_id": gh_user.get("id"), "avatar": gh_user.get("avatar_url")}
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                else:
                    user.name = user.name or name
                    if email and not user.email:
                        user.email = email
                    meta = user.metadata_ or {}
                    meta["login_type"] = "github"
                    meta["github_id"] = gh_user.get("id")
                    meta["avatar"] = gh_user.get("avatar_url")
                    meta["last_login_at"] = datetime.datetime.now(datetime.UTC).isoformat()
                    user.metadata_ = meta
                    db.commit()

                host = request.headers.get("host") or "www.momemory.com"
                scheme = "https" if (request.headers.get("x-forwarded-proto") == "https" or host.startswith("www.")) else "http"
                from urllib.parse import quote_plus
                avatar = gh_user.get("avatar_url") or ""
                redirect_url = f"{scheme}://{host}/login?oauth=github&email={login_id}&name={quote_plus(name)}&avatar={quote_plus(avatar)}"
                return RedirectResponse(redirect_url)

        elif provider == 'google':
            client_id = os.getenv("GOOGLE_CLIENT_ID")
            client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
            redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "https://www.momemory.com/api/v1/auth/oauth/google/callback")
            if not client_id or not client_secret:
                raise HTTPException(status_code=500, detail="Google OAuth not configured")

            async with httpx.AsyncClient() as client:
                token_resp = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "code": code,
                        "grant_type": "authorization_code",
                        "redirect_uri": redirect_uri,
                    },
                    headers={"Accept": "application/json"},
                )
                token_data = token_resp.json()
                access_token = token_data.get("access_token")
                if not access_token:
                    raise HTTPException(status_code=400, detail="Failed to exchange google code")

                user_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                )
                if user_resp.status_code != 200:
                    raise HTTPException(status_code=400, detail="Failed to fetch Google user")
                guser = user_resp.json()
                email = guser.get("email")
                login_id = email or f"google_{guser.get('sub')}"
                name = guser.get("name") or (email.split('@')[0] if email else guser.get("sub"))

                user = db.query(User).filter(func.lower(User.user_id) == func.lower(login_id)).first()
                if not user:
                    user = User(
                        user_id=login_id,
                        name=name,
                        email=email,
                        metadata_={"login_type": "google", "google_sub": guser.get("sub"), "avatar": guser.get("picture")}
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                else:
                    user.name = user.name or name
                    if email and not user.email:
                        user.email = email
                    meta = user.metadata_ or {}
                    meta["login_type"] = "google"
                    meta["google_sub"] = guser.get("sub")
                    meta["avatar"] = guser.get("picture")
                    meta["last_login_at"] = datetime.datetime.now(datetime.UTC).isoformat()
                    user.metadata_ = meta
                    db.commit()

                host = request.headers.get("host") or "www.momemory.com"
                scheme = "https" if (request.headers.get("x-forwarded-proto") == "https" or host.startswith("www.")) else "http"
                from urllib.parse import quote_plus
                avatar = guser.get("picture") or ""
                redirect_url = f"{scheme}://{host}/login?oauth=google&email={login_id}&name={quote_plus(name)}&avatar={quote_plus(avatar)}"
                return RedirectResponse(redirect_url)
    
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=500,
            detail=f"OAuth request failed: {str(e)}"
        )

    if provider == 'gitee':
        client_id = os.getenv("GITEE_CLIENT_ID")
        client_secret = os.getenv("GITEE_CLIENT_SECRET")
        redirect_uri = os.getenv("GITEE_REDIRECT_URI", "https://www.momemory.com/api/v1/auth/oauth/gitee/callback")
        if not client_id or not client_secret:
            raise HTTPException(status_code=500, detail="Gitee OAuth not configured")

        try:
            async with httpx.AsyncClient() as client:
                token_resp = await client.post(
                    "https://gitee.com/oauth/token",
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "client_id": client_id,
                        "redirect_uri": redirect_uri,
                        "client_secret": client_secret
                    },
                    headers={"Accept": "application/json"},
                )
                token_data = token_resp.json()
                access_token = token_data.get("access_token")
                if not access_token:
                     raise HTTPException(status_code=400, detail=f"Failed to exchange gitee code: {token_data}")

                user_resp = await client.get(
                    "https://gitee.com/api/v5/user",
                    params={"access_token": access_token}
                )
                if user_resp.status_code != 200:
                    raise HTTPException(status_code=400, detail="Failed to fetch Gitee user")
                guser = user_resp.json()
                
                login_id = guser.get("email") or f"gitee_{guser.get('id')}"
                name = guser.get("name") or guser.get("login") or (login_id.split('@')[0] if '@' in login_id else str(guser.get('id')))
                avatar = guser.get("avatar_url")

                user = db.query(User).filter(func.lower(User.user_id) == func.lower(login_id)).first()
                if not user:
                    user = User(
                        user_id=login_id,
                        name=name,
                        email=guser.get("email"),
                        metadata_={"login_type": "gitee", "gitee_id": guser.get("id"), "avatar": avatar}
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                else:
                    user.name = user.name or name
                    if guser.get("email") and not user.email:
                        user.email = guser.get("email")
                    meta = user.metadata_ or {}
                    meta["login_type"] = "gitee"
                    meta["gitee_id"] = guser.get("id")
                    meta["avatar"] = avatar
                    meta["last_login_at"] = datetime.datetime.now(datetime.UTC).isoformat()
                    user.metadata_ = meta
                    db.commit()

                host = request.headers.get("host") or "www.momemory.com"
                scheme = "https" if (request.headers.get("x-forwarded-proto") == "https" or host.startswith("www.")) else "http"
                from urllib.parse import quote_plus
                redirect_url = f"{scheme}://{host}/login?oauth=gitee&email={login_id}&name={quote_plus(name)}&avatar={quote_plus(avatar or '')}"
                return RedirectResponse(redirect_url)
        except Exception as e:
             raise HTTPException(status_code=500, detail=f"Gitee OAuth failed: {str(e)}")
    
    raise HTTPException(status_code=400, detail="Invalid provider")


@router.get("/oauth/agg/{login_type}/authorize")
async def oauth_agg_authorize(login_type: str):
    base = os.getenv("AGG_LOGIN_BASE", "https://baoxian18.com/connect.php")
    appid = os.getenv("AGG_APP_ID")
    appkey = os.getenv("AGG_APP_KEY")
    redirect_uri = os.getenv("AGG_REDIRECT_URI", "https://www.momemory.com/api/v1/auth/oauth/agg/callback")
    if not appid or not appkey:
        raise HTTPException(status_code=500, detail="Aggregator OAuth not configured")
    t = login_type.lower()
    if t not in ["qq", "wx", "wechat"]:
        raise HTTPException(status_code=400, detail="Unsupported aggregator login type")
    type_param = "wx" if t in ["wx", "wechat"] else "qq"
    import httpx
    async with httpx.AsyncClient() as client:
        r = await client.get(
            base,
            params={
                "act": "login",
                "appid": appid,
                "appkey": appkey,
                "type": type_param,
                "redirect_uri": redirect_uri,
            },
            timeout=10.0,
        )
        data = r.json()
    try:
        print({"agg_authorize": {"type": login_type, "resp_code": data.get("code"), "msg": data.get("msg")}})
    except Exception:
        pass
    if data.get("code") != 0:
        raise HTTPException(status_code=400, detail=data.get("msg") or "Aggregator login init failed")
    target = data.get("url") or data.get("qrcode")
    if not target:
        raise HTTPException(status_code=400, detail="Aggregator response missing url")
    return RedirectResponse(target)


@router.get("/oauth/agg/callback")
async def oauth_agg_callback(
    request: Request,
    code: str,
    type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    import httpx
    base = os.getenv("AGG_LOGIN_BASE", "https://baoxian18.com/connect.php")
    appid = os.getenv("AGG_APP_ID")
    appkey = os.getenv("AGG_APP_KEY")
    if not appid or not appkey:
        raise HTTPException(status_code=500, detail="Aggregator OAuth not configured")
    t = (type or "qq").lower()
    if t not in ["qq", "wx", "wechat"]:
        raise HTTPException(status_code=400, detail="Unsupported aggregator login type")
    # 规范化，兼容 "wx" → "wx"；但下游 provider 统一为 "wechat"
    type_param = "wx" if t in ["wx", "wechat"] else "qq"
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            base,
            params={
                "act": "callback",
                "appid": appid,
                "appkey": appkey,
                "type": type_param,
                "code": code,
            },
            timeout=15.0,
        )
        data = resp.json()
    try:
        print({"agg_callback": {"type": type_param, "resp_code": data.get("code"), "uid": data.get("social_uid")}})
    except Exception:
        pass
    if data.get("code") != 0:
        raise HTTPException(status_code=400, detail=data.get("msg") or "Aggregator OAuth failed")
    uid = data.get("social_uid") or data.get("uid")
    nickname = data.get("nickname") or "User"
    avatar = data.get("faceimg") or data.get("avatar")
    provider = "wechat" if type_param == "wx" else "qq"
    if not uid:
        raise HTTPException(status_code=400, detail="Missing social uid")
    user = db.query(User).filter(User.user_id == uid).first()
    if not user:
        user = User(
            user_id=uid,
            name=nickname,
            metadata_={
                "login_type": provider,
                "avatar": avatar,
                "agg_provider": "baoxian18",
            },
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        meta = user.metadata_ or {}
        meta["login_type"] = provider
        if avatar:
            meta["avatar"] = avatar
        meta["agg_provider"] = "baoxian18"
        user.metadata_ = meta
        user.name = user.name or nickname
        # Update last login time
        meta["last_login_at"] = datetime.datetime.now(datetime.UTC).isoformat()
        user.metadata_ = meta
        db.commit()
    host = request.headers.get("host") or "www.momemory.com"
    scheme = "https" if (request.headers.get("x-forwarded-proto") == "https" or host.startswith("www.")) else "http"
    from urllib.parse import quote_plus
    redirect_url = f"{scheme}://{host}/login?oauth={provider}&name={quote_plus(nickname)}&avatar={quote_plus(avatar or '')}"
    return RedirectResponse(redirect_url)


@router.post("/register")
async def register_user(
    request: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    用户注册
    - 邮箱注册: 发送验证码到邮箱
    - 微信/QQ: 需要通过OAuth授权,使用 /oauth/{provider}/authorize 接口
    
    注意: 此接口不直接支持微信/QQ注册,请使用OAuth授权流程
    """
    # 邮箱统一转小写
    login_id = request.login_id.lower() if request.login_type == 'email' else request.login_id
    
    # 检查用户是否已存在
    existing_user = db.query(User).filter(User.user_id == login_id).first()
    # 如果用户已存在，仍然发送验证码用于忘记密码/验证码登录
    
    # 只支持邮箱注册,微信/QQ需要OAuth
    if request.login_type == 'email':
        # 生成6位数验证码
        code = str(secrets.randbelow(900000) + 100000)
        # 保存验证码到数据库
        user_name = request.name or login_id.split('@')[0]
        password_hash = hash_password(request.password) if request.password else ''
        save_verification_code(db, login_id, code, user_name, password_hash)
        
        # 保存密码到临时存储(验证成功后再保存到数据库)
        if request.password:
            registration_passwords[login_id] = {
                'password_hash': hash_password(request.password),
                'name': request.name or login_id.split('@')[0]
            }
        
        # 立即打印验证码(方便调试)
        print(f"Generated verification code for {login_id}: {code}")
        
        # 后台发送验证邮件
        background_tasks.add_task(send_verification_email, login_id, code)
        
        return {
            "status": "verification_sent",
            "message": "Verification code sent to email",
            "login_id": login_id,
            "login_type": request.login_type
        }
    
    elif request.login_type in ['wechat', 'qq']:
        # 微信/QQ应该使用OAuth授权
        raise HTTPException(
            status_code=400, 
            detail=f"Please use /api/v1/auth/oauth/{request.login_type}/authorize for {request.login_type} login"
        )
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported login type")


@router.post("/login")
async def login_user(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    用户登录
    - 邮箱登录: 需要验证码
    - 微信/QQ: 直接登录(实际应对接第三方授权)
    """
    # 邮箱统一转小写
    login_id = request.login_id.lower() if request.login_type == 'email' else request.login_id
    
    # 调试日志
    print(f"Login request: login_id={login_id}, login_type={request.login_type}, has_password={bool(request.password)}, has_code={bool(request.verification_code)}")
    
    # 查找用户（不区分大小写），同时支持 user_id 和 email
    user = db.query(User).filter(
        (func.lower(User.user_id) == func.lower(login_id)) |
        (func.lower(User.email) == func.lower(login_id))
    ).first()
    
    # 邮箱登录支持两种方式: 1.密码 2.验证码
    if request.login_type == 'email':
        # 方式1: 密码登录
        if request.password:
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # 验证密码
            stored_password_hash = user.metadata_.get('password_hash')
            if not stored_password_hash:
                raise HTTPException(status_code=400, detail="Password not set. Please use verification code login")
            
            if not verify_password(request.password, stored_password_hash):
                raise HTTPException(status_code=401, detail="Invalid password")
        
        # 方式2: 验证码登录
        elif request.verification_code:
            # 验证验证码
            stored_code = get_verification_code(db, login_id)
            print(f"Login attempt for {login_id}: input={request.verification_code}, stored={stored_code}")
            
            if not stored_code or stored_code != request.verification_code:
                raise HTTPException(status_code=401, detail="Invalid verification code")
            
            # 如果用户不存在,自动创建
            if not user:
                # 检查是否有注册时保存的密码（先检查临时存储，再检查数据库）
                reg_data = registration_passwords.get(login_id, {})
                
                # 如果临时存储中没有密码，尝试从数据库中获取
                if not reg_data.get('password_hash'):
                    # 从数据库中获取验证码记录，其中可能包含密码哈希
                    from sqlalchemy import text
                    from datetime import datetime
                    result = db.execute(
                        text("SELECT user_name, password_hash FROM verification_codes WHERE user_id = :user_id AND expires_at > :now"),
                        {"user_id": login_id, "now": datetime.now()}
                    ).fetchone()
                    if result:
                        # 修复：确保用户名正确设置，即使为空字符串也要使用默认值
                        user_name = result[0] if result[0] is not None and result[0].strip() != '' else login_id.split('@')[0]
                        reg_data = {
                            'name': user_name,
                            'password_hash': result[1] if result[1] else None
                        }
                
                # 修复：确保用户名正确设置
                user_name = reg_data.get('name')
                if not user_name or user_name.strip() == '':
                    user_name = login_id.split('@')[0]
                
                user = User(
                    user_id=login_id,
                    name=user_name,
                    email=login_id,
                    metadata_={
                        "login_type": "email",
                        "password_hash": reg_data.get('password_hash')
                    } if reg_data.get('password_hash') else {"login_type": "email"}
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                
                # 清除临时密码
                if login_id in registration_passwords:
                    del registration_passwords[login_id]
            
            # 验证成功,删除验证码（在创建用户之后）
            delete_verification_code(db, login_id)
        else:
            raise HTTPException(status_code=400, detail="Password or verification code required")
    
    else:  # wechat或qq
        if not user:
            raise HTTPException(status_code=404, detail="User not found. Please register first")
            
    # 更新最后登录时间
    if user:
        from datetime import datetime, timezone
        meta = user.metadata_ or {}
        meta['last_login_at'] = datetime.now(timezone.utc).isoformat()
        user.metadata_ = meta
        db.commit()
    
    return {
        "status": "success",
        "message": "Login successful",
        "user": {
            "id": str(user.id),
            "user_id": user.user_id,
            "name": user.name,
            "email": user.email,
            "login_type": user.metadata_.get("login_type", "unknown")
        }
    }


class ChangePasswordRequest(BaseModel):
    """修改密码请求(已登录场景)"""
    login_id: str
    old_password: str
    new_password: str
    
    @validator('new_password')
    def validate_new_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v


class ResetPasswordRequest(BaseModel):
    """重置密码请求(忘记密码场景)"""
    login_id: str
    login_type: str
    verification_code: str
    new_password: str
    
    @validator('new_password')
    def validate_new_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db)
):
    """
    修改密码(已登录场景)
    
    用户需要提供:
    - login_id: 邮箱或用户ID
    - old_password: 旧密码
    - new_password: 新密码(至少6位)
    
    流程:
    1. 验证旧密码
    2. 更新为新密码
    """
    # 邮箱统一转小写
    login_id = request.login_id.lower() if '@' in request.login_id else request.login_id
    
    # 查找用户（不区分大小写），同时支持 user_id 和 email
    user = db.query(User).filter(
        (func.lower(User.user_id) == func.lower(login_id)) |
        (func.lower(User.email) == func.lower(login_id))
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 验证旧密码
    stored_password_hash = user.metadata_.get('password_hash')
    if not stored_password_hash:
        raise HTTPException(
            status_code=400, 
            detail="Password not set. Please use reset-password with verification code"
        )
    
    if not verify_password(request.old_password, stored_password_hash):
        raise HTTPException(status_code=401, detail="Invalid old password")
    
    # 更新为新密码
    new_password_hash = hash_password(request.new_password)
    user.metadata_['password_hash'] = new_password_hash
    db.commit()
    
    return {
        "status": "success",
        "message": "Password changed successfully"
    }


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    重置密码(忘记密码场景)
    
    用户需要:
    1. 先调用 /register 接口发送验证码
    2. 使用验证码调用此接口重置密码
    
    参数:
    - login_id: 邮箱
    - login_type: 登录类型(目前仅支持email)
    - verification_code: 邮箱验证码
    - new_password: 新密码(至少6位)
    """
    # 邮箱统一转小写
    login_id = request.login_id.lower() if request.login_type == 'email' else request.login_id
    
    # 只支持邮箱重置密码
    if request.login_type != 'email':
        raise HTTPException(
            status_code=400, 
            detail="Only email login type supports password reset"
        )
    
    # 验证验证码（优先从数据库读取，避免进程内存不同步）
    from sqlalchemy import text
    from datetime import datetime
    now = datetime.now()
    row = db.execute(
        text("SELECT code FROM verification_codes WHERE user_id = :user_id AND expires_at > :now"),
        {"user_id": login_id, "now": now}
    ).fetchone()
    stored_code = row[0] if row else None
    if not stored_code or stored_code != request.verification_code:
        raise HTTPException(status_code=401, detail="Invalid verification code")
    # 删除验证码记录
    db.execute(text("DELETE FROM verification_codes WHERE user_id = :user_id"), {"user_id": login_id})
    db.commit()
    
    # 查找用户（不区分大小写），同时支持 user_id 和 email
    user = db.query(User).filter(
        (func.lower(User.user_id) == func.lower(login_id)) |
        (func.lower(User.email) == func.lower(login_id))
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 更新密码
    new_password_hash = hash_password(request.new_password)
    user.metadata_['password_hash'] = new_password_hash
    db.commit()
    
    return {
        "status": "success",
        "message": "Password reset successfully"
    }


@router.post("/auto-bind")
async def auto_bind_device(
    user_id: str,
    device_identifier: str,  # MAC地址或设备唯一标识
    device_type: str = "ai_robot",
    device_name: Optional[str] = None,
    auto_create_user: bool = False,
    db: Session = Depends(get_db)
):
    """
    自动绑定设备到用户
    
    适用场景:
    1. AI机器人首次连接时自动绑定
    2. MCPhub通过MCP工具调用此接口
    3. 支持自动创建用户(用于特殊场景)
    
    参数:
    - user_id: 用户邮箱或唯一标识
    - device_identifier: 设备唯一标识(MAC地址、设备ID等)
    - device_type: 设备类型,默认"ai_robot"
    - device_name: 设备名称(可选)
    - auto_create_user: 是否自动创建用户(默认False)
    
    返回:
    - status: success/already_bound/user_created
    - app_id: 应用ID
    - message: 提示信息
    """
    # 查找或创建用户
    user = db.query(User).filter(User.user_id == user_id).first()
    
    if not user:
        if auto_create_user:
            # 自动创建用户
            user = User(
                user_id=user_id,
                name=user_id.split('@')[0] if '@' in user_id else user_id,
                email=user_id if '@' in user_id else None,
                metadata_={"login_type": "auto", "created_by": "auto_bind"}
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            user_created = True
        else:
            raise HTTPException(
                status_code=404, 
                detail=f"User {user_id} not found. Please register first or set auto_create_user=true"
            )
    else:
        user_created = False
    
    from app.models import App
    
    # 检查设备是否已经绑定
    # 使用device_identifier作为唯一标识
    existing_app = db.query(App).filter(
        App.name == device_identifier
    ).first()
    
    if existing_app:
        # 检查是否绑定到当前用户
        if existing_app.owner_id == user.id:
            return {
                "status": "already_bound",
                "message": f"Device {device_identifier} already bound to user {user_id}",
                "app_id": str(existing_app.id),
                "device_identifier": device_identifier,
                "user_id": user_id
            }
        else:
            # 设备已绑定到其他用户
            raise HTTPException(
                status_code=400,
                detail=f"Device {device_identifier} already bound to another user"
            )
    
    # 创建新的绑定关系
    new_app = App(
        owner_id=user.id,
        name=device_identifier,
        description=device_name or f"{device_type} {device_identifier}",
        metadata_={
            "type": device_type,
            "device_identifier": device_identifier,
            "device_name": device_name,
            "bound_at": str(datetime.datetime.now(datetime.UTC)),
            "bind_method": "auto"
        }
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    
    return {
        "status": "user_created" if user_created else "success",
        "message": f"Device {device_identifier} bound to user {user_id} successfully",
        "app_id": str(new_app.id),
        "device_identifier": device_identifier,
        "device_name": device_name,
        "user_id": user_id,
        "user_created": user_created
    }


@router.post("/bind-mac")
async def bind_mac_address(
    user_id: str,
    request: BindMacRequest,
    db: Session = Depends(get_db)
):
    """
    绑定MAC地址到用户
    MAC地址会作为一个App创建,关联到用户
    """
    # 验证用户存在
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 使用utils.db中的函数创建或获取app(MAC地址作为app name)
    from app.models import App
    
    # 检查MAC地址是否已被绑定
    existing_app = db.query(App).filter(App.name == request.mac_address).first()
    if existing_app:
        # 检查是否已绑定到当前用户
        if existing_app.owner_id == user.id:
            return {
                "status": "already_bound",
                "message": "MAC address already bound to this user",
                "app_id": str(existing_app.id),
                "mac_address": request.mac_address
            }
        else:
            raise HTTPException(
                status_code=400,
                detail="MAC address already bound to another user"
            )
    
    # 创建新的app(MAC地址)
    # 设备名称可选,如果不提供则使用MAC地址,后续由MCPhub首次发送时更新
    new_app = App(
        owner_id=user.id,
        name=request.mac_address,
        description=request.device_name if request.device_name else f"设备 {request.mac_address}",
        metadata_={
            "type": "ai_robot",
            "device_identifier": request.mac_address,
            "device_name": request.device_name if request.device_name else None,
            "bound_at": str(datetime.datetime.now(datetime.UTC)),
            "bind_method": "manual"
        }
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    
    return {
        "status": "success",
        "message": "MAC address bound successfully",
        "app_id": str(new_app.id),
        "mac_address": request.mac_address,
        "device_name": request.device_name
    }


@router.get("/user/{user_id}/devices")
async def get_user_devices(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    获取用户绑定的所有设备(MAC地址)
    """
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    from app.models import App
    
    # 获取用户的所有app,筛选出MAC地址类型的
    apps = db.query(App).filter(
        App.owner_id == user.id
    ).all()
    
    # 筛选出MAC地址类型的设备
    mac_devices = [
        app for app in apps 
        if app.metadata_ and app.metadata_.get('type') == 'mac_device'
    ]
    
    devices = [
        {
            "app_id": str(app.id),
            "mac_address": app.name,
            "device_name": app.metadata_.get("device_name"),
            "bound_at": app.metadata_.get("bound_at"),
            "is_active": app.is_active,
            "created_at": str(app.created_at)
        }
        for app in mac_devices
    ]
    
    return {
        "user_id": user_id,
        "total_devices": len(devices),
        "devices": devices
    }


@router.post("/bind-app")
async def bind_ai_app(
    user_id: str,
    app_name: str,
    app_type: str = "ai_agent",  # claude, cursor, cline, windsurf等
    description: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    绑定AI应用(Claude, Cursor, Cline等)
    
    参数:
    - user_id: 用户邮箱
    - app_name: 应用名称,如"Claude Desktop", "Cursor", "Cline"等
    - app_type: 应用类型,默认"ai_agent"
    - description: 应用描述
    
    返回:
    - app_id: 应用ID
    - mcp_config: MCP配置信息(用于添加到AI应用配置文件)
    """
    # 验证用户存在
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    from app.models import App
    
    # 检查应用是否已存在
    # 使用user_id + app_name作为唯一标识
    app_unique_name = f"{user_id}_{app_name}"
    existing_app = db.query(App).filter(App.name == app_unique_name).first()
    
    if existing_app:
        return {
            "status": "already_bound",
            "message": f"App {app_name} already bound to this user",
            "app_id": str(existing_app.id),
            "mcp_config": generate_mcp_config(user_id, app_name)
        }
    
    # 创建新的app
    new_app = App(
        owner_id=user.id,
        name=app_unique_name,
        description=description or f"{app_name} for {user.name}",
        metadata_={
            "type": app_type,
            "app_name": app_name,
            "bound_at": str(datetime.datetime.now(datetime.UTC))
        }
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    
    return {
        "status": "success",
        "message": f"App {app_name} bound successfully",
        "app_id": str(new_app.id),
        "app_name": app_name,
        "mcp_config": generate_mcp_config(user_id, app_name)
    }


def generate_mcp_config(user_id: str, client_name: str) -> dict:
    """
    生成MCP配置信息
    
    参数:
    - user_id: 用户邮箱
    - client_name: 客户端名称
    
    返回:
    - MCP配置字典,可直接复制到Claude/Cursor配置文件
    """
    server_url = os.getenv("PUBLIC_URL", "http://8.216.39.10:8765")
    
    config = {
        "mcpServers": {
            "openmemory": {
                "command": "npx",
                "args": [
                    "-y",
                    "@modelcontextprotocol/server-everything"
                ],
                "env": {
                    "MCP_SERVER_URL": f"{server_url}/mcp/{client_name}/sse/{user_id}",
                    "USER_ID": user_id,
                    "CLIENT_NAME": client_name
                }
            }
        }
    }
    
    # 同时提供简化的配置说明
    config_guide = {
        "claude_desktop": {
            "config_file_path": {
                "mac": "~/Library/Application Support/Claude/claude_desktop_config.json",
                "windows": "%APPDATA%\\Claude\\claude_desktop_config.json",
                "linux": "~/.config/Claude/claude_desktop_config.json"
            },
            "config_content": config
        },
        "cursor": {
            "config_file_path": "在Cursor设置中添加MCP服务器",
            "server_url": f"{server_url}/mcp/{client_name}/sse/{user_id}",
            "env": {
                "USER_ID": user_id,
                "CLIENT_NAME": client_name
            }
        },
        "streamable_http": {
            "description": "适用于MCPhub等支持Streamable HTTP的客户端",
            "url": f"{server_url}/mcp/openmemory",
            "configuration": {
                "user_id": user_id,
                "client_name": client_name
            }
        }
    }
    
    return {
        "config": config,
        "guide": config_guide
    }


@router.get("/user/{user_id}/apps")
async def get_user_apps(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    获取用户绑定的所有AI应用
    """
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    from app.models import App
    
    # 获取用户的所有app
    apps = db.query(App).filter(
        App.owner_id == user.id
    ).all()
    
    # 分类显示
    ai_apps = [
        app for app in apps 
        if app.metadata_ and app.metadata_.get('type') == 'ai_agent'
    ]
    
    mac_devices = [
        app for app in apps 
        if app.metadata_ and app.metadata_.get('type') == 'mac_device'
    ]
    
    return {
        "user_id": user_id,
        "total_apps": len(apps),
        "ai_apps": [
            {
                "app_id": str(app.id),
                "app_name": app.metadata_.get("app_name"),
                "description": app.description,
                "is_active": app.is_active,
                "bound_at": app.metadata_.get("bound_at"),
                "created_at": str(app.created_at)
            }
            for app in ai_apps
        ],
        "devices": [
            {
                "app_id": str(app.id),
                "mac_address": app.name.split('_')[-1] if '_' in app.name else app.name,
                "device_name": app.metadata_.get("device_name"),
                "is_active": app.is_active,
                "bound_at": app.metadata_.get("bound_at"),
                "created_at": str(app.created_at)
            }
            for app in mac_devices
        ]
    }


@router.delete("/unbind-mac")
async def unbind_mac_address(
    user_id: str,
    mac_address: str,
    db: Session = Depends(get_db)
):
    """
    解绑MAC地址
    """
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    from app.models import App
    
    # 查找MAC地址对应的app
    app = db.query(App).filter(
        App.name == mac_address,
        App.owner_id == user.id
    ).first()
    
    if not app:
        raise HTTPException(
            status_code=404,
            detail="MAC address not found or not bound to this user"
        )
    
    # 删除app(解绑)
    # 注意:这会影响相关的记忆,可能需要软删除或归档
    db.delete(app)
    db.commit()
    
    return {
        "status": "success",
        "message": "MAC address unbound successfully",
        "mac_address": mac_address
    }


@router.get("/profile")
async def get_user_profile(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    获取用户资料
    """
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        user = db.query(User).filter(User.email == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user.id),
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }

class PromoteAdminRequest(BaseModel):
    email: EmailStr

@router.post("/promote-admin")
async def promote_admin(
    requester_id: str,
    request: PromoteAdminRequest,
    db: Session = Depends(get_db)
):
    requester = db.query(User).filter(User.user_id == requester_id).first()
    if not requester:
        requester = db.query(User).filter(User.email == requester_id).first()
    if not requester or not requester.is_admin:
        raise HTTPException(status_code=403, detail="Permission denied")

    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Target user not found")
    user.is_admin = True
    db.commit()
    db.refresh(user)
    return {"status": "success", "email": user.email, "is_admin": user.is_admin}


# 验证码数据库操作函数
def save_verification_code(db: Session, user_id: str, code: str, user_name: str = '', password_hash: str = ''):
    """保存验证码到数据库"""
    from datetime import datetime, timedelta
    from sqlalchemy import text
    # 删除旧的验证码
    db.execute(text("DELETE FROM verification_codes WHERE user_id = :user_id"), {"user_id": user_id})
    # 插入新的验证码
    expires_at = datetime.now() + timedelta(minutes=10)  # 10分钟有效期
    db.execute(
        text("INSERT INTO verification_codes (user_id, code, expires_at, user_name, password_hash) VALUES (:user_id, :code, :expires_at, :user_name, :password_hash)"),
        {"user_id": user_id, "code": code, "expires_at": expires_at, "user_name": user_name, "password_hash": password_hash}
    )
    db.commit()


def get_verification_code(db: Session, user_id: str) -> Optional[str]:
    """从数据库获取验证码"""
    from datetime import datetime
    from sqlalchemy import text
    result = db.execute(
        text("SELECT code FROM verification_codes WHERE user_id = :user_id AND expires_at > :now"),
        {"user_id": user_id, "now": datetime.now()}
    ).fetchone()
    return result[0] if result else None


def delete_verification_code(db: Session, user_id: str):
    """从数据库删除验证码"""
    from sqlalchemy import text
    db.execute(text("DELETE FROM verification_codes WHERE user_id = :user_id"), {"user_id": user_id})
    db.commit()


@router.post("/bind-endpoint")
async def bind_endpoint_url(
    user_id: str,
    request: BindEndpointRequest,
    db: Session = Depends(get_db)
):
    """
    绑定Endpoint URL到用户
    使用endpoint URL作为设备标识，支持用户自定义设备名称
    """
    # 验证用户存在
    # 尝试匹配 user_id, email, 或 metadata 中的 id
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        user = db.query(User).filter(User.email == user_id).first()
    
    if not user:
        print(f"User not found for bind-endpoint: {user_id}")
        raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
    
    from app.models import App
    
    # 优先使用 websocket_url 进行唯一绑定检查
    existing_app = db.query(App).filter(App.websocket_url == request.endpoint_url).first()
    if existing_app:
        # 检查是否已绑定到当前用户
        if existing_app.owner_id == user.id:
            return {
                "status": "already_bound",
                "message": "Endpoint URL already bound to this user",
                "app_id": str(existing_app.id),
                "endpoint_url": request.endpoint_url,
                "device_name": existing_app.device_name or existing_app.metadata_.get("device_name") if existing_app.metadata_ else None
            }
        else:
            raise HTTPException(
                status_code=400,
                detail="Endpoint URL already bound to another user"
            )
    # 如果同名设备已存在，进行归属与更新校验
    same_name_app = db.query(App).filter(App.name == request.device_name).first()
    if same_name_app:
        if same_name_app.owner_id != user.id:
            raise HTTPException(status_code=400, detail="Device name already used by another user")
        # 更新其 websocket_url 以与新的端点绑定保持一致
        same_name_app.websocket_url = request.endpoint_url
        same_name_app.device_name = request.device_name
        same_name_app.metadata_ = (same_name_app.metadata_ or {})
        same_name_app.metadata_.update({
            "type": "ai_robot",
            "device_identifier": request.endpoint_url,
            "device_name": request.device_name,
            "bound_at": str(datetime.datetime.now(datetime.UTC)),
            "bind_method": "manual"
        })
        db.commit()
        db.refresh(same_name_app)
        return {
            "status": "success",
            "message": "Endpoint URL bound successfully",
            "app_id": str(same_name_app.id),
            "endpoint_url": request.endpoint_url,
            "device_name": request.device_name
        }

    # 创建新的app(使用设备名称作为 app.name，websocket_url 单独存储)
    # 尝试从URL的token中解析 agentId
    agent_id_val = None
    try:
        import re
        m = re.search(r"token=([^&]*)", request.endpoint_url)
        if m:
            token = m.group(1)
            parts = token.split('.')
            if len(parts) >= 2:
                payload = parts[1]
                missing = len(payload) % 4
                if missing:
                    payload += '=' * (4 - missing)
                data = json.loads(base64.b64decode(payload).decode('utf-8'))
                if 'agentId' in data:
                    agent_id_val = int(data['agentId'])
    except Exception:
        agent_id_val = None
    new_app = App(
        owner_id=user.id,
        name=request.device_name,
        description=f"设备 {request.device_name}",
        metadata_={
            "type": "ai_robot",
            "device_identifier": request.endpoint_url,
            "device_name": request.device_name,
            "bound_at": str(datetime.datetime.now(datetime.UTC)),
            "bind_method": "manual"
        },
        websocket_url=request.endpoint_url,
        device_name=request.device_name,
        agent_id=agent_id_val
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    
    return {
        "status": "success",
        "message": "Endpoint URL bound successfully",
        "app_id": str(new_app.id),
        "endpoint_url": request.endpoint_url,
        "device_name": request.device_name
    }


@router.get("/user/{user_id}/endpoints")
async def get_user_endpoints(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    获取用户绑定的所有Endpoint URL设备
    """
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    from app.models import App
    
    # 获取用户的所有app,筛选出endpoint URL类型的
    apps = db.query(App).filter(
        App.owner_id == user.id
    ).all()
    
    # 筛选出endpoint URL类型的设备
    endpoint_devices = [
        app for app in apps 
        if app.metadata_ and app.metadata_.get('type') == 'ai_robot' and app.metadata_.get('bind_method') == 'manual'
    ]
    
    endpoints = [
        {
            "app_id": str(app.id),
            "endpoint_url": app.websocket_url or (app.metadata_.get("device_identifier") if app.metadata_ else None) or app.name,
            "device_name": app.device_name or (app.metadata_.get("device_name") if app.metadata_ else None),
            "bound_at": (app.metadata_.get("bound_at") if app.metadata_ else None),
            "is_active": app.is_active,
            "created_at": str(app.created_at)
        }
        for app in endpoint_devices
    ]
    
    return {
        "user_id": user_id,
        "total_endpoints": len(endpoints),
        "endpoints": endpoints
    }


@router.get("/endpoint/{endpoint_url}/user")
async def get_user_by_endpoint(
    endpoint_url: str,
    db: Session = Depends(get_db)
):
    """
    通过endpoint URL获取绑定的用户信息
    """
    from app.models import App
    
    # 解码URL（如果需要）
    import urllib.parse
    decoded_endpoint = urllib.parse.unquote(endpoint_url)
    
    # 查找绑定到该endpoint的app（优先 websocket_url）
    app = db.query(App).filter(App.websocket_url == decoded_endpoint).first()
    if not app:
        # 兼容旧数据：回退到 name 匹配
        app = db.query(App).filter(App.name == decoded_endpoint).first()
    if not app:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    
    # 获取用户信息
    user = db.query(User).filter(User.id == app.owner_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user.user_id,
        "user_name": user.name,
        "app_id": str(app.id),
        "endpoint_url": app.name
    }
@router.get("/oauth/agg/{login_type}/prepare")
async def oauth_agg_prepare(login_type: str):
    base = os.getenv("AGG_LOGIN_BASE", "https://baoxian18.com/connect.php")
    appid = os.getenv("AGG_APP_ID")
    appkey = os.getenv("AGG_APP_KEY")
    redirect_uri = os.getenv("AGG_REDIRECT_URI", "https://www.momemory.com/api/v1/auth/oauth/agg/callback")
    if not appid or not appkey:
        raise HTTPException(status_code=500, detail="Aggregator OAuth not configured")
    t = login_type.lower()
    if t not in ["qq", "wx", "wechat"]:
        raise HTTPException(status_code=400, detail="Unsupported aggregator login type")
    type_param = "wx" if t in ["wx", "wechat"] else "qq"
    import httpx
    async with httpx.AsyncClient() as client:
        r = await client.get(
            base,
            params={
                "act": "login",
                "appid": appid,
                "appkey": appkey,
                "type": type_param,
                "redirect_uri": redirect_uri,
            },
            timeout=10.0,
        )
        data = r.json()
    if data.get("code") != 0:
        raise HTTPException(status_code=400, detail=data.get("msg") or "Aggregator login init failed")
    return {
        "type": type_param,
        "url": data.get("url"),
        "qrcode": data.get("qrcode"),
        "redirect_uri": redirect_uri,
    }
import logging

logger = logging.getLogger(__name__)

class SendCodeRequest(BaseModel):
    email: EmailStr
    type: str = "update_email" # register, update_email, reset_password

class UpdateEmailRequest(BaseModel):
    user_id: str
    email: EmailStr
    code: str
    password: Optional[str] = None

@router.post("/update-email")
async def update_user_email(
    request: UpdateEmailRequest,
    db: Session = Depends(get_db)
):
    """
    更新用户邮箱
    验证通过后更新邮箱，并可选设置密码
    """
    # 1. 验证验证码
    # 注意：验证码是绑定在新邮箱上的
    stored_code = get_verification_code(db, request.email)
    if not stored_code or stored_code != request.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
        
    # 2. 检查邮箱是否被占用
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
         # 如果是同一个用户，允许更新（虽然没变化）
         # 注意：这里需要准确判断是否为同一用户。
         # 简单起见，如果存在且user_id不同则报错
         if existing.user_id != request.user_id:
             raise HTTPException(status_code=400, detail="Email already occupied by another user")
             
    # 3. 获取当前用户
    user = db.query(User).filter(User.user_id == request.user_id).first()
    if not user:
        # 尝试通过email查找（兼容旧逻辑）
        user = db.query(User).filter(User.email == request.user_id).first()
        
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # 4. 更新邮箱
    user.email = request.email
    
    # 5. 设置密码（如果提供）
    if request.password:
        meta = user.metadata_ or {}
        meta['password_hash'] = hash_password(request.password)
        # 确保 login_type 信息完整，允许混合登录
        user.metadata_ = meta
        
    db.commit()
    
    # 6. 删除验证码
    delete_verification_code(db, request.email)
    
    return {
        "status": "success",
        "message": "Email updated successfully",
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "login_type": user.metadata_.get("login_type")
        }
    }

@router.post("/send-code")
async def send_code(
    request: SendCodeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    发送验证码 (通用接口)
    type: register, update_email, reset_password
    """
    email = request.email.lower()
    
    # 检查频率限制 (TODO)
    
    if request.type == 'update_email':
        # 检查邮箱是否已被其他用户占用
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already occupied by another user")
    
    # 生成验证码
    code = str(secrets.randbelow(900000) + 100000)
    
    # 保存验证码
    save_verification_code(db, email, code)
    
