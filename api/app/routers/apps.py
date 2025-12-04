from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc

from app.database import get_db
from app.models import App, Memory, MemoryAccessLog, MemoryState, User, memory_categories
from app.dependencies import get_current_user

router = APIRouter(tags=["apps"])

# Helper functions
def get_app_or_404(db: Session, app_id: UUID) -> App:
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    return app

# List all apps with filtering
@router.get("/")
async def list_apps(
    name: Optional[str] = None,
    is_active: Optional[bool] = None,
    sort_by: str = 'name',
    sort_direction: str = 'asc',
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user_id: Optional[str] = None,  # 添加user_id参数
    hide_empty: bool = False,  # 添加hide_empty参数，用于隐藏没有记忆的应用
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Create a subquery for memory counts (包括所有状态的记忆)
    memory_counts = db.query(
        Memory.app_id,
        func.count(Memory.id).label('memory_count')
    ).filter(
        Memory.state != MemoryState.deleted  # 只计算非删除状态的记忆
    ).group_by(Memory.app_id).subquery()

    # Create a subquery for access counts
    access_counts = db.query(
        MemoryAccessLog.app_id,
        func.count(func.distinct(MemoryAccessLog.memory_id)).label('access_count')
    ).group_by(MemoryAccessLog.app_id).subquery()

    # Base query
    query = db.query(
        App,
        func.coalesce(memory_counts.c.memory_count, 0).label('total_memories_created'),
        func.coalesce(access_counts.c.access_count, 0).label('total_memories_accessed')
    )

    # Determined target user logic
    target_user = current_user
    if user_id:
        # Only admin can query for other users
        if current_user.is_admin:
            target_user = db.query(User).filter(User.user_id == user_id).first()
            if not target_user:
                # Return empty if admin asks for non-existent user
                return {"total": 0, "page": page, "page_size": page_size, "apps": []}
        # If not admin, ignore user_id param and show current user's apps
    
    if not target_user.is_admin:
        query = query.filter(App.owner_id == target_user.id)
    # If admin and no user_id specified, show all apps (no filter)
    # If admin and user_id specified, we filtered by target_user above (implied? no, wait)
    
    if current_user.is_admin and user_id:
         query = query.filter(App.owner_id == target_user.id)

    # Join with subqueries
    query = query.outerjoin(
        memory_counts,
        App.id == memory_counts.c.app_id
    ).outerjoin(
        access_counts,
        App.id == access_counts.c.app_id
    )

    # 如果hide_empty为True，则只返回有记忆的应用
    if hide_empty:
        query = query.filter(func.coalesce(memory_counts.c.memory_count, 0) > 0)

    if name:
        query = query.filter(App.name.ilike(f"%{name}%"))

    if is_active is not None:
        query = query.filter(App.is_active == is_active)

    # Apply sorting
    if sort_by == 'name':
        sort_field = App.name
    elif sort_by == 'memories':
        sort_field = func.coalesce(memory_counts.c.memory_count, 0)
    elif sort_by == 'memories_accessed':
        sort_field = func.coalesce(access_counts.c.access_count, 0)
    else:
        sort_field = App.name  # default sort

    if sort_direction == 'desc':
        query = query.order_by(desc(sort_field))
    else:
        query = query.order_by(sort_field)

    total = query.count()
    apps = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "apps": [
            {
                "id": app[0].id,
                "name": format_app_display_name(app[0]),
                "is_active": app[0].is_active,
                "total_memories_created": app[1],
                "total_memories_accessed": app[2]
            }
            for app in apps
        ]
    }


def format_app_display_name(app: App) -> str:
    """
    格式化应用显示名称
    - AI机器人: 显示设备名称
    - 其他应用: 原名称
    """
    if app.metadata_ and app.metadata_.get('type') in ['ai_robot', 'mac_device']:
        # 优先使用device_name字段，如果没有则使用metadata中的设备名称
        device_name = app.device_name or app.metadata_.get('device_name')
        if device_name:
            return device_name
        else:
            # 如果没有设备名称，显示原始名称
            return app.name
    else:
        # 其他类型app,返回原名称
        return app.name

# Get app details
@router.get("/{app_id}")
async def get_app_details(
    app_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = get_app_or_404(db, app_id)
    
    # Check permission
    if not current_user.is_admin and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")

    # Get memory access statistics
    access_stats = db.query(
        func.count(MemoryAccessLog.id).label("total_memories_accessed"),
        func.min(MemoryAccessLog.accessed_at).label("first_accessed"),
        func.max(MemoryAccessLog.accessed_at).label("last_accessed")
    ).filter(MemoryAccessLog.app_id == app_id).first()

    return {
        "is_active": app.is_active,
        "total_memories_created": db.query(Memory)
            .filter(Memory.app_id == app_id)
            .count(),
        "total_memories_accessed": access_stats.total_memories_accessed or 0,
        "first_accessed": access_stats.first_accessed,
        "last_accessed": access_stats.last_accessed
    }

# List memories created by app
@router.get("/{app_id}/memories")
async def list_app_memories(
    app_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = get_app_or_404(db, app_id)
    
    # Check permission
    if not current_user.is_admin and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")

    query = db.query(Memory).filter(
        Memory.app_id == app_id,
        Memory.state.in_([MemoryState.active, MemoryState.paused, MemoryState.archived])
    )
    # Add eager loading for categories
    query = query.options(joinedload(Memory.categories))
    total = query.count()
    memories = query.order_by(Memory.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "memories": [
            {
                "id": memory.id,
                "content": memory.content,
                "created_at": memory.created_at,
                "state": memory.state.value,
                "app_id": memory.app_id,
                "categories": [category.name for category in memory.categories],
                "metadata_": memory.metadata_
            }
            for memory in memories
        ]
    }

# List memories accessed by app
@router.get("/{app_id}/accessed")
async def list_app_accessed_memories(
    app_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = get_app_or_404(db, app_id)
    if not current_user.is_admin and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get memories with access counts
    query = db.query(
        Memory,
        func.count(MemoryAccessLog.id).label("access_count")
    ).join(
        MemoryAccessLog,
        Memory.id == MemoryAccessLog.memory_id
    ).filter(
        MemoryAccessLog.app_id == app_id
    ).group_by(
        Memory.id
    ).order_by(
        desc("access_count")
    )

    # Add eager loading for categories
    query = query.options(joinedload(Memory.categories))

    total = query.count()
    results = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "memories": [
            {
                "memory": {
                    "id": memory.id,
                    "content": memory.content,
                    "created_at": memory.created_at,
                    "state": memory.state.value,
                    "app_id": memory.app_id,
                    "app_name": memory.app.name if memory.app else None,
                    "categories": [category.name for category in memory.categories],
                    "metadata_": memory.metadata_
                },
                "access_count": count
            }
            for memory, count in results
        ]
    }


@router.put("/{app_id}")
async def update_app_details(
    app_id: UUID,
    is_active: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = get_app_or_404(db, app_id)
    
    if not current_user.is_admin and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")

    app.is_active = is_active
    db.commit()
    return {"status": "success", "message": "Updated app details successfully"}


# Delete app
@router.delete("/{app_id}")
async def delete_app(
    app_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = get_app_or_404(db, app_id)
    
    if not current_user.is_admin and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Delete all memory category associations for memories associated with this app
    # First get all memory IDs associated with this app
    memory_ids = db.query(Memory.id).filter(Memory.app_id == app_id).all()
    memory_ids = [mid[0] for mid in memory_ids]
    
    # Delete all related records in other tables that reference these memories
    if memory_ids:
        # Delete memory category associations
        db.execute(
            memory_categories.delete().where(
                memory_categories.c.memory_id.in_(memory_ids)
            )
        )
        
        # Delete memory access logs
        db.query(MemoryAccessLog).filter(
            MemoryAccessLog.memory_id.in_(memory_ids)
        ).delete(synchronize_session=False)
        
        # Delete memory status history
        from app.models import MemoryStatusHistory
        db.query(MemoryStatusHistory).filter(
            MemoryStatusHistory.memory_id.in_(memory_ids)
        ).delete(synchronize_session=False)
    
    # Delete all memories associated with this app
    db.query(Memory).filter(Memory.app_id == app_id).delete()
    
    # Delete the app itself
    db.delete(app)
    db.commit()
    
    return {"status": "success", "message": "App deleted successfully"}


# Update app name
@router.put("/{app_id}/name")
async def update_app_name(
    app_id: UUID,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = get_app_or_404(db, app_id)
    
    if not current_user.is_admin and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get the name from request body
    name = request.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    
    # Update the app name
    app.name = name
    db.commit()
    
    return {"status": "success", "message": "App name updated successfully"}

    # Delete all memories associated with this app
    db.query(Memory).filter(Memory.app_id == app_id).delete()
    
    # Delete the app itself
    db.delete(app)
    db.commit()
    
    return {"status": "success", "message": "App deleted successfully"}


# Update app name
@router.put("/{app_id}/name")
async def update_app_name(
    app_id: UUID,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = get_app_or_404(db, app_id)
    
    if not current_user.is_admin and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get the name from request body
    name = request.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    
    # Update the app name
    app.name = name
    db.commit()
    
    return {"status": "success", "message": "App name updated successfully"}
    # Delete all memories associated with this app
    db.query(Memory).filter(Memory.app_id == app_id).delete()
    
    # Delete the app itself
    db.delete(app)
    db.commit()
    
    return {"status": "success", "message": "App deleted successfully"}


# Update app name
@router.put("/{app_id}/name")
async def update_app_name(
    app_id: UUID,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = get_app_or_404(db, app_id)
    
    if not current_user.is_admin and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get the name from request body
    name = request.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    
    # Update the app name
    app.name = name
    db.commit()
    
    return {"status": "success", "message": "App name updated successfully"}

    # Delete all memories associated with this app
    db.query(Memory).filter(Memory.app_id == app_id).delete()
    
    # Delete the app itself
    db.delete(app)
    db.commit()
    
    return {"status": "success", "message": "App deleted successfully"}


# Update app name
@router.put("/{app_id}/name")
async def update_app_name(
    app_id: UUID,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = get_app_or_404(db, app_id)
    
    if not current_user.is_admin and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get the name from request body
    name = request.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    
    # Update the app name
    app.name = name
    db.commit()
    
    return {"status": "success", "message": "App name updated successfully"}

    # Delete all memories associated with this app
    db.query(Memory).filter(Memory.app_id == app_id).delete()
    
    # Delete the app itself
    db.delete(app)
    db.commit()
    
    return {"status": "success", "message": "App deleted successfully"}


# Update app name
@router.put("/{app_id}/name")
async def update_app_name(
    app_id: UUID,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = get_app_or_404(db, app_id)
    
    if not current_user.is_admin and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get the name from request body
    name = request.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    
    # Update the app name
    app.name = name
    db.commit()
    
    return {"status": "success", "message": "App name updated successfully"}
    # Delete all memories associated with this app
    db.query(Memory).filter(Memory.app_id == app_id).delete()
    
    # Delete the app itself
    db.delete(app)
    db.commit()
    
    return {"status": "success", "message": "App deleted successfully"}


# Update app name
@router.put("/{app_id}/name")
async def update_app_name(
    app_id: UUID,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = get_app_or_404(db, app_id)
    
    if not current_user.is_admin and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get the name from request body
    name = request.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    
    # Update the app name
    app.name = name
    db.commit()
    
    return {"status": "success", "message": "App name updated successfully"}