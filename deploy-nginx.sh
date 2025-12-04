#!/bin/bash

# 部署Nginx配置脚本

echo "停止现有的Nginx服务..."
sudo systemctl stop nginx

echo "备份现有的Nginx配置..."
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

echo "复制新的Nginx配置..."
sudo cp /opt/OpenMemory-MCP/nginx.conf /etc/nginx/nginx.conf

echo "测试Nginx配置..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "Nginx配置测试通过，重新加载Nginx..."
    sudo systemctl start nginx
    sudo systemctl reload nginx
    echo "Nginx部署完成！"
else
    echo "Nginx配置测试失败，恢复备份配置..."
    sudo cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
    sudo systemctl start nginx
    echo "已恢复原始配置"
fi