#!/bin/bash
# OpenMemory 用户注册和MAC地址绑定测试脚本

BASE_URL="http://localhost:8765/api/v1/auth"

echo "========================================="
echo "OpenMemory 认证API测试"
echo "========================================="
echo ""

echo "测试OAuth授权接口(微信/QQ)..."
echo "----------------------------------------"
echo "注意: 微信和QQ登录需要OAuth授权,不能直接注册"
echo ""

echo "1. 测试微信OAuth授权(TODO)..."
echo "----------------------------------------"
curl -X GET "$BASE_URL/oauth/wechat/authorize" | jq .
echo ""

echo "2. 测试QQ OAuth授权(TODO)..."
echo "----------------------------------------"
curl -X GET "$BASE_URL/oauth/qq/authorize" | jq .
echo ""

echo "3. 测试邮箱注册(发送验证码)..."
echo "----------------------------------------"
curl -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{"login_id":"test@openmemory.com","login_type":"email","name":"测试用户"}' \
  | jq .
echo ""

echo "2. 测试QQ注册(直接创建用户)..."
echo "----------------------------------------"
curl -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{"login_id":"qq_789012","login_type":"qq","name":"QQ测试用户"}' \
  | jq .
echo ""

echo "3. 测试微信注册(直接创建用户)..."
echo "----------------------------------------"
curl -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{"login_id":"wx_456789","login_type":"wechat","name":"微信测试用户"}' \
  | jq .
echo ""

echo "4. 为QQ用户绑定MAC地址..."
echo "----------------------------------------"
curl -X POST "$BASE_URL/bind-mac?user_id=qq_789012" \
  -H "Content-Type: application/json" \
  -d '{"mac_address":"AA:BB:CC:DD:EE:FF","device_name":"测试设备1"}' \
  | jq .
echo ""

echo "5. 再绑定一个MAC地址..."
echo "----------------------------------------"
curl -X POST "$BASE_URL/bind-mac?user_id=qq_789012" \
  -H "Content-Type: application/json" \
  -d '{"mac_address":"11:22:33:44:55:66","device_name":"测试设备2"}' \
  | jq .
echo ""

echo "6. 获取QQ用户的所有设备..."
echo "----------------------------------------"
curl -X GET "$BASE_URL/user/qq_789012/devices" | jq .
echo ""

echo "7. 测试重复绑定(应该返回already_bound)..."
echo "----------------------------------------"
curl -X POST "$BASE_URL/bind-mac?user_id=qq_789012" \
  -H "Content-Type: application/json" \
  -d '{"mac_address":"AA:BB:CC:DD:EE:FF","device_name":"测试设备1"}' \
  | jq .
echo ""

echo "========================================="
echo "测试完成!"
echo "========================================="
