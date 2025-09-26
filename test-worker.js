#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Testing Claude Code Worker System...\n');

// Test configuration
const testCommand = {
  command: 'Create a simple test.txt file with the content "Worker test successful!"',
  working_directory: './test-workspace',
  timeout: 60
};

console.log('📝 Test Command:', testCommand);
console.log('\n⚡ Starting Python wrapper...\n');

// Start the Python wrapper
const wrapper = spawn('python3', ['scripts/claude_wrapper.py'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

let outputBuffer = '';
let testStartTime = Date.now();

wrapper.stdout.on('data', (data) => {
  const output = data.toString();
  outputBuffer += output;

  // Process complete JSON lines
  const lines = outputBuffer.split('\n');
  outputBuffer = lines.pop() || '';

  for (const line of lines) {
    if (line.trim()) {
      try {
        const parsed = JSON.parse(line.trim());
        const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1);

        console.log(`[${elapsed}s] ${getStatusEmoji(parsed.status)} ${parsed.status.toUpperCase()}: ${parsed.message || 'Processing...'}`);

        if (parsed.status === 'ready') {
          console.log('\n📤 Sending test command...\n');
          wrapper.stdin.write(JSON.stringify(testCommand) + '\n');
        }

        if (parsed.status === 'completed') {
          console.log('\n✅ Worker test completed successfully!');
          console.log('🔍 Checking if test file was created...\n');

          // Check if the file was created
          const fs = require('fs');
          const testFilePath = path.join('./test-workspace', 'test.txt');

          if (fs.existsSync(testFilePath)) {
            const content = fs.readFileSync(testFilePath, 'utf8');
            console.log('📄 File created successfully:', testFilePath);
            console.log('📝 Content:', content.trim());
          } else {
            console.log('⚠️  Test file not found, but worker reported success');
          }

          wrapper.kill();
          process.exit(0);
        }

        if (parsed.status === 'failed' || parsed.status === 'error') {
          console.log('\n❌ Worker test failed:');
          console.log('🔍 Error details:', JSON.stringify(parsed, null, 2));
          wrapper.kill();
          process.exit(1);
        }

      } catch (e) {
        // Non-JSON output, might be debug info
        console.log('📢 Raw output:', line.trim());
      }
    }
  }
});

wrapper.stderr.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    console.log('🐍 Python log:', output);
  }
});

wrapper.on('close', (code) => {
  const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1);
  console.log(`\n🏁 Worker process closed after ${elapsed}s with exit code: ${code}`);

  if (code === 0) {
    console.log('✅ Test completed successfully!');
  } else {
    console.log('❌ Test failed with exit code:', code);
    process.exit(code);
  }
});

wrapper.on('error', (error) => {
  console.error('💥 Worker process error:', error);
  process.exit(1);
});

// Set a timeout for the entire test
setTimeout(() => {
  console.log('\n⏰ Test timed out after 2 minutes');
  wrapper.kill();
  process.exit(1);
}, 120000);

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  wrapper.kill();
  process.exit(130);
});

function getStatusEmoji(status) {
  const emojis = {
    ready: '🟢',
    started: '🔄',
    running: '⚡',
    completed: '✅',
    failed: '❌',
    error: '💥',
    timeout: '⏰',
    shutdown: '🛑'
  };
  return emojis[status] || '📊';
}