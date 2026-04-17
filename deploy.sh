#!/bin/bash
# SubLearn 一键部署脚本
# 在服务器上执行: bash deploy.sh

set -e
echo "========================================="
echo "  SubLearn 一键部署"
echo "========================================="

# 1. 安装 Docker
echo ""
echo "[1/6] 安装 Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker 安装完成"
else
    echo "✅ Docker 已安装"
fi

if ! docker compose version &> /dev/null; then
    apt-get update -qq && apt-get install -y -qq docker-compose-plugin
    echo "✅ Docker Compose 安装完成"
else
    echo "✅ Docker Compose 已安装"
fi

# 2. 创建项目目录
echo ""
echo "[2/6] 创建项目目录..."
mkdir -p /opt/sublearn
cd /opt/sublearn

# 3. 创建媒体存储目录
echo ""
echo "[3/6] 创建存储目录..."
mkdir -p /data/sublearn/media

# 4. 解压项目文件（如果还没有）
echo ""
echo "[4/6] 检查项目文件..."
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 项目文件不存在！请先上传 sublearn.tar.gz 到 /opt/sublearn/"
    echo "   在你的电脑上运行: scp sublearn.tar.gz root@118.178.178.123:/opt/sublearn/"
    echo "   然后在服务器上运行: cd /opt/sublearn && tar xzf sublearn.tar.gz"
    exit 1
fi
echo "✅ 项目文件已就绪"

# 5. 开放 80 端口防火墙
echo ""
echo "[5/6] 配置防火墙..."
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 22/tcp 2>/dev/null || true
    echo "✅ 防火墙已配置"
else
    echo "⚠️ 未检测到 ufw，请确保阿里云安全组已开放 80 端口"
fi

# 6. 启动服务
echo ""
echo "[6/6] 启动服务..."
docker compose down 2>/dev/null || true
docker compose up -d --build

echo ""
echo "========================================="
echo "  ✅ 部署完成！"
echo "========================================="
echo ""
echo "访问地址: http://118.178.178.123"
echo "手机/iPad 也可以用这个地址访问"
echo ""
echo "常用命令:"
echo "  查看日志: cd /opt/sublearn && docker compose logs -f"
echo "  重启:     cd /opt/sublearn && docker compose restart"
echo "  停止:     cd /opt/sublearn && docker compose stop"
echo ""