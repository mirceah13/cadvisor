# Production Deployment Guide

## Prerequisites

- Kubernetes cluster (1.20+) or Docker Swarm
- PostgreSQL 16+ with pgvector extension
- Redis 7+
- S3-compatible object storage (AWS S3, MinIO, etc.)
- Domain name with SSL certificate
- SMTP server (for email notifications)
- GPU instance (optional, for faster Ollama inference)

## Environment Variables (Production)

```env
# Application
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/buildguard?sslmode=require
DB_POOL_SIZE=50
DB_MAX_OVERFLOW=100

# Redis
REDIS_URL=redis://redis:6379/0

# Security (GENERATE STRONG SECRETS!)
JWT_SECRET=<generate-64-char-random-string>
SESSION_SECRET=<generate-64-char-random-string>

# Storage (AWS S3)
MINIO_ENDPOINT=s3.amazonaws.com
MINIO_ROOT_USER=<aws-access-key>
MINIO_ROOT_PASSWORD=<aws-secret-key>
MINIO_USE_SSL=true
MINIO_BUCKET_NAME=buildguard-production-files
MINIO_REGION=us-east-1

# CORS (production domains)
CORS_ORIGINS=https://buildguard.example.com,https://app.buildguard.example.com
ALLOWED_HOSTS=buildguard.example.com,app.buildguard.example.com

# Ollama (dedicated GPU instance)
OLLAMA_BASE_URL=http://ollama-gpu:11434

# Email
ENABLE_EMAIL_VERIFICATION=true
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<sendgrid-api-key>
SMTP_FROM_EMAIL=noreply@buildguard.example.com

# Monitoring
SENTRY_DSN=<sentry-dsn>
ENABLE_METRICS=true

# Billing (Stripe)
BILLING_PROVIDER=stripe
STRIPE_SECRET_KEY=<stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
```

## Docker Production Images

### Build Production Images

```bash
# API Service
docker build -f infra/docker/api.Dockerfile -t buildguard/api:1.0.0 .

# AI Service
docker build -f infra/docker/ai.Dockerfile -t buildguard/ai:1.0.0 .

# Web Frontend
docker build -f infra/docker/web.Dockerfile --target production -t buildguard/web:1.0.0 .
```

### Push to Registry

```bash
docker tag buildguard/api:1.0.0 registry.example.com/buildguard/api:1.0.0
docker push registry.example.com/buildguard/api:1.0.0

docker tag buildguard/ai:1.0.0 registry.example.com/buildguard/ai:1.0.0
docker push registry.example.com/buildguard/ai:1.0.0

docker tag buildguard/web:1.0.0 registry.example.com/buildguard/web:1.0.0
docker push registry.example.com/buildguard/web:1.0.0
```

## Kubernetes Deployment

### 1. Create Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: cadvisor
```

### 2. Secrets

```bash
kubectl create secret generic buildguard-secrets \
  --from-literal=jwt-secret=<secret> \
  --from-literal=session-secret=<secret> \
  --from-literal=database-url=<url> \
  --from-literal=redis-url=<url> \
  -n buildguard
```

### 3. ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: buildguard-config
  namespace: buildguard
data:
  ENVIRONMENT: "production"
  LOG_LEVEL: "info"
  # Add other non-sensitive config
```

### 4. Deployments

**API Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: buildguard-api
  namespace: buildguard
spec:
  replicas: 3
  selector:
    matchLabels:
      app: buildguard-api
  template:
    metadata:
      labels:
        app: buildguard-api
    spec:
      containers:
      - name: api
        image: registry.example.com/buildguard/api:1.0.0
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: buildguard-config
        - secretRef:
            name: buildguard-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
```

**Similar deployments for:**
- AI Service (2 replicas, GPU nodeSelector)
- Celery Worker (4 replicas, CPU-heavy)
- Web Frontend (3 replicas behind CDN)

### 5. Services & Ingress

```yaml
apiVersion: v1
kind: Service
metadata:
  name: buildguard-api
  namespace: buildguard
spec:
  selector:
    app: buildguard-api
  ports:
  - port: 8000
    targetPort: 8000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: buildguard-ingress
  namespace: buildguard
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - app.buildguard.example.com
    secretName: buildguard-tls
  rules:
  - host: app.buildguard.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: buildguard-api
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: buildguard-web
            port:
              number: 3000
```

## Database Migration

```bash
# Run migrations via Job
kubectl run migration-job \
  --image=registry.example.com/buildguard/api:1.0.0 \
  --env-from=secret/buildguard-secrets \
  --restart=Never \
  --command -- alembic upgrade head
```

## Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: buildguard-api-hpa
  namespace: buildguard
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: buildguard-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Monitoring

### Prometheus Metrics

```yaml
apiVersion: v1
kind: Service
metadata:
  name: buildguard-api-metrics
  namespace: buildguard
  labels:
    prometheus: "true"
spec:
  selector:
    app: buildguard-api
  ports:
  - port: 9090
    name: metrics
```

### Grafana Dashboards

- API request rate, latency, errors
- Celery task queue length, processing time
- Database connection pool usage
- File upload/download metrics
- Analysis run duration
- LLM token usage

## Backup Strategy

### Database Backups

```bash
# Daily automated backups to S3
pg_dump -h $DB_HOST -U $DB_USER -d buildguard | gzip > backup-$(date +%Y%m%d).sql.gz
aws s3 cp backup-$(date +%Y%m%d).sql.gz s3://buildguard-backups/db/
```

### S3 Object Versioning

Enable versioning on the S3 bucket for file uploads.

## Disaster Recovery

1. **RTO (Recovery Time Objective)**: 1 hour
2. **RPO (Recovery Point Objective)**: 15 minutes

**Recovery Steps:**
1. Restore database from latest backup
2. Deploy application from latest stable images
3. Verify health checks pass
4. Restore DNS and ingress routes

## Security Checklist

- [ ] All secrets in external secret manager (AWS Secrets Manager, Vault)
- [ ] Database connections use SSL
- [ ] S3 bucket has encryption at rest enabled
- [ ] API rate limiting configured
- [ ] WAF rules active (AWS WAF, Cloudflare)
- [ ] DDoS protection enabled
- [ ] Audit logs shipped to SIEM
- [ ] Regular security scans (Trivy, Snyk)
- [ ] Least privilege IAM roles
- [ ] Network policies for pod-to-pod communication

## Cost Optimization

- Use spot/preemptible instances for Celery workers
- Enable S3 lifecycle policies for old files
- Use CloudFront/CDN for static assets
- Implement caching (Redis) aggressively
- Use reserved instances for baseline capacity

## Scaling Guidelines

**< 100 users:**
- 2 API pods
- 1 AI pod
- 2 Celery workers

**100-1000 users:**
- 5 API pods
- 2 AI pods (with GPU)
- 5 Celery workers

**1000+ users:**
- 10+ API pods
- 4+ AI pods (GPU cluster)
- 10+ Celery workers
- Consider microservices split

## Support

For production support, contact: devops@buildguard.example
