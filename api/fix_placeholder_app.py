#!/usr/bin/env python3
"""
修复数据库中占位符应用名称的脚本
"""

import sys
import os

# 添加项目路径
sys.path.insert(0, '/usr/src/openmemory')

from app.database import SessionLocal
from app.models import App, User

def fix_placeholder_apps():
    db = SessionLocal()
    try:
        # 查找名称为占位符的应用
        placeholder_apps = db.query(App).filter(App.name == "${endpointWebSocketUrl}").all()
        print(f"Found {len(placeholder_apps)} apps with placeholder name")
        
        for app in placeholder_apps:
            print(f"Processing app ID: {app.id}")
            print(f"Current app name: {app.name}")
            
            # 查找所有者信息
            owner = db.query(User).filter(User.id == app.owner_id).first()
            if owner:
                print(f"Owner User ID: {owner.user_id}")
                print(f"Owner Name: {owner.name}")
                
                # 如果有设备名称元数据，使用它作为应用名称
                if app.metadata_ and 'device_name' in app.metadata_:
                    new_name = app.metadata_['device_name']
                    print(f"Updating app name to device name: {new_name}")
                    app.name = new_name
                else:
                    # 否则使用所有者名称作为默认名称
                    new_name = f"MoMemory-{owner.user_id}"
                    print(f"Updating app name to default: {new_name}")
                    app.name = new_name
                    
                db.commit()
                print(f"Successfully updated app {app.id} name from '${{endpointWebSocketUrl}}' to '{new_name}'")
            else:
                print(f"Owner not found for app {app.id}")
            print("---")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_placeholder_apps()