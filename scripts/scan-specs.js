#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPOS_DIR = '/home/rmondo/repos/';

// Parse command line arguments
const args = process.argv.slice(2);
const worktreeOnly = !args.includes('--all');

function countTasks(tasksFilePath) {
  try {
    const content = fs.readFileSync(tasksFilePath, 'utf8');

    const yetCount = (content.match(/\[ \]/g) || []).length;
    const onCount = (content.match(/\[-\]/g) || []).length;
    const doneCount = (content.match(/\[x\]/g) || []).length;
    const total = yetCount + onCount + doneCount;

    return { yet: yetCount, on: onCount, done: doneCount, total };
  } catch (err) {
    return null;
  }
}

function scanSpecWorkflow(basePath, repoName, worktreeSpecName = null) {
  const specWorkflowPath = path.join(basePath, '.spec-workflow');

  if (!fs.existsSync(specWorkflowPath)) {
    return;
  }

  const specsPath = path.join(specWorkflowPath, 'specs');
  if (!fs.existsSync(specsPath)) {
    return;
  }

  const specs = fs.readdirSync(specsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const specName of specs) {
    // If in worktree, only process if spec name matches worktree folder name
    if (worktreeSpecName && specName !== worktreeSpecName) {
      continue;
    }

    const tasksPath = path.join(specsPath, specName, 'tasks.md');

    if (!fs.existsSync(tasksPath)) {
      continue;
    }

    const counts = countTasks(tasksPath);
    if (counts && counts.yet > 0) {
      console.log(JSON.stringify({
        repo_name: repoName,
        spec_name: specName,
        path: basePath,
        yet: counts.yet,
        on: counts.on,
        done: counts.done,
        total: counts.total
      }));
    }
  }
}

function scanRepos() {
  if (!fs.existsSync(REPOS_DIR)) {
    console.error(`Repos directory not found: ${REPOS_DIR}`);
    return;
  }

  const repos = fs.readdirSync(REPOS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const repoName of repos) {
    const repoPath = path.join(REPOS_DIR, repoName);

    // Check main repo directory (skip if worktreeOnly is true)
    if (!worktreeOnly) {
      scanSpecWorkflow(repoPath, repoName);
    }

    // Check worktree subdirectories
    const worktreePath = path.join(repoPath, 'worktree');
    if (fs.existsSync(worktreePath)) {
      const worktrees = fs.readdirSync(worktreePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const worktreeSpecName of worktrees) {
        const worktreeSpecPath = path.join(worktreePath, worktreeSpecName);
        scanSpecWorkflow(worktreeSpecPath, repoName, worktreeSpecName);
      }
    }
  }
}

scanRepos();