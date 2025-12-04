# 数据持久化和备份恢复指南

## 概述
本文档说明了如何确保OpenMemory-MCP系统的数据持久化，以及如何进行数据备份和恢复操作。

## 数据持久化机制

### 1. Docker数据卷
系统使用Docker数据卷来持久化存储数据：
- `pgvector_pgdata`：存储PostgreSQL数据库数据
- `mem0_storage`：存储Qdrant向量数据库数据
- `db_storage`：存储其他数据库相关数据

这些数据卷在docker-compose.yml中定义为external: true，确保即使容器被删除，数据也不会丢失。

### 2. 镜像构建
所有代码修改都会被构建到Docker镜像中，确保重启后修改仍然存在。

## 脚本说明

### 1. build_and_persist.sh
构建并持久化所有服务的脚本。

**使用方法：**
```bash
cd /opt/OpenMemory-MCP
./build_and_persist.sh
```

**功能：**
- 备份当前状态
- 构建API服务镜像
- 构建UI服务镜像
- 重启服务以应用新镜像
- 验证服务状态
- 验证API和UI服务可用性
- 验证数据库和向量数据库连接

### 2. persistence_check.sh
数据持久化状态检查脚本。

**使用方法：**
```bash
cd /opt/OpenMemory-MCP
./persistence_check.sh
```

**功能：**
- 检查Docker数据卷是否存在
- 检查备份目录
- 检查关键服务运行状态
- 检查API和UI服务可用性
- 检查数据库和向量数据库连接

### 3. data_persistence_test.sh
数据持久化完整测试脚本。

**使用方法：**
```bash
cd /opt/OpenMemory-MCP
./data_persistence_test.sh
```

**功能：**
- 全面检查系统状态
- 测试数据库持久化
- 测试向量数据库持久化
- 测试文件持久化
- 测试Docker卷持久化
- 执行服务重启测试
- 验证数据是否持久化

### 4. backup_current_state.sh
备份当前系统状态的脚本。

**使用方法：**
```bash
cd /opt/OpenMemory-MCP
./backup_current_state.sh
```

**功能：**
- 备份docker-compose配置
- 备份PostgreSQL数据库
- 备份Qdrant向量数据库
- 备份重要配置文件
- 记录容器状态信息
- 创建备份压缩包

### 5. backup_data.sh
数据备份脚本。

**使用方法：**
```bash
cd /opt/OpenMemory-MCP
./backup_data.sh
```

**功能：**
- 备份PostgreSQL数据库
- 备份Qdrant向量数据库
- 备份Docker Compose配置
- 备份环境变量文件
- 备份自定义脚本

备份文件保存在 `/opt/OpenMemory-MCP/backups` 目录中。

### 6. restore_data.sh
数据恢复脚本。

**使用方法：**
```bash
cd /opt/OpenMemory-MCP
./restore_data.sh
```

**功能：**
- 停止服务
- 恢复PostgreSQL数据库
- 恢复Qdrant向量数据库
- 恢复配置文件（可选）
- 启动所有服务

## 使用流程

### 日常维护
1. 定期运行 `backup_data.sh` 脚本进行数据备份
2. 在进行重大修改前，先运行备份脚本
3. 修改代码后，运行 `build_and_persist.sh` 脚本确保修改持久化

### 灾难恢复
1. 运行 `restore_data.sh` 脚本
2. 根据提示选择要恢复的备份时间戳
3. 根据需要选择是否恢复配置文件

## 注意事项
1. 数据卷必须正确配置且不能被删除，否则数据会丢失
2. 定期检查备份文件的完整性
3. 在生产环境中，建议设置自动备份任务
4. 恢复操作会覆盖现有数据，请谨慎操作