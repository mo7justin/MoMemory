from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import os
import stripe
import hmac
import hashlib
import json
import httpx

class PaymentProvider(ABC):
    @abstractmethod
    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        """
        Create a payment order/session with the provider.
        Returns a dict containing 'payment_url' or needed info.
        """
        pass

    @abstractmethod
    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """
        Verify webhook signature and return parsed event data if valid.
        Returns None if invalid.
        """
        pass

class StripeProvider(PaymentProvider):
    def __init__(self):
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not stripe.api_key:
            raise Exception("Stripe API key not configured")
            
        try:
            # Stripe expects amount in cents
            session = stripe.checkout.Session.create(
                payment_method_types=['card', 'alipay', 'wechat_pay'],
                line_items=[{
                    'price_data': {
                        'currency': currency.lower(),
                        'product_data': {
                            'name': description,
                        },
                        'unit_amount': amount,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success&order_id=' + order_id,
                cancel_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=cancelled',
                client_reference_id=order_id,
                customer_email=user_email,
                metadata={
                    "user_id": user_id,
                    "plan_id": plan_id
                }
            )
            return {"payment_url": session.url, "provider_id": session.id}
        except Exception as e:
            print(f"Stripe error: {e}")
            raise e

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        sig_header = headers.get('Stripe-Signature') or headers.get('stripe-signature')
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
            
            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                return {
                    "order_id": session.get('client_reference_id'),
                    "status": "paid",
                    "provider_id": session.get('id'),
                    "raw": event,
                    "metadata": session.get('metadata', {})
                }
            return {"status": "ignored", "type": event['type']}
        except ValueError as e:
            return None
        except stripe.error.SignatureVerificationError as e:
            return None

class LemonSqueezyProvider(PaymentProvider):
    def __init__(self):
        self.api_key = os.getenv("LEMONSQUEEZY_API_KEY")
        self.store_id = os.getenv("LEMONSQUEEZY_STORE_ID")
        self.webhook_secret = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET")
        self.variant_map = {
            "starter": os.getenv("LEMONSQUEEZY_VARIANT_ID_STARTER"),
            "pro": os.getenv("LEMONSQUEEZY_VARIANT_ID_PRO")
        }

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.api_key or not self.store_id:
            raise Exception("Lemon Squeezy API key or Store ID not configured")
            
        # Map internal plan_id to Lemon Squeezy Variant ID
        # plan_id format expected: "starter_monthly" or "pro_monthly" -> we simplify to check if it contains starter/pro
        variant_id = None
        if plan_id:
            if "starter" in plan_id.lower():
                variant_id = self.variant_map.get("starter")
            elif "pro" in plan_id.lower():
                variant_id = self.variant_map.get("pro")
        
        if not variant_id:
            raise Exception(f"Could not find Lemon Squeezy Variant ID for plan: {plan_id}")

        url = "https://api.lemonsqueezy.com/v1/checkouts"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json"
        }
        
        payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "checkout_data": {
                        "custom": {
                            "user_id": str(user_id),
                            "plan_id": str(plan_id),
                            "order_id": str(order_id)
                        },
                        "email": user_email
                    },
                    "product_options": {
                        "redirect_url": os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success'
                    }
                },
                "relationships": {
                    "store": {
                        "data": {
                            "type": "stores",
                            "id": str(self.store_id)
                        }
                    },
                    "variant": {
                        "data": {
                            "type": "variants",
                            "id": str(variant_id)
                        }
                    }
                }
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 201:
                print(f"LemonSqueezy Error: {response.text}")
                raise Exception(f"Failed to create checkout: {response.text}")
            
            data = response.json()
            checkout_url = data['data']['attributes']['url']
            
            return {"payment_url": checkout_url, "provider_id": data['data']['id']}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        signature = headers.get("X-Signature") or headers.get("x-signature")
        if not signature or not self.webhook_secret:
            print("Missing signature or secret")
            return None

        # Verify signature
        digest = hmac.new(
            self.webhook_secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(digest, signature):
            print(f"Signature mismatch: expected {digest}, got {signature}")
            return None

        try:
            data = json.loads(payload)
            event_name = data.get('meta', {}).get('event_name')
            
            # Focus on order creation or subscription creation
            if event_name in ['order_created', 'subscription_created', 'subscription_payment_success']:
                attributes = data['data']['attributes']
                custom_data = data['meta']['custom_data'] # Lemon Squeezy passes custom data in meta
                
                # Fallback to attributes if meta is empty (depends on API version)
                if not custom_data:
                     custom_data = attributes.get('checkout_data', {}).get('custom', {})

                return {
                    "order_id": custom_data.get('order_id'), # Our internal order ID
                    "user_id": custom_data.get('user_id'),
                    "plan_id": custom_data.get('plan_id'),
                    "status": "paid",
                    "provider_id": data['data']['id'],
                    "raw": data,
                    "metadata": custom_data
                }
            
            return {"status": "ignored", "type": event_name}
        except Exception as e:
            print(f"Webhook parsing error: {e}")
            return None

class PayJSProvider(PaymentProvider):
    """
    Implementation for PayJS (WeChat Pay for individuals).
    Uses direct HTTP requests usually.
    """
    def __init__(self):
        self.mchid = os.getenv("PAYJS_MCHID")
        self.key = os.getenv("PAYJS_KEY")
        self.api_url = "https://payjs.cn/api/cashier"

    def _sign(self, data: Dict[str, Any]) -> str:
        # PayJS signature algorithm (sort keys, append key, md5)
        import hashlib
        keys = sorted([k for k in data.keys() if data[k]]) # filter empty values
        sign_str = "&".join([f"{k}={data[k]}" for k in keys])
        sign_str += f"&key={self.key}"
        return hashlib.md5(sign_str.encode('utf-8')).hexdigest().upper()

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.mchid:
            raise Exception("PayJS not configured")
        
        # PayJS amount is in 'fen' (cents), same as our internal
        data = {
            "mchid": self.mchid,
            "total_fee": str(amount),
            "out_trade_no": order_id,
            "body": description,
            # "notify_url": os.getenv("API_URL") + "/api/v1/payment/webhook/payjs" 
            # Need to ensure this URL is publicly accessible
        }
        data["sign"] = self._sign(data)
        
        # Construct URL manually for cashier mode
        import urllib.parse
        params = urllib.parse.urlencode(data)
        payment_url = f"{self.api_url}?{params}"
        
        return {"payment_url": payment_url, "provider_id": None}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        # PayJS sends form data in POST
        # payload bytes need to be parsed as form data
        from urllib.parse import parse_qs
        try:
            decoded = parse_qs(payload.decode('utf-8'))
            data = {k: v[0] for k, v in decoded.items()}
            
            received_sign = data.get("sign")
            if not received_sign:
                return None
                
            # Verify signature
            data_to_sign = {k: v for k, v in data.items() if k != "sign"}
            if self._sign(data_to_sign) == received_sign:
                if data.get("return_code") == "1":
                    return {
                        "order_id": data.get("out_trade_no"),
                        "status": "paid",
                        "provider_id": data.get("payjs_order_id"),
                        "raw": data
                    }
            return None
        except Exception:
            return None

class PaymentFactory:
    @staticmethod
    def get_provider(provider_name: str) -> PaymentProvider:
        if provider_name == "stripe":
            return StripeProvider()
        elif provider_name == "payjs":
            return PayJSProvider()
        elif provider_name == "lemonsqueezy":
            return LemonSqueezyProvider()
        else:
            raise ValueError(f"Unknown payment provider: {provider_name}")

import os
import stripe
import hmac
import hashlib
import json
import httpx

class PaymentProvider(ABC):
    @abstractmethod
    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        """
        Create a payment order/session with the provider.
        Returns a dict containing 'payment_url' or needed info.
        """
        pass

    @abstractmethod
    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """
        Verify webhook signature and return parsed event data if valid.
        Returns None if invalid.
        """
        pass

class StripeProvider(PaymentProvider):
    def __init__(self):
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not stripe.api_key:
            raise Exception("Stripe API key not configured")
            
        try:
            # Stripe expects amount in cents
            session = stripe.checkout.Session.create(
                payment_method_types=['card', 'alipay', 'wechat_pay'],
                line_items=[{
                    'price_data': {
                        'currency': currency.lower(),
                        'product_data': {
                            'name': description,
                        },
                        'unit_amount': amount,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success&order_id=' + order_id,
                cancel_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=cancelled',
                client_reference_id=order_id,
                customer_email=user_email,
                metadata={
                    "user_id": user_id,
                    "plan_id": plan_id
                }
            )
            return {"payment_url": session.url, "provider_id": session.id}
        except Exception as e:
            print(f"Stripe error: {e}")
            raise e

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        sig_header = headers.get('Stripe-Signature') or headers.get('stripe-signature')
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
            
            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                return {
                    "order_id": session.get('client_reference_id'),
                    "status": "paid",
                    "provider_id": session.get('id'),
                    "raw": event,
                    "metadata": session.get('metadata', {})
                }
            return {"status": "ignored", "type": event['type']}
        except ValueError as e:
            return None
        except stripe.error.SignatureVerificationError as e:
            return None

class LemonSqueezyProvider(PaymentProvider):
    def __init__(self):
        self.api_key = os.getenv("LEMONSQUEEZY_API_KEY")
        self.store_id = os.getenv("LEMONSQUEEZY_STORE_ID")
        self.webhook_secret = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET")
        self.variant_map = {
            "starter": os.getenv("LEMONSQUEEZY_VARIANT_ID_STARTER"),
            "pro": os.getenv("LEMONSQUEEZY_VARIANT_ID_PRO")
        }

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.api_key or not self.store_id:
            raise Exception("Lemon Squeezy API key or Store ID not configured")
            
        # Map internal plan_id to Lemon Squeezy Variant ID
        # plan_id format expected: "starter_monthly" or "pro_monthly" -> we simplify to check if it contains starter/pro
        variant_id = None
        if plan_id:
            if "starter" in plan_id.lower():
                variant_id = self.variant_map.get("starter")
            elif "pro" in plan_id.lower():
                variant_id = self.variant_map.get("pro")
        
        if not variant_id:
            raise Exception(f"Could not find Lemon Squeezy Variant ID for plan: {plan_id}")

        url = "https://api.lemonsqueezy.com/v1/checkouts"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json"
        }
        
        payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "checkout_data": {
                        "custom": {
                            "user_id": str(user_id),
                            "plan_id": str(plan_id),
                            "order_id": str(order_id)
                        },
                        "email": user_email
                    },
                    "product_options": {
                        "redirect_url": os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success'
                    }
                },
                "relationships": {
                    "store": {
                        "data": {
                            "type": "stores",
                            "id": str(self.store_id)
                        }
                    },
                    "variant": {
                        "data": {
                            "type": "variants",
                            "id": str(variant_id)
                        }
                    }
                }
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 201:
                print(f"LemonSqueezy Error: {response.text}")
                raise Exception(f"Failed to create checkout: {response.text}")
            
            data = response.json()
            checkout_url = data['data']['attributes']['url']
            
            return {"payment_url": checkout_url, "provider_id": data['data']['id']}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        signature = headers.get("X-Signature") or headers.get("x-signature")
        if not signature or not self.webhook_secret:
            print("Missing signature or secret")
            return None

        # Verify signature
        digest = hmac.new(
            self.webhook_secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(digest, signature):
            print(f"Signature mismatch: expected {digest}, got {signature}")
            return None

        try:
            data = json.loads(payload)
            event_name = data.get('meta', {}).get('event_name')
            
            # Focus on order creation or subscription creation
            if event_name in ['order_created', 'subscription_created', 'subscription_payment_success']:
                attributes = data['data']['attributes']
                custom_data = data['meta']['custom_data'] # Lemon Squeezy passes custom data in meta
                
                # Fallback to attributes if meta is empty (depends on API version)
                if not custom_data:
                     custom_data = attributes.get('checkout_data', {}).get('custom', {})

                return {
                    "order_id": custom_data.get('order_id'), # Our internal order ID
                    "user_id": custom_data.get('user_id'),
                    "plan_id": custom_data.get('plan_id'),
                    "status": "paid",
                    "provider_id": data['data']['id'],
                    "raw": data,
                    "metadata": custom_data
                }
            
            return {"status": "ignored", "type": event_name}
        except Exception as e:
            print(f"Webhook parsing error: {e}")
            return None

class PayJSProvider(PaymentProvider):
    """
    Implementation for PayJS (WeChat Pay for individuals).
    Uses direct HTTP requests usually.
    """
    def __init__(self):
        self.mchid = os.getenv("PAYJS_MCHID")
        self.key = os.getenv("PAYJS_KEY")
        self.api_url = "https://payjs.cn/api/cashier"

    def _sign(self, data: Dict[str, Any]) -> str:
        # PayJS signature algorithm (sort keys, append key, md5)
        import hashlib
        keys = sorted([k for k in data.keys() if data[k]]) # filter empty values
        sign_str = "&".join([f"{k}={data[k]}" for k in keys])
        sign_str += f"&key={self.key}"
        return hashlib.md5(sign_str.encode('utf-8')).hexdigest().upper()

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.mchid:
            raise Exception("PayJS not configured")
        
        # PayJS amount is in 'fen' (cents), same as our internal
        data = {
            "mchid": self.mchid,
            "total_fee": str(amount),
            "out_trade_no": order_id,
            "body": description,
            # "notify_url": os.getenv("API_URL") + "/api/v1/payment/webhook/payjs" 
            # Need to ensure this URL is publicly accessible
        }
        data["sign"] = self._sign(data)
        
        # Construct URL manually for cashier mode
        import urllib.parse
        params = urllib.parse.urlencode(data)
        payment_url = f"{self.api_url}?{params}"
        
        return {"payment_url": payment_url, "provider_id": None}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        # PayJS sends form data in POST
        # payload bytes need to be parsed as form data
        from urllib.parse import parse_qs
        try:
            decoded = parse_qs(payload.decode('utf-8'))
            data = {k: v[0] for k, v in decoded.items()}
            
            received_sign = data.get("sign")
            if not received_sign:
                return None
                
            # Verify signature
            data_to_sign = {k: v for k, v in data.items() if k != "sign"}
            if self._sign(data_to_sign) == received_sign:
                if data.get("return_code") == "1":
                    return {
                        "order_id": data.get("out_trade_no"),
                        "status": "paid",
                        "provider_id": data.get("payjs_order_id"),
                        "raw": data
                    }
            return None
        except Exception:
            return None

class PaymentFactory:
    @staticmethod
    def get_provider(provider_name: str) -> PaymentProvider:
        if provider_name == "stripe":
            return StripeProvider()
        elif provider_name == "payjs":
            return PayJSProvider()
        elif provider_name == "lemonsqueezy":
            return LemonSqueezyProvider()
        else:
            raise ValueError(f"Unknown payment provider: {provider_name}")
import os
import stripe
import hmac
import hashlib
import json
import httpx

class PaymentProvider(ABC):
    @abstractmethod
    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        """
        Create a payment order/session with the provider.
        Returns a dict containing 'payment_url' or needed info.
        """
        pass

    @abstractmethod
    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """
        Verify webhook signature and return parsed event data if valid.
        Returns None if invalid.
        """
        pass

class StripeProvider(PaymentProvider):
    def __init__(self):
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not stripe.api_key:
            raise Exception("Stripe API key not configured")
            
        try:
            # Stripe expects amount in cents
            session = stripe.checkout.Session.create(
                payment_method_types=['card', 'alipay', 'wechat_pay'],
                line_items=[{
                    'price_data': {
                        'currency': currency.lower(),
                        'product_data': {
                            'name': description,
                        },
                        'unit_amount': amount,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success&order_id=' + order_id,
                cancel_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=cancelled',
                client_reference_id=order_id,
                customer_email=user_email,
                metadata={
                    "user_id": user_id,
                    "plan_id": plan_id
                }
            )
            return {"payment_url": session.url, "provider_id": session.id}
        except Exception as e:
            print(f"Stripe error: {e}")
            raise e

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        sig_header = headers.get('Stripe-Signature') or headers.get('stripe-signature')
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
            
            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                return {
                    "order_id": session.get('client_reference_id'),
                    "status": "paid",
                    "provider_id": session.get('id'),
                    "raw": event,
                    "metadata": session.get('metadata', {})
                }
            return {"status": "ignored", "type": event['type']}
        except ValueError as e:
            return None
        except stripe.error.SignatureVerificationError as e:
            return None

class LemonSqueezyProvider(PaymentProvider):
    def __init__(self):
        self.api_key = os.getenv("LEMONSQUEEZY_API_KEY")
        self.store_id = os.getenv("LEMONSQUEEZY_STORE_ID")
        self.webhook_secret = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET")
        self.variant_map = {
            "starter": os.getenv("LEMONSQUEEZY_VARIANT_ID_STARTER"),
            "pro": os.getenv("LEMONSQUEEZY_VARIANT_ID_PRO")
        }

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.api_key or not self.store_id:
            raise Exception("Lemon Squeezy API key or Store ID not configured")
            
        # Map internal plan_id to Lemon Squeezy Variant ID
        # plan_id format expected: "starter_monthly" or "pro_monthly" -> we simplify to check if it contains starter/pro
        variant_id = None
        if plan_id:
            if "starter" in plan_id.lower():
                variant_id = self.variant_map.get("starter")
            elif "pro" in plan_id.lower():
                variant_id = self.variant_map.get("pro")
        
        if not variant_id:
            raise Exception(f"Could not find Lemon Squeezy Variant ID for plan: {plan_id}")

        url = "https://api.lemonsqueezy.com/v1/checkouts"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json"
        }
        
        payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "checkout_data": {
                        "custom": {
                            "user_id": str(user_id),
                            "plan_id": str(plan_id),
                            "order_id": str(order_id)
                        },
                        "email": user_email
                    },
                    "product_options": {
                        "redirect_url": os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success'
                    }
                },
                "relationships": {
                    "store": {
                        "data": {
                            "type": "stores",
                            "id": str(self.store_id)
                        }
                    },
                    "variant": {
                        "data": {
                            "type": "variants",
                            "id": str(variant_id)
                        }
                    }
                }
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 201:
                print(f"LemonSqueezy Error: {response.text}")
                raise Exception(f"Failed to create checkout: {response.text}")
            
            data = response.json()
            checkout_url = data['data']['attributes']['url']
            
            return {"payment_url": checkout_url, "provider_id": data['data']['id']}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        signature = headers.get("X-Signature") or headers.get("x-signature")
        if not signature or not self.webhook_secret:
            print("Missing signature or secret")
            return None

        # Verify signature
        digest = hmac.new(
            self.webhook_secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(digest, signature):
            print(f"Signature mismatch: expected {digest}, got {signature}")
            return None

        try:
            data = json.loads(payload)
            event_name = data.get('meta', {}).get('event_name')
            
            # Focus on order creation or subscription creation
            if event_name in ['order_created', 'subscription_created', 'subscription_payment_success']:
                attributes = data['data']['attributes']
                custom_data = data['meta']['custom_data'] # Lemon Squeezy passes custom data in meta
                
                # Fallback to attributes if meta is empty (depends on API version)
                if not custom_data:
                     custom_data = attributes.get('checkout_data', {}).get('custom', {})

                return {
                    "order_id": custom_data.get('order_id'), # Our internal order ID
                    "user_id": custom_data.get('user_id'),
                    "plan_id": custom_data.get('plan_id'),
                    "status": "paid",
                    "provider_id": data['data']['id'],
                    "raw": data,
                    "metadata": custom_data
                }
            
            return {"status": "ignored", "type": event_name}
        except Exception as e:
            print(f"Webhook parsing error: {e}")
            return None

class PayJSProvider(PaymentProvider):
    """
    Implementation for PayJS (WeChat Pay for individuals).
    Uses direct HTTP requests usually.
    """
    def __init__(self):
        self.mchid = os.getenv("PAYJS_MCHID")
        self.key = os.getenv("PAYJS_KEY")
        self.api_url = "https://payjs.cn/api/cashier"

    def _sign(self, data: Dict[str, Any]) -> str:
        # PayJS signature algorithm (sort keys, append key, md5)
        import hashlib
        keys = sorted([k for k in data.keys() if data[k]]) # filter empty values
        sign_str = "&".join([f"{k}={data[k]}" for k in keys])
        sign_str += f"&key={self.key}"
        return hashlib.md5(sign_str.encode('utf-8')).hexdigest().upper()

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.mchid:
            raise Exception("PayJS not configured")
        
        # PayJS amount is in 'fen' (cents), same as our internal
        data = {
            "mchid": self.mchid,
            "total_fee": str(amount),
            "out_trade_no": order_id,
            "body": description,
            # "notify_url": os.getenv("API_URL") + "/api/v1/payment/webhook/payjs" 
            # Need to ensure this URL is publicly accessible
        }
        data["sign"] = self._sign(data)
        
        # Construct URL manually for cashier mode
        import urllib.parse
        params = urllib.parse.urlencode(data)
        payment_url = f"{self.api_url}?{params}"
        
        return {"payment_url": payment_url, "provider_id": None}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        # PayJS sends form data in POST
        # payload bytes need to be parsed as form data
        from urllib.parse import parse_qs
        try:
            decoded = parse_qs(payload.decode('utf-8'))
            data = {k: v[0] for k, v in decoded.items()}
            
            received_sign = data.get("sign")
            if not received_sign:
                return None
                
            # Verify signature
            data_to_sign = {k: v for k, v in data.items() if k != "sign"}
            if self._sign(data_to_sign) == received_sign:
                if data.get("return_code") == "1":
                    return {
                        "order_id": data.get("out_trade_no"),
                        "status": "paid",
                        "provider_id": data.get("payjs_order_id"),
                        "raw": data
                    }
            return None
        except Exception:
            return None

class PaymentFactory:
    @staticmethod
    def get_provider(provider_name: str) -> PaymentProvider:
        if provider_name == "stripe":
            return StripeProvider()
        elif provider_name == "payjs":
            return PayJSProvider()
        elif provider_name == "lemonsqueezy":
            return LemonSqueezyProvider()
        else:
            raise ValueError(f"Unknown payment provider: {provider_name}")

import os
import stripe
import hmac
import hashlib
import json
import httpx

class PaymentProvider(ABC):
    @abstractmethod
    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        """
        Create a payment order/session with the provider.
        Returns a dict containing 'payment_url' or needed info.
        """
        pass

    @abstractmethod
    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """
        Verify webhook signature and return parsed event data if valid.
        Returns None if invalid.
        """
        pass

class StripeProvider(PaymentProvider):
    def __init__(self):
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not stripe.api_key:
            raise Exception("Stripe API key not configured")
            
        try:
            # Stripe expects amount in cents
            session = stripe.checkout.Session.create(
                payment_method_types=['card', 'alipay', 'wechat_pay'],
                line_items=[{
                    'price_data': {
                        'currency': currency.lower(),
                        'product_data': {
                            'name': description,
                        },
                        'unit_amount': amount,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success&order_id=' + order_id,
                cancel_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=cancelled',
                client_reference_id=order_id,
                customer_email=user_email,
                metadata={
                    "user_id": user_id,
                    "plan_id": plan_id
                }
            )
            return {"payment_url": session.url, "provider_id": session.id}
        except Exception as e:
            print(f"Stripe error: {e}")
            raise e

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        sig_header = headers.get('Stripe-Signature') or headers.get('stripe-signature')
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
            
            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                return {
                    "order_id": session.get('client_reference_id'),
                    "status": "paid",
                    "provider_id": session.get('id'),
                    "raw": event,
                    "metadata": session.get('metadata', {})
                }
            return {"status": "ignored", "type": event['type']}
        except ValueError as e:
            return None
        except stripe.error.SignatureVerificationError as e:
            return None

class LemonSqueezyProvider(PaymentProvider):
    def __init__(self):
        self.api_key = os.getenv("LEMONSQUEEZY_API_KEY")
        self.store_id = os.getenv("LEMONSQUEEZY_STORE_ID")
        self.webhook_secret = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET")
        self.variant_map = {
            "starter": os.getenv("LEMONSQUEEZY_VARIANT_ID_STARTER"),
            "pro": os.getenv("LEMONSQUEEZY_VARIANT_ID_PRO")
        }

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.api_key or not self.store_id:
            raise Exception("Lemon Squeezy API key or Store ID not configured")
            
        # Map internal plan_id to Lemon Squeezy Variant ID
        # plan_id format expected: "starter_monthly" or "pro_monthly" -> we simplify to check if it contains starter/pro
        variant_id = None
        if plan_id:
            if "starter" in plan_id.lower():
                variant_id = self.variant_map.get("starter")
            elif "pro" in plan_id.lower():
                variant_id = self.variant_map.get("pro")
        
        if not variant_id:
            raise Exception(f"Could not find Lemon Squeezy Variant ID for plan: {plan_id}")

        url = "https://api.lemonsqueezy.com/v1/checkouts"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json"
        }
        
        payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "checkout_data": {
                        "custom": {
                            "user_id": str(user_id),
                            "plan_id": str(plan_id),
                            "order_id": str(order_id)
                        },
                        "email": user_email
                    },
                    "product_options": {
                        "redirect_url": os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success'
                    }
                },
                "relationships": {
                    "store": {
                        "data": {
                            "type": "stores",
                            "id": str(self.store_id)
                        }
                    },
                    "variant": {
                        "data": {
                            "type": "variants",
                            "id": str(variant_id)
                        }
                    }
                }
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 201:
                print(f"LemonSqueezy Error: {response.text}")
                raise Exception(f"Failed to create checkout: {response.text}")
            
            data = response.json()
            checkout_url = data['data']['attributes']['url']
            
            return {"payment_url": checkout_url, "provider_id": data['data']['id']}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        signature = headers.get("X-Signature") or headers.get("x-signature")
        if not signature or not self.webhook_secret:
            print("Missing signature or secret")
            return None

        # Verify signature
        digest = hmac.new(
            self.webhook_secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(digest, signature):
            print(f"Signature mismatch: expected {digest}, got {signature}")
            return None

        try:
            data = json.loads(payload)
            event_name = data.get('meta', {}).get('event_name')
            
            # Focus on order creation or subscription creation
            if event_name in ['order_created', 'subscription_created', 'subscription_payment_success']:
                attributes = data['data']['attributes']
                custom_data = data['meta']['custom_data'] # Lemon Squeezy passes custom data in meta
                
                # Fallback to attributes if meta is empty (depends on API version)
                if not custom_data:
                     custom_data = attributes.get('checkout_data', {}).get('custom', {})

                return {
                    "order_id": custom_data.get('order_id'), # Our internal order ID
                    "user_id": custom_data.get('user_id'),
                    "plan_id": custom_data.get('plan_id'),
                    "status": "paid",
                    "provider_id": data['data']['id'],
                    "raw": data,
                    "metadata": custom_data
                }
            
            return {"status": "ignored", "type": event_name}
        except Exception as e:
            print(f"Webhook parsing error: {e}")
            return None

class PayJSProvider(PaymentProvider):
    """
    Implementation for PayJS (WeChat Pay for individuals).
    Uses direct HTTP requests usually.
    """
    def __init__(self):
        self.mchid = os.getenv("PAYJS_MCHID")
        self.key = os.getenv("PAYJS_KEY")
        self.api_url = "https://payjs.cn/api/cashier"

    def _sign(self, data: Dict[str, Any]) -> str:
        # PayJS signature algorithm (sort keys, append key, md5)
        import hashlib
        keys = sorted([k for k in data.keys() if data[k]]) # filter empty values
        sign_str = "&".join([f"{k}={data[k]}" for k in keys])
        sign_str += f"&key={self.key}"
        return hashlib.md5(sign_str.encode('utf-8')).hexdigest().upper()

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.mchid:
            raise Exception("PayJS not configured")
        
        # PayJS amount is in 'fen' (cents), same as our internal
        data = {
            "mchid": self.mchid,
            "total_fee": str(amount),
            "out_trade_no": order_id,
            "body": description,
            # "notify_url": os.getenv("API_URL") + "/api/v1/payment/webhook/payjs" 
            # Need to ensure this URL is publicly accessible
        }
        data["sign"] = self._sign(data)
        
        # Construct URL manually for cashier mode
        import urllib.parse
        params = urllib.parse.urlencode(data)
        payment_url = f"{self.api_url}?{params}"
        
        return {"payment_url": payment_url, "provider_id": None}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        # PayJS sends form data in POST
        # payload bytes need to be parsed as form data
        from urllib.parse import parse_qs
        try:
            decoded = parse_qs(payload.decode('utf-8'))
            data = {k: v[0] for k, v in decoded.items()}
            
            received_sign = data.get("sign")
            if not received_sign:
                return None
                
            # Verify signature
            data_to_sign = {k: v for k, v in data.items() if k != "sign"}
            if self._sign(data_to_sign) == received_sign:
                if data.get("return_code") == "1":
                    return {
                        "order_id": data.get("out_trade_no"),
                        "status": "paid",
                        "provider_id": data.get("payjs_order_id"),
                        "raw": data
                    }
            return None
        except Exception:
            return None

class PaymentFactory:
    @staticmethod
    def get_provider(provider_name: str) -> PaymentProvider:
        if provider_name == "stripe":
            return StripeProvider()
        elif provider_name == "payjs":
            return PayJSProvider()
        elif provider_name == "lemonsqueezy":
            return LemonSqueezyProvider()
        else:
            raise ValueError(f"Unknown payment provider: {provider_name}")
import os
import stripe
import hmac
import hashlib
import json
import httpx

class PaymentProvider(ABC):
    @abstractmethod
    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        """
        Create a payment order/session with the provider.
        Returns a dict containing 'payment_url' or needed info.
        """
        pass

    @abstractmethod
    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """
        Verify webhook signature and return parsed event data if valid.
        Returns None if invalid.
        """
        pass

class StripeProvider(PaymentProvider):
    def __init__(self):
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not stripe.api_key:
            raise Exception("Stripe API key not configured")
            
        try:
            # Stripe expects amount in cents
            session = stripe.checkout.Session.create(
                payment_method_types=['card', 'alipay', 'wechat_pay'],
                line_items=[{
                    'price_data': {
                        'currency': currency.lower(),
                        'product_data': {
                            'name': description,
                        },
                        'unit_amount': amount,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success&order_id=' + order_id,
                cancel_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=cancelled',
                client_reference_id=order_id,
                customer_email=user_email,
                metadata={
                    "user_id": user_id,
                    "plan_id": plan_id
                }
            )
            return {"payment_url": session.url, "provider_id": session.id}
        except Exception as e:
            print(f"Stripe error: {e}")
            raise e

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        sig_header = headers.get('Stripe-Signature') or headers.get('stripe-signature')
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
            
            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                return {
                    "order_id": session.get('client_reference_id'),
                    "status": "paid",
                    "provider_id": session.get('id'),
                    "raw": event,
                    "metadata": session.get('metadata', {})
                }
            return {"status": "ignored", "type": event['type']}
        except ValueError as e:
            return None
        except stripe.error.SignatureVerificationError as e:
            return None

class LemonSqueezyProvider(PaymentProvider):
    def __init__(self):
        self.api_key = os.getenv("LEMONSQUEEZY_API_KEY")
        self.store_id = os.getenv("LEMONSQUEEZY_STORE_ID")
        self.webhook_secret = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET")
        self.variant_map = {
            "starter": os.getenv("LEMONSQUEEZY_VARIANT_ID_STARTER"),
            "pro": os.getenv("LEMONSQUEEZY_VARIANT_ID_PRO")
        }

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.api_key or not self.store_id:
            raise Exception("Lemon Squeezy API key or Store ID not configured")
            
        # Map internal plan_id to Lemon Squeezy Variant ID
        # plan_id format expected: "starter_monthly" or "pro_monthly" -> we simplify to check if it contains starter/pro
        variant_id = None
        if plan_id:
            if "starter" in plan_id.lower():
                variant_id = self.variant_map.get("starter")
            elif "pro" in plan_id.lower():
                variant_id = self.variant_map.get("pro")
        
        if not variant_id:
            raise Exception(f"Could not find Lemon Squeezy Variant ID for plan: {plan_id}")

        url = "https://api.lemonsqueezy.com/v1/checkouts"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json"
        }
        
        payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "checkout_data": {
                        "custom": {
                            "user_id": str(user_id),
                            "plan_id": str(plan_id),
                            "order_id": str(order_id)
                        },
                        "email": user_email
                    },
                    "product_options": {
                        "redirect_url": os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success'
                    }
                },
                "relationships": {
                    "store": {
                        "data": {
                            "type": "stores",
                            "id": str(self.store_id)
                        }
                    },
                    "variant": {
                        "data": {
                            "type": "variants",
                            "id": str(variant_id)
                        }
                    }
                }
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 201:
                print(f"LemonSqueezy Error: {response.text}")
                raise Exception(f"Failed to create checkout: {response.text}")
            
            data = response.json()
            checkout_url = data['data']['attributes']['url']
            
            return {"payment_url": checkout_url, "provider_id": data['data']['id']}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        signature = headers.get("X-Signature") or headers.get("x-signature")
        if not signature or not self.webhook_secret:
            print("Missing signature or secret")
            return None

        # Verify signature
        digest = hmac.new(
            self.webhook_secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(digest, signature):
            print(f"Signature mismatch: expected {digest}, got {signature}")
            return None

        try:
            data = json.loads(payload)
            event_name = data.get('meta', {}).get('event_name')
            
            # Focus on order creation or subscription creation
            if event_name in ['order_created', 'subscription_created', 'subscription_payment_success']:
                attributes = data['data']['attributes']
                custom_data = data['meta']['custom_data'] # Lemon Squeezy passes custom data in meta
                
                # Fallback to attributes if meta is empty (depends on API version)
                if not custom_data:
                     custom_data = attributes.get('checkout_data', {}).get('custom', {})

                return {
                    "order_id": custom_data.get('order_id'), # Our internal order ID
                    "user_id": custom_data.get('user_id'),
                    "plan_id": custom_data.get('plan_id'),
                    "status": "paid",
                    "provider_id": data['data']['id'],
                    "raw": data,
                    "metadata": custom_data
                }
            
            return {"status": "ignored", "type": event_name}
        except Exception as e:
            print(f"Webhook parsing error: {e}")
            return None

class PayJSProvider(PaymentProvider):
    """
    Implementation for PayJS (WeChat Pay for individuals).
    Uses direct HTTP requests usually.
    """
    def __init__(self):
        self.mchid = os.getenv("PAYJS_MCHID")
        self.key = os.getenv("PAYJS_KEY")
        self.api_url = "https://payjs.cn/api/cashier"

    def _sign(self, data: Dict[str, Any]) -> str:
        # PayJS signature algorithm (sort keys, append key, md5)
        import hashlib
        keys = sorted([k for k in data.keys() if data[k]]) # filter empty values
        sign_str = "&".join([f"{k}={data[k]}" for k in keys])
        sign_str += f"&key={self.key}"
        return hashlib.md5(sign_str.encode('utf-8')).hexdigest().upper()

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.mchid:
            raise Exception("PayJS not configured")
        
        # PayJS amount is in 'fen' (cents), same as our internal
        data = {
            "mchid": self.mchid,
            "total_fee": str(amount),
            "out_trade_no": order_id,
            "body": description,
            # "notify_url": os.getenv("API_URL") + "/api/v1/payment/webhook/payjs" 
            # Need to ensure this URL is publicly accessible
        }
        data["sign"] = self._sign(data)
        
        # Construct URL manually for cashier mode
        import urllib.parse
        params = urllib.parse.urlencode(data)
        payment_url = f"{self.api_url}?{params}"
        
        return {"payment_url": payment_url, "provider_id": None}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        # PayJS sends form data in POST
        # payload bytes need to be parsed as form data
        from urllib.parse import parse_qs
        try:
            decoded = parse_qs(payload.decode('utf-8'))
            data = {k: v[0] for k, v in decoded.items()}
            
            received_sign = data.get("sign")
            if not received_sign:
                return None
                
            # Verify signature
            data_to_sign = {k: v for k, v in data.items() if k != "sign"}
            if self._sign(data_to_sign) == received_sign:
                if data.get("return_code") == "1":
                    return {
                        "order_id": data.get("out_trade_no"),
                        "status": "paid",
                        "provider_id": data.get("payjs_order_id"),
                        "raw": data
                    }
            return None
        except Exception:
            return None

class PaymentFactory:
    @staticmethod
    def get_provider(provider_name: str) -> PaymentProvider:
        if provider_name == "stripe":
            return StripeProvider()
        elif provider_name == "payjs":
            return PayJSProvider()
        elif provider_name == "lemonsqueezy":
            return LemonSqueezyProvider()
        else:
            raise ValueError(f"Unknown payment provider: {provider_name}")

import os
import stripe
import hmac
import hashlib
import json
import httpx

class PaymentProvider(ABC):
    @abstractmethod
    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        """
        Create a payment order/session with the provider.
        Returns a dict containing 'payment_url' or needed info.
        """
        pass

    @abstractmethod
    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """
        Verify webhook signature and return parsed event data if valid.
        Returns None if invalid.
        """
        pass

class StripeProvider(PaymentProvider):
    def __init__(self):
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not stripe.api_key:
            raise Exception("Stripe API key not configured")
            
        try:
            # Stripe expects amount in cents
            session = stripe.checkout.Session.create(
                payment_method_types=['card', 'alipay', 'wechat_pay'],
                line_items=[{
                    'price_data': {
                        'currency': currency.lower(),
                        'product_data': {
                            'name': description,
                        },
                        'unit_amount': amount,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success&order_id=' + order_id,
                cancel_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=cancelled',
                client_reference_id=order_id,
                customer_email=user_email,
                metadata={
                    "user_id": user_id,
                    "plan_id": plan_id
                }
            )
            return {"payment_url": session.url, "provider_id": session.id}
        except Exception as e:
            print(f"Stripe error: {e}")
            raise e

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        sig_header = headers.get('Stripe-Signature') or headers.get('stripe-signature')
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
            
            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                return {
                    "order_id": session.get('client_reference_id'),
                    "status": "paid",
                    "provider_id": session.get('id'),
                    "raw": event,
                    "metadata": session.get('metadata', {})
                }
            return {"status": "ignored", "type": event['type']}
        except ValueError as e:
            return None
        except stripe.error.SignatureVerificationError as e:
            return None

class LemonSqueezyProvider(PaymentProvider):
    def __init__(self):
        self.api_key = os.getenv("LEMONSQUEEZY_API_KEY")
        self.store_id = os.getenv("LEMONSQUEEZY_STORE_ID")
        self.webhook_secret = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET")
        self.variant_map = {
            "starter": os.getenv("LEMONSQUEEZY_VARIANT_ID_STARTER"),
            "pro": os.getenv("LEMONSQUEEZY_VARIANT_ID_PRO")
        }

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.api_key or not self.store_id:
            raise Exception("Lemon Squeezy API key or Store ID not configured")
            
        # Map internal plan_id to Lemon Squeezy Variant ID
        # plan_id format expected: "starter_monthly" or "pro_monthly" -> we simplify to check if it contains starter/pro
        variant_id = None
        if plan_id:
            if "starter" in plan_id.lower():
                variant_id = self.variant_map.get("starter")
            elif "pro" in plan_id.lower():
                variant_id = self.variant_map.get("pro")
        
        if not variant_id:
            raise Exception(f"Could not find Lemon Squeezy Variant ID for plan: {plan_id}")

        url = "https://api.lemonsqueezy.com/v1/checkouts"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json"
        }
        
        payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "checkout_data": {
                        "custom": {
                            "user_id": str(user_id),
                            "plan_id": str(plan_id),
                            "order_id": str(order_id)
                        },
                        "email": user_email
                    },
                    "product_options": {
                        "redirect_url": os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success'
                    }
                },
                "relationships": {
                    "store": {
                        "data": {
                            "type": "stores",
                            "id": str(self.store_id)
                        }
                    },
                    "variant": {
                        "data": {
                            "type": "variants",
                            "id": str(variant_id)
                        }
                    }
                }
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 201:
                print(f"LemonSqueezy Error: {response.text}")
                raise Exception(f"Failed to create checkout: {response.text}")
            
            data = response.json()
            checkout_url = data['data']['attributes']['url']
            
            return {"payment_url": checkout_url, "provider_id": data['data']['id']}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        signature = headers.get("X-Signature") or headers.get("x-signature")
        if not signature or not self.webhook_secret:
            print("Missing signature or secret")
            return None

        # Verify signature
        digest = hmac.new(
            self.webhook_secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(digest, signature):
            print(f"Signature mismatch: expected {digest}, got {signature}")
            return None

        try:
            data = json.loads(payload)
            event_name = data.get('meta', {}).get('event_name')
            
            # Focus on order creation or subscription creation
            if event_name in ['order_created', 'subscription_created', 'subscription_payment_success']:
                attributes = data['data']['attributes']
                custom_data = data['meta']['custom_data'] # Lemon Squeezy passes custom data in meta
                
                # Fallback to attributes if meta is empty (depends on API version)
                if not custom_data:
                     custom_data = attributes.get('checkout_data', {}).get('custom', {})

                return {
                    "order_id": custom_data.get('order_id'), # Our internal order ID
                    "user_id": custom_data.get('user_id'),
                    "plan_id": custom_data.get('plan_id'),
                    "status": "paid",
                    "provider_id": data['data']['id'],
                    "raw": data,
                    "metadata": custom_data
                }
            
            return {"status": "ignored", "type": event_name}
        except Exception as e:
            print(f"Webhook parsing error: {e}")
            return None

class PayJSProvider(PaymentProvider):
    """
    Implementation for PayJS (WeChat Pay for individuals).
    Uses direct HTTP requests usually.
    """
    def __init__(self):
        self.mchid = os.getenv("PAYJS_MCHID")
        self.key = os.getenv("PAYJS_KEY")
        self.api_url = "https://payjs.cn/api/cashier"

    def _sign(self, data: Dict[str, Any]) -> str:
        # PayJS signature algorithm (sort keys, append key, md5)
        import hashlib
        keys = sorted([k for k in data.keys() if data[k]]) # filter empty values
        sign_str = "&".join([f"{k}={data[k]}" for k in keys])
        sign_str += f"&key={self.key}"
        return hashlib.md5(sign_str.encode('utf-8')).hexdigest().upper()

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.mchid:
            raise Exception("PayJS not configured")
        
        # PayJS amount is in 'fen' (cents), same as our internal
        data = {
            "mchid": self.mchid,
            "total_fee": str(amount),
            "out_trade_no": order_id,
            "body": description,
            # "notify_url": os.getenv("API_URL") + "/api/v1/payment/webhook/payjs" 
            # Need to ensure this URL is publicly accessible
        }
        data["sign"] = self._sign(data)
        
        # Construct URL manually for cashier mode
        import urllib.parse
        params = urllib.parse.urlencode(data)
        payment_url = f"{self.api_url}?{params}"
        
        return {"payment_url": payment_url, "provider_id": None}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        # PayJS sends form data in POST
        # payload bytes need to be parsed as form data
        from urllib.parse import parse_qs
        try:
            decoded = parse_qs(payload.decode('utf-8'))
            data = {k: v[0] for k, v in decoded.items()}
            
            received_sign = data.get("sign")
            if not received_sign:
                return None
                
            # Verify signature
            data_to_sign = {k: v for k, v in data.items() if k != "sign"}
            if self._sign(data_to_sign) == received_sign:
                if data.get("return_code") == "1":
                    return {
                        "order_id": data.get("out_trade_no"),
                        "status": "paid",
                        "provider_id": data.get("payjs_order_id"),
                        "raw": data
                    }
            return None
        except Exception:
            return None

class PaymentFactory:
    @staticmethod
    def get_provider(provider_name: str) -> PaymentProvider:
        if provider_name == "stripe":
            return StripeProvider()
        elif provider_name == "payjs":
            return PayJSProvider()
        elif provider_name == "lemonsqueezy":
            return LemonSqueezyProvider()
        else:
            raise ValueError(f"Unknown payment provider: {provider_name}")
import os
import stripe
import hmac
import hashlib
import json
import httpx

class PaymentProvider(ABC):
    @abstractmethod
    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        """
        Create a payment order/session with the provider.
        Returns a dict containing 'payment_url' or needed info.
        """
        pass

    @abstractmethod
    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """
        Verify webhook signature and return parsed event data if valid.
        Returns None if invalid.
        """
        pass

class StripeProvider(PaymentProvider):
    def __init__(self):
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not stripe.api_key:
            raise Exception("Stripe API key not configured")
            
        try:
            # Stripe expects amount in cents
            session = stripe.checkout.Session.create(
                payment_method_types=['card', 'alipay', 'wechat_pay'],
                line_items=[{
                    'price_data': {
                        'currency': currency.lower(),
                        'product_data': {
                            'name': description,
                        },
                        'unit_amount': amount,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success&order_id=' + order_id,
                cancel_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=cancelled',
                client_reference_id=order_id,
                customer_email=user_email,
                metadata={
                    "user_id": user_id,
                    "plan_id": plan_id
                }
            )
            return {"payment_url": session.url, "provider_id": session.id}
        except Exception as e:
            print(f"Stripe error: {e}")
            raise e

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        sig_header = headers.get('Stripe-Signature') or headers.get('stripe-signature')
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
            
            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                return {
                    "order_id": session.get('client_reference_id'),
                    "status": "paid",
                    "provider_id": session.get('id'),
                    "raw": event,
                    "metadata": session.get('metadata', {})
                }
            return {"status": "ignored", "type": event['type']}
        except ValueError as e:
            return None
        except stripe.error.SignatureVerificationError as e:
            return None

class LemonSqueezyProvider(PaymentProvider):
    def __init__(self):
        self.api_key = os.getenv("LEMONSQUEEZY_API_KEY")
        self.store_id = os.getenv("LEMONSQUEEZY_STORE_ID")
        self.webhook_secret = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET")
        self.variant_map = {
            "starter": os.getenv("LEMONSQUEEZY_VARIANT_ID_STARTER"),
            "pro": os.getenv("LEMONSQUEEZY_VARIANT_ID_PRO")
        }

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.api_key or not self.store_id:
            raise Exception("Lemon Squeezy API key or Store ID not configured")
            
        # Map internal plan_id to Lemon Squeezy Variant ID
        # plan_id format expected: "starter_monthly" or "pro_monthly" -> we simplify to check if it contains starter/pro
        variant_id = None
        if plan_id:
            if "starter" in plan_id.lower():
                variant_id = self.variant_map.get("starter")
            elif "pro" in plan_id.lower():
                variant_id = self.variant_map.get("pro")
        
        if not variant_id:
            raise Exception(f"Could not find Lemon Squeezy Variant ID for plan: {plan_id}")

        url = "https://api.lemonsqueezy.com/v1/checkouts"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json"
        }
        
        payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "checkout_data": {
                        "custom": {
                            "user_id": str(user_id),
                            "plan_id": str(plan_id),
                            "order_id": str(order_id)
                        },
                        "email": user_email
                    },
                    "product_options": {
                        "redirect_url": os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success'
                    }
                },
                "relationships": {
                    "store": {
                        "data": {
                            "type": "stores",
                            "id": str(self.store_id)
                        }
                    },
                    "variant": {
                        "data": {
                            "type": "variants",
                            "id": str(variant_id)
                        }
                    }
                }
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 201:
                print(f"LemonSqueezy Error: {response.text}")
                raise Exception(f"Failed to create checkout: {response.text}")
            
            data = response.json()
            checkout_url = data['data']['attributes']['url']
            
            return {"payment_url": checkout_url, "provider_id": data['data']['id']}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        signature = headers.get("X-Signature") or headers.get("x-signature")
        if not signature or not self.webhook_secret:
            print("Missing signature or secret")
            return None

        # Verify signature
        digest = hmac.new(
            self.webhook_secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(digest, signature):
            print(f"Signature mismatch: expected {digest}, got {signature}")
            return None

        try:
            data = json.loads(payload)
            event_name = data.get('meta', {}).get('event_name')
            
            # Focus on order creation or subscription creation
            if event_name in ['order_created', 'subscription_created', 'subscription_payment_success']:
                attributes = data['data']['attributes']
                custom_data = data['meta']['custom_data'] # Lemon Squeezy passes custom data in meta
                
                # Fallback to attributes if meta is empty (depends on API version)
                if not custom_data:
                     custom_data = attributes.get('checkout_data', {}).get('custom', {})

                return {
                    "order_id": custom_data.get('order_id'), # Our internal order ID
                    "user_id": custom_data.get('user_id'),
                    "plan_id": custom_data.get('plan_id'),
                    "status": "paid",
                    "provider_id": data['data']['id'],
                    "raw": data,
                    "metadata": custom_data
                }
            
            return {"status": "ignored", "type": event_name}
        except Exception as e:
            print(f"Webhook parsing error: {e}")
            return None

class PayJSProvider(PaymentProvider):
    """
    Implementation for PayJS (WeChat Pay for individuals).
    Uses direct HTTP requests usually.
    """
    def __init__(self):
        self.mchid = os.getenv("PAYJS_MCHID")
        self.key = os.getenv("PAYJS_KEY")
        self.api_url = "https://payjs.cn/api/cashier"

    def _sign(self, data: Dict[str, Any]) -> str:
        # PayJS signature algorithm (sort keys, append key, md5)
        import hashlib
        keys = sorted([k for k in data.keys() if data[k]]) # filter empty values
        sign_str = "&".join([f"{k}={data[k]}" for k in keys])
        sign_str += f"&key={self.key}"
        return hashlib.md5(sign_str.encode('utf-8')).hexdigest().upper()

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.mchid:
            raise Exception("PayJS not configured")
        
        # PayJS amount is in 'fen' (cents), same as our internal
        data = {
            "mchid": self.mchid,
            "total_fee": str(amount),
            "out_trade_no": order_id,
            "body": description,
            # "notify_url": os.getenv("API_URL") + "/api/v1/payment/webhook/payjs" 
            # Need to ensure this URL is publicly accessible
        }
        data["sign"] = self._sign(data)
        
        # Construct URL manually for cashier mode
        import urllib.parse
        params = urllib.parse.urlencode(data)
        payment_url = f"{self.api_url}?{params}"
        
        return {"payment_url": payment_url, "provider_id": None}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        # PayJS sends form data in POST
        # payload bytes need to be parsed as form data
        from urllib.parse import parse_qs
        try:
            decoded = parse_qs(payload.decode('utf-8'))
            data = {k: v[0] for k, v in decoded.items()}
            
            received_sign = data.get("sign")
            if not received_sign:
                return None
                
            # Verify signature
            data_to_sign = {k: v for k, v in data.items() if k != "sign"}
            if self._sign(data_to_sign) == received_sign:
                if data.get("return_code") == "1":
                    return {
                        "order_id": data.get("out_trade_no"),
                        "status": "paid",
                        "provider_id": data.get("payjs_order_id"),
                        "raw": data
                    }
            return None
        except Exception:
            return None

class PaymentFactory:
    @staticmethod
    def get_provider(provider_name: str) -> PaymentProvider:
        if provider_name == "stripe":
            return StripeProvider()
        elif provider_name == "payjs":
            return PayJSProvider()
        elif provider_name == "lemonsqueezy":
            return LemonSqueezyProvider()
        else:
            raise ValueError(f"Unknown payment provider: {provider_name}")

import os
import stripe
import hmac
import hashlib
import json
import httpx

class PaymentProvider(ABC):
    @abstractmethod
    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        """
        Create a payment order/session with the provider.
        Returns a dict containing 'payment_url' or needed info.
        """
        pass

    @abstractmethod
    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """
        Verify webhook signature and return parsed event data if valid.
        Returns None if invalid.
        """
        pass

class StripeProvider(PaymentProvider):
    def __init__(self):
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not stripe.api_key:
            raise Exception("Stripe API key not configured")
            
        try:
            # Stripe expects amount in cents
            session = stripe.checkout.Session.create(
                payment_method_types=['card', 'alipay', 'wechat_pay'],
                line_items=[{
                    'price_data': {
                        'currency': currency.lower(),
                        'product_data': {
                            'name': description,
                        },
                        'unit_amount': amount,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success&order_id=' + order_id,
                cancel_url=os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=cancelled',
                client_reference_id=order_id,
                customer_email=user_email,
                metadata={
                    "user_id": user_id,
                    "plan_id": plan_id
                }
            )
            return {"payment_url": session.url, "provider_id": session.id}
        except Exception as e:
            print(f"Stripe error: {e}")
            raise e

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        sig_header = headers.get('Stripe-Signature') or headers.get('stripe-signature')
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
            
            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                return {
                    "order_id": session.get('client_reference_id'),
                    "status": "paid",
                    "provider_id": session.get('id'),
                    "raw": event,
                    "metadata": session.get('metadata', {})
                }
            return {"status": "ignored", "type": event['type']}
        except ValueError as e:
            return None
        except stripe.error.SignatureVerificationError as e:
            return None

class LemonSqueezyProvider(PaymentProvider):
    def __init__(self):
        self.api_key = os.getenv("LEMONSQUEEZY_API_KEY")
        self.store_id = os.getenv("LEMONSQUEEZY_STORE_ID")
        self.webhook_secret = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET")
        self.variant_map = {
            "starter": os.getenv("LEMONSQUEEZY_VARIANT_ID_STARTER"),
            "pro": os.getenv("LEMONSQUEEZY_VARIANT_ID_PRO")
        }

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.api_key or not self.store_id:
            raise Exception("Lemon Squeezy API key or Store ID not configured")
            
        # Map internal plan_id to Lemon Squeezy Variant ID
        # plan_id format expected: "starter_monthly" or "pro_monthly" -> we simplify to check if it contains starter/pro
        variant_id = None
        if plan_id:
            if "starter" in plan_id.lower():
                variant_id = self.variant_map.get("starter")
            elif "pro" in plan_id.lower():
                variant_id = self.variant_map.get("pro")
        
        if not variant_id:
            raise Exception(f"Could not find Lemon Squeezy Variant ID for plan: {plan_id}")

        url = "https://api.lemonsqueezy.com/v1/checkouts"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json"
        }
        
        payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "checkout_data": {
                        "custom": {
                            "user_id": str(user_id),
                            "plan_id": str(plan_id),
                            "order_id": str(order_id)
                        },
                        "email": user_email
                    },
                    "product_options": {
                        "redirect_url": os.getenv("PUBLIC_URL", "https://www.momemory.com") + '/settings?payment=success'
                    }
                },
                "relationships": {
                    "store": {
                        "data": {
                            "type": "stores",
                            "id": str(self.store_id)
                        }
                    },
                    "variant": {
                        "data": {
                            "type": "variants",
                            "id": str(variant_id)
                        }
                    }
                }
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 201:
                print(f"LemonSqueezy Error: {response.text}")
                raise Exception(f"Failed to create checkout: {response.text}")
            
            data = response.json()
            checkout_url = data['data']['attributes']['url']
            
            return {"payment_url": checkout_url, "provider_id": data['data']['id']}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        signature = headers.get("X-Signature") or headers.get("x-signature")
        if not signature or not self.webhook_secret:
            print("Missing signature or secret")
            return None

        # Verify signature
        digest = hmac.new(
            self.webhook_secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(digest, signature):
            print(f"Signature mismatch: expected {digest}, got {signature}")
            return None

        try:
            data = json.loads(payload)
            event_name = data.get('meta', {}).get('event_name')
            
            # Focus on order creation or subscription creation
            if event_name in ['order_created', 'subscription_created', 'subscription_payment_success']:
                attributes = data['data']['attributes']
                custom_data = data['meta']['custom_data'] # Lemon Squeezy passes custom data in meta
                
                # Fallback to attributes if meta is empty (depends on API version)
                if not custom_data:
                     custom_data = attributes.get('checkout_data', {}).get('custom', {})

                return {
                    "order_id": custom_data.get('order_id'), # Our internal order ID
                    "user_id": custom_data.get('user_id'),
                    "plan_id": custom_data.get('plan_id'),
                    "status": "paid",
                    "provider_id": data['data']['id'],
                    "raw": data,
                    "metadata": custom_data
                }
            
            return {"status": "ignored", "type": event_name}
        except Exception as e:
            print(f"Webhook parsing error: {e}")
            return None

class PayJSProvider(PaymentProvider):
    """
    Implementation for PayJS (WeChat Pay for individuals).
    Uses direct HTTP requests usually.
    """
    def __init__(self):
        self.mchid = os.getenv("PAYJS_MCHID")
        self.key = os.getenv("PAYJS_KEY")
        self.api_url = "https://payjs.cn/api/cashier"

    def _sign(self, data: Dict[str, Any]) -> str:
        # PayJS signature algorithm (sort keys, append key, md5)
        import hashlib
        keys = sorted([k for k in data.keys() if data[k]]) # filter empty values
        sign_str = "&".join([f"{k}={data[k]}" for k in keys])
        sign_str += f"&key={self.key}"
        return hashlib.md5(sign_str.encode('utf-8')).hexdigest().upper()

    async def create_order(self, order_id: str, amount: int, currency: str, description: str, user_email: str = None, plan_id: str = None, user_id: str = None) -> Dict[str, Any]:
        if not self.mchid:
            raise Exception("PayJS not configured")
        
        # PayJS amount is in 'fen' (cents), same as our internal
        data = {
            "mchid": self.mchid,
            "total_fee": str(amount),
            "out_trade_no": order_id,
            "body": description,
            # "notify_url": os.getenv("API_URL") + "/api/v1/payment/webhook/payjs" 
            # Need to ensure this URL is publicly accessible
        }
        data["sign"] = self._sign(data)
        
        # Construct URL manually for cashier mode
        import urllib.parse
        params = urllib.parse.urlencode(data)
        payment_url = f"{self.api_url}?{params}"
        
        return {"payment_url": payment_url, "provider_id": None}

    async def verify_webhook(self, payload: bytes, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
        # PayJS sends form data in POST
        # payload bytes need to be parsed as form data
        from urllib.parse import parse_qs
        try:
            decoded = parse_qs(payload.decode('utf-8'))
            data = {k: v[0] for k, v in decoded.items()}
            
            received_sign = data.get("sign")
            if not received_sign:
                return None
                
            # Verify signature
            data_to_sign = {k: v for k, v in data.items() if k != "sign"}
            if self._sign(data_to_sign) == received_sign:
                if data.get("return_code") == "1":
                    return {
                        "order_id": data.get("out_trade_no"),
                        "status": "paid",
                        "provider_id": data.get("payjs_order_id"),
                        "raw": data
                    }
            return None
        except Exception:
            return None

class PaymentFactory:
    @staticmethod
    def get_provider(provider_name: str) -> PaymentProvider:
        if provider_name == "stripe":
            return StripeProvider()
        elif provider_name == "payjs":
            return PayJSProvider()
        elif provider_name == "lemonsqueezy":
            return LemonSqueezyProvider()
        else:
            raise ValueError(f"Unknown payment provider: {provider_name}")