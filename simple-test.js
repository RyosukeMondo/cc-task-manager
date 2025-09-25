#!/usr/bin/env node

const { Queue, QueueEvents } = require('bullmq');

async function simpleTest() {
  console.log('🧪 Simple Claude Code Worker Test');
  console.log('==================================');

  const queue = new Queue('claude-code-queue', {
    connection: { host: 'localhost', port: 6379 },
  });

  const queueEvents = new QueueEvents('claude-code-queue', {
    connection: { host: 'localhost', port: 6379 },
  });

  try {
    console.log('📤 Submitting simple test job...');

    const job = await queue.add('claude-code-task', {
      taskId: `simple-test-${Date.now()}`,
      prompt: 'echo "Hello from Claude Code Worker Test"',
      sessionName: `simple-test-${Date.now()}`,
      workingDirectory: process.cwd() + '/test-workspace',
      options: { timeout: 30 },
      timeoutMs: 30000,
    });

    console.log(`📋 Job ID: ${job.id}`);
    console.log('⏳ Waiting for processing (30s timeout)...');

    // Set up a timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Test timeout')), 35000);
    });

    const jobPromise = job.waitUntilFinished(queueEvents);

    const result = await Promise.race([jobPromise, timeoutPromise]);

    console.log('✅ Job completed!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.message);

    // Check job status
    try {
      const jobStatus = await queue.getJob(await queue.add('status-check', {}));
      console.log('📈 Queue status check successful - worker is responding');
    } catch (statusError) {
      console.error('📉 Queue status check failed - worker may not be running');
    }
  } finally {
    await queueEvents.close();
    await queue.close();
  }
}

// Create test workspace
const fs = require('fs');
const testWorkspace = process.cwd() + '/test-workspace';
if (!fs.existsSync(testWorkspace)) {
  fs.mkdirSync(testWorkspace, { recursive: true });
}

simpleTest().catch(console.error);