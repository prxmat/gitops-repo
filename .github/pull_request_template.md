# Environment Request

## 🚀 Environment Creation

To create a new environment, use the following commands in the comments:

- `/create-env` - Start the environment creation wizard
- `/help` - Show available commands

The wizard will guide you through:
1. Selecting required services
2. Setting environment duration
3. Configuring resource limits (optional)

### Available Services
- NestJS API
- Vue.js Frontend
- PrestaShop
- MySQL
- Redis

### Duration Options
- 1 hour (1h)
- 24 hours (24h)
- 7 days (7d)
- 30 days (30d)

## 📝 Description
<!-- Describe your changes here -->

## 🔍 Testing
<!-- Describe how you tested your changes -->

## 📋 Checklist
- [ ] I have followed the environment creation wizard
- [ ] I have tested the environment locally
- [ ] I have checked the ArgoCD application status
- [ ] I have verified all selected services are running

## Services Configuration
<!--
Please select the services you want to deploy by checking the boxes below.
The environment will be created with only the selected services.
-->
- [ ] NestJS API
- [ ] Vue.js Frontend
- [ ] PrestaShop
- [ ] MySQL
- [ ] Redis

## Environment Configuration
<!--
Please fill in the following information about your environment.
-->
### Time To Live (TTL)
<!--
How long should this environment exist? After this time, it will be automatically deleted.
Format: 1h, 24h, 7d, etc.
-->
TTL: [24h]

### Resource Limits
<!--
Optional: Specify custom resource limits for your environment.
If not specified, default values will be used.
-->
```yaml
resources:
  limits:
    cpu: "500m"
    memory: "512Mi"
  requests:
    cpu: "100m"
    memory: "128Mi"
```

### Additional Configuration
<!--
Optional: Add any additional configuration or notes here.
-->
Additional notes: [Your notes here]

## PR Annotations
<!--
The following annotations will be automatically added to your PR.
Please do not modify them.
-->
```yaml
environment:
  ttl: 24h
  services:
    - nestjs-api
    - vue-frontend
  resources:
    limits:
      cpu: "500m"
      memory: "512Mi"
    requests:
      cpu: "100m"
      memory: "128Mi"
``` 