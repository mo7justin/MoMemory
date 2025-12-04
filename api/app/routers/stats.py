from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Memory, App, MemoryState, MemoryAccessLog
from sqlalchemy import func, text, case
import logging
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
from app.dependencies import get_current_user

router = APIRouter(tags=["stats"])

DEFAULT_PLAN_CONFIG = {
    "id": "pro_monthly",
    "name": "Professional",
    "tier": "pro",
    "quota": 5000,
    "price": 4900,  # cents
    "currency": "CNY",
    "billing_cycle": "monthly",
    "status": "active"
}

def build_user_plan_info(user: User) -> Dict[str, Any]:
    """
    Build a simple plan description for the current user.
    In real scenario this would come from billing/subscription tables.
    """
    metadata = user.metadata_ or {}
    meta_plan = metadata.get("plan") or {}
    base_date = meta_plan.get("purchase_date")
    if isinstance(base_date, str):
        try:
            purchase_dt = datetime.fromisoformat(base_date.replace("Z", "+00:00"))
        except Exception:
            purchase_dt = user.created_at or datetime.utcnow()
    else:
        purchase_dt = base_date or user.created_at or datetime.utcnow()

    renewal_meta = meta_plan.get("renewal_date")
    if isinstance(renewal_meta, str):
        try:
            renewal_dt = datetime.fromisoformat(renewal_meta.replace("Z", "+00:00"))
        except Exception:
            renewal_dt = purchase_dt + timedelta(days=30)
    else:
        renewal_dt = renewal_meta or (purchase_dt + timedelta(days=30))

    plan_info = {
        "id": meta_plan.get("id", DEFAULT_PLAN_CONFIG["id"]),
        "name": meta_plan.get("name", DEFAULT_PLAN_CONFIG["name"]),
        "tier": meta_plan.get("tier", DEFAULT_PLAN_CONFIG["tier"]),
        "quota": meta_plan.get("quota", DEFAULT_PLAN_CONFIG["quota"]),
        "price": meta_plan.get("price", DEFAULT_PLAN_CONFIG["price"]),
        "currency": meta_plan.get("currency", DEFAULT_PLAN_CONFIG["currency"]),
        "billing_cycle": meta_plan.get("billing_cycle", DEFAULT_PLAN_CONFIG["billing_cycle"]),
        "status": meta_plan.get("status", DEFAULT_PLAN_CONFIG["status"]),
        "purchase_date": purchase_dt.isoformat(),
        "renewal_date": renewal_dt.isoformat(),
    }

    return plan_info

def get_target_user(db: Session, current_user: User, user_id: Optional[str]) -> User:
    """
    Helper to determine the target user for stats.
    If user_id is provided and current_user is admin, fetch that user.
    Otherwise return current_user.
    """
    if current_user.is_admin and user_id:
        # If target is self (case-insensitive check), return current_user
        if (user_id.lower() == current_user.user_id.lower()) or \
           (current_user.email and user_id.lower() == current_user.email.lower()):
            return current_user
            
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            # Fallback: try email lookup
            user = db.query(User).filter(User.email == user_id).first()
            
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    return current_user

@router.get("")
async def get_profile(
    user_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = get_target_user(db, current_user, user_id)
    
    # Log user info for debugging
    logging.info(f"User info: id={user.id}, user_id={user.user_id}, is_admin={user.is_admin}")
    
    if user.is_admin:
        # Admin: show all memories (excluding deleted)
        logging.info("User is admin, fetching all memories")
        total_memories = db.query(Memory).filter(Memory.state != MemoryState.deleted).count()
        # For admin, get all apps
        logging.info("User is admin, fetching all apps")
        apps = db.query(App)
    else:
        # Regular user: show only their own memories (excluding deleted)
        logging.info(f"User is regular, fetching memories for user_id={user.id}")
        total_memories = db.query(Memory).filter(Memory.user_id == user.id, Memory.state != MemoryState.deleted).count()
        # Regular user: show only their own apps
        logging.info(f"User is regular, fetching apps for owner_id={user.id}")
        apps = db.query(App).filter(App.owner_id == user.id)
    
    total_apps = apps.count()
    
    logging.info(f"Total memories: {total_memories}, Total apps: {total_apps}")

    plan_info = build_user_plan_info(user)

    return {
        "total_memories": total_memories,
        "total_apps": total_apps,
        "apps": apps.all(),
        "plan": plan_info
    }

@router.get("/trends")
async def get_stats_trends(
    user_id: str = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics trends (retrieval events and memory growth) over time.
    """
    user = get_target_user(db, current_user, user_id)
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Determine filter condition based on admin status
    if user.is_admin:
        # Admin sees all data
        memory_filter = Memory.created_at >= start_date
        log_filter = MemoryAccessLog.accessed_at >= start_date
    else:
        # Regular user sees only their own data
        user_app_ids = db.query(App.id).filter(App.owner_id == user.id).subquery()
        log_filter = (MemoryAccessLog.accessed_at >= start_date) & (MemoryAccessLog.app_id.in_(user_app_ids))
        memory_filter = (Memory.created_at >= start_date) & (Memory.user_id == user.id)

    # 1. Memory Growth (Add Events)
    date_col = func.date_trunc('day', Memory.created_at).label('date')
    
    memory_growth = (
        db.query(date_col, func.count(Memory.id))
        .filter(memory_filter)
        .group_by(date_col)
        .order_by(date_col)
        .all()
    )
    
    # 2. Retrieval Events (Search Logs)
    log_date_col = func.date_trunc('day', MemoryAccessLog.accessed_at).label('date')
    
    # TODO: Currently distinguishing SEARCH vs ADD/UPDATE in logs
    # access_type: 'search' (retrieval), 'ADD', 'UPDATE'
    retrieval_usage = (
        db.query(log_date_col, func.count(MemoryAccessLog.id))
        .filter(log_filter)
        .filter(MemoryAccessLog.access_type.ilike('search%'))
        .group_by(log_date_col)
        .order_by(log_date_col)
        .all()
    )
    
    data_map = {}
    
    for date_val, count in memory_growth:
        if date_val:
            date_str = date_val.strftime('%Y-%m-%d')
            if date_str not in data_map:
                data_map[date_str] = {"date": date_str, "apiUsage": 0, "memoryGrowth": 0}
            data_map[date_str]["memoryGrowth"] = count
            
    for date_val, count in retrieval_usage:
        if date_val:
            date_str = date_val.strftime('%Y-%m-%d')
            if date_str not in data_map:
                data_map[date_str] = {"date": date_str, "apiUsage": 0, "memoryGrowth": 0}
            data_map[date_str]["apiUsage"] = count
            
    results = sorted(data_map.values(), key=lambda x: x["date"])
    
    return results

@router.get("/usage")
async def get_usage_stats(
    user_id: str = Query(None),
    days: int = Query(30, ge=1, le=365),
    start_date_q: Optional[date] = Query(None, alias="start_date"),
    end_date_q: Optional[date] = Query(None, alias="end_date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed usage stats:
    - API Calls over time (Total, Search, Add, Update)
    - Token usage (Monthly/Total) - Simulated for now
    - Calls per App/Device
    """
    logging.info(f"Starting get_usage_stats for user {current_user.id}")
    try:
        user = get_target_user(db, current_user, user_id)
        plan_info = build_user_plan_info(user)

        # Determine date range
        if start_date_q:
            # Use provided date range
            start_dt = datetime.combine(start_date_q, datetime.min.time())
            if end_date_q:
                 end_dt = datetime.combine(end_date_q, datetime.max.time())
            else:
                 end_dt = datetime.now()
        else:
            # Use days offset
            end_dt = datetime.utcnow()
            start_dt = end_dt - timedelta(days=days)
        
        # Filter setup
        if user.is_admin:
            log_filter = (MemoryAccessLog.accessed_at >= start_dt) & (MemoryAccessLog.accessed_at <= end_dt)
        else:
            user_app_ids = db.query(App.id).filter(App.owner_id == user.id).subquery()
            log_filter = (
                (MemoryAccessLog.accessed_at >= start_dt)
                & (MemoryAccessLog.accessed_at <= end_dt)
                & (MemoryAccessLog.app_id.in_(user_app_ids))
            )

        # 1. Usage by App/Device
        logging.info("Querying usage by app...")
        # Join MemoryAccessLog with App to get app names
        usage_by_app = (
            db.query(
                App.id,
                App.name,
                func.count(MemoryAccessLog.id).label('count'),
                func.max(MemoryAccessLog.accessed_at).label('last_used')
            )
            .join(MemoryAccessLog, App.id == MemoryAccessLog.app_id)
            .filter(log_filter)
            .group_by(App.id, App.name)
            .order_by(func.count(MemoryAccessLog.id).desc())
            .all()
        )
        
        formatted_app_usage = []
        for app_id, app_name, count, _ in usage_by_app:
            formatted_app_usage.append({
                "app_id": str(app_id),
                "app_name": app_name,
                "count": count
            })

        # 2. API Calls Over Time (broken down by type)
        logging.info("Querying calls over time...")
        log_date_col = func.date_trunc('day', MemoryAccessLog.accessed_at).label('date')
        
        calls_over_time = (
            db.query(
                log_date_col,
                func.count(MemoryAccessLog.id).label('total'),
                func.sum(case((MemoryAccessLog.access_type.ilike('search%'), 1), else_=0)).label('search_count'),
                func.sum(case((MemoryAccessLog.access_type.ilike('add%'), 1), else_=0)).label('add_count'),
                func.sum(case((MemoryAccessLog.access_type.ilike('list%'), 1), else_=0)).label('list_count'),
                func.sum(case((MemoryAccessLog.access_type.ilike('%delete%'), 1), else_=0)).label('delete_count')
            )
            .filter(log_filter)
            .group_by(log_date_col)
            .order_by(log_date_col)
            .all()
        )
        
        formatted_timeline = []
        for date_val, total, search, add, list_count, delete_count in calls_over_time:
            if date_val:
                formatted_timeline.append({
                    "date": date_val.strftime('%Y-%m-%d'),
                    "count": total or 0,
                    "search": search or 0,
                    "add": add or 0,
                    "list": list_count or 0,
                    "delete": delete_count or 0
                })

        # 3. Token Usage (Simulated logic for now)
        # In a real implementation, we would sum a 'tokens' column.
        # User request: 1 API call = 1 Token
        
        total_search_ops = sum(x['search'] for x in formatted_timeline) or 0
        total_add_ops = sum(x['add'] for x in formatted_timeline) or 0
        total_list_ops = sum(x.get('list', 0) for x in formatted_timeline) or 0
        total_delete_ops = sum(x.get('delete', 0) for x in formatted_timeline) or 0
        total_calls = sum(x['count'] for x in formatted_timeline) or 0
        estimated_tokens = total_search_ops + total_add_ops + total_list_ops + total_delete_ops

        # TODO: replace placeholder with real quota from subscription/plan
        plan_quota = plan_info.get("quota", DEFAULT_PLAN_CONFIG["quota"])
        usage_percent = float(estimated_tokens) / plan_quota * 100 if plan_quota else 0

        logging.info("Usage stats calculation complete.")

        return {
            "total_requests": total_calls,
            "total_tokens_estimated": estimated_tokens,
            "plan_quota": plan_quota,
            "plan_usage_percent": usage_percent,
            "plan": plan_info,
            "requests_by_type": {
                "search": total_search_ops,
                "add": total_add_ops,
                "list": total_list_ops,
                "delete": total_delete_ops
            },
            "usage_by_date": [
                {
                    "date": item["date"],
                    "count": item["count"],
                    "search": item.get("search", 0),
                    "add": item.get("add", 0),
                    "list": item.get("list", 0),
                    "delete": item.get("delete", 0),
                }
                for item in formatted_timeline
            ],
            "usage_by_app": formatted_app_usage
        }
    except Exception as e:
        logging.error(f"Error in get_usage_stats: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

            
    results = sorted(data_map.values(), key=lambda x: x["date"])
    
from app.database import get_db
from app.models import User, Memory, App, MemoryState, MemoryAccessLog
from sqlalchemy import func, text, case
import logging
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
from app.dependencies import get_current_user

router = APIRouter(tags=["stats"])

def get_target_user(db: Session, current_user: User, user_id: Optional[str]) -> User:
    """
    Helper to determine the target user for stats.
    If user_id is provided and current_user is admin, fetch that user.
    Otherwise return current_user.
    """
    if current_user.is_admin and user_id:
        # If target is self (case-insensitive check), return current_user
        if (user_id.lower() == current_user.user_id.lower()) or \
           (current_user.email and user_id.lower() == current_user.email.lower()):
            return current_user
            
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            # Fallback: try email lookup
            user = db.query(User).filter(User.email == user_id).first()
            
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    return current_user

@router.get("")
async def get_profile(
    user_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = get_target_user(db, current_user, user_id)
    
    # Log user info for debugging
    logging.info(f"User info: id={user.id}, user_id={user.user_id}, is_admin={user.is_admin}")
    
    if user.is_admin:
        # Admin: show all memories (excluding deleted)
        logging.info("User is admin, fetching all memories")
        total_memories = db.query(Memory).filter(Memory.state != MemoryState.deleted).count()
        # For admin, get all apps
        logging.info("User is admin, fetching all apps")
        apps = db.query(App)
    else:
        # Regular user: show only their own memories (excluding deleted)
        logging.info(f"User is regular, fetching memories for user_id={user.id}")
        total_memories = db.query(Memory).filter(Memory.user_id == user.id, Memory.state != MemoryState.deleted).count()
        # Regular user: show only their own apps
        logging.info(f"User is regular, fetching apps for owner_id={user.id}")
        apps = db.query(App).filter(App.owner_id == user.id)
    
    total_apps = apps.count()
    
    logging.info(f"Total memories: {total_memories}, Total apps: {total_apps}")

    return {
        "total_memories": total_memories,
        "total_apps": total_apps,
        "apps": apps.all()
    }

@router.get("/trends")
async def get_stats_trends(
    user_id: str = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics trends (retrieval events and memory growth) over time.
    """
    user = get_target_user(db, current_user, user_id)
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Determine filter condition based on admin status
    if user.is_admin:
        # Admin sees all data
        memory_filter = Memory.created_at >= start_date
        log_filter = MemoryAccessLog.accessed_at >= start_date
    else:
        # Regular user sees only their own data
        user_app_ids = db.query(App.id).filter(App.owner_id == user.id).subquery()
        log_filter = (MemoryAccessLog.accessed_at >= start_date) & (MemoryAccessLog.app_id.in_(user_app_ids))
        memory_filter = (Memory.created_at >= start_date) & (Memory.user_id == user.id)

    # 1. Memory Growth (Add Events)
    date_col = func.date_trunc('day', Memory.created_at).label('date')
    
    memory_growth = (
        db.query(date_col, func.count(Memory.id))
        .filter(memory_filter)
        .group_by(date_col)
        .order_by(date_col)
        .all()
    )
    
    # 2. Retrieval Events (Search Logs)
    log_date_col = func.date_trunc('day', MemoryAccessLog.accessed_at).label('date')
    
    # TODO: Currently distinguishing SEARCH vs ADD/UPDATE in logs
    # access_type: 'search' (retrieval), 'ADD', 'UPDATE'
    retrieval_usage = (
        db.query(log_date_col, func.count(MemoryAccessLog.id))
        .filter(log_filter)
        .filter(MemoryAccessLog.access_type.ilike('search%'))
        .group_by(log_date_col)
        .order_by(log_date_col)
        .all()
    )
    
    data_map = {}
    
    for date_val, count in memory_growth:
        if date_val:
            date_str = date_val.strftime('%Y-%m-%d')
            if date_str not in data_map:
                data_map[date_str] = {"date": date_str, "apiUsage": 0, "memoryGrowth": 0}
            data_map[date_str]["memoryGrowth"] = count
            
    for date_val, count in retrieval_usage:
        if date_val:
            date_str = date_val.strftime('%Y-%m-%d')
            if date_str not in data_map:
                data_map[date_str] = {"date": date_str, "apiUsage": 0, "memoryGrowth": 0}
            data_map[date_str]["apiUsage"] = count
            
    results = sorted(data_map.values(), key=lambda x: x["date"])
    
    return results

@router.get("/usage")
async def get_usage_stats(
    user_id: str = Query(None),
    days: int = Query(30, ge=1, le=365),
    start_date_q: Optional[date] = Query(None, alias="start_date"),
    end_date_q: Optional[date] = Query(None, alias="end_date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed usage stats:
    - API Calls over time (Total, Search, Add, Update)
    - Token usage (Monthly/Total) - Simulated for now
    - Calls per App/Device
    """
    logging.info(f"Starting get_usage_stats for user {current_user.id}")
    try:
        user = get_target_user(db, current_user, user_id)

        # Determine date range
        if start_date_q:
            # Use provided date range
            start_dt = datetime.combine(start_date_q, datetime.min.time())
            if end_date_q:
                 end_dt = datetime.combine(end_date_q, datetime.max.time())
            else:
                 end_dt = datetime.now()
        else:
            # Use days offset
            end_dt = datetime.utcnow()
            start_dt = end_dt - timedelta(days=days)
        
        # Filter setup
        if user.is_admin:
            log_filter = (MemoryAccessLog.accessed_at >= start_dt) & (MemoryAccessLog.accessed_at <= end_dt)
        else:
            user_app_ids = db.query(App.id).filter(App.owner_id == user.id).subquery()
            log_filter = (
                (MemoryAccessLog.accessed_at >= start_dt)
                & (MemoryAccessLog.accessed_at <= end_dt)
                & (MemoryAccessLog.app_id.in_(user_app_ids))
            )

        # 1. Usage by App/Device
        logging.info("Querying usage by app...")
        # Join MemoryAccessLog with App to get app names
        usage_by_app = (
            db.query(
                App.id,
                App.name,
                func.count(MemoryAccessLog.id).label('count'),
                func.max(MemoryAccessLog.accessed_at).label('last_used')
            )
            .join(MemoryAccessLog, App.id == MemoryAccessLog.app_id)
            .filter(log_filter)
            .group_by(App.id, App.name)
            .order_by(func.count(MemoryAccessLog.id).desc())
            .all()
        )
        
        formatted_app_usage = []
        for app_id, app_name, count, _ in usage_by_app:
            formatted_app_usage.append({
                "app_id": str(app_id),
                "app_name": app_name,
                "count": count
            })

        # 2. API Calls Over Time (broken down by type)
        logging.info("Querying calls over time...")
        log_date_col = func.date_trunc('day', MemoryAccessLog.accessed_at).label('date')
        
        calls_over_time = (
            db.query(
                log_date_col,
                func.count(MemoryAccessLog.id).label('total'),
                func.sum(case((MemoryAccessLog.access_type.ilike('search%'), 1), else_=0)).label('search_count'),
                func.sum(case((MemoryAccessLog.access_type.ilike('add%'), 1), else_=0)).label('add_count'),
                func.sum(case((MemoryAccessLog.access_type.ilike('update%'), 1), else_=0)).label('update_count')
            )
            .filter(log_filter)
            .group_by(log_date_col)
            .order_by(log_date_col)
            .all()
        )
        
        formatted_timeline = []
        for date_val, total, search, add, update in calls_over_time:
            if date_val:
                formatted_timeline.append({
                    "date": date_val.strftime('%Y-%m-%d'),
                    "count": total or 0,
                    "search": search or 0,
                    "add": add or 0,
                    "update": update or 0
                })

        # 3. Token Usage (Simulated logic for now)
        # In a real implementation, we would sum a 'tokens' column.
        # User request: 1 API call = 1 Token
        
        total_search_ops = sum(x['search'] for x in formatted_timeline) or 0
        total_add_ops = sum(x['add'] for x in formatted_timeline) or 0
        total_update_ops = sum(x['update'] for x in formatted_timeline) or 0
        total_calls = sum(x['count'] for x in formatted_timeline) or 0
        estimated_tokens = total_search_ops + total_add_ops + total_update_ops

        logging.info("Usage stats calculation complete.")

        return {
            "total_requests": total_calls,
            "total_tokens_estimated": estimated_tokens,
            "requests_by_type": {
                "search": total_search_ops,
                "add": total_add_ops,
                "update": total_update_ops,
                "delete": 0
            },
            "usage_by_date": [
                {"date": item["date"], "count": item["count"]}
                for item in formatted_timeline
            ],
            "usage_by_app": formatted_app_usage
        }
    except Exception as e:
        logging.error(f"Error in get_usage_stats: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

            
    results = sorted(data_map.values(), key=lambda x: x["date"])
    


from app.database import get_db
from app.models import User, Memory, App, MemoryState, MemoryAccessLog
from sqlalchemy import func, text, case
import logging
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
from app.dependencies import get_current_user

router = APIRouter(tags=["stats"])

def get_target_user(db: Session, current_user: User, user_id: Optional[str]) -> User:
    """
    Helper to determine the target user for stats.
    If user_id is provided and current_user is admin, fetch that user.
    Otherwise return current_user.
    """
    if current_user.is_admin and user_id:
        # If target is self (case-insensitive check), return current_user
        if (user_id.lower() == current_user.user_id.lower()) or \
           (current_user.email and user_id.lower() == current_user.email.lower()):
            return current_user
            
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            # Fallback: try email lookup
            user = db.query(User).filter(User.email == user_id).first()
            
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    return current_user

@router.get("")
async def get_profile(
    user_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = get_target_user(db, current_user, user_id)
    
    # Log user info for debugging
    logging.info(f"User info: id={user.id}, user_id={user.user_id}, is_admin={user.is_admin}")
    
    if user.is_admin:
        # Admin: show all memories (excluding deleted)
        logging.info("User is admin, fetching all memories")
        total_memories = db.query(Memory).filter(Memory.state != MemoryState.deleted).count()
        # For admin, get all apps
        logging.info("User is admin, fetching all apps")
        apps = db.query(App)
    else:
        # Regular user: show only their own memories (excluding deleted)
        logging.info(f"User is regular, fetching memories for user_id={user.id}")
        total_memories = db.query(Memory).filter(Memory.user_id == user.id, Memory.state != MemoryState.deleted).count()
        # Regular user: show only their own apps
        logging.info(f"User is regular, fetching apps for owner_id={user.id}")
        apps = db.query(App).filter(App.owner_id == user.id)
    
    total_apps = apps.count()
    
    logging.info(f"Total memories: {total_memories}, Total apps: {total_apps}")

    return {
        "total_memories": total_memories,
        "total_apps": total_apps,
        "apps": apps.all()
    }

@router.get("/trends")
async def get_stats_trends(
    user_id: str = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics trends (retrieval events and memory growth) over time.
    """
    user = get_target_user(db, current_user, user_id)
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Determine filter condition based on admin status
    if user.is_admin:
        # Admin sees all data
        memory_filter = Memory.created_at >= start_date
        log_filter = MemoryAccessLog.accessed_at >= start_date
    else:
        # Regular user sees only their own data
        user_app_ids = db.query(App.id).filter(App.owner_id == user.id).subquery()
        log_filter = (MemoryAccessLog.accessed_at >= start_date) & (MemoryAccessLog.app_id.in_(user_app_ids))
        memory_filter = (Memory.created_at >= start_date) & (Memory.user_id == user.id)

    # 1. Memory Growth (Add Events)
    date_col = func.date_trunc('day', Memory.created_at).label('date')
    
    memory_growth = (
        db.query(date_col, func.count(Memory.id))
        .filter(memory_filter)
        .group_by(date_col)
        .order_by(date_col)
        .all()
    )
    
    # 2. Retrieval Events (Search Logs)
    log_date_col = func.date_trunc('day', MemoryAccessLog.accessed_at).label('date')
    
    # TODO: Currently distinguishing SEARCH vs ADD/UPDATE in logs
    # access_type: 'search' (retrieval), 'ADD', 'UPDATE'
    retrieval_usage = (
        db.query(log_date_col, func.count(MemoryAccessLog.id))
        .filter(log_filter)
        .filter(MemoryAccessLog.access_type.ilike('search%'))
        .group_by(log_date_col)
        .order_by(log_date_col)
        .all()
    )
    
    data_map = {}
    
    for date_val, count in memory_growth:
        if date_val:
            date_str = date_val.strftime('%Y-%m-%d')
            if date_str not in data_map:
                data_map[date_str] = {"date": date_str, "apiUsage": 0, "memoryGrowth": 0}
            data_map[date_str]["memoryGrowth"] = count
            
    for date_val, count in retrieval_usage:
        if date_val:
            date_str = date_val.strftime('%Y-%m-%d')
            if date_str not in data_map:
                data_map[date_str] = {"date": date_str, "apiUsage": 0, "memoryGrowth": 0}
            data_map[date_str]["apiUsage"] = count
            
    results = sorted(data_map.values(), key=lambda x: x["date"])
    
    return results

@router.get("/usage")
async def get_usage_stats(
    user_id: str = Query(None),
    days: int = Query(30, ge=1, le=365),
    start_date_q: Optional[date] = Query(None, alias="start_date"),
    end_date_q: Optional[date] = Query(None, alias="end_date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed usage stats:
    - API Calls over time (Total, Search, Add, Update)
    - Token usage (Monthly/Total) - Simulated for now
    - Calls per App/Device
    """
    logging.info(f"Starting get_usage_stats for user {current_user.id}")
    try:
        user = get_target_user(db, current_user, user_id)

        # Determine date range
        if start_date_q:
            # Use provided date range
            start_dt = datetime.combine(start_date_q, datetime.min.time())
            if end_date_q:
                 end_dt = datetime.combine(end_date_q, datetime.max.time())
            else:
                 end_dt = datetime.now()
        else:
            # Use days offset
            end_dt = datetime.utcnow()
            start_dt = end_dt - timedelta(days=days)
        
        # Filter setup
        if user.is_admin:
            log_filter = (MemoryAccessLog.accessed_at >= start_dt) & (MemoryAccessLog.accessed_at <= end_dt)
        else:
            user_app_ids = db.query(App.id).filter(App.owner_id == user.id).subquery()
            log_filter = (
                (MemoryAccessLog.accessed_at >= start_dt)
                & (MemoryAccessLog.accessed_at <= end_dt)
                & (MemoryAccessLog.app_id.in_(user_app_ids))
            )

        # 1. Usage by App/Device
        logging.info("Querying usage by app...")
        # Join MemoryAccessLog with App to get app names
        usage_by_app = (
            db.query(
                App.id,
                App.name,
                func.count(MemoryAccessLog.id).label('count'),
                func.max(MemoryAccessLog.accessed_at).label('last_used')
            )
            .join(MemoryAccessLog, App.id == MemoryAccessLog.app_id)
            .filter(log_filter)
            .group_by(App.id, App.name)
            .order_by(func.count(MemoryAccessLog.id).desc())
            .all()
        )
        
        formatted_app_usage = []
        for app_id, app_name, count, _ in usage_by_app:
            formatted_app_usage.append({
                "app_id": str(app_id),
                "app_name": app_name,
                "count": count
            })

        # 2. API Calls Over Time (broken down by type)
        logging.info("Querying calls over time...")
        log_date_col = func.date_trunc('day', MemoryAccessLog.accessed_at).label('date')
        
        calls_over_time = (
            db.query(
                log_date_col,
                func.count(MemoryAccessLog.id).label('total'),
                func.sum(case((MemoryAccessLog.access_type.ilike('search%'), 1), else_=0)).label('search_count'),
                func.sum(case((MemoryAccessLog.access_type.ilike('add%'), 1), else_=0)).label('add_count'),
                func.sum(case((MemoryAccessLog.access_type.ilike('update%'), 1), else_=0)).label('update_count')
            )
            .filter(log_filter)
            .group_by(log_date_col)
            .order_by(log_date_col)
            .all()
        )
        
        formatted_timeline = []
        for date_val, total, search, add, update in calls_over_time:
            if date_val:
                formatted_timeline.append({
                    "date": date_val.strftime('%Y-%m-%d'),
                    "count": total or 0,
                    "search": search or 0,
                    "add": add or 0,
                    "update": update or 0
                })

        # 3. Token Usage (Simulated logic for now)
        # In a real implementation, we would sum a 'tokens' column.
        # User request: 1 API call = 1 Token
        
        total_search_ops = sum(x['search'] for x in formatted_timeline) or 0
        total_add_ops = sum(x['add'] for x in formatted_timeline) or 0
        total_update_ops = sum(x['update'] for x in formatted_timeline) or 0
        total_calls = sum(x['count'] for x in formatted_timeline) or 0
        estimated_tokens = total_search_ops + total_add_ops + total_update_ops

        logging.info("Usage stats calculation complete.")

        return {
            "total_requests": total_calls,
            "total_tokens_estimated": estimated_tokens,
            "requests_by_type": {
                "search": total_search_ops,
                "add": total_add_ops,
                "update": total_update_ops,
                "delete": 0
            },
            "usage_by_date": [
                {"date": item["date"], "count": item["count"]}
                for item in formatted_timeline
            ],
            "usage_by_app": formatted_app_usage
        }
    except Exception as e:
        logging.error(f"Error in get_usage_stats: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

            
    results = sorted(data_map.values(), key=lambda x: x["date"])
    
from app.database import get_db
from app.models import User, Memory, App, MemoryState, MemoryAccessLog
from sqlalchemy import func, text, case
import logging
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
from app.dependencies import get_current_user

router = APIRouter(tags=["stats"])

def get_target_user(db: Session, current_user: User, user_id: Optional[str]) -> User:
    """
    Helper to determine the target user for stats.
    If user_id is provided and current_user is admin, fetch that user.
    Otherwise return current_user.
    """
    if current_user.is_admin and user_id:
        # If target is self (case-insensitive check), return current_user
        if (user_id.lower() == current_user.user_id.lower()) or \
           (current_user.email and user_id.lower() == current_user.email.lower()):
            return current_user
            
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            # Fallback: try email lookup
            user = db.query(User).filter(User.email == user_id).first()
            
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    return current_user

@router.get("")
async def get_profile(
    user_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = get_target_user(db, current_user, user_id)
    
    # Log user info for debugging
    logging.info(f"User info: id={user.id}, user_id={user.user_id}, is_admin={user.is_admin}")
    
    if user.is_admin:
        # Admin: show all memories (excluding deleted)
        logging.info("User is admin, fetching all memories")
        total_memories = db.query(Memory).filter(Memory.state != MemoryState.deleted).count()
        # For admin, get all apps
        logging.info("User is admin, fetching all apps")
        apps = db.query(App)
    else:
        # Regular user: show only their own memories (excluding deleted)
        logging.info(f"User is regular, fetching memories for user_id={user.id}")
        total_memories = db.query(Memory).filter(Memory.user_id == user.id, Memory.state != MemoryState.deleted).count()
        # Regular user: show only their own apps
        logging.info(f"User is regular, fetching apps for owner_id={user.id}")
        apps = db.query(App).filter(App.owner_id == user.id)
    
    total_apps = apps.count()
    
    logging.info(f"Total memories: {total_memories}, Total apps: {total_apps}")

    return {
        "total_memories": total_memories,
        "total_apps": total_apps,
        "apps": apps.all()
    }

@router.get("/trends")
async def get_stats_trends(
    user_id: str = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics trends (retrieval events and memory growth) over time.
    """
    user = get_target_user(db, current_user, user_id)
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Determine filter condition based on admin status
    if user.is_admin:
        # Admin sees all data
        memory_filter = Memory.created_at >= start_date
        log_filter = MemoryAccessLog.accessed_at >= start_date
    else:
        # Regular user sees only their own data
        user_app_ids = db.query(App.id).filter(App.owner_id == user.id).subquery()
        log_filter = (MemoryAccessLog.accessed_at >= start_date) & (MemoryAccessLog.app_id.in_(user_app_ids))
        memory_filter = (Memory.created_at >= start_date) & (Memory.user_id == user.id)

    # 1. Memory Growth (Add Events)
    date_col = func.date_trunc('day', Memory.created_at).label('date')
    
    memory_growth = (
        db.query(date_col, func.count(Memory.id))
        .filter(memory_filter)
        .group_by(date_col)
        .order_by(date_col)
        .all()
    )
    
    # 2. Retrieval Events (Search Logs)
    log_date_col = func.date_trunc('day', MemoryAccessLog.accessed_at).label('date')
    
    # TODO: Currently distinguishing SEARCH vs ADD/UPDATE in logs
    # access_type: 'search' (retrieval), 'ADD', 'UPDATE'
    retrieval_usage = (
        db.query(log_date_col, func.count(MemoryAccessLog.id))
        .filter(log_filter)
        .filter(MemoryAccessLog.access_type.ilike('search%'))
        .group_by(log_date_col)
        .order_by(log_date_col)
        .all()
    )
    
    data_map = {}
    
    for date_val, count in memory_growth:
        if date_val:
            date_str = date_val.strftime('%Y-%m-%d')
            if date_str not in data_map:
                data_map[date_str] = {"date": date_str, "apiUsage": 0, "memoryGrowth": 0}
            data_map[date_str]["memoryGrowth"] = count
            
    for date_val, count in retrieval_usage:
        if date_val:
            date_str = date_val.strftime('%Y-%m-%d')
            if date_str not in data_map:
                data_map[date_str] = {"date": date_str, "apiUsage": 0, "memoryGrowth": 0}
            data_map[date_str]["apiUsage"] = count
            
    results = sorted(data_map.values(), key=lambda x: x["date"])
    
    return results

@router.get("/usage")
async def get_usage_stats(
    user_id: str = Query(None),
    days: int = Query(30, ge=1, le=365),
    start_date_q: Optional[date] = Query(None, alias="start_date"),
    end_date_q: Optional[date] = Query(None, alias="end_date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed usage stats:
    - API Calls over time (Total, Search, Add, Update)
    - Token usage (Monthly/Total) - Simulated for now
    - Calls per App/Device
    """
    logging.info(f"Starting get_usage_stats for user {current_user.id}")
    try:
        user = get_target_user(db, current_user, user_id)

        # Determine date range
        if start_date_q:
            # Use provided date range
            start_dt = datetime.combine(start_date_q, datetime.min.time())
            if end_date_q:
                 end_dt = datetime.combine(end_date_q, datetime.max.time())
            else:
                 end_dt = datetime.now()
        else:
            # Use days offset
            end_dt = datetime.utcnow()
            start_dt = end_dt - timedelta(days=days)
        
        # Filter setup
        if user.is_admin:
            log_filter = (MemoryAccessLog.accessed_at >= start_dt) & (MemoryAccessLog.accessed_at <= end_dt)
        else:
            user_app_ids = db.query(App.id).filter(App.owner_id == user.id).subquery()
            log_filter = (
                (MemoryAccessLog.accessed_at >= start_dt)
                & (MemoryAccessLog.accessed_at <= end_dt)
                & (MemoryAccessLog.app_id.in_(user_app_ids))
            )

        # 1. Usage by App/Device
        logging.info("Querying usage by app...")
        # Join MemoryAccessLog with App to get app names
        usage_by_app = (
            db.query(
                App.id,
                App.name,
                func.count(MemoryAccessLog.id).label('count'),
                func.max(MemoryAccessLog.accessed_at).label('last_used')
            )
            .join(MemoryAccessLog, App.id == MemoryAccessLog.app_id)
            .filter(log_filter)
            .group_by(App.id, App.name)
            .order_by(func.count(MemoryAccessLog.id).desc())
            .all()
        )
        
        formatted_app_usage = []
        for app_id, app_name, count, _ in usage_by_app:
            formatted_app_usage.append({
                "app_id": str(app_id),
                "app_name": app_name,
                "count": count
            })

        # 2. API Calls Over Time (broken down by type)
        logging.info("Querying calls over time...")
        log_date_col = func.date_trunc('day', MemoryAccessLog.accessed_at).label('date')
        
        calls_over_time = (
            db.query(
                log_date_col,
                func.count(MemoryAccessLog.id).label('total'),
                func.sum(case((MemoryAccessLog.access_type.ilike('search%'), 1), else_=0)).label('search_count'),
                func.sum(case((MemoryAccessLog.access_type.ilike('add%'), 1), else_=0)).label('add_count'),
                func.sum(case((MemoryAccessLog.access_type.ilike('update%'), 1), else_=0)).label('update_count')
            )
            .filter(log_filter)
            .group_by(log_date_col)
            .order_by(log_date_col)
            .all()
        )
        
        formatted_timeline = []
        for date_val, total, search, add, update in calls_over_time:
            if date_val:
                formatted_timeline.append({
                    "date": date_val.strftime('%Y-%m-%d'),
                    "count": total or 0,
                    "search": search or 0,
                    "add": add or 0,
                    "update": update or 0
                })

        # 3. Token Usage (Simulated logic for now)
        # In a real implementation, we would sum a 'tokens' column.
        # User request: 1 API call = 1 Token
        
        total_search_ops = sum(x['search'] for x in formatted_timeline) or 0
        total_add_ops = sum(x['add'] for x in formatted_timeline) or 0
        total_update_ops = sum(x['update'] for x in formatted_timeline) or 0
        total_calls = sum(x['count'] for x in formatted_timeline) or 0
        estimated_tokens = total_search_ops + total_add_ops + total_update_ops

        logging.info("Usage stats calculation complete.")

        return {
            "total_requests": total_calls,
            "total_tokens_estimated": estimated_tokens,
            "requests_by_type": {
                "search": total_search_ops,
                "add": total_add_ops,
                "update": total_update_ops,
                "delete": 0
            },
            "usage_by_date": [
                {"date": item["date"], "count": item["count"]}
                for item in formatted_timeline
            ],
            "usage_by_app": formatted_app_usage
        }
    except Exception as e:
        logging.error(f"Error in get_usage_stats: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

            
    results = sorted(data_map.values(), key=lambda x: x["date"])
    