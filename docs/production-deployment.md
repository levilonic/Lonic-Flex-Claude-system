# Production Deployment Guide

## 📋 Pre-Deployment Checklist

### System Requirements
- [ ] Linux server (Ubuntu 20.04+ or CentOS 8+)
- [ ] Docker 20.10+ and Docker Compose 2.0+
- [ ] Node.js 18+ (if not using Docker)
- [ ] At least 4GB RAM, 2 CPU cores
- [ ] 20GB+ available disk space
- [ ] SSL certificates configured

### Network Requirements
- [ ] Ports 80, 443 open for HTTP/HTTPS
- [ ] Port 3000 for application (internal)
- [ ] Port 3001 for monitoring dashboard
- [ ] Port 6379 for Redis (internal)
- [ ] Firewall configured properly

### Environment Setup
- [ ] Production environment variables configured
- [ ] SSL certificates obtained and installed
- [ ] Domain name configured and DNS updated
- [ ] CDN configured (optional but recommended)
- [ ] Backup storage configured

### Security
- [ ] Security scanning completed
- [ ] Dependencies updated to latest secure versions
- [ ] API keys and secrets properly secured
- [ ] Access control configured
- [ ] HTTPS enforced

### Monitoring & Logging
- [ ] Log aggregation configured
- [ ] Monitoring alerts configured
- [ ] Performance monitoring setup
- [ ] Backup strategy tested
- [ ] Disaster recovery plan reviewed

---

## 🚀 Deployment Methods

### Method 1: Docker Compose (Recommended)

**Step 1: Prepare the Server**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**Step 2: Deploy the Application**
```bash
# Clone repository
git clone https://github.com/humanlayer/12-factor-agents.git
cd 12-factor-agents

# Create production environment file
cp .env.example .env.production
# Edit with your production values

# Create necessary directories
mkdir -p logs backups uploads security-reports

# Start services
docker-compose -f docker-compose.yml --env-file .env.production up -d
```

**Step 3: Verify Deployment**
```bash
# Check services status
docker-compose ps

# View logs
docker-compose logs -f lonicflex

# Test endpoints
curl http://localhost/health
curl http://localhost:3001/api/health
```

### Method 2: Kubernetes

**Step 1: Prepare Kubernetes Manifests**
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: lonicflex
---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: lonicflex-config
  namespace: lonicflex
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lonicflex-app
  namespace: lonicflex
spec:
  replicas: 3
  selector:
    matchLabels:
      app: lonicflex
  template:
    metadata:
      labels:
        app: lonicflex
    spec:
      containers:
      - name: lonicflex
        image: ghcr.io/humanlayer/lonicflex:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: lonicflex-config
        - secretRef:
            name: lonicflex-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

**Step 2: Deploy to Kubernetes**
```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n lonicflex
kubectl get services -n lonicflex

# View logs
kubectl logs -f deployment/lonicflex-app -n lonicflex
```

### Method 3: Manual Installation

**Step 1: Install Dependencies**
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx
```

**Step 2: Deploy Application**
```bash
# Clone and setup application
git clone https://github.com/humanlayer/12-factor-agents.git
cd 12-factor-agents
npm ci --production

# Create production configuration
cp .env.example .env.production
# Edit with production values

# Initialize database
npm run demo-db

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

---

## 🔧 Configuration

### Environment Variables

**Core Settings**
```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
```

**Database**
```bash
DB_PATH=/app/database/agents.db
DB_WAL_MODE=true
DB_BACKUP_ENABLED=true
```

**Security**
```bash
SESSION_SECRET=your-strong-session-secret
JWT_SECRET=your-jwt-secret-key
API_RATE_LIMIT=100
CORS_ORIGIN=https://yourdomain.com
```

**Integrations**
```bash
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret

GITHUB_TOKEN=your-github-token
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

**Monitoring**
```bash
MONITORING_ENABLED=true
METRICS_RETENTION_DAYS=30
ALERT_WEBHOOK_URL=your-alert-webhook
SLACK_MONITORING_WEBHOOK=your-monitoring-webhook
```

**Performance**
```bash
CLUSTERING_ENABLED=true
WORKER_COUNT=0  # 0 = auto (CPU count)
CACHE_TTL=300000
COMPRESSION_ENABLED=true
```

### SSL Configuration

**Option 1: Let's Encrypt (Free)**
```bash
# Install Certbot
sudo snap install --classic certbot

# Generate certificates
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

**Option 2: Custom Certificates**
```bash
# Create SSL directory
sudo mkdir -p /etc/nginx/ssl

# Copy your certificates
sudo cp your-cert.pem /etc/nginx/ssl/cert.pem
sudo cp your-key.pem /etc/nginx/ssl/key.pem

# Set permissions
sudo chmod 600 /etc/nginx/ssl/key.pem
sudo chmod 644 /etc/nginx/ssl/cert.pem
```

---

## 🏗️ Infrastructure Setup

### Load Balancer Configuration

**Nginx Configuration**
```nginx
# /etc/nginx/sites-available/lonicflex
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Enable the site**
```bash
sudo ln -s /etc/nginx/sites-available/lonicflex /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Database Optimization

**SQLite Production Settings**
```javascript
// In your application
const db = new sqlite3.Database('database/agents.db', (err) => {
    if (err) throw err;
    
    // Production optimizations
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA synchronous = NORMAL');
    db.run('PRAGMA cache_size = 1000000');
    db.run('PRAGMA temp_store = memory');
});
```

**Database Backup Strategy**
```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/database"
DB_PATH="/app/database/agents.db"

mkdir -p $BACKUP_DIR
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/agents_$DATE.db'"

# Compress backup
gzip "$BACKUP_DIR/agents_$DATE.db"

# Keep only last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
```

### Monitoring Setup

**Prometheus Configuration**
```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'lonicflex'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    
  - job_name: 'nginx'
    static_configs:
      - targets: ['localhost:9113']
```

**Grafana Dashboards**
- Import dashboard ID: 12345 (LonicFLex overview)
- Configure data source: Prometheus
- Set up alerts for critical metrics

---

## 📊 Monitoring & Alerting

### Key Metrics to Monitor

**Application Metrics**
- Response time (< 2s average)
- Error rate (< 1%)
- Request throughput
- Memory usage (< 80%)
- CPU usage (< 70%)

**Infrastructure Metrics**
- Disk space (> 20% free)
- Network I/O
- Database connections
- SSL certificate expiry

**Business Metrics**
- Successful agent workflows
- Slack integration usage
- GitHub webhook processing
- User authentication events

### Alert Configuration

**Critical Alerts** (Page immediately)
- All servers down
- Error rate > 5%
- Database connection failures
- SSL certificate expiring < 7 days

**Warning Alerts** (Notify during business hours)
- Response time > 5s
- Memory usage > 85%
- Disk space < 30%
- Failed backup jobs

**Slack Notifications**
```bash
# Configure webhook in environment
SLACK_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Test alert
curl -X POST $SLACK_ALERT_WEBHOOK \
  -H 'Content-type: application/json' \
  --data '{"text":"🚨 Production Alert: Test notification"}'
```

---

## 🔐 Security Hardening

### Server Security

**Firewall Configuration**
```bash
# UFW (Ubuntu)
sudo ufw enable
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw deny 3000/tcp # Block direct app access
```

**Security Updates**
```bash
# Enable automatic security updates
sudo dpkg-reconfigure unattended-upgrades

# Or manual approach
sudo apt update && sudo apt upgrade -y
```

### Application Security

**Environment Variables**
```bash
# Use strong secrets
openssl rand -base64 32  # Generate strong passwords

# Restrict file permissions
chmod 600 .env.production
chown app:app .env.production
```

**SSL/TLS Configuration**
```bash
# Test SSL configuration
curl -I https://yourdomain.com
openssl s_client -connect yourdomain.com:443

# Use SSL Labs test
# https://www.ssllabs.com/ssltest/
```

---

## 🔄 CI/CD Integration

### GitHub Actions Deployment

**Production Workflow**
```yaml
# .github/workflows/production-deploy.yml
name: Production Deployment

on:
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to production
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.PROD_HOST }}
        username: ${{ secrets.PROD_USER }}
        key: ${{ secrets.PROD_SSH_KEY }}
        script: |
          cd /opt/lonicflex
          git pull origin main
          docker-compose down
          docker-compose pull
          docker-compose up -d
          sleep 30
          curl -f http://localhost/health
```

### Automated Deployment Script

**deployment.sh**
```bash
#!/bin/bash
set -e

echo "🚀 Starting production deployment..."

# Backup current version
docker-compose exec lonicflex npm run demo-backup

# Pull latest changes
git pull origin main

# Build new images
docker-compose build --no-cache

# Run database migrations if needed
docker-compose run --rm lonicflex npm run migrate

# Deploy with zero-downtime
docker-compose up -d --scale lonicflex=2
sleep 30
curl -f http://localhost/health

# Scale back to normal
docker-compose up -d --scale lonicflex=1

# Clean up old images
docker image prune -f

echo "✅ Deployment completed successfully!"
```

---

## 🔧 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Find process using port
sudo lsof -i :3000
sudo kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

**Database Lock Issues**
```bash
# Check for WAL files
ls -la database/

# Reset database if corrupted
sqlite3 database/agents.db "PRAGMA integrity_check;"
```

**Memory Issues**
```bash
# Check memory usage
free -h
htop

# Restart services
docker-compose restart lonicflex

# Check logs
docker-compose logs lonicflex
```

**SSL Certificate Issues**
```bash
# Check certificate validity
openssl x509 -in /etc/nginx/ssl/cert.pem -text -noout

# Renew Let's Encrypt certificate
sudo certbot renew --force-renewal
```

### Performance Issues

**Slow Response Times**
1. Check CPU and memory usage
2. Review database query performance
3. Enable caching
4. Add more worker processes
5. Optimize Nginx configuration

**High Memory Usage**
1. Enable garbage collection monitoring
2. Check for memory leaks
3. Reduce cache size
4. Restart services periodically

### Recovery Procedures

**Database Corruption**
```bash
# Restore from backup
cd /opt/lonicflex
npm run restore:latest

# Or manual restore
cp backups/latest-backup.db database/agents.db
```

**Complete System Failure**
1. Restore from infrastructure backup
2. Deploy latest version
3. Restore database from backup
4. Verify all services
5. Update DNS if needed

---

## 📈 Scaling Considerations

### Horizontal Scaling

**Multiple Application Instances**
```yaml
# docker-compose.yml
services:
  lonicflex:
    image: lonicflex:latest
    deploy:
      replicas: 3
    depends_on:
      - redis
      - db
```

**Database Scaling**
- Consider PostgreSQL for higher load
- Implement read replicas
- Use connection pooling
- Regular performance monitoring

### Vertical Scaling

**Resource Optimization**
- Monitor CPU/memory usage
- Adjust container limits
- Optimize Node.js heap size
- Use clustering in production

---

## 📞 Support & Maintenance

### Regular Maintenance Tasks

**Daily**
- [ ] Check application health
- [ ] Review error logs
- [ ] Verify backup completion

**Weekly** 
- [ ] Security updates
- [ ] Performance review
- [ ] Certificate expiry check
- [ ] Database optimization

**Monthly**
- [ ] Full system backup test
- [ ] Security audit
- [ ] Capacity planning review
- [ ] Disaster recovery test

### Getting Help

- **Documentation**: `/docs` directory
- **Logs**: `logs/` directory or `docker-compose logs`
- **Health Checks**: `http://yourdomain.com/health`
- **Monitoring**: `http://yourdomain.com:3001`
- **Issues**: GitHub Issues
- **Support**: support@lonicflex.dev

---

*Last updated: September 4, 2025*