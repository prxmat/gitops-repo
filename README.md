# GitOps Multi-Project Deployment System

Ce système permet de déployer et gérer plusieurs projets dans un environnement de test en utilisant Helm, ArgoCD et GitHub Actions. Il offre une interface utilisateur simple pour créer des environnements de test temporaires.

## Structure du Projet

```
.
├── gitops/
│   ├── charts/
│   │   └── unified-app/           # Chart Helm unifié
│   │       ├── templates/         # Templates Kubernetes
│   │       │   ├── deployment.yaml
│   │       │   ├── service.yaml
│   │       │   ├── ingress.yaml
│   │       │   ├── nestjs-deployment.yaml
│   │       │   ├── monitoring.yaml
│   │       │   ├── backup.yaml
│   │       │   └── notifications.yaml
│   │       ├── values.yaml        # Valeurs par défaut
│   │       └── Chart.yaml
│   └── apps/                      # Configurations ArgoCD
│       ├── appset.yaml           # Définition des ApplicationSets
│       └── _project-template.yaml # Template de base pour les projets
├── .github/
│   └── workflows/                # GitHub Actions
│       ├── ci.yml               # Pipeline CI
│       └── create-test-env.yml  # Workflow de création d'environnement
└── values/                      # Valeurs Helm par environnement
    ├── development.yaml
    ├── staging.yaml
    └── production.yaml
```

## Applications Disponibles

1. **PrestaShop**
   - Version: 8.x
   - Base de données: MySQL
   - Cache: Redis
   - Configuration: Optimisée pour le développement

2. **NestJS API**
   - Support des microservices
   - Monitoring avec OpenTelemetry
   - Health checks intégrés
   - Auto-scaling configurable
   - Intégration avec Secret Manager

3. **Vue.js Frontend**
   - SPA optimisée
   - Ingress avec TLS
   - Monitoring des performances
   - Intégration avec l'API NestJS

## Prérequis

- Kubernetes cluster (v1.20+)
- Helm (v3.0+)
- ArgoCD (v2.0+)
- GitHub Actions configurées
- Google Cloud Platform
  - Secret Manager
  - Container Registry
  - Cloud Monitoring
  - Cloud Logging

## Installation

1. Installer ArgoCD :
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

2. Configurer l'accès à ArgoCD :
```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

3. Configurer Secret Manager :
```bash
# Créer un secret dans Secret Manager
gcloud secrets create my-secret --replication-policy="automatic"
gcloud secrets versions add my-secret --data-file=./secret.json

# Créer un secret Kubernetes qui référence Secret Manager
kubectl create secret generic my-secret \
  --from-literal=secret-store=secretmanager \
  --from-literal=secret-name=my-secret
```

4. Configurer Workload Identity pour GCP :
```bash
# Activer Workload Identity sur le cluster
gcloud container clusters update CLUSTER_NAME \
  --workload-pool=PROJECT_ID.svc.id.goog

# Configurer le service account
gcloud iam service-accounts add-iam-policy-binding \
  SERVICE_ACCOUNT_EMAIL \
  --role=roles/iam.workloadIdentityUser \
  --member="serviceAccount:PROJECT_ID.svc.id.goog[NAMESPACE/KSA_NAME]"
```

## CI/CD Pipeline

### GitHub Actions (CI)
```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

env:
  REGISTRY: gcr.io
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  NESTJS_IMAGE: nestjs-api
  VUE_IMAGE: vue-frontend

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install Dependencies
        run: |
          npm ci
          cd frontend && npm ci
          
      - name: Run Tests
        run: |
          # Backend tests
          npm run test
          npm run test:e2e
          
          # Frontend tests
          cd frontend
          npm run test:unit
          npm run test:e2e
          
      - name: Run Linting
        run: |
          npm run lint
          cd frontend && npm run lint
          
      - name: Build Applications
        run: |
          # Build NestJS
          npm run build
          
          # Build Vue.js
          cd frontend
          npm run build
          
      - name: Run Security Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop')
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Google Auth
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT_ID }}
          
      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        
      - name: Configure Docker
        run: gcloud auth configure-docker
        
      - name: Build and Push NestJS
        run: |
          docker build -t $REGISTRY/$PROJECT_ID/$NESTJS_IMAGE:${{ github.sha }} -f Dockerfile.nestjs .
          docker push $REGISTRY/$PROJECT_ID/$NESTJS_IMAGE:${{ github.sha }}
          docker tag $REGISTRY/$PROJECT_ID/$NESTJS_IMAGE:${{ github.sha }} $REGISTRY/$PROJECT_ID/$NESTJS_IMAGE:latest
          docker push $REGISTRY/$PROJECT_ID/$NESTJS_IMAGE:latest
          
      - name: Build and Push Vue.js
        run: |
          docker build -t $REGISTRY/$PROJECT_ID/$VUE_IMAGE:${{ github.sha }} -f Dockerfile.vue frontend/
          docker push $REGISTRY/$PROJECT_ID/$VUE_IMAGE:${{ github.sha }}
          docker tag $REGISTRY/$PROJECT_ID/$VUE_IMAGE:${{ github.sha }} $REGISTRY/$PROJECT_ID/$VUE_IMAGE:latest
          docker push $REGISTRY/$PROJECT_ID/$VUE_IMAGE:latest
          
      - name: Update Helm Values
        run: |
          # Update image tags in values files
          for env in development staging production; do
            yq e ".nestjs-api.image.tag = \"${{ github.sha }}\"" -i values/$env.yaml
            yq e ".vue-frontend.image.tag = \"${{ github.sha }}\"" -i values/$env.yaml
          done
          
      - name: Commit Changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add values/
          git commit -m "chore: update image tags to ${{ github.sha }}"
          git push

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Helm
        uses: azure/setup-helm@v3
        
      - name: Deploy to Production
        run: |
          # Get GKE credentials
          gcloud container clusters get-credentials ${{ secrets.GKE_CLUSTER }} --zone ${{ secrets.GKE_ZONE }}
          
          # Deploy using Helm
          helm upgrade --install unified-app ./gitops/charts/unified-app \
            --namespace production \
            -f values/production.yaml \
            --set global.environment=production \
            --wait \
            --timeout 5m

### ArgoCD (CD)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/your-repo.git
    targetRevision: HEAD
    path: gitops/apps/my-app
  destination:
    server: https://kubernetes.default.svc
    namespace: my-namespace
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

## Gestion des Secrets

1. **Configuration de Secret Manager**
```yaml
# values.yaml
global:
  secrets:
    manager: secretmanager
    project: your-project-id
    secrets:
      - name: database-credentials
        key: DATABASE_URL
      - name: api-keys
        key: API_KEY
```

2. **Utilisation dans les Applications**
```yaml
nestjs-api:
  env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: database-credentials
          key: DATABASE_URL
```

## Monitoring et Observabilité

1. **OpenTelemetry**
```yaml
global:
  monitoring:
    enabled: true
    otel:
      collector:
        enabled: true
        endpoint: "http://otel-collector:4317"
```

2. **Cloud Monitoring**
```yaml
global:
  gcp:
    monitoring:
      enabled: true
      metrics:
        enabled: true
      logging:
        enabled: true
        logName: "test-environments"
```

## Bonnes Pratiques

1. **Sécurité**
   - Utiliser Secret Manager pour les secrets
   - Activer Workload Identity
   - Configurer des RBAC stricts
   - Scanner les images Docker

2. **CI/CD**
   - Tests automatisés
   - Build et push des images
   - Déploiement via ArgoCD
   - Rollback automatique

3. **Monitoring**
   - Métriques Prometheus
   - Logs Cloud Logging
   - Alertes Cloud Monitoring
   - Traces OpenTelemetry

4. **Maintenance**
   - Nettoyage automatique des environnements
   - Mise à jour des dépendances
   - Documentation à jour