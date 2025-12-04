import datetime
from fastapi import FastAPI
from app.database import engine, Base, SessionLocal
from app.mcp_server import setup_mcp_server
from app.routers import memories_router, apps_router, stats_router, config_router, auth_router, api_keys_router, payment
from app.routers.admin import router as admin_router
from app.routers.test_categorization import router as test_categorization
from app.routers.graph import router as graph_router
from fastapi_pagination import add_pagination
from fastapi.middleware.cors import CORSMiddleware
from app.models import User, App
from uuid import uuid4
from app.config import USER_ID, DEFAULT_APP_ID

app = FastAPI(title="OpenMemory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.momemory.com",
        "http://www.momemory.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create all tables
Base.metadata.create_all(bind=engine)

# Check for USER_ID and create default user if needed
def create_default_user():
    db = SessionLocal()
    try:
        # Check if user exists
        user = db.query(User).filter(User.user_id == USER_ID).first()
        if not user:
            # Create default user
            user = User(
                id=uuid4(),
                user_id=USER_ID,
                name="Default User",
                created_at=datetime.datetime.now(datetime.UTC)
            )
            db.add(user)
            db.commit()
    finally:
        db.close()


def create_default_app():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == USER_ID).first()
        if not user:
            return

        # Check if app already exists (app name is globally unique)
        existing_app = db.query(App).filter(
            App.name == DEFAULT_APP_ID
        ).first()

        if existing_app:
            return

        app = App(
            id=uuid4(),
            name=DEFAULT_APP_ID,
            owner_id=user.id,
            created_at=datetime.datetime.now(datetime.UTC),
            updated_at=datetime.datetime.now(datetime.UTC),
        )
        db.add(app)
        db.commit()
    finally:
        db.close()

# Create default user on startup
create_default_user()
create_default_app()

import logging

# ...

# Setup MCP server
mcp_instance = setup_mcp_server(app)

@app.on_event("startup")
async def on_startup():
    logger = logging.getLogger("app.main")
    try:
        tools = await mcp_instance.list_tools()
        logger.info(f"✅ Registered MCP Tools: {[t.name for t in tools]}")
    except Exception as e:
        logger.error(f"❌ Failed to list MCP tools on startup: {e}")
        # Fallback inspection
        try:
            logger.info(f"Inspecting mcp._tool_manager._tools: {mcp_instance._tool_manager._tools.keys()}")
        except:
            pass

# Include routers with correct prefixes
app.include_router(memories_router, prefix="/api/v1/memories", tags=["memories"])
app.include_router(apps_router, prefix="/api/v1/apps", tags=["apps"])
app.include_router(stats_router, prefix="/api/v1/stats", tags=["stats"])
app.include_router(config_router, prefix="/api/v1/config", tags=["config"])
app.include_router(graph_router, prefix="/api/v1/graph", tags=["graph"])
app.include_router(test_categorization, prefix="/api/v1/test", tags=["test"])
app.include_router(auth_router)  # auth_router already has prefix="/api/v1/auth"
app.include_router(api_keys_router) # api_keys_router has prefix "/api/v1/api-keys"
app.include_router(admin_router)
app.include_router(payment.router)

# Health check endpoint
@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok"}

# Ping endpoint for Mem0 Client validation
@app.get("/api/v1/ping")
async def ping():
    return {"status": "ok"}

# Add pagination support
add_pagination(app)
# Include routers with correct prefixes
app.include_router(memories_router, prefix="/api/v1/memories", tags=["memories"])
app.include_router(apps_router, prefix="/api/v1/apps", tags=["apps"])
app.include_router(stats_router, prefix="/api/v1/stats", tags=["stats"])
app.include_router(config_router, prefix="/api/v1/config", tags=["config"])
app.include_router(test_categorization, prefix="/api/v1/test", tags=["test"])
app.include_router(auth_router)  # auth_router already has prefix="/api/v1/auth"
app.include_router(api_keys_router) # api_keys_router has prefix "/api/v1/api-keys"
app.include_router(admin_router)
app.include_router(payment.router)

# Health check endpoint
@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok"}

# Ping endpoint for Mem0 Client validation
@app.get("/api/v1/ping")
async def ping():
    return {"status": "ok"}
# Include routers with correct prefixes
app.include_router(memories_router, prefix="/api/v1/memories", tags=["memories"])
app.include_router(apps_router, prefix="/api/v1/apps", tags=["apps"])
app.include_router(stats_router, prefix="/api/v1/stats", tags=["stats"])
app.include_router(config_router, prefix="/api/v1/config", tags=["config"])
app.include_router(test_categorization, prefix="/api/v1/test", tags=["test"])
app.include_router(auth_router)  # auth_router already has prefix="/api/v1/auth"
app.include_router(api_keys_router) # api_keys_router has prefix "/api/v1/api-keys"
app.include_router(admin_router)
app.include_router(payment.router)

# Health check endpoint
@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok"}

# Ping endpoint for Mem0 Client validation
@app.get("/api/v1/ping")
async def ping():
    return {"status": "ok"}

# Add pagination support
add_pagination(app)
# Include routers with correct prefixes
app.include_router(memories_router, prefix="/api/v1/memories", tags=["memories"])
app.include_router(apps_router, prefix="/api/v1/apps", tags=["apps"])
app.include_router(stats_router, prefix="/api/v1/stats", tags=["stats"])
app.include_router(config_router, prefix="/api/v1/config", tags=["config"])
app.include_router(test_categorization, prefix="/api/v1/test", tags=["test"])
app.include_router(auth_router)  # auth_router already has prefix="/api/v1/auth"
app.include_router(api_keys_router) # api_keys_router has prefix "/api/v1/api-keys"
app.include_router(admin_router)
app.include_router(payment.router)

# Health check endpoint
@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok"}