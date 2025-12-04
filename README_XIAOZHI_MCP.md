# 小智AI MCP集成指南

## 概述

本指南介绍了如何将小智AI设备与OpenMemory-MCP系统集成，实现设备绑定和记忆交互功能。通过本集成，用户与AI机器人交流时的记忆可以存储到Momemory中。

## 功能特性

1. **设备绑定** - 支持通过MAC地址或Endpoint URL绑定小智AI设备
2. **记忆存储** - 将用户与AI的对话内容存储为记忆
3. **记忆检索** - 根据查询检索相关记忆
4. **用户管理** - 管理用户绑定的设备列表

## 核心组件

### 1. XiaozhiMCPConnector (xiaozhi_mcp_connector.py)

核心连接器类，提供以下方法：

- `bind_device_by_mac()` - 通过MAC地址绑定设备
- `bind_device_by_endpoint()` - 通过Endpoint URL绑定设备
- `auto_bind_device()` - 自动绑定设备（适用于MCPhub）
- `add_memory()` - 添加记忆到Momemory
- `search_memory()` - 搜索记忆
- `get_user_devices()` - 获取用户绑定的设备列表

### 2. MCP服务器 (mcp_server_xiaozhi.py)

提供RESTful API接口的MCP服务器：

- `/bind-device` - 绑定设备
- `/add-memory` - 添加记忆
- `/search-memory` - 搜索记忆
- `/user/{user_id}/devices` - 获取用户设备列表

## 使用方法

### 1. 设备绑定流程

```bash
# 通过MAC地址绑定设备
curl -X POST "http://localhost:8766/bind-device" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user@example.com",
    "device_identifier": "00:1A:2B:3C:4D:5E",
    "device_name": "小智AI语音助手",
    "bind_type": "mac"
  }'
```

### 2. 添加记忆

```bash
# 添加记忆
curl -X POST "http://localhost:8766/add-memory" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user@example.com",
    "client_name": "00:1A:2B:3C:4D:5E",
    "text": "我叫小明，今年25岁，是一名软件工程师。",
    "mac_address": "00:1A:2B:3C:4D:5E"
  }'
```

### 3. 搜索记忆

```bash
# 搜索记忆
curl -X POST "http://localhost:8766/search-memory" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user@example.com",
    "client_name": "00:1A:2B:3C:4D:5E",
    "query": "用户的职业是什么？"
  }'
```

## 部署指南

### 1. 启动MCP服务器

```bash
# 启动服务器
cd /opt/OpenMemory-MCP
./start_xiaozhi_mcp_server.sh
```

### 2. 配置环境变量

```bash
# 设置端口（可选，默认8766）
export XIAOZHI_MCP_PORT=8766
```

## 小智AI MCP接入点配置

根据小智AI文档，MCP接入点配置如下：

1. 登录 xiaozhi.me 控制台
2. 进入智能体的配置角色页面
3. 在右下角找到该智能体专属的 MCP 接入点

### 示例代码集成

GitHub示例：https://github.com/78/mcp-calculator

在小智AI MCP服务中，需要实现以下功能：

```python
from mcp.server.fastmcp import FastMCP
import logging

# 创建MCP服务器
mcp = FastMCP("Calculator")

# 添加记忆工具
@mcp.tool()
def add_memories(text: str, mac_address: str = None) -> dict:
    """添加记忆到Momemory"""
    # 实现记忆存储逻辑
    return {"success": True, "message": "记忆添加成功"}

# 启动服务器
if __name__ == "__main__":
    mcp.run(transport="stdio")
```

## 注意事项

1. **MAC地址格式** - 确保MAC地址使用标准格式（如：00:1A:2B:3C:4D:5E）
2. **URL编码** - Endpoint URL中的特殊字符需要进行URL编码
3. **用户认证** - 确保用户已注册并登录系统
4. **设备唯一性** - 每个设备只能绑定到一个用户
5. **记忆长度限制** - MCP返回值通常限制在1024字节内

## 故障排除

### 常见问题

1. **设备绑定失败**
   - 检查MAC地址格式是否正确
   - 确认用户是否存在
   - 验证设备是否已绑定到其他用户

2. **记忆存储失败**
   - 检查OpenMemory服务是否正常运行
   - 验证网络连接
   - 确认API密钥配置正确

3. **记忆检索为空**
   - 检查查询语句是否准确
   - 确认记忆是否已成功存储
   - 验证向量数据库连接

### 日志查看

```bash
# 查看服务器日志
tail -f /var/log/xiaozhi-mcp-server.log
```

## API参考

### 绑定设备

**POST** `/bind-device`

请求体：
```json
{
  "user_id": "string",
  "device_identifier": "string",
  "device_name": "string (可选)",
  "bind_type": "auto|mac|endpoint"
}
```

响应：
```json
{
  "status": "success|error",
  "message": "string",
  "app_id": "string (成功时)",
  "error_details": "string (失败时)"
}
```

### 添加记忆

**POST** `/add-memory`

请求体：
```json
{
  "user_id": "string",
  "client_name": "string",
  "text": "string",
  "mac_address": "string (可选)"
}
```

响应：
```json
{
  "status": "success|error",
  "message": "string",
  "raw_response": "object"
}
```

### 搜索记忆

**POST** `/search-memory`

请求体：
```json
{
  "user_id": "string",
  "client_name": "string",
  "query": "string"
}
```

响应：
```json
{
  "status": "success|error",
  "memories": "array|string",
  "raw_response": "object"
}
```