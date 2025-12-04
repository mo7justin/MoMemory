from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, validator

class MemoryBase(BaseModel):
    content: str
    metadata_: Optional[dict] = Field(default_factory=dict)

class MemoryCreate(MemoryBase):
    user_id: UUID
    app_id: UUID


class Category(BaseModel):
    name: str


class App(BaseModel):
    id: UUID
    name: str


class Memory(MemoryBase):
    id: UUID
    user_id: UUID
    app_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    state: str
    categories: Optional[List[Category]] = None
    app: App

    class Config:
        from_attributes = True

class MemoryUpdate(BaseModel):
    content: Optional[str] = None
    metadata_: Optional[dict] = None
    state: Optional[str] = None


class MemoryResponse(BaseModel):
    id: UUID
    content: str
    created_at: int
    state: str
    app_id: UUID
    app_name: str
    categories: List[str]
    metadata_: Optional[dict] = None

    @validator('created_at', pre=True)
    def convert_to_epoch(cls, v):
        if isinstance(v, datetime):
            return int(v.timestamp())
        return v

class PaginatedMemoryResponse(BaseModel):
    items: List[MemoryResponse]
    total: int
    page: int
    size: int
    pages: int

# Search schemas
class SearchRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    limit: int = 5

class SearchResponse(BaseModel):
    content: str
    score: float
    metadata: Optional[dict] = None

# API Key schemas
class ApiKeyCreate(BaseModel):
    name: Optional[str] = None
    user_id: str  # Can be UUID or string email/user_id

class ApiKeyResponse(BaseModel):
    id: UUID
    name: Optional[str]
    prefix: str
    created_at: datetime
    last_used_at: Optional[datetime]
    is_active: bool
    
    class Config:
        from_attributes = True

class ApiKeyCreatedResponse(ApiKeyResponse):
    key: str  # Only returned once upon creation
