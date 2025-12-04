from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.models import User, App, Memory, MemoryState

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

@router.get("/users")
async def list_users(
    user_id: str = Query(...),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    # case-insensitive match for user_id or email
    admin = (
        db.query(User)
        .filter(func.lower(User.user_id) == func.lower(user_id))
        .first()
    )
    if not admin:
        admin = (
            db.query(User)
            .filter(func.lower(User.email) == func.lower(user_id))
            .first()
        )
    if not admin:
        raise HTTPException(status_code=404, detail="User not found")
    if not admin.is_admin:
        raise HTTPException(status_code=403, detail="Permission denied")

    total = db.query(User).count()
    items: List[User] = (
        db.query(User)
        .order_by(User.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    results = []
    for u in items:
        apps = db.query(App).filter(App.owner_id == u.id).all()
        apps_count = len(apps)
        
        # Collect device info
        devices = []
        for app in apps:
            ws_url = app.websocket_url
            d_name = app.device_name
            
            # Fallback to metadata if columns are empty
            if not ws_url and app.metadata_:
                ws_url = app.metadata_.get('device_identifier')
                # Check if it looks like a URL or is explicitly marked as a device
                if not ws_url and app.metadata_.get('type') in ['ai_robot', 'mac_device']:
                     ws_url = app.name # Sometimes name is the identifier
            
            if not d_name and app.metadata_:
                d_name = app.metadata_.get('device_name')
            
            # Only include if it looks like a device binding (has WS URL or is specific type)
            if ws_url or app.metadata_.get('type') in ['ai_robot', 'mac_device']:
                devices.append({
                    "name": d_name or app.name,
                    "url": ws_url or "N/A"
                })

        memories_count = db.query(Memory).filter(
            Memory.user_id == u.id,
            Memory.state != MemoryState.deleted
        ).count()
        last_login_at = None
        try:
            if isinstance(u.metadata_, dict) and 'last_login_at' in u.metadata_:
                last_login_at = u.metadata_['last_login_at']
        except Exception:
            last_login_at = None
        if not last_login_at:
            last_login_at = u.updated_at or u.created_at
        
        login_type = "email"
        if isinstance(u.metadata_, dict):
            login_type = u.metadata_.get("login_type", "email")
            
        results.append({
            "id": str(u.id),
            "user_id": u.user_id,
            "email": u.email,
            "name": u.name,
            "apps_count": apps_count,
            "memories_count": memories_count,
            "last_login_at": last_login_at,
            "created_at": u.created_at,
            "login_type": login_type,
            "devices": devices,
        })

    pages = (total + size - 1) // size
    return {
        "items": results,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
    }