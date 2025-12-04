from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import secrets
import datetime
from pydantic import BaseModel
from uuid import UUID

from app.database import get_db
from app.models import User, ApiKey
from app.dependencies import get_current_user_from_cookie

router = APIRouter(
    prefix="/api/v1/api-keys",
    tags=["api-keys"],
    responses={404: {"description": "Not found"}},
)

class ApiKeyResponse(BaseModel):
    id: UUID
    name: Optional[str] = None
    key_preview: str
    full_key: Optional[str] = None  # Added to allow copying from list if needed
    created_at: datetime.datetime
    last_used_at: Optional[datetime.datetime] = None
    is_active: bool

    class Config:
        from_attributes = True

class ApiKeyCreate(BaseModel):
    name: Optional[str] = "My API Key"

class ApiKeyCreateResponse(ApiKeyResponse):
    full_key: str # Only returned once on creation

@router.get("/", response_model=List[ApiKeyResponse])
async def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """List all API keys for the current user."""
    keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id, ApiKey.is_active == True).all()
    
    # Mask keys for display
    results = []
    for k in keys:
        # Handle potential short keys or just safeguard
        if len(k.key) > 12:
            preview = f"{k.key[:8]}...{k.key[-4:]}"
        else:
            preview = "********"
            
        results.append(ApiKeyResponse(
            id=k.id,
            name=k.name,
            key_preview=preview,
            full_key=k.key, # Return full key for copy functionality
            created_at=k.created_at,
            last_used_at=k.last_used_at,
            is_active=k.is_active
        ))
    return results

@router.post("/", response_model=ApiKeyCreateResponse)
async def create_api_key(
    request: ApiKeyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Create a new API key."""
    # Generate a secure random key
    # Format: sk-momemory-<32chars>
    raw_key = f"sk-momemory-{secrets.token_urlsafe(32)}"
    
    new_key = ApiKey(
        user_id=current_user.id,
        key=raw_key,
        name=request.name or "My API Key"
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)
    
    preview = f"{raw_key[:8]}...{raw_key[-4:]}"
    
    return ApiKeyCreateResponse(
        id=new_key.id,
        name=new_key.name,
        key_preview=preview,
        created_at=new_key.created_at,
        last_used_at=new_key.last_used_at,
        is_active=new_key.is_active,
        full_key=raw_key 
    )

@router.delete("/{key_id}")
async def delete_api_key(
    key_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Revoke (delete) an API key."""
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == current_user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Hard delete to keep it simple and clean
    db.delete(key)
    db.commit()
    
    return {"status": "success", "message": "API key revoked"}
