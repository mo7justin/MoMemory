import datetime
from typing import List, Optional, Set
from uuid import UUID, uuid4
import logging
import os
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlalchemy import paginate as sqlalchemy_paginate
from pydantic import BaseModel
from sqlalchemy import or_, func
from app.utils.memory import get_memory_client

from app.database import get_db
from app.models import (
    Memory, MemoryState, MemoryAccessLog, App,
    MemoryStatusHistory, User, Category, AccessControl, Config as ConfigModel,
    categorize_memory, memory_categories
)
from app.schemas import MemoryResponse, PaginatedMemoryResponse
from app.utils.permissions import check_memory_access_permissions
from app.routers.apps import format_app_display_name
from app.dependencies import get_current_user

router = APIRouter(tags=["memories"])


class UpdateMemoryStateRequest(BaseModel):
    memory_ids: List[UUID]
    state: str
    user_id: str


class DeleteMemoriesRequest(BaseModel):
    memory_ids: List[UUID]
    user_id: str


class UpdateMemoryContentRequest(BaseModel):
    memory_content: str
    user_id: str


class UpdateMemoryCategoriesRequest(BaseModel):
    categories: List[str]
    user_id: str


# Create memory request model
class CreateMemoryRequest(BaseModel):
    user_id: str
    text: str
    metadata: dict = {}
    infer: bool = True
    app: str = "openmemory"
    device_name: Optional[str] = None  # MCPhub发送时携带设备名称


class MemoryFilterRequest(BaseModel):
    user_id: str
    page: int = 1
    size: int = 10
    search_query: Optional[str] = None
    app_ids: Optional[List[str]] = None
    category_ids: Optional[List[str]] = None
    sort_column: Optional[str] = None
    sort_direction: Optional[str] = None
    show_archived: bool = False


class MemorySearchCompatRequest(BaseModel):
    user_id: Optional[str] = None
    query: Optional[str] = None
    page: int = 1
    page_size: int = 10


def get_memory_or_404(db: Session, memory_id: UUID) -> Memory:
    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


def update_memory_state(db: Session, memory_id: UUID, new_state: MemoryState, user_id: UUID):
    memory = get_memory_or_404(db, memory_id)
    old_state = memory.state

    # Update memory state
    memory.state = new_state
    if new_state == MemoryState.archived:
        memory.archived_at = datetime.datetime.now(datetime.UTC)
    elif new_state == MemoryState.deleted:
        memory.deleted_at = datetime.datetime.now(datetime.UTC)

    # Record state change
    history = MemoryStatusHistory(
        memory_id=memory_id,
        changed_by=user_id,
        old_state=old_state,
        new_state=new_state
    )
    db.add(history)
    db.commit()
    return memory


def get_accessible_memory_ids(db: Session, app_id: UUID) -> Optional[Set[UUID]]:
    """
    Get the set of memory IDs that the app has access to based on app-level ACL rules.
    Returns all memory IDs if no specific restrictions are found.
    """
    # Get app-level access controls
    app_access = db.query(AccessControl).filter(
        AccessControl.subject_type == "app",
        AccessControl.subject_id == app_id,
        AccessControl.object_type == "memory"
    ).all()

    # If no app-level rules exist, return None to indicate all memories are accessible
    if not app_access:
        return None

    # Initialize sets for allowed and denied memory IDs
    allowed_memory_ids = set()
    denied_memory_ids = set()

    # Process app-level rules
    for rule in app_access:
        if rule.effect == "allow":
            if rule.object_id:  # Specific memory access
                allowed_memory_ids.add(rule.object_id)
            else:  # All memories access
                return None  # All memories allowed
        elif rule.effect == "deny":
            if rule.object_id:  # Specific memory denied
                denied_memory_ids.add(rule.object_id)
            else:  # All memories denied
                return set()  # No memories accessible

    # Remove denied memories from allowed set
    if allowed_memory_ids:
        allowed_memory_ids -= denied_memory_ids

    return allowed_memory_ids


# Create new memory
@router.post("/")
async def create_memory(
    request: CreateMemoryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate input
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Memory text cannot be empty")
    
    # Use authenticated user directly
    user = current_user
    
    # Get or create app
    # 如果app是MAC地址格式,并且提供了device_name,则自动绑定
    is_mac_address = ':' in request.app or '-' in request.app
    
    if is_mac_address and request.device_name:
        # MAC地址作为app name,查找或创建
        app_obj = db.query(App).filter(App.name == request.app).first()
        if not app_obj:
            # 创建新的AI机器人设备绑定
            app_obj = App(
                name=request.app,
                owner_id=user.id,
                description=f"{request.device_name}",
                metadata_={
                    "type": "ai_robot",
                    "device_name": request.device_name,
                    "device_identifier": request.app,
                    "bound_at": str(datetime.datetime.now(datetime.UTC)),
                    "bind_method": "auto"
                }
            )
            db.add(app_obj)
            db.commit()
            db.refresh(app_obj)
            logging.info(f"Auto-bound device: {request.device_name} ({request.app}) to user {user.user_id}")
        elif not app_obj.metadata_.get('device_name') and request.device_name:
            # 如果设备已存在但没有device_name,更新它
            app_obj.metadata_['device_name'] = request.device_name
            app_obj.metadata_['type'] = 'ai_robot'
            app_obj.description = request.device_name
            db.commit()
            db.refresh(app_obj)
            logging.info(f"Updated device name: {request.device_name} for MAC {request.app}")
    else:
        # 普通app名称
        app_obj = db.query(App).filter(App.name == request.app).first()
        if not app_obj:
            app_obj = App(name=request.app, owner_id=user.id)
            db.add(app_obj)
            db.commit()
            db.refresh(app_obj)

    # Check if app is active
    if not app_obj.is_active:
        raise HTTPException(status_code=403, detail=f"App {request.app} is currently paused on OpenMemory. Cannot create new memories.")

    # Log what we're about to do
    logging.info(f"Creating memory for user_id: {user.user_id} with app: {request.app}")
    
    # Try to get memory client safely
    try:
        memory_client = get_memory_client()
        if not memory_client:
            error_message = "Memory client is not available. Please check if the memory service is properly configured."
            logging.error(error_message)
            raise HTTPException(status_code=503, detail=error_message)
    except HTTPException:
        raise
    except Exception as client_error:
        error_message = f"Failed to initialize memory client: {str(client_error)}"
        logging.error(error_message)
        raise HTTPException(status_code=500, detail=error_message)

    # Try to save to vector database via memory_client
    try:
        vector_response = memory_client.add(
            messages=request.text,
            user_id=user.user_id,  # Use string user_id to match search
            metadata={
                "source_app": "openmemory",
                "mcp_client": request.app,
                **(request.metadata or {})  # Include user-provided metadata
            }
        )
        
        # Log the response for debugging
        logging.info(f"Vector database response: {vector_response}")
        
        # Process vector database response
        if isinstance(vector_response, dict):
            # Check if results exist and is not empty
            if 'results' in vector_response and vector_response['results']:
                for result in vector_response['results']:
                    if result.get('event') == 'ADD':
                        try:
                            # Get the vector database-generated ID
                            memory_id = UUID(result['id'])
                            
                            # Check if memory already exists
                            existing_memory = db.query(Memory).filter(Memory.id == memory_id).first()
                            
                            if existing_memory:
                                # Update existing memory
                                existing_memory.state = MemoryState.active
                                existing_memory.content = result.get('memory', request.text)
                                existing_memory.metadata_ = request.metadata
                                memory = existing_memory
                                db.commit()
                                db.refresh(memory)
                            else:
                                # Create memory with the EXACT SAME ID from vector database
                                memory = Memory(
                                    id=memory_id,  # Use the same ID that vector database generated
                                    user_id=user.id,
                                    app_id=app_obj.id,
                                    content=result.get('memory', request.text),
                                    metadata_=request.metadata,
                                    state=MemoryState.active
                                )
                                db.add(memory)
                                
                                # Create history entry
                                history = MemoryStatusHistory(
                                    memory_id=memory_id,
                                    changed_by=user.id,
                                    old_state=MemoryState.deleted if not existing_memory else existing_memory.state,
                                    new_state=MemoryState.active
                                )
                                db.add(history)
                                
                                # Commit the memory and history entry first
                                db.commit()
                                db.refresh(memory)
                                
                                # 显式调用分类函数，确保新创建的记忆能够被分类
                                if request.infer:
                                    try:
                                        categorize_memory(memory, db)
                                        db.commit()
                                        logging.info(f"Memory categorized successfully: {memory.id}")
                                    except Exception as cat_error:
                                        logging.error(f"Failed to categorize memory: {str(cat_error)}")
                                        # Continue even if categorization fails
                
                                # 记录成功日志
                                logging.info(f"Memory created and categorized successfully: {memory.id}")
                            
                            db.commit()
                            db.refresh(memory)
                            
                            # Return properly formatted response
                            return {
                                "id": memory.id,
                                "text": memory.content,
                                "created_at": memory.created_at,
                                "state": memory.state.value,
                                "app_id": memory.app_id,
                                "metadata_": memory.metadata_
                            }
                        except Exception as db_error:
                            db.rollback()
                            error_message = f"Database error while saving memory: {str(db_error)}"
                            logging.error(error_message)
                            raise HTTPException(status_code=500, detail=error_message)
            else:
                # Even if results is empty, the memory might have been added to Qdrant successfully
                # Let's check Qdrant directly and create a memory entry in our database
                logging.warning("Empty results returned from vector database, but memory might have been added successfully")
                
                try:
                    # Generate a new UUID for the memory
                    memory_id = uuid4()
                    
                    # Create memory in our database
                    memory = Memory(
                        id=memory_id,
                        user_id=user.id,
                        app_id=app_obj.id,
                        content=request.text,
                        metadata_=request.metadata,
                        state=MemoryState.active
                    )
                    db.add(memory)
                    
                    # Create history entry
                    history = MemoryStatusHistory(
                        memory_id=memory_id,
                        changed_by=user.id,
                        old_state=MemoryState.deleted,
                        new_state=MemoryState.active
                    )
                    db.add(history)
                    
                    # Commit the memory and history entry first
                    db.commit()
                    db.refresh(memory)
                    
                    # 显式调用分类函数，确保新创建的记忆能够被分类
                    if request.infer:
                        try:
                            categorize_memory(memory, db)
                            db.commit()
                            logging.info(f"Memory categorized successfully: {memory.id}")
                        except Exception as cat_error:
                            logging.error(f"Failed to categorize memory: {str(cat_error)}")
                            # Continue even if categorization fails
            
                    # 记录成功日志
                    logging.info(f"Memory created and categorized successfully: {memory.id}")
                    
                    db.commit()
                    db.refresh(memory)
                    
                    # Return properly formatted response
                    return {
                        "id": memory.id,
                        "text": memory.content,
                        "created_at": memory.created_at,
                        "state": memory.state.value,
                        "app_id": memory.app_id,
                        "metadata_": memory.metadata_
                    }
                except Exception as db_error:
                    db.rollback()
                    error_message = f"Database error while saving memory: {str(db_error)}"
                    logging.error(error_message)
                    raise HTTPException(status_code=500, detail=error_message)
        else:
            # If vector_response is not a dict, it's an error
            error_message = f"Unexpected response from vector database: {vector_response}"
            logging.error(error_message)
            raise HTTPException(status_code=500, detail=error_message)
    except HTTPException:
        raise
    except Exception as e:
        error_message = f"Error adding to memory: {str(e)}"
        logging.error(error_message)
        raise HTTPException(status_code=500, detail=error_message)


# Update memory state (pause, archive, etc.)
@router.post("/actions/update-state")
async def update_memory_state_endpoint(
    request: UpdateMemoryStateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the state of one or more memories"""
    user = current_user
    
    # Convert string state to MemoryState enum
    try:
        new_state = MemoryState(request.state)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid state: {request.state}")
    
    updated_memories = []
    
    for memory_id in request.memory_ids:
        # Check if memory exists and belongs to user (or user is admin)
        memory = db.query(Memory).filter(Memory.id == memory_id).first()
        if not memory:
            raise HTTPException(status_code=404, detail=f"Memory {memory_id} not found")
        
        # Check permissions - admin can update any memory, regular user only their own
        if not user.is_admin and memory.user_id != user.id:
            raise HTTPException(status_code=403, detail=f"Permission denied for memory {memory_id}")
        
        # Update memory state using existing function
        updated_memory = update_memory_state(db, memory_id, new_state, user.id)
        updated_memories.append(updated_memory)
    
    return {"message": f"Updated {len(updated_memories)} memories", "updated_memories": len(updated_memories)}


# Delete memories
@router.delete("/")
async def delete_memories(
    request: DeleteMemoriesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete one or more memories"""
    user = current_user
    
    deleted_count = 0
    
    for memory_id in request.memory_ids:
        # Check if memory exists and belongs to user (or user is admin)
        memory = db.query(Memory).filter(Memory.id == memory_id).first()
        if not memory:
            continue  # Skip if memory not found
        
        # Check permissions - admin can delete any memory, regular user only their own
        if not user.is_admin and memory.user_id != user.id:
            continue  # Skip if no permission
        
        # Update memory state to deleted
        update_memory_state(db, memory_id, MemoryState.deleted, user.id)
        deleted_count += 1
    
    return {"message": f"Deleted {deleted_count} memories", "deleted_memories": deleted_count}


# Filter memories (POST endpoint for compatibility with frontend)
@router.post("/filter", response_model=Page[MemoryResponse])
async def filter_memories(
    request: MemoryFilterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Filter memories with POST method (frontend compatibility)"""
    user = current_user

    # Build base query
    # admin用户可以看到所有用户的记忆
    if user.is_admin:
        # admin: 查看所有记忆
        query = db.query(Memory).filter(
            Memory.state != MemoryState.deleted
        )
    else:
        # 普通用户: 只查看自己的记忆
        query = db.query(Memory).filter(
            Memory.user_id == user.id,
            Memory.state != MemoryState.deleted
        )
    
    # Filter archived memories unless explicitly shown
    if not request.show_archived:
        query = query.filter(Memory.state != MemoryState.archived)
    
    # Apply search filter
    if request.search_query:
        query = query.filter(Memory.content.ilike(f"%{request.search_query}%"))

    # Apply app filter
    if request.app_ids:
        query = query.filter(Memory.app_id.in_([UUID(app_id) for app_id in request.app_ids]))

    # Add joins
    query = query.outerjoin(App, Memory.app_id == App.id)
    query = query.outerjoin(Memory.categories)

    # Apply category filter
    if request.category_ids:
        query = query.filter(Category.name.in_(request.category_ids))

    # Apply sorting
    if request.sort_column:
        sort_field = getattr(Memory, request.sort_column, None)
        if sort_field:
            if request.sort_direction == "desc":
                query = query.order_by(sort_field.desc())
            else:
                query = query.order_by(sort_field.asc())
    else:
        # Default: sort by created_at descending
        query = query.order_by(Memory.created_at.desc())

    # Manual pagination
    total = query.count()
    offset = (request.page - 1) * request.size
    items = query.offset(offset).limit(request.size).all()
    
    # Transform results
    results = [
        MemoryResponse(
            id=item.id,
            content=item.content,
            created_at=item.created_at,
            state=item.state.value,
            app_id=item.app_id,
            app_name=format_app_display_name(item.app) if item.app else None,
            categories=[category.name for category in item.categories],
            metadata_=item.metadata_
        )
        for item in items
        if check_memory_access_permissions(db, item, item.app_id)
    ]
    
    pages = (total + request.size - 1) // request.size
    
    return Page(
        items=results,
        total=total,
        page=request.page,
        size=request.size,
        pages=pages
    )


@router.post("/search")
async def search_memories_compat(
    request: MemorySearchCompatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Simplified search endpoint for MCPHub.
    If user_id is provided, reuse filter_memories.
    If user_id is omitted, perform a safe global search (non-deleted; includes archived) by query.
    """
    # Force user_id to be current_user if not provided or provided different
    # For security, we should probably always use current_user
    target_user_id = current_user.user_id
    
    if request.user_id:
        # If user specifies an ID, allow it ONLY if admin, otherwise ignore and use current
        if current_user.is_admin:
            target_user_id = request.user_id
        elif request.user_id != current_user.user_id:
            # Optionally raise error, or just use current user. 
            # To be friendly but secure, we use current_user
            target_user_id = current_user.user_id

    filter_req = MemoryFilterRequest(
        user_id=target_user_id,
        search_query=request.query or None,
        page=request.page,
        size=request.page_size,
        show_archived=True
    )
    return await filter_memories(filter_req, db, current_user)


@router.get("/search")
async def search_memories_get(
    query: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """GET variant for MCPHub or clients that prefer querystring parameters.
    Mirrors the behavior of POST /search.
    """
    target_user_id = current_user.user_id
    
    if user_id:
        if current_user.is_admin:
            target_user_id = user_id
        # Else ignore user_id param if not admin

    filter_req = MemoryFilterRequest(
        user_id=target_user_id,
        search_query=query or None,
        page=page,
        size=page_size,
        show_archived=True
    )
    return await filter_memories(filter_req, db, current_user)


@router.get("/{memory_id}")
async def get_memory_by_id(
    memory_id: UUID,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a memory by its ID"""
    user = current_user

    # Check if memory exists
    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    # Check permissions - admin can access any memory, regular user only their own
    if not user.is_admin and memory.user_id != user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Format the response
    return {
        "id": memory.id,
        "content": memory.content,
        "created_at": memory.created_at,
        "updated_at": memory.updated_at,
        "state": memory.state.value,
        "app_id": memory.app_id,
        "app_name": memory.app.name if memory.app else None,
        "categories": [category.name for category in memory.categories],
        "metadata_": memory.metadata_
    }

@router.get("/{memory_id}/access-log")
async def get_memory_access_log(
    memory_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check permission first
    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    if not current_user.is_admin and memory.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")

    query = db.query(MemoryAccessLog).filter(MemoryAccessLog.memory_id == memory_id)
    total = query.count()
    logs = query.order_by(MemoryAccessLog.accessed_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    for log in logs:
        app = db.query(App).filter(App.id == log.app_id).first()
        name = app.name if app else None
        # 优先根据日志来源字段判断（后台手动修改标记为 Momemory）
        if isinstance(log.metadata_, dict) and log.metadata_.get('source') == 'Momemory':
            setattr(log, 'app_name', 'Momemory')
        elif log.access_type == 'update' and (not name or not any(k in (name or '') for k in ['小智A','xiaozhi','AI机器人','AI設備'])):
            setattr(log, 'app_name', 'Momemory')
        else:
            setattr(log, 'app_name', name)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "logs": [
            {
                "id": l.id,
                "app_id": l.app_id,
                "app_name": getattr(l, 'app_name', None),
                "access_type": l.access_type,
                "accessed_at": l.accessed_at,
                "metadata_": l.metadata_,
            }
            for l in logs
        ],
    }

@router.get("/{memory_id}/related", response_model=Page[MemoryResponse])
async def get_related_memories(
    memory_id: UUID,
    user_id: str,
    params: Params = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = current_user

    source = db.query(Memory).filter(Memory.id == memory_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Memory not found")

    # Check permissions
    if not user.is_admin and source.user_id != user.id:
        raise HTTPException(status_code=403, detail="Permission denied")

    category_ids = [c.id for c in source.categories]
    if not category_ids:
        return Page.create([], total=0, params=params)

    # Subquery to avoid DISTINCT ON + ORDER BY mismatch in Postgres
    related_ids_subq = (
        db.query(Memory.id.label("mid"))
        .join(Memory.categories)
        .filter(
            Memory.id != memory_id,
            Memory.state != MemoryState.deleted,
            Category.id.in_(category_ids),
        )
        .group_by(Memory.id)
        .subquery()
    )

    base = (
        db.query(Memory)
        .join(related_ids_subq, related_ids_subq.c.mid == Memory.id)
        .options(joinedload(Memory.categories), joinedload(Memory.app))
        .order_by(Memory.created_at.desc())
    )

    query = base.filter(Memory.user_id == user.id) if not user.is_admin else base

    total = query.count()
    items = query.offset((params.page - 1) * params.size).limit(params.size).all()

    return Page.create(
        [
            MemoryResponse(
                id=item.id,
                content=item.content,
                created_at=item.created_at,
                state=item.state.value,
                app_id=item.app_id,
                app_name=format_app_display_name(item.app) if item.app else None,
                categories=[category.name for category in item.categories],
                metadata_=item.metadata_,
            )
            for item in items
            if check_memory_access_permissions(db, item, item.app_id)
        ],
        total=total,
        params=params,
    )


# Update memory content
@router.put("/{memory_id}")
async def update_memory_content(
    memory_id: UUID,
    request: UpdateMemoryContentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the content of a memory"""
    user = current_user
    
    # Check if memory exists
    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    # Check permissions - admin can update any memory, regular user only their own
    if not user.is_admin and memory.user_id != user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    previous_content = memory.content
    memory.content = request.memory_content
    memory.updated_at = datetime.datetime.now(datetime.UTC)
    db.commit()
    db.refresh(memory)

    app_obj = db.query(App).filter(App.id == memory.app_id).first()
    try:
        access_log = MemoryAccessLog(
            memory_id=memory.id,
            app_id=app_obj.id if app_obj else None,
            access_type="update",
            metadata_={
                "assistant_text": memory.content,
                "previous_memory": previous_content,
            }
        )
        db.add(access_log)
        db.commit()
    except Exception:
        pass
    
    return {
        "id": memory.id,
        "content": memory.content,
        "updated_at": memory.updated_at,
        "state": memory.state.value
    }


# Get all categories for a user
@router.get("/user/categories")
async def get_user_categories(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all categories for a user"""
    user = current_user
    
    # Get all categories associated with user's memories
    categories = db.query(Category).join(
        memory_categories, Category.id == memory_categories.c.category_id
    ).join(
        Memory, memory_categories.c.memory_id == Memory.id
    ).filter(
        Memory.user_id == user.id
    ).distinct().all()
    
    return {
        "categories": [category.name for category in categories],
        "total": len(categories)
    }


# Update memory categories
@router.put("/{memory_id}/categories")
async def update_memory_categories(
    memory_id: UUID,
    request: UpdateMemoryCategoriesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the categories of a memory"""
    user = current_user
    
    # Check if memory exists
    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    # Check permissions - admin can update any memory, regular user only their own
    if not user.is_admin and memory.user_id != user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Clear existing categories
    db.execute(
        memory_categories.delete().where(
            memory_categories.c.memory_id == memory_id
        )
    )
    
    # Add new categories
    for category_name in request.categories:
        # Get or create category
        category = db.query(Category).filter(Category.name == category_name).first()
        if not category:
            category = Category(
                name=category_name,
                description=f"Category for {category_name}"
            )
            db.add(category)
            db.flush()
        
        # Create the association
        db.execute(
            memory_categories.insert().values(
                memory_id=memory_id,
                category_id=category.id
            )
        )
    
    db.commit()
    db.refresh(memory)
    
    return {
        "id": memory.id,
        "categories": [category.name for category in memory.categories]
    }
