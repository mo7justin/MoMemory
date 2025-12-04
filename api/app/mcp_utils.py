
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from .models import User, App, Memory as MemoryModel, MemoryAccessLog, categorize_memory
from uuid import UUID

def _sync_memory_to_pg(result: Dict[str, Any], user_id: str, agent_id: Optional[str], db: Session):
    """Helper to sync a mem0 result to PostgreSQL"""
    mem_id = result.get('id')
    print(f"DEBUG: Processing sync for ID: {mem_id}")
    
    try:
        db_memory = db.query(MemoryModel).filter(MemoryModel.id == mem_id).first()
        print(f"DEBUG: Found in DB? {db_memory is not None}")
        
        if not db_memory:
            # Find user object
            user_obj = None
            try:
                user_uuid = UUID(user_id)
                user_obj = db.query(User).filter(User.id == user_uuid).first()
            except ValueError:
                pass
            
            if not user_obj:
                user_obj = db.query(User).filter(User.user_id == user_id).first()
                if not user_obj:
                    user_obj = db.query(User).filter(User.email == user_id).first()
            
            print(f"DEBUG: Found User? {user_obj.id if user_obj else 'No'}")

            if user_obj:
                # Find or create App context
                app_obj = None
                
                # Try to find agent_id in metadata if not provided
                if not agent_id and result.get('metadata'):
                    agent_id = result.get('metadata').get('agent_id')

                if agent_id:
                    # Try by ID
                    try:
                        aid = int(agent_id)
                        app_obj = db.query(App).filter(App.id == aid).first()
                    except ValueError:
                        pass
                    # Try by name match
                    if not app_obj:
                        apps = db.query(App).all()
                        for a in apps:
                            if str(agent_id) in a.name:
                                app_obj = a
                                break
                
                if not app_obj:
                     app_obj = db.query(App).filter(App.owner_id == user_obj.id).order_by(App.created_at.desc()).first()
                
                try:
                    new_mem_id = UUID(mem_id)
                    new_memory = MemoryModel(
                        id=new_mem_id,
                        user_id=user_obj.id,
                        app_id=app_obj.id if app_obj else None,
                        content=result.get('memory'),
                        metadata_=result.get('metadata', {}),
                        state="active"
                    )
                    db.add(new_memory)
                    db.commit()
                    db.refresh(new_memory)
                    db_memory = new_memory
                    logging.info(f"Synced new MCP memory to Postgres: {mem_id}")

                    # Create Access Log for ADD
                    if app_obj:
                        access_log = MemoryAccessLog(
                            memory_id=new_memory.id,
                            app_id=app_obj.id,
                            access_type="ADD",
                            metadata_={
                                "agent_id": agent_id,
                                "source": "mcp_tool",
                                "event": result.get('event', 'ADD')
                            }
                        )
                        db.add(access_log)
                        db.commit()
                        logging.info(f"Created Access Log for ADD: {mem_id}")

                except Exception as create_err:
                    logging.error(f"Failed to sync memory to Postgres: {create_err}")
                    db.rollback()
        
        if db_memory:
            # Categorize
            categorize_memory(db_memory, db)
            logging.info(f"Categorized memory: {mem_id}")

            # If it was an update (implied if db_memory existed but contents might have changed - though logic above only handles CREATE if not exists. 
            # Ideally we should check if content changed to log UPDATE, but mem0 usually returns event='update' or 'add'.
            # For now, since the function is mostly called on 'add' tool, if it existed, it might be a duplicate or update. 
            # If we want to log access even if it existed:
            # Note: The current logic ONLY enters the creation block if !db_memory. 
            # So updates to existing memories via MCP tool are NOT currently updating the PG record content in this function 
            # (except for the categorization call).
            # We should probably update the content if it's different and log that too.
            
            # Update logic if content differs
            if db_memory.content != result.get('memory'):
                db_memory.content = result.get('memory')
                # Also update metadata if needed
                if result.get('metadata'):
                    db_memory.metadata_ = result.get('metadata')
                
                db.commit()
                logging.info(f"Updated existing memory content in Postgres: {mem_id}")
                
                # Log UPDATE
                # We need to find the app again if not passed in scope, but we can use db_memory.app_id or re-resolve
                if db_memory.app_id:
                    access_log = MemoryAccessLog(
                        memory_id=db_memory.id,
                        app_id=db_memory.app_id,
                        access_type="UPDATE",
                         metadata_={
                            "agent_id": agent_id,
                            "source": "mcp_tool",
                            "event": result.get('event', 'UPDATE')
                        }
                    )
                    db.add(access_log)
                    db.commit()
            
    except Exception as e:
        logging.error(f"Error in _sync_memory_to_pg: {e}")


from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from .models import User, App, Memory as MemoryModel, MemoryAccessLog, categorize_memory
from uuid import UUID

def _sync_memory_to_pg(result: Dict[str, Any], user_id: str, agent_id: Optional[str], db: Session):
    """Helper to sync a mem0 result to PostgreSQL"""
    mem_id = result.get('id')
    print(f"DEBUG: Processing sync for ID: {mem_id}")
    
    try:
        db_memory = db.query(MemoryModel).filter(MemoryModel.id == mem_id).first()
        print(f"DEBUG: Found in DB? {db_memory is not None}")
        
        if not db_memory:
            # Find user object
            user_obj = None
            try:
                user_uuid = UUID(user_id)
                user_obj = db.query(User).filter(User.id == user_uuid).first()
            except ValueError:
                pass
            
            if not user_obj:
                user_obj = db.query(User).filter(User.user_id == user_id).first()
                if not user_obj:
                    user_obj = db.query(User).filter(User.email == user_id).first()
            
            print(f"DEBUG: Found User? {user_obj.id if user_obj else 'No'}")

            if user_obj:
                # Find or create App context
                app_obj = None
                
                # Try to find agent_id in metadata if not provided
                if not agent_id and result.get('metadata'):
                    agent_id = result.get('metadata').get('agent_id')

                if agent_id:
                    # Try by ID
                    try:
                        aid = int(agent_id)
                        app_obj = db.query(App).filter(App.id == aid).first()
                    except ValueError:
                        pass
                    # Try by name match
                    if not app_obj:
                        apps = db.query(App).all()
                        for a in apps:
                            if str(agent_id) in a.name:
                                app_obj = a
                                break
                
                if not app_obj:
                     app_obj = db.query(App).filter(App.owner_id == user_obj.id).order_by(App.created_at.desc()).first()
                
                try:
                    new_mem_id = UUID(mem_id)
                    new_memory = MemoryModel(
                        id=new_mem_id,
                        user_id=user_obj.id,
                        app_id=app_obj.id if app_obj else None,
                        content=result.get('memory'),
                        metadata_=result.get('metadata', {}),
                        state="active"
                    )
                    db.add(new_memory)
                    db.commit()
                    db.refresh(new_memory)
                    db_memory = new_memory
                    logging.info(f"Synced new MCP memory to Postgres: {mem_id}")

                    # Create Access Log for ADD
                    if app_obj:
                        access_log = MemoryAccessLog(
                            memory_id=new_memory.id,
                            app_id=app_obj.id,
                            access_type="ADD",
                            metadata_={
                                "agent_id": agent_id,
                                "source": "mcp_tool",
                                "event": result.get('event', 'ADD')
                            }
                        )
                        db.add(access_log)
                        db.commit()
                        logging.info(f"Created Access Log for ADD: {mem_id}")

                except Exception as create_err:
                    logging.error(f"Failed to sync memory to Postgres: {create_err}")
                    db.rollback()
        
        if db_memory:
            # Categorize
            categorize_memory(db_memory, db)
            logging.info(f"Categorized memory: {mem_id}")

            # If it was an update (implied if db_memory existed but contents might have changed - though logic above only handles CREATE if not exists. 
            # Ideally we should check if content changed to log UPDATE, but mem0 usually returns event='update' or 'add'.
            # For now, since the function is mostly called on 'add' tool, if it existed, it might be a duplicate or update. 
            # If we want to log access even if it existed:
            # Note: The current logic ONLY enters the creation block if !db_memory. 
            # So updates to existing memories via MCP tool are NOT currently updating the PG record content in this function 
            # (except for the categorization call).
            # We should probably update the content if it's different and log that too.
            
            # Update logic if content differs
            if db_memory.content != result.get('memory'):
                db_memory.content = result.get('memory')
                # Also update metadata if needed
                if result.get('metadata'):
                    db_memory.metadata_ = result.get('metadata')
                
                db.commit()
                logging.info(f"Updated existing memory content in Postgres: {mem_id}")
                
                # Log UPDATE
                # We need to find the app again if not passed in scope, but we can use db_memory.app_id or re-resolve
                if db_memory.app_id:
                    access_log = MemoryAccessLog(
                        memory_id=db_memory.id,
                        app_id=db_memory.app_id,
                        access_type="UPDATE",
                         metadata_={
                            "agent_id": agent_id,
                            "source": "mcp_tool",
                            "event": result.get('event', 'UPDATE')
                        }
                    )
                    db.add(access_log)
                    db.commit()
            
    except Exception as e:
        logging.error(f"Error in _sync_memory_to_pg: {e}")

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from .models import User, App, Memory as MemoryModel, MemoryAccessLog, categorize_memory
from uuid import UUID

def _sync_memory_to_pg(result: Dict[str, Any], user_id: str, agent_id: Optional[str], db: Session):
    """Helper to sync a mem0 result to PostgreSQL"""
    mem_id = result.get('id')
    print(f"DEBUG: Processing sync for ID: {mem_id}")
    
    try:
        db_memory = db.query(MemoryModel).filter(MemoryModel.id == mem_id).first()
        print(f"DEBUG: Found in DB? {db_memory is not None}")
        
        if not db_memory:
            # Find user object
            user_obj = None
            try:
                user_uuid = UUID(user_id)
                user_obj = db.query(User).filter(User.id == user_uuid).first()
            except ValueError:
                pass
            
            if not user_obj:
                user_obj = db.query(User).filter(User.user_id == user_id).first()
                if not user_obj:
                    user_obj = db.query(User).filter(User.email == user_id).first()
            
            print(f"DEBUG: Found User? {user_obj.id if user_obj else 'No'}")

            if user_obj:
                # Find or create App context
                app_obj = None
                
                # Try to find agent_id in metadata if not provided
                if not agent_id and result.get('metadata'):
                    agent_id = result.get('metadata').get('agent_id')

                if agent_id:
                    # Try by ID
                    try:
                        aid = int(agent_id)
                        app_obj = db.query(App).filter(App.id == aid).first()
                    except ValueError:
                        pass
                    # Try by name match
                    if not app_obj:
                        apps = db.query(App).all()
                        for a in apps:
                            if str(agent_id) in a.name:
                                app_obj = a
                                break
                
                if not app_obj:
                     app_obj = db.query(App).filter(App.owner_id == user_obj.id).order_by(App.created_at.desc()).first()
                
                try:
                    new_mem_id = UUID(mem_id)
                    new_memory = MemoryModel(
                        id=new_mem_id,
                        user_id=user_obj.id,
                        app_id=app_obj.id if app_obj else None,
                        content=result.get('memory'),
                        metadata_=result.get('metadata', {}),
                        state="active"
                    )
                    db.add(new_memory)
                    db.commit()
                    db.refresh(new_memory)
                    db_memory = new_memory
                    logging.info(f"Synced new MCP memory to Postgres: {mem_id}")

                    # Create Access Log for ADD
                    if app_obj:
                        access_log = MemoryAccessLog(
                            memory_id=new_memory.id,
                            app_id=app_obj.id,
                            access_type="ADD",
                            metadata_={
                                "agent_id": agent_id,
                                "source": "mcp_tool",
                                "event": result.get('event', 'ADD')
                            }
                        )
                        db.add(access_log)
                        db.commit()
                        logging.info(f"Created Access Log for ADD: {mem_id}")

                except Exception as create_err:
                    logging.error(f"Failed to sync memory to Postgres: {create_err}")
                    db.rollback()
        
        if db_memory:
            # Categorize
            categorize_memory(db_memory, db)
            logging.info(f"Categorized memory: {mem_id}")

            # If it was an update (implied if db_memory existed but contents might have changed - though logic above only handles CREATE if not exists. 
            # Ideally we should check if content changed to log UPDATE, but mem0 usually returns event='update' or 'add'.
            # For now, since the function is mostly called on 'add' tool, if it existed, it might be a duplicate or update. 
            # If we want to log access even if it existed:
            # Note: The current logic ONLY enters the creation block if !db_memory. 
            # So updates to existing memories via MCP tool are NOT currently updating the PG record content in this function 
            # (except for the categorization call).
            # We should probably update the content if it's different and log that too.
            
            # Update logic if content differs
            if db_memory.content != result.get('memory'):
                db_memory.content = result.get('memory')
                # Also update metadata if needed
                if result.get('metadata'):
                    db_memory.metadata_ = result.get('metadata')
                
                db.commit()
                logging.info(f"Updated existing memory content in Postgres: {mem_id}")
                
                # Log UPDATE
                # We need to find the app again if not passed in scope, but we can use db_memory.app_id or re-resolve
                if db_memory.app_id:
                    access_log = MemoryAccessLog(
                        memory_id=db_memory.id,
                        app_id=db_memory.app_id,
                        access_type="UPDATE",
                         metadata_={
                            "agent_id": agent_id,
                            "source": "mcp_tool",
                            "event": result.get('event', 'UPDATE')
                        }
                    )
                    db.add(access_log)
                    db.commit()
            
    except Exception as e:
        logging.error(f"Error in _sync_memory_to_pg: {e}")


from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from .models import User, App, Memory as MemoryModel, MemoryAccessLog, categorize_memory
from uuid import UUID

def _sync_memory_to_pg(result: Dict[str, Any], user_id: str, agent_id: Optional[str], db: Session):
    """Helper to sync a mem0 result to PostgreSQL"""
    mem_id = result.get('id')
    print(f"DEBUG: Processing sync for ID: {mem_id}")
    
    try:
        db_memory = db.query(MemoryModel).filter(MemoryModel.id == mem_id).first()
        print(f"DEBUG: Found in DB? {db_memory is not None}")
        
        if not db_memory:
            # Find user object
            user_obj = None
            try:
                user_uuid = UUID(user_id)
                user_obj = db.query(User).filter(User.id == user_uuid).first()
            except ValueError:
                pass
            
            if not user_obj:
                user_obj = db.query(User).filter(User.user_id == user_id).first()
                if not user_obj:
                    user_obj = db.query(User).filter(User.email == user_id).first()
            
            print(f"DEBUG: Found User? {user_obj.id if user_obj else 'No'}")

            if user_obj:
                # Find or create App context
                app_obj = None
                
                # Try to find agent_id in metadata if not provided
                if not agent_id and result.get('metadata'):
                    agent_id = result.get('metadata').get('agent_id')

                if agent_id:
                    # Try by ID
                    try:
                        aid = int(agent_id)
                        app_obj = db.query(App).filter(App.id == aid).first()
                    except ValueError:
                        pass
                    # Try by name match
                    if not app_obj:
                        apps = db.query(App).all()
                        for a in apps:
                            if str(agent_id) in a.name:
                                app_obj = a
                                break
                
                if not app_obj:
                     app_obj = db.query(App).filter(App.owner_id == user_obj.id).order_by(App.created_at.desc()).first()
                
                try:
                    new_mem_id = UUID(mem_id)
                    new_memory = MemoryModel(
                        id=new_mem_id,
                        user_id=user_obj.id,
                        app_id=app_obj.id if app_obj else None,
                        content=result.get('memory'),
                        metadata_=result.get('metadata', {}),
                        state="active"
                    )
                    db.add(new_memory)
                    db.commit()
                    db.refresh(new_memory)
                    db_memory = new_memory
                    logging.info(f"Synced new MCP memory to Postgres: {mem_id}")

                    # Create Access Log for ADD
                    if app_obj:
                        access_log = MemoryAccessLog(
                            memory_id=new_memory.id,
                            app_id=app_obj.id,
                            access_type="ADD",
                            metadata_={
                                "agent_id": agent_id,
                                "source": "mcp_tool",
                                "event": result.get('event', 'ADD')
                            }
                        )
                        db.add(access_log)
                        db.commit()
                        logging.info(f"Created Access Log for ADD: {mem_id}")

                except Exception as create_err:
                    logging.error(f"Failed to sync memory to Postgres: {create_err}")
                    db.rollback()
        
        if db_memory:
            # Categorize
            categorize_memory(db_memory, db)
            logging.info(f"Categorized memory: {mem_id}")

            # If it was an update (implied if db_memory existed but contents might have changed - though logic above only handles CREATE if not exists. 
            # Ideally we should check if content changed to log UPDATE, but mem0 usually returns event='update' or 'add'.
            # For now, since the function is mostly called on 'add' tool, if it existed, it might be a duplicate or update. 
            # If we want to log access even if it existed:
            # Note: The current logic ONLY enters the creation block if !db_memory. 
            # So updates to existing memories via MCP tool are NOT currently updating the PG record content in this function 
            # (except for the categorization call).
            # We should probably update the content if it's different and log that too.
            
            # Update logic if content differs
            if db_memory.content != result.get('memory'):
                db_memory.content = result.get('memory')
                # Also update metadata if needed
                if result.get('metadata'):
                    db_memory.metadata_ = result.get('metadata')
                
                db.commit()
                logging.info(f"Updated existing memory content in Postgres: {mem_id}")
                
                # Log UPDATE
                # We need to find the app again if not passed in scope, but we can use db_memory.app_id or re-resolve
                if db_memory.app_id:
                    access_log = MemoryAccessLog(
                        memory_id=db_memory.id,
                        app_id=db_memory.app_id,
                        access_type="UPDATE",
                         metadata_={
                            "agent_id": agent_id,
                            "source": "mcp_tool",
                            "event": result.get('event', 'UPDATE')
                        }
                    )
                    db.add(access_log)
                    db.commit()
            
    except Exception as e:
        logging.error(f"Error in _sync_memory_to_pg: {e}")