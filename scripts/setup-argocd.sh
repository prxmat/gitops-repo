#!/bin/bash

# Exit on error
set -e

echo "🚀 Setting up ArgoCD..."

# Check if minikube is running
if ! minikube status &> /dev/null; then
    echo "❌ Minikube is not running. Please start it first."
    exit 1
fi

# Create argocd namespace if it doesn't exist
if ! kubectl get namespace argocd &> /dev/null; then
    echo "📁 Creating argocd namespace..."
    kubectl create namespace argocd
fi

# Install ArgoCD
echo "📦 Installing ArgoCD..."
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD pods to be ready
echo "⏳ Waiting for ArgoCD pods to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s

# Get the ArgoCD server password
echo "🔑 Getting ArgoCD admin password..."
ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
echo "ArgoCD admin password: $ARGOCD_PASSWORD"

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

echo "✅ ArgoCD setup complete!"
echo "You can access the ArgoCD UI at: https://localhost:8080"
echo "Username: admin"
echo "Password: $ARGOCD_PASSWORD"
echo ""
echo "To stop port forwarding, press Ctrl+C" 