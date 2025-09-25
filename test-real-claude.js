#!/usr/bin/env node

const { Queue, QueueEvents } = require('bullmq');

async function testRealClaude() {
  console.log('🚀 Testing Real Claude Code Worker System');
  console.log('=========================================');

  const queue = new Queue('claude-code-queue', {
    connection: { host: 'localhost', port: 6379 },
  });

  const queueEvents = new QueueEvents('claude-code-queue', {
    connection: { host: 'localhost', port: 6379 },
  });

  try {
    console.log('📤 Submitting Claude Code job...');

    const job = await queue.add('claude-code-task', {
      taskId: `real-claude-${Date.now()}`,
      prompt: 'Create a simple Python script called hello.py that prints "Hello from Claude!" and also create a README.md explaining what it does',
      sessionName: `claude-session-${Date.now()}`,
      workingDirectory: process.cwd() + '/test-workspace',
      options: { timeout: 60 },
      timeoutMs: 60000,
    });

    console.log(`📋 Job ID: ${job.id}`);
    console.log('⏳ Waiting for Claude to process (this may take a moment)...');

    // Add progress monitoring
    let progressCount = 0;
    const progressInterval = setInterval(() => {
      progressCount++;
      console.log(`⌛ Processing... ${progressCount * 5}s`);
    }, 5000);

    const result = await job.waitUntilFinished(queueEvents);
    clearInterval(progressInterval);

    console.log('\n🎉 Claude Code job completed!');
    console.log('📊 Results:');
    console.log('  - Task ID:', result.taskId);
    console.log('  - Success:', result.success);
    console.log('  - State:', result.state);
    console.log('  - Processing Time:', new Date(result.endTime) - new Date(result.startTime), 'ms');

    if (result.error) {
      console.log('  - Error:', result.error);
    }

    // Check what files were created
    console.log('\n📁 Checking workspace for created files...');
    const fs = require('fs');
    const workspace = process.cwd() + '/test-workspace';

    try {
      const files = fs.readdirSync(workspace);
      console.log('  Files found:', files.length ? files.join(', ') : 'none');

      // Show content of created files
      files.forEach(file => {
        if (file.endsWith('.py') || file.endsWith('.md')) {
          const content = fs.readFileSync(workspace + '/' + file, 'utf8');
          console.log(`\n📄 Content of ${file}:`);
          console.log('  ' + content.split('\n').slice(0, 5).join('\n  '));
          if (content.split('\n').length > 5) {
            console.log('  ... (truncated)');
          }
        }
      });
    } catch (err) {
      console.log('  Could not read workspace directory');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
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

console.log('🎯 Starting real Claude Code test...');
console.log('This will test the complete workflow:');
console.log('  1. Job submission to BullMQ');
console.log('  2. Worker picks up job');
console.log('  3. Python wrapper spawned');
console.log('  4. Claude CLI executed');
console.log('  5. Files created by Claude');
console.log('  6. Results returned');
console.log('');

testRealClaude().catch(console.error);