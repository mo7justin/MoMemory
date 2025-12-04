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

from app.database import get_db
from app.models import User, ApiKey
from app.utils.db import get_or_create_user

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
security = HTTPBearer(auto_error=False) # Optional auth for some endpoints

# ... existing code ...

# API Key Management Models
class CreateApiKeyRequest(BaseModel):
    name: str

class ApiKeyResponse(BaseModel):
    id: str
    key: str
    name: Optional[str]
    created_at: str
    last_used_at: Optional[str] = None
    is_active: bool

# API Key Dependency
async def get_current_user_from_api_key(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    if not creds:
        return None
    
    token = creds.credentials
    # Only handle sk- keys
    if not token.startswith("sk-"):
        return None
        
    api_key = db.query(ApiKey).filter(ApiKey.key == token, ApiKey.is_active == True).first()
    if not api_key:
        # If a token was provided but invalid, we might want to reject here, 
        # but to allow mixed auth modes (like user_id param), we return None 
        # and let the endpoint decide.
        # However, for security, if an API key IS provided but invalid, it should probably fail.
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
    # Update last used (commit effectively logs usage)
    api_key.last_used_at = datetime.datetime.now(datetime.UTC)
    db.commit()
    
    return api_key.user

# ... existing register/login/etc endpoints ...

# API Key Endpoints

@router.post("/api-keys", response_model=ApiKeyResponse)
async def create_api_key(
    request: CreateApiKeyRequest,
    user_id: str,
    db: Session = Depends(get_db)
):
    """Create a new API key for the user"""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        # Try email
        user = db.query(User).filter(User.email == user_id).first()
        
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Generate key
    key_content = f"sk-{secrets.token_urlsafe(32)}"
    
    new_key = ApiKey(
        user_id=user.id,
        key=key_content,
        name=request.name
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)
    
    return {
        "id": str(new_key.id),
        "key": new_key.key, # Only show full key once? For now showing always as we store it plain text (should hash in prod)
        "name": new_key.name,
        "created_at": new_key.created_at.isoformat(),
        "last_used_at": new_key.last_used_at.isoformat() if new_key.last_used_at else None,
        "is_active": new_key.is_active
    }

@router.get("/api-keys", response_model=List[ApiKeyResponse])
async def list_api_keys(
    user_id: str,
    db: Session = Depends(get_db)
):
    """List all API keys for the user"""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        # Try email
        user = db.query(User).filter(User.email == user_id).first()
        
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    keys = db.query(ApiKey).filter(ApiKey.user_id == user.id).all()
    
    return [
        {
            "id": str(k.id),
            "key": k.key[:8] + "..." + k.key[-4:], # Mask key in list
            "name": k.name,
            "created_at": k.created_at.isoformat(),
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "is_active": k.is_active
        }
        for k in keys
    ]

@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    user_id: str,
    db: Session = Depends(get_db)
):
    """Delete (revoke) an API key"""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        user = db.query(User).filter(User.email == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API Key not found")
        
    db.delete(key)
    db.commit()
    
    return {"status": "success", "message": "API Key deleted"}


