#!/usr/bin/env node

const { Queue, QueueEvents } = require('bullmq');

async function testFinalClaude() {
  console.log('🚀 Final Claude Code Worker Test');
  console.log('=================================');
  console.log('Using realistic timeout values for Claude API');
  console.log('');

  const queue = new Queue('claude-code-queue', {
    connection: { host: 'localhost', port: 6379 },
  });

  const queueEvents = new QueueEvents('claude-code-queue', {
    connection: { host: 'localhost', port: 6379 },
  });

  try {
    const job = await queue.add('claude-code-task', {
      taskId: `final-test-${Date.now()}`,
      prompt: 'Create a simple Python script called final-test.py that prints "Success! Claude Code Worker is fully operational!"',
      sessionName: `final-session-${Date.now()}`,
      workingDirectory: process.cwd() + '/test-workspace',
      options: { timeout: 120 }, // 2 minutes - realistic for Claude API
      timeoutMs: 120000,
    });

    console.log(`📋 Job ID: ${job.id}`);
    console.log('⏳ Waiting for Claude (up to 2 minutes)...');

    let dots = 0;
    const progressInterval = setInterval(() => {
      dots = (dots + 1) % 4;
      process.stdout.write(`\r⌛ Processing${'...'.slice(0, dots).padEnd(3)}`);
    }, 1000);

    const result = await job.waitUntilFinished(queueEvents);
    clearInterval(progressInterval);
    console.log('\n');

    console.log('🎉 Job Processing Complete!');
    console.log('📊 Final Results:');
    console.log('  Success:', result.success);
    console.log('  State:', result.state);
    console.log('  Task ID:', result.taskId);
    console.log('  Processing Time:', new Date(result.endTime) - new Date(result.startTime), 'ms');

    if (result.success) {
      console.log('  ✅ SUCCESS: Claude Code Worker is fully operational!');
    } else {
      console.log('  ❌ Status:', result.error || 'Unknown error');
    }

    // Check for created files
    console.log('\n📁 File System Check:');
    try {
      const fs = require('fs');
      const files = fs.readdirSync(process.cwd() + '/test-workspace');
      const newFiles = files.filter(f => f.includes('final-test') || f.includes('hello') || f.includes('debug'));

      if (newFiles.length > 0) {
        console.log('  Files created by Claude:', newFiles.join(', '));

        // Show content of the latest file
        const latestFile = newFiles[newFiles.length - 1];
        try {
          const content = fs.readFileSync(process.cwd() + '/test-workspace/' + latestFile, 'utf8');
          console.log(`\n📄 Content of ${latestFile}:`);
          console.log('  ' + content.trim());
        } catch (err) {
          console.log('  Could not read file content');
        }
      } else {
        console.log('  No new files detected');
      }
    } catch (err) {
      console.log('  Could not check workspace directory');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  } finally {
    await queueEvents.close();
    await queue.close();
  }
}

console.log('🎯 This is the final test of your Claude Code Worker System!');
console.log('If this succeeds, your system is 100% ready for production.');
console.log('');

testFinalClaude().then(() => {
  console.log('');
  console.log('🏁 Test Complete!');
}).catch(console.error);