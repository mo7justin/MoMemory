# OpenMemory 用户注册和MAC地址绑定功能

## 📋 功能概述

已实现用户注册系统和MAC地址(设备)绑定功能,支持:
- 邮箱/微信/QQ多种登录方式
- MAC地址作为来源应用(Entity/App)
- 每个用户可绑定多个MAC地址
- 支持用户自己绑定或管理员绑定

## 🔗 API 接口

### 1. 用户注册
**端点**: `POST /api/v1/auth/register`

**邮箱注册**:
```json
{
  "login_id": "user@example.com",
  "login_type": "email",
  "name": "用户名"
}
```

**响应**:
```json
{
  "status": "verification_sent",
  "message": "Verification code sent to email",
  "login_id": "user@example.com",
  "login_type": "email"
}
```

**QQ/微信注册**:
```json
{
  "login_id": "qq_123456",
  "login_type": "qq",  // 或 "wechat"
  "name": "用户名"
}
```

**响应**:
```json
{
  "status": "success",
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "user_id": "qq_123456",
    "name": "用户名",
    "email": null,
    "login_type": "qq"
  }
}
```

### 2. 用户登录
**端点**: `POST /api/v1/auth/login`

**邮箱登录**(需要验证码):
```json
{
  "login_id": "user@example.com",
  "login_type": "email",
  "verification_code": "123456"
}
```

**QQ/微信登录**:
```json
{
  "login_id": "qq_123456",
  "login_type": "qq"
}
```

**响应**:
```json
{
  "status": "success",
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "user_id": "qq_123456",
    "name": "用户名",
    "email": null,
    "login_type": "qq"
  }
}
```

### 3. 绑定MAC地址
**端点**: `POST /api/v1/auth/bind-mac?user_id={user_id}`

**请求**:
```json
{
  "mac_address": "10:b4:1d:cd:77:10",
  "device_name": "AI小智-大收哥"  // 可选
}
```

**响应**(成功):
```json
{
  "status": "success",
  "message": "MAC address bound successfully",
  "app_id": "uuid",
  "mac_address": "10:b4:1d:cd:77:10",
  "device_name": "AI小智-大收哥"
}
```

**响应**(已绑定):
```json
{
  "status": "already_bound",
  "message": "MAC address already bound to this user",
  "app_id": "uuid",
  "mac_address": "10:b4:1d:cd:77:10"
}
```

### 4. 获取用户设备列表
**端点**: `GET /api/v1/auth/user/{user_id}/devices`

**响应**:
```json
{
  "user_id": "qq_123456",
  "total_devices": 2,
  "devices": [
    {
      "app_id": "uuid",
      "mac_address": "10:b4:1d:cd:77:10",
      "device_name": "AI小智-大收哥",
      "bound_at": "2025-11-03 06:53:42.569584+00:00",
      "is_active": true,
      "created_at": "2025-11-03 06:53:42.571276"
    }
  ]
}
```

### 5. 解绑MAC地址
**端点**: `DELETE /api/v1/auth/unbind-mac?user_id={user_id}&mac_address={mac}`

**响应**:
```json
{
  "status": "success",
  "message": "MAC address unbound successfully",
  "mac_address": "10:b4:1d:cd:77:10"
}
```

## 📐 数据模型设计

### User (用户表)
- `id`: UUID (主键)
- `user_id`: String (登录标识: 邮箱/QQ/微信号, 唯一索引)
- `name`: String (用户名)
- `email`: String (邮箱地址, 可选)
- `metadata_`: JSON (存储 `login_type` 等扩展信息)
- `created_at`, `updated_at`: Timestamp

### App (应用表 - 用于存储MAC地址)
- `id`: UUID (主键)
- `owner_id`: UUID (关联到 User.id)
- `name`: String (MAC地址, 全局唯一索引)
- `description`: String (设备描述)
- `metadata_`: JSON (存储 `type: 'mac_device'`, `device_name`, `bound_at`)
- `is_active`: Boolean (是否激活)
- `created_at`, `updated_at`: Timestamp

## 🔑 关键设计

1. **MAC地址作为App名称**: 
   - MAC地址存储在 `App.name` 字段(全局唯一)
   - `App.metadata_['type'] = 'mac_device'` 标记为设备类型
   - `App.owner_id` 关联到用户

2. **多登录方式支持**:
   - `User.metadata_['login_type']` 区分登录类型
   - 邮箱: 验证码机制(临时存储在内存,生产应使用Redis)
   - QQ/微信: 预留第三方OAuth接口

3. **一对多关系**:
   - 一个用户可以拥有多个MAC地址(多个App)
   - 一个MAC地址只能绑定到一个用户

## 🧪 测试

运行测试脚本:
```bash
chmod +x /opt/OpenMemory-MCP/api/test_auth_apis.sh
/opt/OpenMemory-MCP/api/test_auth_apis.sh
```

## 📝 后续集成任务

### 1. 前端登录页面对接
- 文件: `/opt/OpenMemory-MCP/ui/app/login/page.tsx`
- 任务:
  - 实现邮箱验证码发送和验证流程
  - 对接微信/QQ OAuth授权
  - 添加MAC地址绑定界面

### 2. MCPhub集成
- 获取AI小智设备的MAC地址
- 在连接时自动调用绑定API
- 将MAC地址作为 `client_name` 参数传递给OpenMemory

### 3. MCP服务器修改
- 在 `get_or_create_user()` 函数中支持MAC地址查找
- 在 `get_or_create_app()` 函数中支持MAC地址作为app name

## 🛠️ 环境变量配置

邮箱功能需要配置SMTP(可选):
```env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

如果未配置,验证码将打印到日志中。

## ✅ 已完成的功能

- ✅ 用户注册API(邮箱/QQ/微信)
- ✅ 用户登录API(邮箱验证码/QQ/微信)
- ✅ MAC地址绑定API
- ✅ 获取用户设备列表API
- ✅ MAC地址解绑API
- ✅ MAC地址格式验证
- ✅ 防止重复绑定
- ✅ 支持多个MAC地址绑定到同一用户

## 🎯 使用场景

1. **用户通过登录页面注册**: 
   - 访问 http://8.216.39.10/login
   - 输入邮箱/QQ/微信号注册
   - 邮箱用户收到验证码,输入验证码登录

2. **AI小智设备绑定**:
   - MCPhub获取设备MAC地址
   - 调用绑定API将MAC地址与用户关联
   - 后续所有该设备产生的记忆都关联到该用户

3. **查看设备列表**:
   - 用户可以查看自己绑定的所有AI小智设备
   - 管理员可以为用户绑定/解绑设备
