#!/bin/bash

# LonicFLex Multi-Agent System Deployment Script
# Usage: ./scripts/deploy.sh [environment] [strategy]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$ROOT_DIR/logs/deploy.log"

# Default values
ENVIRONMENT="${1:-development}"
STRATEGY="${2:-rolling}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
BACKUP_ENABLED="${BACKUP_ENABLED:-true}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Validate environment
validate_environment() {
    case $ENVIRONMENT in
        development|staging|production)
            log "Deploying to $ENVIRONMENT environment"
            ;;
        *)
            error "Invalid environment: $ENVIRONMENT. Must be development, staging, or production"
            ;;
    esac
}

# Validate deployment strategy
validate_strategy() {
    case $STRATEGY in
        rolling|blue-green|canary|recreate)
            log "Using $STRATEGY deployment strategy"
            ;;
        *)
            error "Invalid strategy: $STRATEGY. Must be rolling, blue-green, canary, or recreate"
            ;;
    esac
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running"
    fi
    
    # Check if required environment variables are set
    if [[ $ENVIRONMENT == "production" ]]; then
        if [[ -z "$SLACK_BOT_TOKEN" || -z "$GITHUB_TOKEN" ]]; then
            error "Production deployment requires SLACK_BOT_TOKEN and GITHUB_TOKEN"
        fi
    fi
    
    # Check disk space
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
    if [[ $AVAILABLE_SPACE -lt 1000000 ]]; then # Less than 1GB
        warning "Low disk space: ${AVAILABLE_SPACE}KB available"
    fi
    
    # Check if ports are available
    if netstat -tuln | grep -q ":3000 "; then
        warning "Port 3000 is already in use"
    fi
    
    success "Pre-deployment checks passed"
}

# Create backup
create_backup() {
    if [[ $BACKUP_ENABLED == "true" ]]; then
        log "Creating backup..."
        
        cd "$ROOT_DIR"
        npm run demo-backup || warning "Backup failed but continuing deployment"
        
        success "Backup created"
    else
        log "Backup disabled, skipping..."
    fi
}

# Build Docker image
build_image() {
    log "Building Docker image..."
    
    cd "$ROOT_DIR"
    
    # Build the image
    docker build -t "lonicflex-multi-agent:$IMAGE_TAG" . || error "Docker build failed"
    
    # Tag for registry if needed
    if [[ -n "$DOCKER_REGISTRY" ]]; then
        docker tag "lonicflex-multi-agent:$IMAGE_TAG" "$DOCKER_REGISTRY/lonicflex-multi-agent:$IMAGE_TAG"
        docker push "$DOCKER_REGISTRY/lonicflex-multi-agent:$IMAGE_TAG" || error "Docker push failed"
    fi
    
    success "Docker image built and tagged"
}

# Deploy with rolling strategy
deploy_rolling() {
    log "Executing rolling deployment..."
    
    cd "$ROOT_DIR"
    
    # Update docker-compose with new image
    export IMAGE_TAG
    export NODE_ENV="$ENVIRONMENT"
    
    # Rolling update
    docker-compose up -d --scale lonicflex=2 || error "Failed to scale up"
    sleep 10
    
    # Health check new instances
    check_health "http://localhost:3000/health" || error "Health check failed"
    
    # Remove old instances
    docker-compose up -d --scale lonicflex=1 || error "Failed to scale down"
    
    success "Rolling deployment completed"
}

# Deploy with blue-green strategy
deploy_blue_green() {
    log "Executing blue-green deployment..."
    
    cd "$ROOT_DIR"
    
    # Create green environment
    docker-compose -f docker-compose.yml -f docker-compose.green.yml up -d || error "Failed to start green environment"
    
    # Health check green environment
    check_health "http://localhost:3001/health" || error "Green environment health check failed"
    
    # Run smoke tests on green
    run_smoke_tests "http://localhost:3001" || error "Smoke tests failed on green environment"
    
    # Switch traffic to green
    switch_traffic_to_green || error "Failed to switch traffic"
    
    # Stop blue environment
    docker-compose -f docker-compose.yml down || error "Failed to stop blue environment"
    
    # Rename green to blue
    docker-compose -f docker-compose.green.yml down
    docker-compose up -d || error "Failed to start new blue environment"
    
    success "Blue-green deployment completed"
}

# Deploy with canary strategy
deploy_canary() {
    log "Executing canary deployment..."
    
    cd "$ROOT_DIR"
    
    # Deploy canary (10% traffic)
    docker-compose -f docker-compose.yml -f docker-compose.canary.yml up -d || error "Failed to start canary"
    
    # Monitor canary for 5 minutes
    log "Monitoring canary deployment..."
    sleep 300
    
    # Check canary metrics
    if check_canary_metrics; then
        log "Canary metrics look good, proceeding with full deployment"
        deploy_rolling
    else
        error "Canary metrics failed, rolling back"
    fi
    
    success "Canary deployment completed"
}

# Deploy with recreate strategy
deploy_recreate() {
    log "Executing recreate deployment..."
    
    cd "$ROOT_DIR"
    
    # Stop all services
    docker-compose down || error "Failed to stop services"
    
    # Start with new image
    export IMAGE_TAG
    export NODE_ENV="$ENVIRONMENT"
    docker-compose up -d || error "Failed to start services"
    
    # Wait for services to be ready
    sleep 30
    
    # Health check
    check_health "http://localhost:3000/health" || error "Health check failed"
    
    success "Recreate deployment completed"
}

# Health check function
check_health() {
    local url="$1"
    local max_attempts=30
    local attempt=1
    
    log "Checking health at $url..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$url" > /dev/null; then
            success "Health check passed"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, retrying in 10s..."
        sleep 10
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
}

# Run smoke tests
run_smoke_tests() {
    local base_url="$1"
    
    log "Running smoke tests against $base_url..."
    
    # Test health endpoint
    curl -sf "$base_url/health" > /dev/null || return 1
    
    # Test API endpoint
    curl -sf "$base_url/api/v1/health" > /dev/null || return 1
    
    # Test monitoring endpoint
    curl -sf "http://localhost:3001/api/health" > /dev/null || return 1
    
    success "Smoke tests passed"
    return 0
}

# Check canary metrics
check_canary_metrics() {
    log "Checking canary metrics..."
    
    # Simple metric check - in production this would be more sophisticated
    local error_rate=$(curl -s "http://localhost:3001/api/metrics" | jq -r '.error_rate // 0')
    
    if [[ $(echo "$error_rate < 5" | bc -l) -eq 1 ]]; then
        return 0
    else
        return 1
    fi
}

# Switch traffic (placeholder for load balancer integration)
switch_traffic_to_green() {
    log "Switching traffic to green environment..."
    
    # Update nginx config or load balancer
    # This is a placeholder - actual implementation depends on your load balancer
    
    return 0
}

# Post-deployment tasks
post_deployment_tasks() {
    log "Running post-deployment tasks..."
    
    # Update monitoring
    curl -X POST "http://localhost:3001/api/deployment" \
        -H "Content-Type: application/json" \
        -d "{\"environment\":\"$ENVIRONMENT\",\"version\":\"$IMAGE_TAG\",\"strategy\":\"$STRATEGY\"}" || true
    
    # Send notification
    send_notification "Deployment completed successfully" "success"
    
    # Clean up old images
    docker image prune -f || true
    
    success "Post-deployment tasks completed"
}

# Send notification
send_notification() {
    local message="$1"
    local status="$2"
    
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🚀 LonicFLex Deployment: $message\",\"channel\":\"#deployments\"}" || true
    fi
    
    log "Notification sent: $message"
}

# Rollback function
rollback() {
    log "Rolling back deployment..."
    
    # Stop current deployment
    docker-compose down || true
    
    # Restore from backup
    if [[ -f "backups/latest-backup.tar.gz" ]]; then
        log "Restoring from backup..."
        cd "$ROOT_DIR"
        npm run restore:latest || error "Backup restore failed"
    fi
    
    # Start previous version
    docker-compose up -d || error "Rollback failed"
    
    # Health check
    check_health "http://localhost:3000/health" || error "Rollback health check failed"
    
    send_notification "Deployment rolled back" "warning"
    success "Rollback completed"
}

# Cleanup on exit
cleanup() {
    if [[ $? -ne 0 ]]; then
        error "Deployment failed, initiating rollback..."
        rollback
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Main deployment function
main() {
    log "Starting LonicFLex deployment..."
    log "Environment: $ENVIRONMENT"
    log "Strategy: $STRATEGY"
    log "Image Tag: $IMAGE_TAG"
    
    # Create logs directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    validate_environment
    validate_strategy
    pre_deployment_checks
    create_backup
    build_image
    
    # Execute deployment strategy
    case $STRATEGY in
        rolling)
            deploy_rolling
            ;;
        blue-green)
            deploy_blue_green
            ;;
        canary)
            deploy_canary
            ;;
        recreate)
            deploy_recreate
            ;;
    esac
    
    # Health check
    check_health "http://localhost:3000/health"
    
    # Run smoke tests
    run_smoke_tests "http://localhost:3000"
    
    post_deployment_tasks
    
    success "Deployment completed successfully!"
    log "Deployment log saved to $LOG_FILE"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [environment] [strategy]"
        echo "Environments: development, staging, production"
        echo "Strategies: rolling, blue-green, canary, recreate"
        exit 0
        ;;
    --rollback)
        rollback
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac