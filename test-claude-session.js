#!/usr/bin/env node

const { Queue, QueueEvents } = require('bullmq');

async function testClaudeCodeSession() {
  const queue = new Queue('claude-code-queue', {
    connection: {
      host: 'localhost',
      port: 6379,
    },
  });

  const queueEvents = new QueueEvents('claude-code-queue', {
    connection: {
      host: 'localhost',
      port: 6379,
    },
  });

  console.log('🚀 Submitting Claude Code session job...');

  const job = await queue.add('claude-code-task', {
    taskId: `claude-session-${Date.now()}`,
    prompt: 'Create a simple Python script that prints "Hello from Claude Code!" and then list the files in the current directory.',
    sessionName: `test-session-${Date.now()}`,
    workingDirectory: process.cwd() + '/test-workspace',
    options: {
      timeout: 60, // 60 seconds timeout
      // Add any Claude Code specific options here
    },
    timeoutMs: 60000,
  });

  console.log(`📋 Job submitted with ID: ${job.id}`);
  console.log('⏳ Waiting for Claude Code to process...');

  try {
    // Wait for job completion
    const result = await job.waitUntilFinished(queueEvents);

    console.log('✅ Claude Code session completed!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Claude Code session failed:', error.message);
  } finally {
    await queueEvents.close();
    await queue.close();
  }
}

// Create test workspace directory
const fs = require('fs');
const testWorkspace = process.cwd() + '/test-workspace';
if (!fs.existsSync(testWorkspace)) {
  fs.mkdirSync(testWorkspace, { recursive: true });
}

testClaudeCodeSession().catch(console.error);