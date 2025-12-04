import enum
import uuid
import datetime
from sqlalchemy import (
    Column, String, Boolean, ForeignKey, Enum, Table,
    DateTime, JSON, Integer, UUID, Index, event
)
from sqlalchemy.orm import relationship
from app.database import Base
from sqlalchemy.orm import Session
from app.utils.categorization import get_categories_for_memory


def get_current_utc_time():
    """Get current UTC time"""
    return datetime.datetime.now(datetime.UTC)


class MemoryState(enum.Enum):
    active = "active"
    paused = "paused"
    archived = "archived"
    deleted = "deleted"


class User(Base):
    __tablename__ = "users"
    id = Column(UUID, primary_key=True, default=lambda: uuid.uuid4())
    user_id = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=True, index=True)
    email = Column(String, unique=True, nullable=True, index=True)
    is_admin = Column(Boolean, default=False, index=True)  # 管理员标识
    metadata_ = Column('metadata', JSON, default=dict)
    created_at = Column(DateTime, default=get_current_utc_time, index=True)
    updated_at = Column(DateTime,
                        default=get_current_utc_time,
                        onupdate=get_current_utc_time)

    apps = relationship("App", back_populates="owner")
    memories = relationship("Memory", back_populates="user")
    api_keys = relationship("ApiKey", back_populates="user")


class ApiKey(Base):
    __tablename__ = "api_keys"
    id = Column(UUID, primary_key=True, default=lambda: uuid.uuid4())
    key = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=get_current_utc_time, index=True)
    last_used_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="api_keys")


class App(Base):
    __tablename__ = "apps"
    id = Column(UUID, primary_key=True, default=lambda: uuid.uuid4())
    owner_id = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(String)
    metadata_ = Column('metadata', JSON, default=dict)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=get_current_utc_time, index=True)
    updated_at = Column(DateTime,
                        default=get_current_utc_time,
                        onupdate=get_current_utc_time)
    
    # 新增字段用于优化数据结构
    websocket_url = Column(String, unique=True, nullable=True, index=True)
    device_name = Column(String, nullable=True, index=True)
    agent_id = Column(Integer, nullable=True, index=True)

    owner = relationship("User", back_populates="apps")
    memories = relationship("Memory", back_populates="app")


class Config(Base):
    __tablename__ = "configs"
    id = Column(UUID, primary_key=True, default=lambda: uuid.uuid4())
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=get_current_utc_time)
    updated_at = Column(DateTime,
                        default=get_current_utc_time,
                        onupdate=get_current_utc_time)


class Memory(Base):
    __tablename__ = "memories"
    id = Column(UUID, primary_key=True, default=lambda: uuid.uuid4())
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    app_id = Column(UUID, ForeignKey("apps.id"), nullable=False, index=True)
    content = Column(String, nullable=False)
    vector = Column(String)
    metadata_ = Column('metadata', JSON, default=dict)
    state = Column(Enum(MemoryState), default=MemoryState.active, index=True)
    created_at = Column(DateTime, default=get_current_utc_time, index=True)
    updated_at = Column(DateTime,
                        default=get_current_utc_time,
                        onupdate=get_current_utc_time)
    archived_at = Column(DateTime, nullable=True, index=True)
    deleted_at = Column(DateTime, nullable=True, index=True)

    user = relationship("User", back_populates="memories")
    app = relationship("App", back_populates="memories")
    categories = relationship("Category", secondary="memory_categories", back_populates="memories")

    __table_args__ = (
        Index('idx_memory_user_state', 'user_id', 'state'),
        Index('idx_memory_app_state', 'app_id', 'state'),
        Index('idx_memory_user_app', 'user_id', 'app_id'),
    )


class Category(Base):
    __tablename__ = "categories"
    id = Column(UUID, primary_key=True, default=lambda: uuid.uuid4())
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.now(datetime.UTC), index=True)
    updated_at = Column(DateTime,
                        default=get_current_utc_time,
                        onupdate=get_current_utc_time)

    memories = relationship("Memory", secondary="memory_categories", back_populates="categories")

memory_categories = Table(
    "memory_categories", Base.metadata,
    Column("memory_id", UUID, ForeignKey("memories.id"), primary_key=True, index=True),
    Column("category_id", UUID, ForeignKey("categories.id"), primary_key=True, index=True),
    Index('idx_memory_category', 'memory_id', 'category_id')
)


class AccessControl(Base):
    __tablename__ = "access_controls"
    id = Column(UUID, primary_key=True, default=lambda: uuid.uuid4())
    subject_type = Column(String, nullable=False, index=True)
    subject_id = Column(UUID, nullable=True, index=True)
    object_type = Column(String, nullable=False, index=True)
    object_id = Column(UUID, nullable=True, index=True)
    effect = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=get_current_utc_time, index=True)

    __table_args__ = (
        Index('idx_access_subject', 'subject_type', 'subject_id'),
        Index('idx_access_object', 'object_type', 'object_id'),
    )


class ArchivePolicy(Base):
    __tablename__ = "archive_policies"
    id = Column(UUID, primary_key=True, default=lambda: uuid.uuid4())
    criteria_type = Column(String, nullable=False, index=True)
    criteria_id = Column(UUID, nullable=True, index=True)
    days_to_archive = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=get_current_utc_time, index=True)

    __table_args__ = (
        Index('idx_policy_criteria', 'criteria_type', 'criteria_id'),
    )


class MemoryStatusHistory(Base):
    __tablename__ = "memory_status_history"
    id = Column(UUID, primary_key=True, default=lambda: uuid.uuid4())
    memory_id = Column(UUID, ForeignKey("memories.id"), nullable=False, index=True)
    changed_by = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    old_state = Column(Enum(MemoryState), nullable=False, index=True)
    new_state = Column(Enum(MemoryState), nullable=False, index=True)
    changed_at = Column(DateTime, default=get_current_utc_time, index=True)

    __table_args__ = (
        Index('idx_history_memory_state', 'memory_id', 'new_state'),
        Index('idx_history_user_time', 'changed_by', 'changed_at'),
    )


class MemoryAccessLog(Base):
    __tablename__ = "memory_access_logs"
    id = Column(UUID, primary_key=True, default=lambda: uuid.uuid4())
    memory_id = Column(UUID, ForeignKey("memories.id"), nullable=False, index=True)
    app_id = Column(UUID, ForeignKey("apps.id"), nullable=False, index=True)
    accessed_at = Column(DateTime, default=get_current_utc_time, index=True)
    access_type = Column(String, nullable=False, index=True)
    metadata_ = Column('metadata', JSON, default=dict)

    __table_args__ = (
        Index('idx_access_memory_time', 'memory_id', 'accessed_at'),
        Index('idx_access_app_time', 'app_id', 'accessed_at'),
    )

class PaymentOrder(Base):
    __tablename__ = "payment_orders"
    id = Column(UUID, primary_key=True, default=lambda: uuid.uuid4())
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    plan_id = Column(String, nullable=False) # e.g. "pro_monthly"
    amount = Column(Integer, nullable=False) # In cents/lowest unit, e.g., 900 for $9.00
    currency = Column(String, nullable=False) # USD, CNY
    status = Column(String, nullable=False, default="pending", index=True) # pending, paid, failed, cancelled
    provider = Column(String, nullable=False) # stripe, payjs
    provider_order_id = Column(String, nullable=True, index=True) # stripe_session_id, payjs_order_id
    metadata_ = Column('metadata', JSON, default=dict)
    created_at = Column(DateTime, default=get_current_utc_time, index=True)
    updated_at = Column(DateTime, default=get_current_utc_time, onupdate=get_current_utc_time)
    
    user = relationship("User")

def categorize_memory(memory: Memory, db: Session) -> None:
    """Categorize a memory using OpenAI and store the categories in the database."""
    print(f"[DEBUG] Starting categorization for memory {memory.id} with content: {memory.content}")
    try:
        # Get categories from OpenAI
        print(f"[DEBUG] Calling get_categories_for_memory")
        categories = get_categories_for_memory(memory.content)
        print(f"[DEBUG] Received categories: {categories}")

        # Get or create categories in the database
        for category_name in categories:
            print(f"[DEBUG] Processing category: {category_name}")
            category = db.query(Category).filter(Category.name == category_name).first()
            if not category:
                print(f"[DEBUG] Creating new category: {category_name}")
                category = Category(
                    name=category_name,
                    description=f"Automatically created category for {category_name}"
                )
                db.add(category)
                db.flush()  # Flush to get the category ID
                print(f"[DEBUG] Created category with id: {category.id}")
            else:
                print(f"[DEBUG] Category already exists with id: {category.id}")

            # Check if the memory-category association already exists
            existing = db.execute(
                memory_categories.select().where(
                    (memory_categories.c.memory_id == memory.id) &
                    (memory_categories.c.category_id == category.id)
                )
            ).first()

            if not existing:
                # Create the association
                print(f"[DEBUG] Creating memory-category association")
                db.execute(
                    memory_categories.insert().values(
                        memory_id=memory.id,
                        category_id=category.id
                    )
                )
                print(f"[DEBUG] Created association between memory {memory.id} and category {category.id}")
            else:
                print(f"[DEBUG] Association already exists")

        print(f"[DEBUG] Committing changes to database")
        db.commit()
        print(f"[DEBUG] Categorization completed successfully")
    except Exception as e:
        print(f"[DEBUG] Rolling back transaction due to error")
        db.rollback()
        print(f"[ERROR] Error categorizing memory: {e}")
        import traceback
        traceback.print_exc()
