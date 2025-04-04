import { Probot } from "probot";

interface EnvironmentConfig {
  services: string[];
  ttl: string;
  customResources: boolean;
}

export = (app: Probot) => {
  // Add button when PR is opened
  app.on("pull_request.opened", async (context) => {
    const pr = context.payload.pull_request;
    
    // Create a comment with the button
    await context.octokit.issues.createComment({
      owner: context.repo().owner,
      repo: context.repo().repo,
      issue_number: pr.number,
      body: `🚀 **Environment Setup**

<details>
<summary>Create Test Environment</summary>

Click the button below to create a test environment for this PR:

<button type="button" onclick="createEnvironment()">Create Environment</button>

<script>
function createEnvironment() {
  const comment = document.createElement('div');
  comment.textContent = '/create-env';
  document.querySelector('.js-new-comment-form').appendChild(comment);
  document.querySelector('.js-new-comment-form').submit();
}
</script>
</details>`
    });
  });

  app.on("pull_request_review_comment.created", async (context) => {
    const comment = context.payload.comment;
    const command = comment.body.trim().toLowerCase();

    if (command === "/create-env") {
      // Create initial comment with form
      const response = await context.octokit.pulls.createReviewComment({
        owner: context.repo().owner,
        repo: context.repo().repo,
        pull_number: context.payload.pull_request.number,
        body: `🚀 **Environment Creation Wizard**

Please select the services you need:

- [ ] NestJS API
- [ ] Vue.js Frontend
- [ ] PrestaShop
- [ ] MySQL
- [ ] Redis

How long should this environment exist?

- [ ] 1 Hour
- [ ] 24 Hours
- [ ] 7 Days
- [ ] 30 Days

Would you like to customize resource limits?

- [ ] Use Default Resources
- [ ] Customize Resources

Please check the boxes and click "Submit" when done.`,
        commit_id: context.payload.pull_request.head.sha,
        line: 1,
        side: "RIGHT"
      });

      // Store the comment ID for later use
      await context.octokit.pulls.createReviewComment({
        owner: context.repo().owner,
        repo: context.repo().repo,
        pull_number: context.payload.pull_request.number,
        body: `<!-- env-creator:${response.data.id} -->`,
        commit_id: context.payload.pull_request.head.sha,
        line: 1,
        side: "RIGHT"
      });
    }
  });

  app.on("pull_request_review_comment.edited", async (context) => {
    const comment = context.payload.comment;
    const body = comment.body;

    // Check if this is a response to our form
    const formMatch = body.match(/<!-- env-creator:(\d+) -->/);
    if (!formMatch) return;

    const formCommentId = parseInt(formMatch[1]);
    const formComment = await context.octokit.pulls.getReviewComment({
      owner: context.repo().owner,
      repo: context.repo().repo,
      comment_id: formCommentId
    });

    // Parse the form response
    const services = [];
    const ttlOptions = [];
    const resourceOptions = [];

    const lines = formComment.data.body.split('\n');
    for (const line of lines) {
      if (line.includes('[x]')) {
        if (line.includes('NestJS API')) services.push('nestjs-api');
        else if (line.includes('Vue.js Frontend')) services.push('vue-frontend');
        else if (line.includes('PrestaShop')) services.push('prestashop');
        else if (line.includes('MySQL')) services.push('mysql');
        else if (line.includes('Redis')) services.push('redis');
        else if (line.includes('1 Hour')) ttlOptions.push('1h');
        else if (line.includes('24 Hours')) ttlOptions.push('24h');
        else if (line.includes('7 Days')) ttlOptions.push('7d');
        else if (line.includes('30 Days')) ttlOptions.push('30d');
        else if (line.includes('Customize Resources')) resourceOptions.push('custom');
      }
    }

    if (services.length > 0 && ttlOptions.length > 0) {
      // Create environment using ArgoCD
      try {
        // TODO: Implement ArgoCD integration
        await context.octokit.pulls.createReviewComment({
          owner: context.repo().owner,
          repo: context.repo().repo,
          pull_number: context.payload.pull_request.number,
          body: `✅ Environment created successfully!

Services: ${services.join(', ')}
Duration: ${ttlOptions[0]}
Custom Resources: ${resourceOptions.length > 0 ? 'Yes' : 'No'}

Your environment will be available shortly.`,
          commit_id: context.payload.pull_request.head.sha,
          line: 1,
          side: "RIGHT"
        });
      } catch (error: any) {
        await context.octokit.pulls.createReviewComment({
          owner: context.repo().owner,
          repo: context.repo().repo,
          pull_number: context.payload.pull_request.number,
          body: `❌ Failed to create environment: ${error?.message || 'Unknown error'}`,
          commit_id: context.payload.pull_request.head.sha,
          line: 1,
          side: "RIGHT"
        });
      }
    }
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
