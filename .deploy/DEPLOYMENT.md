# Multimodal Library Deployment Guide

## 1. Server Requirements
- OS: Ubuntu 22.04 LTS
- RAM: 4GB+ (Redis + Node.js + PostgreSQL)
- CPU: 2 vCPUs+

## 2. Software Installation
```bash
# Install Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Install Redis
sudo apt-get install -y redis-server

# Install Nginx
sudo apt-get install -y nginx
```

## 3. Application Setup
```bash
git clone <repo_url>
cd book
npm install
cp .env.example .env # Configure DATABASE_URL and REDIS_URL
npx prisma migrate deploy
```

## 4. Process Management (PM2)
```bash
npm install -g pm2
pm2 start src/server/index.ts --name multimodal-backend --interpreter ts-node
pm2 start npm --name multimodal-frontend -- start
```

## 5. Nginx Configuration
Copy `.deploy/nginx.conf` to `/etc/nginx/sites-available/multimodal_library` and link it:
```bash
sudo ln -s /etc/nginx/sites-available/multimodal_library /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. SSL (Certbot)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d library.example.com
```
