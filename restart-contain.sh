#!/bin/bash
# 脚本功能：一键重建并重启 openmemory-ui 容器，确保新配置生效
# 使用说明：1. 复制到服务器任意目录；2. 执行 chmod +x restart-ui.sh 赋予权限；3. ./restart-ui.sh 运行

# 定义变量（根据你的实际情况修改，默认和之前配置匹配）
UI_CONTAINER_NAME="openmemory-mcp_openmemory-ui_1"  # UI容器名
UI_IMAGE_NAME="mem0/openmemory-ui:latest"            # UI镜像名
COMPOSE_PROJECT_DIR="/opt/OpenMemory-MCP"            # docker-compose.yml 所在目录（项目根目录）

# 1. 停止UI容器
echo "=== 1. 停止 UI 容器 $UI_CONTAINER_NAME ==="
docker stop $UI_CONTAINER_NAME 2>/dev/null || echo "容器已停止，跳过此步"

# 2. 删除UI容器
echo -e "\n=== 2. 删除 UI 容器 $UI_CONTAINER_NAME ==="
docker rm -f $UI_CONTAINER_NAME 2>/dev/null || echo "容器已删除，跳过此步"

# 3. 删除旧UI镜像（避免缓存干扰）
echo -e "\n=== 3. 删除旧 UI 镜像 $UI_IMAGE_NAME ==="
docker rmi -f $UI_IMAGE_NAME 2>/dev/null || echo "镜像已删除，跳过此步"

# 4. 进入项目根目录，重建UI镜像（加载新的 compose 配置）
echo -e "\n=== 4. 重建 UI 镜像 ==="
cd $COMPOSE_PROJECT_DIR || { echo "项目目录不存在！请检查 COMPOSE_PROJECT_DIR 变量"; exit 1; }
docker-compose build --no-cache openmemory-ui || { echo "镜像构建失败！请检查 Dockerfile 或网络"; exit 1; }

# 5. 启动新UI容器
echo -e "\n=== 5. 启动新 UI 容器 ==="
docker-compose up -d openmemory-ui || { echo "容器启动失败！请检查 docker-compose.yml 配置"; exit 1; }

# 6. 查看日志，验证替换结果
echo -e "\n=== 6. 查看 UI 容器日志（确认 API 地址是否正确） ==="
docker logs $UI_CONTAINER_NAME | grep -E "Replaced NEXT_PUBLIC_API_URL|NEXT_PUBLIC_API_URL_PLACEHOLDER"

# 7. 提示执行结果
echo -e "\n=== 操作完成 ==="
echo "✅ 若日志显示 'Replaced NEXT_PUBLIC_API_URL_PLACEHOLDER with http://openmemory-mcp:8765'，说明配置生效"
echo "❌ 若启动失败，可执行 docker ps -a | grep openmemory-ui 查看容器状态，或检查脚本中的变量是否正确"