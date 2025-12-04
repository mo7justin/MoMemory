import asyncio
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import App

async def check_apps():
    db: Session = SessionLocal()
    try:
        apps = db.query(App).order_by(App.created_at.desc()).all()
        for app in apps:
            print(f"App ID: {app.id}, Name: '{app.name}', Created: {app.created_at}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(check_apps())

from app.database import SessionLocal
from app.models import App

async def check_apps():
    db: Session = SessionLocal()
    try:
        apps = db.query(App).order_by(App.created_at.desc()).all()
        for app in apps:
            print(f"App ID: {app.id}, Name: '{app.name}', Created: {app.created_at}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(check_apps())
from app.database import SessionLocal
from app.models import App

async def check_apps():
    db: Session = SessionLocal()
    try:
        apps = db.query(App).order_by(App.created_at.desc()).all()
        for app in apps:
            print(f"App ID: {app.id}, Name: '{app.name}', Created: {app.created_at}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(check_apps())

from app.database import SessionLocal
from app.models import App

async def check_apps():
    db: Session = SessionLocal()
    try:
        apps = db.query(App).order_by(App.created_at.desc()).all()
        for app in apps:
            print(f"App ID: {app.id}, Name: '{app.name}', Created: {app.created_at}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(check_apps())