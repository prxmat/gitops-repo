require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');

const app = express();
app.use(cors());
app.use(express.json());

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// GitHub OAuth callback
app.get('/auth/github/callback', async (req, res) => {
  const { code } = req.query;
  // TODO: Exchange code for access token
  res.redirect('/');
});

// Create environment
app.post('/api/environments', async (req, res) => {
  try {
    const { prNumber, services, ttl, customResources } = req.body;
    
    // Create environment configuration
    const envName = `env-${req.user}-${prNumber}`;
    const application = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: envName,
        namespace: 'argocd',
        annotations: {
          'argocd.argoproj.io/ttl': ttl
        }
      },
      spec: {
        project: 'default',
        source: {
          repoURL: process.env.GITHUB_REPO_URL,
          targetRevision: 'HEAD',
          path: 'gitops/charts/unified-app'
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: envName
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: true
          },
          syncOptions: ['CreateNamespace=true']
        },
        helm: {
          values: `
            global:
              environment: ${envName}
              ttl:
                enabled: true
                duration: "${ttl}"
            ${services.map(service => `
            ${service}:
              enabled: true
            `).join('\n')}
          `
        }
      }
    };

    // Create file in repository
    await octokit.repos.createOrUpdateFileContents({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      path: `argocd-app-${envName}.yaml`,
      message: `Create environment ${envName}`,
      content: Buffer.from(JSON.stringify(application, null, 2)).toString('base64')
    });

    res.json({ success: true, envName });
  } catch (error) {
    console.error('Error creating environment:', error);
    res.status(500).json({ error: 'Failed to create environment' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 