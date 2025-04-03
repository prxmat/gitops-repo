#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting local development setup..."

# Check if minikube is installed
if ! command -v minikube &> /dev/null; then
    echo "❌ minikube is not installed. Please install it first."
    echo "Visit: https://minikube.sigs.k8s.io/docs/start/"
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install it first."
    echo "Visit: https://kubernetes.io/docs/tasks/tools/install-kubectl/"
    exit 1
fi

# Check if argocd CLI is installed
if ! command -v argocd &> /dev/null; then
    echo "❌ argocd CLI is not installed. Please install it first."
    echo "Visit: https://argo-cd.readthedocs.io/en/stable/cli_installation/"
    exit 1
fi

# Start minikube if it's not running
if ! minikube status &> /dev/null; then
    echo "📦 Starting minikube..."
    minikube start --driver=docker
fi

# Enable minikube addons
echo "🔧 Enabling minikube addons..."
minikube addons enable ingress
minikube addons enable metrics-server

# Create namespaces if they don't exist
echo "📁 Creating namespaces..."
for ns in development integration test staging production argocd; do
    if ! kubectl get namespace $ns &> /dev/null; then
        kubectl create namespace $ns
        echo "✅ Created namespace: $ns"
    else
        echo "ℹ️  Namespace $ns already exists"
    fi
done

# Build Docker images
echo "🏗️  Building Docker images..."
docker build -t nestjs-api:latest -f nestjs-api/Dockerfile nestjs-api/
docker build -t vue-frontend:latest -f frontend/Dockerfile.vue frontend/

# Load images into minikube
echo "📥 Loading Docker images into minikube..."
minikube image load nestjs-api:latest
minikube image load vue-frontend:latest

# Install ArgoCD if not already installed
if ! kubectl get namespace argocd &> /dev/null; then
    echo "📦 Installing ArgoCD..."
    kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
    
    # Wait for ArgoCD pods to be ready
    echo "⏳ Waiting for ArgoCD pods to be ready..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
    
    # Get the ArgoCD server password
    echo "🔑 Getting ArgoCD admin password..."
    ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
    echo "ArgoCD admin password: $ARGOCD_PASSWORD"
fi

# Port forward ArgoCD server
echo "🌐 Setting up port forwarding for ArgoCD UI..."
kubectl port-forward svc/argocd-server -n argocd 8080:443 &

# Wait for port forwarding to be ready
sleep 5

# Login to ArgoCD CLI
echo "🔐 Logging in to ArgoCD CLI..."
argocd login localhost:8080 --admin --password $ARGOCD_PASSWORD --insecure

# Create ArgoCD application
echo "📝 Creating ArgoCD application..."
cat <<EOF | kubectl apply -f -
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: unified-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/yourusername/gitops-repo.git
    targetRevision: HEAD
    path: gitops/charts/unified-app
  destination:
    server: https://kubernetes.default.svc
    namespace: development
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
  values:
    global:
      environment: development
EOF

# Get minikube IP
MINIKUBE_IP=$(minikube ip)
echo "🌐 Minikube IP: $MINIKUBE_IP"

echo "✅ Local development setup complete!"
echo "You can access the ArgoCD UI at: https://localhost:8080"
echo "Username: admin"
echo "Password: $ARGOCD_PASSWORD"
echo ""
echo "To stop port forwarding, press Ctrl+C"
echo "To stop minikube, run: minikube stop"
echo "To delete minikube, run: minikube delete" 