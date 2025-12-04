import os
import logging
import asyncio
import json
import httpx
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from mcp.server.fastmcp import FastMCP
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from mem0 import Memory

from .database import get_db
from .models import User, App, Memory as MemoryModel, categorize_memory
# from .utils.categorization import categorize_memory

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create the MCP server
mcp = FastMCP("OpenMemory")

# Initialize Memory Client
# Check if running in Docker or local
if os.path.exists('/mem0/storage'):
    # Docker environment
    config = {
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "host": "mem0_store",
                "port": 6333
            }
        },
        "version": "v1.1"
    }
else:
    # Local environment
    config = {
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "host": "localhost",
                "port": 6333
            }
        },
        "version": "v1.1"
    }

from mem0.configs.vector_stores.qdrant import QdrantConfig
from mem0.configs.base import MemoryConfig, VectorStoreConfig, LlmConfig, EmbedderConfig

memory_client = None

def get_memory_client():
    global memory_client
    if memory_client is None:
        try:
            # Construct config objects
            # Check if running in Docker via .dockerenv or env var
            is_docker = os.path.exists('/.dockerenv') or os.getenv("IS_DOCKER", "false").lower() == "true"
            
            # Load SiliconFlow config from environment
            openai_api_key = os.getenv("OPENAI_API_KEY")
            openai_base_url = os.getenv("OPENAI_BASE_URL")
            openai_model = os.getenv("OPENAI_MODEL")
            
            embed_api_key = os.getenv("OPENAI_EMBEDDING_MODEL_API_KEY", openai_api_key)
            embed_base_url = os.getenv("OPENAI_EMBEDDING_MODEL_BASE_URL", openai_base_url)
            embed_model = os.getenv("OPENAI_EMBEDDING_MODEL", "Pro/BAAI/bge-m3")
            embed_dims = int(os.getenv("OPENAI_EMBEDDING_MODEL_DIMS", "1024"))

            q_config = QdrantConfig(
                host="mem0_store" if is_docker else "localhost",
                port=6333,
                embedding_model_dims=embed_dims
            )
            
            vs_config = VectorStoreConfig(
                provider="qdrant",
                config=q_config.model_dump()
            )

            llm_config = LlmConfig(
                provider="openai",
                config={
                    "api_key": openai_api_key,
                    "openai_base_url": openai_base_url,
                    "model": openai_model,
                    "max_tokens": 4000
                }
            )
            
            embedder_config = EmbedderConfig(
                provider="openai",
                config={
                    "api_key": embed_api_key,
                    "openai_base_url": embed_base_url,
                    "model": embed_model,
                    "embedding_dims": embed_dims
                }
            )
            
            mem_config = MemoryConfig(
                vector_store=vs_config,
                llm=llm_config,
                embedder=embedder_config,
                version="v1.1"
            )
            
            memory_client = Memory(config=mem_config)
            logger.info(f"Memory initialized successfully with SiliconFlow model: {openai_model}, embed: {embed_model}")
        except Exception as e:
            logger.error(f"Failed to initialize Memory: {str(e)}")
            # Fallback? Maybe not needed if this works.
    return memory_client

from .mcp_utils import _sync_memory_to_pg

@mcp.tool()
async def add_memories(memories: str = None, text: str = None, user_id: str = "default_user", agent_id: str = None, run_id: str = None, metadata: str = None) -> str:
    """
    Add multiple memories to the system.
    
    Args:
        memories: A string containing memories to add, or a JSON string of memory objects.
        text: Content of the memory to add (alias for memories, compatible with Xiaozhi).
        user_id: The ID of the user adding the memories.
        agent_id: The ID of the agent adding the memories (optional).
        run_id: The ID of the run (optional).
        metadata: Additional metadata as a JSON string (optional).
    """
    client = get_memory_client()
    if not client:
        return "Error: Memory system not available"
        
    # Compatibility: Use text if memories is not provided
    content_to_add = memories
    if not content_to_add and text:
        content_to_add = text
        
    if not content_to_add:
        return "Error: No memory content provided. Please provide 'memories' or 'text'."

    try:
        # Parse metadata if provided
        meta = {}
        if metadata:
            try:
                meta = json.loads(metadata)
            except:
                pass
        
        # Add agent_id and run_id to metadata if provided
        if agent_id:
            meta["agent_id"] = agent_id
        if run_id:
            meta["run_id"] = run_id
            
        # Try to parse memories as JSON, otherwise treat as plain text
        try:
            memories_list = json.loads(content_to_add)
            if isinstance(memories_list, list):
                # Process list of memories
                results = []
                for m in memories_list:
                    content = m if isinstance(m, str) else m.get("content", str(m))
                    # Merge entry-specific metadata if exists
                    entry_meta = meta.copy()
                    if isinstance(m, dict) and "metadata" in m:
                        entry_meta.update(m["metadata"])
                        
                    res = client.add(content, user_id=user_id, metadata=entry_meta)
                    results.append(res)
                
                # Process results to handle updates correctly
                final_results = []
                
                # Create a new database session for categorization
                db = next(get_db())
                
                for result_batch in results:
                    if isinstance(result_batch, dict):
                        result_batch = [result_batch]

                    for result in result_batch:
                        logging.info(f"Mem0 add result: {result}")
                        event = result.get("event")

                        if event == "add":
                            final_results.append(f"Added: {result.get('memory')}")
                            if "id" in result:
                                _sync_memory_to_pg(result, user_id, agent_id, db)
                        elif event == "update":
                            final_results.append(
                                f"Updated: {result.get('memory')} (ID: {result.get('id')})"
                            )
                            if "id" in result:
                                _sync_memory_to_pg(result, user_id, agent_id, db)
                        else:
                            final_results.append(str(result))

                return "\n".join(final_results)
            else:
                # Single memory string (JSON parseable but not list)
                logger.info(f"Adding single memory (json): {content_to_add}")
                result = client.add(content_to_add, user_id=user_id, metadata=meta)
                logger.info(f"Mem0 add result: {result}")

                # Sync single result (which might contain a list in 'results' key)
                db = next(get_db())

                items_to_sync = []
                if isinstance(result, dict):
                    if "results" in result and isinstance(result["results"], list):
                        items_to_sync = result["results"]
                    elif "id" in result:
                        items_to_sync = [result]
                elif isinstance(result, list):
                    items_to_sync = result

                logger.info(f"Items to sync: {len(items_to_sync)}")
                for item in items_to_sync:
                    if isinstance(item, dict) and "id" in item:
                        _sync_memory_to_pg(item, user_id, agent_id, db)

                return f"Added: {content_to_add}"
        except json.JSONDecodeError:
            # Plain text memory
            logger.info(f"Adding plain text memory: {content_to_add}")
            result = client.add(content_to_add, user_id=user_id, metadata=meta)
            logger.info(f"Mem0 plain text result: {result}")
            
            # Sync single result
            db = next(get_db())
            
            items_to_sync = []
            if isinstance(result, dict):
                if 'results' in result and isinstance(result['results'], list):
                    items_to_sync = result['results']
                elif 'id' in result:
                     items_to_sync = [result]
            elif isinstance(result, list):
                items_to_sync = result

            logger.info(f"Items to sync (plain): {len(items_to_sync)}")
            for item in items_to_sync:
                if isinstance(item, dict) and 'id' in item:
                    _sync_memory_to_pg(item, user_id, agent_id, db)

            return f"Added: {content_to_add}"

    except Exception as e:
        logger.error(f"Error adding memories: {str(e)}")
        import traceback

        traceback.print_exc()
        return f"Error adding memories: {str(e)}"

@mcp.tool()
async def search_memory(query: str, user_id: str = "default_user", agent_id: str = None, limit: int = 5) -> str:
    """
    Search for memories relevant to a query.
    
    Args:
        query: The search query.
        user_id: The ID of the user to search memories for.
        agent_id: The ID of the agent to search memories for (optional).
        limit: The maximum number of results to return (default: 5).
    """
    return await search_memories(query, user_id, agent_id, limit)

@mcp.tool()
async def search_memories(query: str, user_id: str = "default_user", agent_id: str = None, limit: int = 5) -> str:
    """
    Search for memories relevant to a query.
    
    Args:
        query: The search query.
        user_id: The ID of the user to search memories for.
        agent_id: The ID of the agent to search memories for (optional).
        limit: The maximum number of results to return (default: 5).
    """
    client = get_memory_client()
    if not client:
        return "Error: Memory system not available"
        
    try:
        results = client.search(query, user_id=user_id, limit=limit)
        
        if isinstance(results, dict) and 'results' in results:
            results = results['results']
            
        if not results:
            return "No relevant memories found."
            
        formatted_results = []
        for r in results:
            mem = r.get('memory', '')
            score = r.get('score', 0)
            formatted_results.append(f"- {mem} (Score: {score:.2f})")
            
        return "\n".join(formatted_results)
    except Exception as e:
        logger.error(f"Error searching memories: {str(e)}")
        return f"Error searching memories: {str(e)}"

def setup_mcp_server(app: FastAPI):
    """
    Mounts the MCP server to the FastAPI app.
    """
    # Mount the MCP server SSE endpoint
    # FastMCP.sse_app is a method that returns a Starlette app
    # We mount it at /mcp so the endpoints become /mcp/sse and /mcp/messages
    if hasattr(mcp, "sse_app"):
        sse_asgi_app = mcp.sse_app()
        app.mount("/mcp", sse_asgi_app)
    else:
        logger.error("FastMCP instance does not have 'sse_app' attribute. MCP might not work.")
    
    # Return the MCP instance so main.py can use it if needed
    return mcp
