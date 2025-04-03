const fs = require('fs');
const path = require('path');

const valuesPath = path.join(__dirname, '../values');

function isExpired(createdAt, ttlHours) {
  const expiry = new Date(createdAt);
  expiry.setHours(expiry.getHours() + ttlHours);
  return new Date() > expiry;
}

function checkAndPrint() {
  const projects = fs.readdirSync(valuesPath);
  projects.forEach(project => {
    const projectDir = path.join(valuesPath, project);
    const files = fs.readdirSync(projectDir);
    files.forEach(file => {
      const fullPath = path.join(projectDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const createdAt = content.match(/createdAt: "(.*?)"/)?.[1];
      const ttl = parseInt(content.match(/ttlHours: (\d+)/)?.[1]);

      if (createdAt && ttl && isExpired(createdAt, ttl)) {
        console.log(`[EXPIRED] ${file} - Should delete namespace: ${file.replace('.yaml', '')}`);
        // shell out to kubectl delete ns if desired
      }
    });
  });
}

checkAndPrint();