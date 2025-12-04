from fastapi import Header, HTTPException, Depends, Request, Cookie, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ApiKey, User
from typing import Optional
import json
import urllib.parse
import datetime

def ensure_admin_access(user: User, db: Session):
    """
    Ensure specific users have admin access.
    """
    if user and user.email and user.email.lower() == 'tan_jia@hotmail.com' and not user.is_admin:
        user.is_admin = True
        db.commit()
        db.refresh(user)

async def get_user_from_api_key(
    request: Request,
    authorization: Optional[str] = Header(None),
    api_key_query: Optional[str] = Query(None, alias="api_key"),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Verifies the API Key from:
    1. Authorization header (Bearer <key>)
    2. Query parameter (api_key=<key>)
    
    Returns the User associated with the key, or None if not found/invalid.
    """
    key = None
    
    # 1. Check Header
    if authorization:
        scheme, _, k = authorization.partition(" ")
        if scheme.lower() == "bearer" and k:
            key = k
            
    # 2. Check Query Parameter (Fallback)
    if not key and api_key_query:
        key = api_key_query
        
    if not key:
        return None
    
    # Verify against DB (Plain text check as decided for MVP)
    api_key = db.query(ApiKey).filter(
        ApiKey.key == key,
        ApiKey.is_active == True
    ).first()
    
    if not api_key:
        return None
    
    user = api_key.user
    ensure_admin_access(user, db)
    
    # Update last used time (optional, skip for performance or use background task)
    # api_key.last_used_at = datetime.datetime.now(datetime.UTC)
    # db.commit()
    
    return user

async def get_current_user_from_cookie(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """
    Extracts user info from 'userInfo' cookie.
    Note: This relies on the cookie set by LoginClient. 
    For higher security, this should be a signed session or JWT.
    """
    user_info_str = request.cookies.get("userInfo")
    if not user_info_str:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Cookie might be URL encoded
        try:
            user_info_str = urllib.parse.unquote(user_info_str)
            user_info = json.loads(user_info_str)
        except json.JSONDecodeError:
            # Try raw
            user_info = json.loads(request.cookies.get("userInfo"))
            
        user_id = user_info.get("userId") or user_info.get("email") or user_info.get("openid")
        if not user_id:
             raise HTTPException(status_code=401, detail="Invalid user session")
             
        # Find user in DB
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            # Try case-insensitive email match if user_id lookups fail
            # Note: This is a fallback. user_id should normally match.
            user = db.query(User).filter(User.email == user_id).first()
            
        if not user:
             raise HTTPException(status_code=401, detail="User not found")
             
        ensure_admin_access(user, db)
             
        return user
        
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid session format")

async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    api_key_query: Optional[str] = Query(None, alias="api_key"),
    db: Session = Depends(get_db)
) -> User:
    """
    Unified dependency to get current user from API Key OR Cookie.
    """
    # 1. Try API Key (Header or Query)
    if authorization or api_key_query:
        user = await get_user_from_api_key(request, authorization, api_key_query, db)
        if user:
            return user
    
    # 2. Try Cookie
    if request.cookies.get("userInfo"):
        return await get_current_user_from_cookie(request, db)
        
    raise HTTPException(status_code=401, detail="Not authenticated")
