# SubLearn 阿里云部署指南

## 1. 购买服务器

1. 访问 [阿里云轻量应用服务器](https://www.aliyun.com/product/swas)
2. 选择配置：**2核4G**，系统选择 **Ubuntu 22.04**
3. 购买完成后记下公网IP地址

## 2. 连接服务器

```bash
ssh root@<你的服务器IP>
```

## 3. 安装 Docker

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 安装 Docker Compose
apt install docker-compose-plugin -y

# 验证安装
docker --version
docker compose version
```

## 4. 部署应用

```bash
# 克隆项目（或者通过 scp 上传）
git clone <你的git仓库地址> /opt/sublearn
cd /opt/sublearn

# 配置环境变量
cp backend/.env.example backend/.env
nano backend/.env  # 填入你的 API Key

# 构建前端
cd frontend
# 如果服务器上没有 Node.js，可以在本地构建后上传 dist 目录
# 或者安装 Node.js:
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs -y
npm install
npm run build
cd ..

# 启动服务
docker compose up -d --build

# 查看日志
docker compose logs -f
```

## 5. 访问

打开浏览器访问 `http://<你的服务器IP>`

## 6. 配置域名和 HTTPS（可选）

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx -y

# 获取证书（需要先将域名解析到服务器IP）
certbot --nginx -d yourdomain.com

# 自动续期
crontab -e
# 添加: 0 0 1 * * certbot renew --quiet
```

## 7. 更新应用

```bash
cd /opt/sublearn
git pull
cd frontend && npm install && npm run build && cd ..
docker compose up -d --build
```

## 8. 常见问题

### 视频加载很慢
- 检查服务器带宽是否足够（建议至少 5Mbps）
- B站视频流直接从CDN获取，服务器只做代理转发

### 字幕提取失败
- 确认 `.env` 中的 API Key 已正确配置
- 检查 `docker compose logs backend` 查看错误日志

### iPad 无法访问
- 确保阿里云安全组开放了 80 端口（或 443 端口如果配了HTTPS）
- iPad 和服务器在同一网络环境下
