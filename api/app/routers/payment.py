from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import logging
import datetime

from app.database import get_db
from app.models import User, PaymentOrder
from app.dependencies import get_current_user
from app.services.payment import PaymentFactory

router = APIRouter(prefix="/api/v1/payment", tags=["payment"])
logger = logging.getLogger(__name__)

class CreateSessionRequest(BaseModel):
    provider: str = "stripe"  # stripe, payjs, lemonsqueezy
    plan_id: str  # starter_monthly, pro_monthly
    amount: int  # amount in cents/lowest unit
    currency: str = "USD"
    description: str

@router.post("/create-session")
async def create_session(
    request: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        provider = PaymentFactory.get_provider(request.provider)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error initializing provider: {e}")
        raise HTTPException(status_code=500, detail="Payment provider configuration error")

    # Create order record
    order_id = str(uuid.uuid4())
    payment_order = PaymentOrder(
        id=order_id,
        user_id=current_user.id,
        plan_id=request.plan_id,
        amount=request.amount,
        currency=request.currency,
        provider=request.provider,
        status="pending",
        metadata_={"description": request.description}
    )
    db.add(payment_order)
    db.commit()

    try:
        result = await provider.create_order(
            order_id=order_id,
            amount=request.amount,
            currency=request.currency,
            description=request.description,
            user_email=current_user.email,
            plan_id=request.plan_id,
            user_id=str(current_user.id)
        )
        
        # Update order with provider's ID if available
        if result.get("provider_id"):
            payment_order.provider_order_id = result.get("provider_id")
            db.commit()
            
        return result
    except Exception as e:
        logger.error(f"Payment creation failed: {e}")
        # Mark order as failed
        payment_order.status = "failed"
        payment_order.metadata_ = {"error": str(e)}
        db.commit()
        raise HTTPException(status_code=500, detail=f"Payment creation failed: {str(e)}")

@router.post("/webhook/{provider}")
async def webhook(
    provider: str,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        payment_provider = PaymentFactory.get_provider(provider)
    except ValueError:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Get raw body and headers
    payload = await request.body()
    headers = dict(request.headers)

    # Verify webhook
    event_data = await payment_provider.verify_webhook(payload, headers)
    
    if not event_data:
        raise HTTPException(status_code=400, detail="Invalid signature or payload")
    
    status = event_data.get("status")
    
    if status == "ignored":
        return {"status": "ignored"}
        
    if status == "paid":
        order_id = event_data.get("order_id")
        if not order_id:
            logger.error("Paid event missing order_id")
            return {"status": "error", "message": "Missing order_id"}
            
        # Find order
        # Try to find by ID (if order_id is UUID)
        payment_order = None
        try:
            uuid_obj = uuid.UUID(order_id)
            payment_order = db.query(PaymentOrder).filter(PaymentOrder.id == uuid_obj).first()
        except ValueError:
            # Maybe order_id is stored in provider_order_id or it's a different format
            payment_order = db.query(PaymentOrder).filter(PaymentOrder.provider_order_id == order_id).first()
            
        if not payment_order:
            logger.error(f"Order not found: {order_id}")
            return {"status": "error", "message": "Order not found"}
            
        if payment_order.status == "paid":
            return {"status": "success", "message": "Already processed"}
            
        # Update order status
        payment_order.status = "paid"
        payment_order.updated_at = datetime.datetime.now(datetime.UTC)
        
        # Update raw data in metadata
        meta = payment_order.metadata_ or {}
        meta["webhook_event"] = event_data.get("raw")
        payment_order.metadata_ = meta
        
        db.commit()
        
        # TODO: Provision the plan to the user (update limits, etc.)
        # logic to update user.metadata_['plan'] or similar
        
        logger.info(f"Payment processed successfully for order {order_id}")
        return {"status": "success"}
        
    return {"status": "received"}


from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import logging
import datetime

from app.database import get_db
from app.models import User, PaymentOrder
from app.dependencies import get_current_user
from app.services.payment import PaymentFactory

router = APIRouter(prefix="/api/v1/payment", tags=["payment"])
logger = logging.getLogger(__name__)

class CreateSessionRequest(BaseModel):
    provider: str = "stripe"  # stripe, payjs, lemonsqueezy
    plan_id: str  # starter_monthly, pro_monthly
    amount: int  # amount in cents/lowest unit
    currency: str = "USD"
    description: str

@router.post("/create-session")
async def create_session(
    request: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        provider = PaymentFactory.get_provider(request.provider)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error initializing provider: {e}")
        raise HTTPException(status_code=500, detail="Payment provider configuration error")

    # Create order record
    order_id = str(uuid.uuid4())
    payment_order = PaymentOrder(
        id=order_id,
        user_id=current_user.id,
        plan_id=request.plan_id,
        amount=request.amount,
        currency=request.currency,
        provider=request.provider,
        status="pending",
        metadata_={"description": request.description}
    )
    db.add(payment_order)
    db.commit()

    try:
        result = await provider.create_order(
            order_id=order_id,
            amount=request.amount,
            currency=request.currency,
            description=request.description,
            user_email=current_user.email,
            plan_id=request.plan_id,
            user_id=str(current_user.id)
        )
        
        # Update order with provider's ID if available
        if result.get("provider_id"):
            payment_order.provider_order_id = result.get("provider_id")
            db.commit()
            
        return result
    except Exception as e:
        logger.error(f"Payment creation failed: {e}")
        # Mark order as failed
        payment_order.status = "failed"
        payment_order.metadata_ = {"error": str(e)}
        db.commit()
        raise HTTPException(status_code=500, detail=f"Payment creation failed: {str(e)}")

@router.post("/webhook/{provider}")
async def webhook(
    provider: str,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        payment_provider = PaymentFactory.get_provider(provider)
    except ValueError:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Get raw body and headers
    payload = await request.body()
    headers = dict(request.headers)

    # Verify webhook
    event_data = await payment_provider.verify_webhook(payload, headers)
    
    if not event_data:
        raise HTTPException(status_code=400, detail="Invalid signature or payload")
    
    status = event_data.get("status")
    
    if status == "ignored":
        return {"status": "ignored"}
        
    if status == "paid":
        order_id = event_data.get("order_id")
        if not order_id:
            logger.error("Paid event missing order_id")
            return {"status": "error", "message": "Missing order_id"}
            
        # Find order
        # Try to find by ID (if order_id is UUID)
        payment_order = None
        try:
            uuid_obj = uuid.UUID(order_id)
            payment_order = db.query(PaymentOrder).filter(PaymentOrder.id == uuid_obj).first()
        except ValueError:
            # Maybe order_id is stored in provider_order_id or it's a different format
            payment_order = db.query(PaymentOrder).filter(PaymentOrder.provider_order_id == order_id).first()
            
        if not payment_order:
            logger.error(f"Order not found: {order_id}")
            return {"status": "error", "message": "Order not found"}
            
        if payment_order.status == "paid":
            return {"status": "success", "message": "Already processed"}
            
        # Update order status
        payment_order.status = "paid"
        payment_order.updated_at = datetime.datetime.now(datetime.UTC)
        
        # Update raw data in metadata
        meta = payment_order.metadata_ or {}
        meta["webhook_event"] = event_data.get("raw")
        payment_order.metadata_ = meta
        
        db.commit()
        
        # TODO: Provision the plan to the user (update limits, etc.)
        # logic to update user.metadata_['plan'] or similar
        
        logger.info(f"Payment processed successfully for order {order_id}")
        return {"status": "success"}
        
    return {"status": "received"}

from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import logging
import datetime

from app.database import get_db
from app.models import User, PaymentOrder
from app.dependencies import get_current_user
from app.services.payment import PaymentFactory

router = APIRouter(prefix="/api/v1/payment", tags=["payment"])
logger = logging.getLogger(__name__)

class CreateSessionRequest(BaseModel):
    provider: str = "stripe"  # stripe, payjs, lemonsqueezy
    plan_id: str  # starter_monthly, pro_monthly
    amount: int  # amount in cents/lowest unit
    currency: str = "USD"
    description: str

@router.post("/create-session")
async def create_session(
    request: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        provider = PaymentFactory.get_provider(request.provider)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error initializing provider: {e}")
        raise HTTPException(status_code=500, detail="Payment provider configuration error")

    # Create order record
    order_id = str(uuid.uuid4())
    payment_order = PaymentOrder(
        id=order_id,
        user_id=current_user.id,
        plan_id=request.plan_id,
        amount=request.amount,
        currency=request.currency,
        provider=request.provider,
        status="pending",
        metadata_={"description": request.description}
    )
    db.add(payment_order)
    db.commit()

    try:
        result = await provider.create_order(
            order_id=order_id,
            amount=request.amount,
            currency=request.currency,
            description=request.description,
            user_email=current_user.email,
            plan_id=request.plan_id,
            user_id=str(current_user.id)
        )
        
        # Update order with provider's ID if available
        if result.get("provider_id"):
            payment_order.provider_order_id = result.get("provider_id")
            db.commit()
            
        return result
    except Exception as e:
        logger.error(f"Payment creation failed: {e}")
        # Mark order as failed
        payment_order.status = "failed"
        payment_order.metadata_ = {"error": str(e)}
        db.commit()
        raise HTTPException(status_code=500, detail=f"Payment creation failed: {str(e)}")

@router.post("/webhook/{provider}")
async def webhook(
    provider: str,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        payment_provider = PaymentFactory.get_provider(provider)
    except ValueError:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Get raw body and headers
    payload = await request.body()
    headers = dict(request.headers)

    # Verify webhook
    event_data = await payment_provider.verify_webhook(payload, headers)
    
    if not event_data:
        raise HTTPException(status_code=400, detail="Invalid signature or payload")
    
    status = event_data.get("status")
    
    if status == "ignored":
        return {"status": "ignored"}
        
    if status == "paid":
        order_id = event_data.get("order_id")
        if not order_id:
            logger.error("Paid event missing order_id")
            return {"status": "error", "message": "Missing order_id"}
            
        # Find order
        # Try to find by ID (if order_id is UUID)
        payment_order = None
        try:
            uuid_obj = uuid.UUID(order_id)
            payment_order = db.query(PaymentOrder).filter(PaymentOrder.id == uuid_obj).first()
        except ValueError:
            # Maybe order_id is stored in provider_order_id or it's a different format
            payment_order = db.query(PaymentOrder).filter(PaymentOrder.provider_order_id == order_id).first()
            
        if not payment_order:
            logger.error(f"Order not found: {order_id}")
            return {"status": "error", "message": "Order not found"}
            
        if payment_order.status == "paid":
            return {"status": "success", "message": "Already processed"}
            
        # Update order status
        payment_order.status = "paid"
        payment_order.updated_at = datetime.datetime.now(datetime.UTC)
        
        # Update raw data in metadata
        meta = payment_order.metadata_ or {}
        meta["webhook_event"] = event_data.get("raw")
        payment_order.metadata_ = meta
        
        db.commit()
        
        # TODO: Provision the plan to the user (update limits, etc.)
        # logic to update user.metadata_['plan'] or similar
        
        logger.info(f"Payment processed successfully for order {order_id}")
        return {"status": "success"}
        
    return {"status": "received"}


from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import logging
import datetime

from app.database import get_db
from app.models import User, PaymentOrder
from app.dependencies import get_current_user
from app.services.payment import PaymentFactory

router = APIRouter(prefix="/api/v1/payment", tags=["payment"])
logger = logging.getLogger(__name__)

class CreateSessionRequest(BaseModel):
    provider: str = "stripe"  # stripe, payjs, lemonsqueezy
    plan_id: str  # starter_monthly, pro_monthly
    amount: int  # amount in cents/lowest unit
    currency: str = "USD"
    description: str

@router.post("/create-session")
async def create_session(
    request: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        provider = PaymentFactory.get_provider(request.provider)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error initializing provider: {e}")
        raise HTTPException(status_code=500, detail="Payment provider configuration error")

    # Create order record
    order_id = str(uuid.uuid4())
    payment_order = PaymentOrder(
        id=order_id,
        user_id=current_user.id,
        plan_id=request.plan_id,
        amount=request.amount,
        currency=request.currency,
        provider=request.provider,
        status="pending",
        metadata_={"description": request.description}
    )
    db.add(payment_order)
    db.commit()

    try:
        result = await provider.create_order(
            order_id=order_id,
            amount=request.amount,
            currency=request.currency,
            description=request.description,
            user_email=current_user.email,
            plan_id=request.plan_id,
            user_id=str(current_user.id)
        )
        
        # Update order with provider's ID if available
        if result.get("provider_id"):
            payment_order.provider_order_id = result.get("provider_id")
            db.commit()
            
        return result
    except Exception as e:
        logger.error(f"Payment creation failed: {e}")
        # Mark order as failed
        payment_order.status = "failed"
        payment_order.metadata_ = {"error": str(e)}
        db.commit()
        raise HTTPException(status_code=500, detail=f"Payment creation failed: {str(e)}")

@router.post("/webhook/{provider}")
async def webhook(
    provider: str,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        payment_provider = PaymentFactory.get_provider(provider)
    except ValueError:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Get raw body and headers
    payload = await request.body()
    headers = dict(request.headers)

    # Verify webhook
    event_data = await payment_provider.verify_webhook(payload, headers)
    
    if not event_data:
        raise HTTPException(status_code=400, detail="Invalid signature or payload")
    
    status = event_data.get("status")
    
    if status == "ignored":
        return {"status": "ignored"}
        
    if status == "paid":
        order_id = event_data.get("order_id")
        if not order_id:
            logger.error("Paid event missing order_id")
            return {"status": "error", "message": "Missing order_id"}
            
        # Find order
        # Try to find by ID (if order_id is UUID)
        payment_order = None
        try:
            uuid_obj = uuid.UUID(order_id)
            payment_order = db.query(PaymentOrder).filter(PaymentOrder.id == uuid_obj).first()
        except ValueError:
            # Maybe order_id is stored in provider_order_id or it's a different format
            payment_order = db.query(PaymentOrder).filter(PaymentOrder.provider_order_id == order_id).first()
            
        if not payment_order:
            logger.error(f"Order not found: {order_id}")
            return {"status": "error", "message": "Order not found"}
            
        if payment_order.status == "paid":
            return {"status": "success", "message": "Already processed"}
            
        # Update order status
        payment_order.status = "paid"
        payment_order.updated_at = datetime.datetime.now(datetime.UTC)
        
        # Update raw data in metadata
        meta = payment_order.metadata_ or {}
        meta["webhook_event"] = event_data.get("raw")
        payment_order.metadata_ = meta
        
        db.commit()
        
        # TODO: Provision the plan to the user (update limits, etc.)
        # logic to update user.metadata_['plan'] or similar
        
        logger.info(f"Payment processed successfully for order {order_id}")
        return {"status": "success"}
        
    return {"status": "received"}