#!/usr/bin/env python3
"""
MCPhub消息处理集成模块
这个模块会在MCPhub消息处理流程中自动调用，确保消息存储到正确的设备名称上
"""

import json
import logging
import urllib.parse
import re
import base64
from typing import Optional, Dict, Any

def extract_agent_id_from_token(token: str) -> Optional[int]:
    """从JWT token中提取agentId"""
    try:
        # 分割JWT token
        token_parts = token.split('.')
        if len(token_parts) >= 2:
            # 获取payload部分
            payload = token_parts[1]
            # 添加缺失的填充字符
            missing_padding = len(payload) % 4
            if missing_padding:
                payload += '=' * (4 - missing_padding)
            
            # 解码payload
            decoded_payload = base64.b64decode(payload)
            payload_str = decoded_payload.decode('utf-8')
            
            # 从payload中提取agentId
            payload_data = json.loads(payload_str)
            agent_id = payload_data.get('agentId')
            if agent_id is not None:
                return int(agent_id)
    except Exception as e:
        logging.warning(f"Error extracting agentId from token: {e}")
    return None


def find_user_and_device_info(request_data: Dict[str, Any], db) -> Optional[Dict[str, Any]]:
    """查找用户和设备信息"""
    try:
        from app.models import App, User
        
        # 提取关键信息
        user_id = request_data.get("user_id", "USER")
        client_name = request_data.get("client_name", "openmemory")
        
        # 从请求头中获取endpoint参数
        endpoint_url = None
        if "headers" in request_data:
            headers = request_data["headers"]
            endpoint_url = (
                headers.get("x-endpoint") or 
                headers.get("X-Xiaozhi-WebSocket-Url") or
                headers.get("x-websocket-url")
            )
        
        # 从请求参数中获取agentId
        agent_id = None
        if "params" in request_data and "arguments" in request_data["params"]:
            arguments = request_data["params"]["arguments"]
            agent_id_str = arguments.get("agentId")
            if agent_id_str and agent_id_str not in ["${agentId}", "agentId"]:
                try:
                    agent_id = int(agent_id_str)
                except (ValueError, TypeError):
                    logging.warning(f"Invalid agentId: {agent_id_str}")
        
        logging.info(f"Searching for user - user_id: {user_id}, client_name: {client_name}, endpoint_url: {endpoint_url}, agent_id: {agent_id}")
        
        # 如果有endpoint URL，尝试通过websocket_url字段查找用户
        if endpoint_url and endpoint_url not in ["endpointWebSocketUrl", "${endpointWebSocketUrl}"]:
            # 解码URL
            decoded_url = urllib.parse.unquote(endpoint_url)
            logging.info(f"Searching for app with WebSocket URL: {decoded_url}")
            
            # 查找绑定到该URL的应用（优先使用websocket_url字段）
            app = db.query(App).filter(App.websocket_url == decoded_url).first()
            if not app:
                # 如果没有找到，回退到使用name字段查找
                app = db.query(App).filter(App.name == decoded_url).first()
            
            if app:
                # 获取用户信息
                user = db.query(User).filter(User.id == app.owner_id).first()
                if user:
                    # 优先使用device_name字段，如果没有则使用metadata中的device_name，最后回退到client_name
                    device_name = app.device_name or (app.metadata_.get('device_name') if app.metadata_ else None) or client_name
                    return {
                        "user_id": user.user_id,
                        "user_name": user.name,
                        "app_id": str(app.id),
                        "device_name": device_name,
                        "app_name": app.name
                    }
        
        # 如果有agentId，尝试通过agent_id字段查找用户
        if agent_id:
            logging.info(f"Searching for user by agentId: {agent_id}")
            
            # 查找所有应用
            apps = db.query(App).all()
            for app in apps:
                try:
                    # 优先使用agent_id字段匹配
                    if app.agent_id == agent_id:
                        # 找到匹配的应用，获取用户信息
                        user = db.query(User).filter(User.id == app.owner_id).first()
                        if user:
                            # 优先使用device_name字段，如果没有则使用metadata中的device_name，最后回退到默认名称
                            device_name = app.device_name or (app.metadata_.get('device_name') if app.metadata_ else None) or f"AI设备-{agent_id}"
                            return {
                                "user_id": user.user_id,
                                "user_name": user.name,
                                "app_id": str(app.id),
                                "device_name": device_name,
                                "app_name": app.name
                            }
                            
                    # 如果没有匹配的agent_id，检查URL中是否包含agentId
                    decoded_name = urllib.parse.unquote(app.name)
                    agent_id_str = f"agentId={agent_id}"
                    if agent_id_str in decoded_name:
                        user = db.query(User).filter(User.id == app.owner_id).first()
                        if user:
                            # 优先使用device_name字段，如果没有则使用metadata中的device_name，最后回退到默认名称
                            device_name = app.device_name or (app.metadata_.get('device_name') if app.metadata_ else None) or f"AI设备-{agent_id}"
                            return {
                                "user_id": user.user_id,
                                "user_name": user.name,
                                "app_id": str(app.id),
                                "device_name": device_name,
                                "app_name": app.name
                            }
                            
                except Exception as e:
                    logging.warning(f"Error parsing app name {app.name}: {e}")
                    continue
        
        # 如果通过endpoint和agentId都没找到，返回None
        logging.info("No user found by endpoint or agentId")
        return None
        
    except Exception as e:
        logging.error(f"Error finding user and device info: {e}")
        return None


def integrate_mcphub_processing(request_data: Dict[str, Any], db) -> Dict[str, Any]:
    """集成MCPhub消息处理，确保消息存储到正确的设备名称上"""
    try:
        logging.info("Integrating MCPhub message processing")
        logging.info(f"Request data: {request_data}")
        
        # 查找用户和设备信息
        user_info = find_user_and_device_info(request_data, db)
        
        if user_info:
            logging.info(f"Found user and device: {user_info}")
            
            # 更新请求数据中的用户ID和客户端名称
            request_data["user_id"] = user_info["user_id"]
            request_data["client_name"] = user_info["device_name"]
            
            return {
                "status": "success",
                "updated_request": request_data,
                "user_info": user_info
            }
        else:
            # 如果通过标准方法没有找到用户，尝试通过endpoint URL查找
            endpoint_url = None
            agent_id = None
            
            # 获取endpoint URL和agentId
            if "headers" in request_data:
                headers = request_data["headers"]
                endpoint_url = (
                    headers.get("x-endpoint") or 
                    headers.get("X-Xiaozhi-WebSocket-Url") or
                    headers.get("x-websocket-url")
                )
            
            if "params" in request_data and "arguments" in request_data["params"]:
                arguments = request_data["params"]["arguments"]
                agent_id_str = arguments.get("agentId")
                if agent_id_str and agent_id_str not in ["${agentId}", "agentId"]:
                    try:
                        agent_id = int(agent_id_str)
                    except (ValueError, TypeError):
                        logging.warning(f"Invalid agentId: {agent_id_str}")
            
            # 如果有endpoint URL，这是AI机器人发送的消息
            if endpoint_url and endpoint_url not in ["endpointWebSocketUrl", "${endpointWebSocketUrl}"]:
                # 解码URL
                decoded_url = urllib.parse.unquote(endpoint_url)
                logging.info(f"Creating new app for WebSocket URL: {decoded_url}")
                
                # 查找管理员用户作为默认用户
                from app.models import User
                admin_user = db.query(User).filter(User.is_admin == True).first()
                if not admin_user:
                    # 如果没有管理员用户，使用第一个用户
                    admin_user = db.query(User).first()
                
                if admin_user:
                    # 创建AI机器人应用
                    from app.models import App
                    import uuid
                    
                    # 从请求中获取设备名称，如果没有则使用默认名称
                    device_name = request_data.get("client_name", "未知设备")
                    if not device_name or device_name in ["openmemory", "USER"]:
                        device_name = f"AI设备-{agent_id if agent_id else '未知设备'}"
                    
                    # 如果没有agent_id，尝试从WebSocket URL中提取
                    if not agent_id and "token=" in decoded_url:
                        import re
                        token_match = re.search(r'token=([^&]*)', decoded_url)
                        if token_match:
                            token = token_match.group(1)
                            agent_id = extract_agent_id_from_token(token)
                            logging.info(f"Extracted agentId {agent_id} from WebSocket URL token")
                    
                    # 确保设备名称以"AI机器人-"开头
                    if not device_name.startswith("AI机器人-"):
                        device_name = f"AI机器人-{device_name}"
                    
                    new_app = App(
                        id=uuid.uuid4(),
                        owner_id=admin_user.id,
                        name=device_name,  # 使用AI机器人-设备名称格式作为应用名称
                        websocket_url=decoded_url,  # 存储WebSocket URL到专门字段
                        device_name=device_name,  # 存储设备名称
                        agent_id=agent_id,  # 存储agentId
                        metadata_={"type": "ai_robot", "device_identifier": decoded_url}
                    )
                    db.add(new_app)
                    db.commit()
                    
                    logging.info(f"Created new AI robot app {new_app.id} for WebSocket URL")
                    
                    # 更新请求数据
                    request_data["user_id"] = admin_user.user_id
                    request_data["client_name"] = device_name
                    
                    return {
                        "status": "success",
                        "updated_request": request_data,
                        "user_info": {
                            "user_id": admin_user.user_id,
                            "user_name": admin_user.name,
                            "app_id": str(new_app.id),
                            "device_name": device_name,
                            "app_name": device_name
                        }
                    }
            else:
                # 如果没有endpoint URL，这是终端应用发送的消息（如Claude, Cursor等）
                client_name = request_data.get("client_name", "未知应用")
                logging.info(f"Creating new app for terminal application: {client_name}")
                
                # 查找管理员用户作为默认用户
                from app.models import User
                admin_user = db.query(User).filter(User.is_admin == True).first()
                if not admin_user:
                    # 如果没有管理员用户，使用第一个用户
                    admin_user = db.query(User).first()
                
                if admin_user:
                    # 创建终端应用
                    from app.models import App
                    import uuid
                    
                    new_app = App(
                        id=uuid.uuid4(),
                        owner_id=admin_user.id,
                        name=client_name,  # 使用客户端名称作为应用名称
                        device_name=client_name,  # 设备名称与应用名称相同
                        metadata_={"type": "terminal_app", "client_name": client_name}
                    )
                    db.add(new_app)
                    db.commit()
                    
                    logging.info(f"Created new terminal app {new_app.id} for client: {client_name}")
                    
                    # 更新请求数据
                    request_data["user_id"] = admin_user.user_id
                    request_data["client_name"] = client_name
                    
                    return {
                        "status": "success",
                        "updated_request": request_data,
                        "user_info": {
                            "user_id": admin_user.user_id,
                            "user_name": admin_user.name,
                            "app_id": str(new_app.id),
                            "device_name": client_name,
                            "app_name": client_name
                        }
                    }
            
            logging.info("No user found, using original request")
            return {
                "status": "default",
                "original_request": request_data,
                "message": "No user found, using original request"
            }
            
    except Exception as e:
        logging.error(f"Error in MCPhub integration: {e}")
        return {
            "status": "error",
            "message": f"Integration error: {str(e)}",
            "original_request": request_data
        }