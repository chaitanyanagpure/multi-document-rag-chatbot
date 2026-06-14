# VerbaFlow AI — Production Deployment Guide

> **Scope:** This guide covers deploying VerbaFlow AI to production on GCP GKE, AWS EKS, and Azure AKS.  
> For local development, see the [README](README.md).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Pre-deployment Checklist](#2-pre-deployment-checklist)
3. [Deploy on GCP GKE](#3-deploy-on-gcp-gke)
4. [Deploy on AWS EKS](#4-deploy-on-aws-eks)
5. [Deploy on Azure AKS](#5-deploy-on-azure-aks)
6. [Post-deployment Steps](#6-post-deployment-steps)
7. [Backup Strategy](#7-backup-strategy)
8. [Disaster Recovery](#8-disaster-recovery)
9. [Scaling Guidelines](#9-scaling-guidelines)

---

## 1. Prerequisites

### Common Tools

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install cert-manager CRDs (required for TLS)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml
```

### Container Registry

Ensure your Docker images have been pushed to GHCR:

```bash
# Build and push backend
docker build -t ghcr.io/your-org/verbaflow-backend:1.0.0 ./backend
docker push ghcr.io/your-org/verbaflow-backend:1.0.0

# Build and push frontend
docker build -t ghcr.io/your-org/verbaflow-frontend:1.0.0 ./frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com
docker push ghcr.io/your-org/verbaflow-frontend:1.0.0
```

---

## 2. Pre-deployment Checklist

Before deploying to any cloud provider, verify the following:

### Infrastructure
- [ ] DNS records pointing to your load balancer IP
- [ ] Domain verified and SSL certificate email configured
- [ ] Container registry access configured
- [ ] Secrets manager populated with all secrets
- [ ] Backup storage bucket created

### Configuration
- [ ] All placeholder values in `k8s/ingress.yaml` replaced with real domain
- [ ] All placeholder values in `k8s/secrets.yaml` replaced with real base64-encoded secrets
- [ ] `ALLOWED_ORIGINS` updated with your production domain
- [ ] Email/SMTP settings configured
- [ ] AI provider API keys set and verified

### Security
- [ ] `SECRET_KEY` is a cryptographically random 32+ character string
- [ ] `POSTGRES_PASSWORD` is a strong, unique password
- [ ] Default admin password will be changed on first login
- [ ] Rate limiting is enabled
- [ ] Firewall rules allow only necessary ports

---

## 3. Deploy on GCP GKE

### 3.1 Install gcloud CLI

```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
gcloud auth login
```

### 3.2 Enable required APIs

```bash
gcloud services enable \
  container.googleapis.com \
  containerregistry.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  dns.googleapis.com \
  compute.googleapis.com
```

### 3.3 Create the GKE Cluster

```bash
export PROJECT_ID=your-gcp-project-id
export CLUSTER_NAME=verbaflow-prod
export REGION=us-central1
export ZONE=us-central1-a

gcloud config set project $PROJECT_ID

# Create a production-grade GKE Autopilot cluster (recommended)
gcloud container clusters create-auto $CLUSTER_NAME \
  --region=$REGION \
  --release-channel=stable

# OR: Create a standard cluster with more control
gcloud container clusters create $CLUSTER_NAME \
  --region=$REGION \
  --num-nodes=3 \
  --min-nodes=2 \
  --max-nodes=10 \
  --enable-autoscaling \
  --machine-type=n2-standard-4 \
  --disk-size=100GB \
  --disk-type=pd-ssd \
  --enable-autorepair \
  --enable-autoupgrade \
  --release-channel=stable \
  --workload-pool=${PROJECT_ID}.svc.id.goog \
  --enable-shielded-nodes \
  --enable-ip-alias \
  --network=verbaflow-vpc \
  --subnetwork=verbaflow-subnet \
  --enable-private-nodes \
  --master-ipv4-cidr=172.16.0.0/28
```

### 3.4 Get credentials

```bash
gcloud container clusters get-credentials $CLUSTER_NAME --region=$REGION
kubectl cluster-info
```

### 3.5 Install NGINX Ingress Controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.replicaCount=2 \
  --set controller.resources.requests.cpu=100m \
  --set controller.resources.requests.memory=128Mi

# Wait for external IP assignment
kubectl get svc -n ingress-nginx -w
```

### 3.6 Install cert-manager

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.14.0 \
  --set installCRDs=true
```

### 3.7 Create DNS records

```bash
# Get the LoadBalancer external IP
LB_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "LoadBalancer IP: $LB_IP"

# Create A records in your DNS provider pointing to $LB_IP:
#   yourdomain.com     → $LB_IP
#   www.yourdomain.com → $LB_IP
#   api.yourdomain.com → $LB_IP  (optional)
```

### 3.8 Set up GCP Secret Manager (recommended over K8s Secrets)

```bash
# Store secrets in Secret Manager
gcloud secrets create verbaflow-postgres-password \
  --data-file=<(echo -n 'your_secure_db_password')

gcloud secrets create verbaflow-secret-key \
  --data-file=<(openssl rand -hex 32)

gcloud secrets create verbaflow-gemini-api-key \
  --data-file=<(echo -n 'your_gemini_key')

# Install External Secrets Operator to sync secrets to K8s
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace
```

### 3.9 Deploy VerbaFlow AI

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Apply ConfigMaps
kubectl apply -f k8s/configmap.yaml

# Apply Secrets (use real values — see pre-deployment checklist)
kubectl apply -f k8s/secrets.yaml

# Deploy PostgreSQL
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl rollout status statefulset/verbaflow-postgres -n verbaflow --timeout=120s

# Deploy Redis
kubectl apply -f k8s/redis-deployment.yaml
kubectl rollout status deployment/verbaflow-redis -n verbaflow --timeout=60s

# Deploy Backend
kubectl apply -f k8s/backend-deployment.yaml
kubectl rollout status deployment/verbaflow-backend -n verbaflow --timeout=180s

# Run migrations
kubectl exec -n verbaflow deploy/verbaflow-backend -- alembic upgrade head

# Deploy Frontend
kubectl apply -f k8s/frontend-deployment.yaml
kubectl rollout status deployment/verbaflow-frontend -n verbaflow --timeout=120s

# Apply Ingress (update yourdomain.com first!)
kubectl apply -f k8s/ingress.yaml

# Check all resources
kubectl get all -n verbaflow
```

### 3.10 Optional: Cloud SQL (Managed PostgreSQL)

For production, consider Cloud SQL instead of running Postgres in K8s:

```bash
# Create Cloud SQL PostgreSQL instance
gcloud sql instances create verbaflow-postgres \
  --database-version=POSTGRES_16 \
  --tier=db-custom-2-7680 \
  --region=$REGION \
  --storage-size=100GB \
  --storage-type=SSD \
  --storage-auto-increase \
  --backup-start-time=02:00 \
  --enable-point-in-time-recovery \
  --deletion-protection

# Create database
gcloud sql databases create verbaflow --instance=verbaflow-postgres

# Create user
gcloud sql users create verbaflow \
  --instance=verbaflow-postgres \
  --password=your_secure_password

# Get connection string
CONNECTION_NAME=$(gcloud sql instances describe verbaflow-postgres \
  --format='value(connectionName)')
echo "Use Cloud SQL Proxy with: $CONNECTION_NAME"
```

---

## 4. Deploy on AWS EKS

### 4.1 Install AWS CLI and eksctl

```bash
# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install
aws configure

# Install eksctl
curl --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_Linux_amd64.tar.gz" \
  | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
```

### 4.2 Create EKS Cluster

```bash
export CLUSTER_NAME=verbaflow-prod
export REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create cluster using eksctl config
cat > eks-cluster.yaml << EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: $CLUSTER_NAME
  region: $REGION
  version: "1.29"

iam:
  withOIDC: true

managedNodeGroups:
  - name: verbaflow-ng
    instanceType: m6i.xlarge
    minSize: 3
    maxSize: 15
    desiredCapacity: 3
    volumeSize: 100
    ssh:
      allow: false
    iam:
      withAddonPolicies:
        externalDNS: true
        certManager: true
        ebs: true
        efs: true
        albIngress: true
        cloudWatch: true

addons:
  - name: vpc-cni
  - name: coredns
  - name: kube-proxy
  - name: aws-ebs-csi-driver

cloudWatch:
  clusterLogging:
    enable: [api, audit, authenticator, controllerManager, scheduler]
EOF

eksctl create cluster -f eks-cluster.yaml
```

### 4.3 Install AWS Load Balancer Controller

```bash
# Create IAM policy
curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.0/docs/install/iam_policy.json

aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam_policy.json

# Create IAM service account
eksctl create iamserviceaccount \
  --cluster=$CLUSTER_NAME \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::${AWS_ACCOUNT_ID}:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Install controller via Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=$CLUSTER_NAME \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### 4.4 Install NGINX Ingress (alternative to ALB)

```bash
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-type"="external" \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-scheme"="internet-facing"
```

### 4.5 Set up AWS Secrets Manager + External Secrets

```bash
# Store secrets
aws secretsmanager create-secret \
  --name verbaflow/postgres-password \
  --secret-string '{"password":"your_secure_db_password"}'

aws secretsmanager create-secret \
  --name verbaflow/secret-key \
  --secret-string '{"key":"'$(openssl rand -hex 32)'"}'

aws secretsmanager create-secret \
  --name verbaflow/gemini-api-key \
  --secret-string '{"key":"your_gemini_key"}'
```

### 4.6 Deploy VerbaFlow

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### 4.7 Optional: Amazon RDS (Managed PostgreSQL)

```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier verbaflow-postgres \
  --db-instance-class db.r7g.large \
  --engine postgres \
  --engine-version 16 \
  --master-username verbaflow \
  --master-user-password your_secure_password \
  --allocated-storage 100 \
  --storage-type gp3 \
  --multi-az \
  --backup-retention-period 7 \
  --deletion-protection \
  --db-name verbaflow \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name your-subnet-group

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier verbaflow-postgres \
  --query 'DBInstances[0].Endpoint.Address'
```

---

## 5. Deploy on Azure AKS

### 5.1 Install Azure CLI

```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
az login
az account set --subscription "Your Subscription ID"
```

### 5.2 Create Resource Group and AKS Cluster

```bash
export RESOURCE_GROUP=verbaflow-prod-rg
export CLUSTER_NAME=verbaflow-aks
export LOCATION=eastus
export ACR_NAME=verbaflowacr

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Standard \
  --admin-enabled false

# Create AKS cluster
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --node-count 3 \
  --node-vm-size Standard_D4s_v5 \
  --enable-addons monitoring \
  --enable-oidc-issuer \
  --enable-workload-identity \
  --generate-ssh-keys \
  --attach-acr $ACR_NAME \
  --kubernetes-version 1.29 \
  --enable-cluster-autoscaler \
  --min-count 2 \
  --max-count 15 \
  --network-plugin azure \
  --network-policy azure \
  --enable-secret-rotation \
  --tier standard

# Get credentials
az aks get-credentials \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME
```

### 5.3 Install NGINX Ingress

```bash
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz
```

### 5.4 Set up Azure Key Vault + CSI Driver

```bash
# Create Key Vault
az keyvault create \
  --name verbaflow-kv \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --enable-soft-delete true \
  --retention-days 90

# Add secrets
az keyvault secret set --vault-name verbaflow-kv --name postgres-password --value 'your_secure_db_password'
az keyvault secret set --vault-name verbaflow-kv --name secret-key --value $(openssl rand -hex 32)
az keyvault secret set --vault-name verbaflow-kv --name gemini-api-key --value 'your_key'

# Enable Key Vault CSI driver add-on
az aks enable-addons \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --addons azure-keyvault-secrets-provider
```

### 5.5 Deploy VerbaFlow

```bash
# Push images to ACR
az acr login --name $ACR_NAME
docker tag verbaflow-backend:latest ${ACR_NAME}.azurecr.io/verbaflow-backend:1.0.0
docker push ${ACR_NAME}.azurecr.io/verbaflow-backend:1.0.0
docker tag verbaflow-frontend:latest ${ACR_NAME}.azurecr.io/verbaflow-frontend:1.0.0
docker push ${ACR_NAME}.azurecr.io/verbaflow-frontend:1.0.0

# Deploy
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## 6. Post-deployment Steps

### 6.1 Verify all pods are running

```bash
kubectl get pods -n verbaflow
# Expected: All pods in Running state with READY 1/1 or 2/2
```

### 6.2 Run database migrations

```bash
kubectl exec -n verbaflow -it \
  $(kubectl get pod -n verbaflow -l app.kubernetes.io/name=verbaflow-backend -o jsonpath='{.items[0].metadata.name}') \
  -- alembic upgrade head
```

### 6.3 Create initial admin user

```bash
kubectl exec -n verbaflow -it \
  $(kubectl get pod -n verbaflow -l app.kubernetes.io/name=verbaflow-backend -o jsonpath='{.items[0].metadata.name}') \
  -- python -m app.cli create-admin \
       --email admin@yourdomain.com \
       --password 'InitialAdminP@ss!'
```

### 6.4 Install monitoring stack

```bash
# Install kube-prometheus-stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword='your_grafana_password' \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi

# Apply VerbaFlow Prometheus config
kubectl apply -f k8s/monitoring/prometheus-config.yaml

# Import Grafana dashboard
# Navigate to Grafana UI → Dashboards → Import → Upload grafana-dashboard.json
```

### 6.5 Post-deployment Checklist

- [ ] All pods running (no CrashLoopBackOff or Pending)
- [ ] HTTPS is working with valid TLS certificate
- [ ] Frontend loads without console errors
- [ ] API health endpoint returns 200: `curl https://yourdomain.com/health`
- [ ] Can log in with admin credentials
- [ ] Can upload a test document
- [ ] Can run a test query and get a citation-backed answer
- [ ] Grafana dashboard showing data
- [ ] Prometheus alerts configured and reaching Alertmanager
- [ ] Sentry receiving errors (test with `curl https://yourdomain.com/api/v1/test-error`)
- [ ] Database backup job is scheduled and running
- [ ] Log aggregation configured (CloudWatch/Stackdriver/Azure Monitor)

---

## 7. Backup Strategy

### PostgreSQL Backup

#### Automated K8s CronJob

```bash
cat << 'EOF' | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: verbaflow
spec:
  schedule: "0 2 * * *"   # 2 AM UTC daily
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: postgres:16-alpine
              command:
                - sh
                - -c
                - |
                  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
                  FILENAME="verbaflow_backup_${TIMESTAMP}.sql.gz"
                  pg_dump "$DATABASE_URL" | gzip > /tmp/$FILENAME
                  # Upload to S3/GCS/Azure Blob
                  # aws s3 cp /tmp/$FILENAME s3://your-backup-bucket/postgres/
                  # gsutil cp /tmp/$FILENAME gs://your-backup-bucket/postgres/
                  echo "Backup completed: $FILENAME"
              env:
                - name: DATABASE_URL
                  valueFrom:
                    secretKeyRef:
                      name: verbaflow-secrets
                      key: DATABASE_URL
EOF
```

#### Point-in-time Recovery Setup

For managed databases (Cloud SQL / RDS / Azure DB for PostgreSQL):
- Enable continuous backup / WAL archiving
- Set retention period to 7-30 days
- Test restore monthly

### Redis Backup

Redis AOF persistence is enabled by default in our deployment. For additional safety:

```bash
# Manual Redis backup
kubectl exec -n verbaflow deploy/verbaflow-redis -- redis-cli BGSAVE
kubectl exec -n verbaflow deploy/verbaflow-redis -- redis-cli BGREWRITEAOF
```

### FAISS Index Backup

```bash
# Schedule daily backup of FAISS indexes
kubectl exec -n verbaflow deploy/verbaflow-backend -- \
  tar czf /tmp/faiss_backup_$(date +%Y%m%d).tar.gz /app/data/faiss_indexes/
```

---

## 8. Disaster Recovery

### RTO/RPO Targets

| Component | RTO | RPO |
|-----------|-----|-----|
| Application (K8s) | < 5 minutes | N/A (stateless) |
| PostgreSQL | < 30 minutes | < 1 hour |
| Redis | < 5 minutes | < 1 hour |
| FAISS Indexes | < 1 hour | < 24 hours |

### Recovery Runbook

#### Application Recovery

```bash
# 1. Check pod status
kubectl get pods -n verbaflow

# 2. View recent events
kubectl get events -n verbaflow --sort-by='.lastTimestamp'

# 3. If deployment is broken, rollback
kubectl rollout undo deployment/verbaflow-backend -n verbaflow
kubectl rollout undo deployment/verbaflow-frontend -n verbaflow

# 4. Verify rollback
kubectl rollout status deployment/verbaflow-backend -n verbaflow
```

#### Database Recovery from Backup

```bash
# 1. Create a new PostgreSQL pod for recovery
kubectl run pg-recovery \
  --image=postgres:16-alpine \
  --restart=Never \
  --env="PGPASSWORD=your_password" \
  -n verbaflow \
  -- sleep 3600

# 2. Copy backup to pod
kubectl cp /path/to/backup.sql.gz verbaflow/pg-recovery:/tmp/

# 3. Restore
kubectl exec -n verbaflow pg-recovery -- sh -c \
  'gunzip -c /tmp/backup.sql.gz | psql -h verbaflow-postgres -U verbaflow -d verbaflow'

# 4. Cleanup
kubectl delete pod pg-recovery -n verbaflow
```

#### Full Cluster Recovery

```bash
# 1. Recreate namespace and apply all manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/redis-deployment.yaml

# 2. Restore database
# (run database recovery runbook above)

# 3. Deploy application
kubectl apply -f k8s/backend-deployment.yaml
kubectl exec -n verbaflow deploy/verbaflow-backend -- alembic upgrade head
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# 4. Restore FAISS indexes from backup
# kubectl cp /path/to/faiss_backup.tar.gz verbaflow/backend-pod:/tmp/
# kubectl exec -n verbaflow deploy/verbaflow-backend -- \
#   tar xzf /tmp/faiss_backup.tar.gz -C /
```

---

## 9. Scaling Guidelines

### Horizontal Scaling (HPA)

The HPA is pre-configured with:
- Backend: min 3, max 20 replicas (CPU target 70%)
- Frontend: min 2, max 10 replicas (CPU target 70%)

Adjust for your workload:

```bash
# Increase max replicas
kubectl patch hpa verbaflow-backend-hpa -n verbaflow \
  --type merge \
  -p '{"spec":{"maxReplicas":40}}'

# Scale immediately (bypass HPA)
kubectl scale deployment verbaflow-backend -n verbaflow --replicas=10
```

### Vertical Scaling

```bash
# Increase backend memory limit
kubectl set resources deployment/verbaflow-backend \
  --limits=cpu=4000m,memory=4Gi \
  --requests=cpu=1000m,memory=1Gi \
  -n verbaflow
```

### Database Scaling

| Scenario | Action |
|----------|--------|
| Read-heavy workload | Add PostgreSQL read replicas |
| Query performance | Add database indexes, enable query caching |
| Data volume growth | Increase PVC size (online with CSI drivers) |
| Connection saturation | Add PgBouncer connection pooler |

### Worker Scaling (Uvicorn)

Increase Uvicorn workers in `backend/Dockerfile`:
```dockerfile
CMD ["uvicorn", "app.main:app", "--workers", "8", ...]  # Up from 4
```

Rule of thumb: `workers = (2 × CPU_cores) + 1`

### Vector Store Scaling

| Scale | Recommendation |
|-------|---------------|
| < 1M vectors | FAISS (local, default) |
| 1M - 100M vectors | Pinecone or Qdrant |
| > 100M vectors | Managed Weaviate or Qdrant cluster |
