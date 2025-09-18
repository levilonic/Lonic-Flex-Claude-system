# LonicFLex External Webhook Setup - Complete Guide

## 🎉 Current Status: Infrastructure Ready ✅

**Docker Services**: All 7 services containerized and operational
**Security**: Webhook signature verification implemented and tested
**Infrastructure**: nginx reverse proxy with proper routing
**Credentials**: GitHub webhook secret generated and configured

## 🚀 Option 1: Development Setup with ngrok (Recommended)

### Prerequisites
✅ ngrok downloaded and available
✅ Docker services running
✅ Webhook secret configured

### Step 1: ngrok Authentication (One-time setup)
```bash
# Sign up for free ngrok account: https://dashboard.ngrok.com/signup
# Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
./ngrok.exe authtoken YOUR_AUTHTOKEN_HERE
```

### Step 2: Start External Tunnel
```bash
# Start ngrok tunnel (keep this running)
./ngrok.exe http 80

# You'll see output like:
# Forwarding: https://abc123-def456.ngrok-free.app -> http://localhost:80
```

### Step 3: Configure GitHub Repository Webhook
1. Go to: https://github.com/levilonic/Lonic-Flex-Claude-system/settings/hooks
2. Click "Add webhook"
3. **Payload URL**: `https://YOUR-NGROK-URL.ngrok-free.app/webhook/github`
4. **Content type**: `application/json`
5. **Secret**: `569bd9cd01b0463c988cc5f32bf694feeeb44b18b1fa1a702d7160ee772d0fc6`
6. **Events**: Select "Issues", "Issue comments", "Push events", "Pull requests"
7. Click "Add webhook"

### Step 4: Test @claude Integration
1. Create a new issue in your repository
2. Add comment: `@claude run health-check`
3. Check ngrok terminal for webhook delivery
4. Verify LonicFLex processing in Docker logs:
   ```bash
   docker logs lonicflex-lonicflex-webhooks-1 -f
   ```

## 🌐 Option 2: Production Cloud Deployment

### AWS/GCP/Azure Setup
1. Deploy Docker stack to cloud instance
2. Configure domain DNS: `webhooks.yourdomain.com`
3. Enable SSL in nginx.conf (certificates already created)
4. Update GitHub webhook URL to production domain

### SSL Configuration (Ready to enable)
```nginx
# Uncomment these lines in nginx.conf:
listen 443 ssl http2;
ssl_certificate /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;
```

## 🧪 Validation & Testing

### Webhook Security Validation ✅
- Signature verification: ✅ Working (rejects unsigned requests)
- HMAC SHA-256: ✅ Implemented
- Secret validation: ✅ Configured
- Rate limiting: ✅ nginx configuration active

### Service Communication ✅
- Docker networking: ✅ All services communicating
- Health endpoints: ✅ All responding
- nginx routing: ✅ Webhook traffic properly routed
- Container restart: ✅ Services auto-recover

### @claude Mention Detection (Ready)
- GitHub webhook events: ✅ endpoint configured
- Comment parsing: ✅ implemented in webhook service
- Workflow triggering: ✅ integration with master service
- Run ID generation: ✅ operational

## 📊 Current Service Architecture

```
GitHub → ngrok tunnel → nginx:80 → webhook service:3008
                                 ↓
                        master service:3007 → workflow execution
```

### External Endpoints Available
- **GitHub Webhooks**: `http://localhost/webhook/github` (via ngrok)
- **Health Check**: `http://localhost/health`
- **API Access**: `http://localhost/api/*`

## 🚨 Security Implementation

### GitHub Webhook Security ✅
- **Secret**: 64-character hex string configured
- **Signature**: HMAC SHA-256 verification
- **Validation**: Timing-safe comparison prevents attacks
- **Replay Protection**: Request logging and monitoring

### nginx Security ✅
- **Rate Limiting**: 10 requests/second for webhooks
- **Security Headers**: X-Frame-Options, XSS Protection, etc.
- **SSL Ready**: Certificate infrastructure prepared
- **Input Validation**: Request size limits and type validation

## 📋 Troubleshooting

### Common Issues & Solutions

**1. ngrok Authentication Error**
```bash
# Solution: Get authtoken from ngrok dashboard
./ngrok.exe authtoken YOUR_TOKEN
```

**2. Webhook Delivery Failed**
```bash
# Check ngrok is running and accessible
curl https://YOUR-NGROK-URL.ngrok-free.app/health

# Check Docker services
docker-compose ps
```

**3. @claude Mentions Not Processing**
```bash
# Check webhook service logs
docker logs lonicflex-lonicflex-webhooks-1 --tail=20

# Verify signature secret matches
echo $GITHUB_WEBHOOK_SECRET
```

### Debug Commands
```bash
# Check all services status
docker-compose ps

# Monitor webhook traffic
docker logs lonicflex-lonicflex-webhooks-1 -f

# Test local webhook processing
curl -X POST http://localhost:3008/webhook/github -H "Content-Type: application/json" -d '{}'
# (Should return "Invalid signature" - proving security works)

# Check nginx routing
curl http://localhost/health
curl http://localhost/webhook/health  # Should route to master service
```

## 🎯 Success Criteria

### Phase 3B Complete When:
✅ Docker infrastructure deployed (7/7 services)
✅ nginx reverse proxy operational
✅ Webhook security implemented and tested
✅ SSL certificate infrastructure ready
✅ External access configuration documented
✅ GitHub integration ready (webhook endpoint operational)

### Ready for Real-World Use:
- Set up ngrok tunnel (1 minute)
- Configure GitHub webhook (2 minutes)
- Test @claude mentions (1 minute)
- **Total setup time: 4 minutes from infrastructure ready to live integration**

## 🚀 Next Steps: Advanced Workflows

With external webhook infrastructure complete, you can now:

1. **Test @claude Health Checks**: `@claude run health-check`
2. **Develop Custom Workflows**: Add new templates to workflow service
3. **Enhanced Commands**: Implement `@claude run deploy`, `@claude run test-all`
4. **Monitoring**: Set up comprehensive logging and alerting
5. **Production Deployment**: Move from ngrok to cloud infrastructure

---

**🎉 Phase 3B External Webhook Infrastructure: COMPLETE ✅**

*LonicFLex Foundation v0 ready for real-world GitHub integration*