import sys
import io
from uuid import UUID

# Setup encoding
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app.database import SessionLocal
from app.models import User, App

def fix_app_name():
    db = SessionLocal()
    try:
        user_id = UUID("d9e018bf-fa9f-4901-aef4-3c9c2d3cb9fe")
        # Find the Cursor app created in the previous step
        # The previous script printed: Created 'Cursor' app: cea0333a-79ed-4a58-ae23-02a3086cfe94
        # But let's query by name/owner just to be safe
        cursor_app = db.query(App).filter(App.owner_id == user_id, App.name == "Cursor").first()
        
        if cursor_app:
            print(f"Found Cursor app: {cursor_app.id}")
            cursor_app.device_name = "Cursor"
            # Add some metadata that might help with icons if the frontend uses it
            if not cursor_app.metadata_:
                cursor_app.metadata_ = {}
            cursor_app.metadata_['icon'] = 'cursor'
            cursor_app.metadata_['type'] = 'ide'
            
            db.commit()
            print("Updated Cursor app device_name to 'Cursor' and metadata.")
        else:
            print("Cursor app not found.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_app_name()


import io
from uuid import UUID

# Setup encoding
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app.database import SessionLocal
from app.models import User, App

def fix_app_name():
    db = SessionLocal()
    try:
        user_id = UUID("d9e018bf-fa9f-4901-aef4-3c9c2d3cb9fe")
        # Find the Cursor app created in the previous step
        # The previous script printed: Created 'Cursor' app: cea0333a-79ed-4a58-ae23-02a3086cfe94
        # But let's query by name/owner just to be safe
        cursor_app = db.query(App).filter(App.owner_id == user_id, App.name == "Cursor").first()
        
        if cursor_app:
            print(f"Found Cursor app: {cursor_app.id}")
            cursor_app.device_name = "Cursor"
            # Add some metadata that might help with icons if the frontend uses it
            if not cursor_app.metadata_:
                cursor_app.metadata_ = {}
            cursor_app.metadata_['icon'] = 'cursor'
            cursor_app.metadata_['type'] = 'ide'
            
            db.commit()
            print("Updated Cursor app device_name to 'Cursor' and metadata.")
        else:
            print("Cursor app not found.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_app_name()

import sys
import io
from uuid import UUID

# Setup encoding
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app.database import SessionLocal
from app.models import User, App

def fix_app_name():
    db = SessionLocal()
    try:
        user_id = UUID("d9e018bf-fa9f-4901-aef4-3c9c2d3cb9fe")
        # Find the Cursor app created in the previous step
        # The previous script printed: Created 'Cursor' app: cea0333a-79ed-4a58-ae23-02a3086cfe94
        # But let's query by name/owner just to be safe
        cursor_app = db.query(App).filter(App.owner_id == user_id, App.name == "Cursor").first()
        
        if cursor_app:
            print(f"Found Cursor app: {cursor_app.id}")
            cursor_app.device_name = "Cursor"
            # Add some metadata that might help with icons if the frontend uses it
            if not cursor_app.metadata_:
                cursor_app.metadata_ = {}
            cursor_app.metadata_['icon'] = 'cursor'
            cursor_app.metadata_['type'] = 'ide'
            
            db.commit()
            print("Updated Cursor app device_name to 'Cursor' and metadata.")
        else:
            print("Cursor app not found.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_app_name()


import io
from uuid import UUID

# Setup encoding
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app.database import SessionLocal
from app.models import User, App

def fix_app_name():
    db = SessionLocal()
    try:
        user_id = UUID("d9e018bf-fa9f-4901-aef4-3c9c2d3cb9fe")
        # Find the Cursor app created in the previous step
        # The previous script printed: Created 'Cursor' app: cea0333a-79ed-4a58-ae23-02a3086cfe94
        # But let's query by name/owner just to be safe
        cursor_app = db.query(App).filter(App.owner_id == user_id, App.name == "Cursor").first()
        
        if cursor_app:
            print(f"Found Cursor app: {cursor_app.id}")
            cursor_app.device_name = "Cursor"
            # Add some metadata that might help with icons if the frontend uses it
            if not cursor_app.metadata_:
                cursor_app.metadata_ = {}
            cursor_app.metadata_['icon'] = 'cursor'
            cursor_app.metadata_['type'] = 'ide'
            
            db.commit()
            print("Updated Cursor app device_name to 'Cursor' and metadata.")
        else:
            print("Cursor app not found.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_app_name()

