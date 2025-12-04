import os
import sys
import hashlib
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the parent directory to sys.path to import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Database connection string
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/openmemory_db")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def update_user():
    try:
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()

        # Check if user exists
        user_id = 'test_user_001'
        
        check_sql = text("SELECT id, email FROM users WHERE user_id = :user_id")
        result = db.execute(check_sql, {"user_id": user_id}).fetchone()

        if not result:
            print(f"User {user_id} not found.")
            return

        new_email = 'test@Momemory.com'
        new_password = '123456'
        password_hash = hash_password(new_password)

        # Use jsonb casting for COALESCE if needed, or just simple update if we assume it's jsonb.
        # The error "COALESCE could not convert type jsonb to json" suggests column type mismatch.
        # It's likely `metadata` is JSON type, not JSONB, or vice versa.
        # Let's try casting metadata to jsonb explicitly if it's json, or just replacing the whole object if simpler.
        
        # Simpler approach: Fetch, Update in Python, Save back.
        # This avoids SQL type casting headaches.
        
        select_meta_sql = text("SELECT metadata FROM users WHERE user_id = :user_id")
        meta_result = db.execute(select_meta_sql, {"user_id": user_id}).fetchone()
        
        current_meta = meta_result[0] if meta_result and meta_result[0] else {}
        if isinstance(current_meta, str):
            import json
            current_meta = json.loads(current_meta)
            
        current_meta['password_hash'] = password_hash
        current_meta['login_type'] = 'email' # Ensure login type is email
        
        import json
        new_meta_json = json.dumps(current_meta)
        
        update_sql = text("""
            UPDATE users 
            SET email = :email, 
                metadata = :metadata
            WHERE user_id = :user_id
        """)
        
        db.execute(update_sql, {
            "email": new_email,
            "metadata": new_meta_json,
            "user_id": user_id
        })
        
        db.commit()
        print(f"Successfully updated user {user_id}:")
        print(f"Email: {new_email}")
        print(f"Password: {new_password}")

    except Exception as e:
        print(f"Error updating user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    update_user()

import hashlib
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the parent directory to sys.path to import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Database connection string
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/openmemory_db")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def update_user():
    try:
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()

        # Check if user exists
        user_id = 'test_user_001'
        
        check_sql = text("SELECT id, email FROM users WHERE user_id = :user_id")
        result = db.execute(check_sql, {"user_id": user_id}).fetchone()

        if not result:
            print(f"User {user_id} not found.")
            return

        new_email = 'test@Momemory.com'
        new_password = '123456'
        password_hash = hash_password(new_password)

        # Use jsonb casting for COALESCE if needed, or just simple update if we assume it's jsonb.
        # The error "COALESCE could not convert type jsonb to json" suggests column type mismatch.
        # It's likely `metadata` is JSON type, not JSONB, or vice versa.
        # Let's try casting metadata to jsonb explicitly if it's json, or just replacing the whole object if simpler.
        
        # Simpler approach: Fetch, Update in Python, Save back.
        # This avoids SQL type casting headaches.
        
        select_meta_sql = text("SELECT metadata FROM users WHERE user_id = :user_id")
        meta_result = db.execute(select_meta_sql, {"user_id": user_id}).fetchone()
        
        current_meta = meta_result[0] if meta_result and meta_result[0] else {}
        if isinstance(current_meta, str):
            import json
            current_meta = json.loads(current_meta)
            
        current_meta['password_hash'] = password_hash
        current_meta['login_type'] = 'email' # Ensure login type is email
        
        import json
        new_meta_json = json.dumps(current_meta)
        
        update_sql = text("""
            UPDATE users 
            SET email = :email, 
                metadata = :metadata
            WHERE user_id = :user_id
        """)
        
        db.execute(update_sql, {
            "email": new_email,
            "metadata": new_meta_json,
            "user_id": user_id
        })
        
        db.commit()
        print(f"Successfully updated user {user_id}:")
        print(f"Email: {new_email}")
        print(f"Password: {new_password}")

    except Exception as e:
        print(f"Error updating user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    update_user()