import asyncio
import sys
import os

# Add current directory to path so we can import app
sys.path.append(os.getcwd())

from app.mcp_server import add_memories, get_memory_client

async def test():
    print("Testing memory addition...")
    # Ensure client is initialized (which happens on first call/get)
    client = get_memory_client()
    if not client:
        print("Failed to get client")
        return

    result = await add_memories(memories="这个项目的品牌主色调是紫色：RGB的值是：118, 52, 249", user_id="test_user")
    print(f"Result: {result}")

if __name__ == "__main__":
    asyncio.run(test())

