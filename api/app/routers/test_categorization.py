from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Memory, categorize_memory, get_categories_for_memory
from typing import List

router = APIRouter(prefix="/api/v1/test", tags=["test"])

@router.post("/categorize-memory/{memory_id}")
def test_categorize_memory(memory_id: str, db: Session = Depends(get_db)):
    """测试对指定记忆进行分类"""
    print(f"[DEBUG] Manual test categorization called for memory_id: {memory_id}")
    
    # 查找记忆
    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        return {"error": "Memory not found"}
    
    print(f"[DEBUG] Found memory: {memory.id}, content: {memory.content}")
    
    # 尝试直接获取分类
    print(f"[DEBUG] Testing get_categories_for_memory function")
    try:
        categories = get_categories_for_memory(memory.content)
        print(f"[DEBUG] get_categories_for_memory returned: {categories}")
    except Exception as e:
        print(f"[ERROR] get_categories_for_memory failed: {e}")
        import traceback
        traceback.print_exc()
        return {"error": f"Failed to get categories: {str(e)}"}
    
    # 尝试使用 categorize_memory 函数
    print(f"[DEBUG] Testing categorize_memory function")
    try:
        categorize_memory(memory, db)
        print(f"[DEBUG] categorize_memory completed")
    except Exception as e:
        print(f"[ERROR] categorize_memory failed: {e}")
        import traceback
        traceback.print_exc()
        return {"error": f"Failed to categorize memory: {str(e)}"}
    
    return {
        "memory_id": memory.id,
        "content": memory.content,
        "categories": categories
    }