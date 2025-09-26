#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🔧 Simple Worker Test - Testing Claude Code CLI directly...\n');

// Simple test command
const testCommand = {
  command: 'List the current directory files',
  working_directory: '.',
  timeout: 30
};

console.log('📝 Command:', testCommand.command);
console.log('📁 Directory:', testCommand.working_directory);
console.log('\n⚡ Starting test...\n');

const wrapper = spawn('python3', ['scripts/claude_wrapper.py'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

let outputBuffer = '';
const startTime = Date.now();

wrapper.stdout.on('data', (data) => {
  const output = data.toString();
  outputBuffer += output;

  const lines = outputBuffer.split('\n');
  outputBuffer = lines.pop() || '';

  for (const line of lines) {
    if (line.trim()) {
      try {
        const parsed = JSON.parse(line.trim());
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`[${elapsed}s] Status: ${parsed.status}`);

        if (parsed.message) {
          console.log(`         Message: ${parsed.message}`);
        }

        if (parsed.status === 'ready') {
          console.log('\n📤 Sending command...');
          wrapper.stdin.write(JSON.stringify(testCommand) + '\n');
        }

        if (parsed.status === 'completed') {
          console.log('\n✅ SUCCESS: Command completed!');
          console.log(`📊 Return code: ${parsed.return_code}`);
          console.log(`📄 Output length: ${parsed.stdout_length} chars`);
          wrapper.kill();
          process.exit(0);
        }

        if (parsed.status === 'failed' || parsed.status === 'error') {
          console.log('\n❌ FAILED: Command failed');
          if (parsed.error) {
            console.log(`🔍 Error: ${parsed.error}`);
          }
          if (parsed.error_output) {
            console.log(`🐛 Error output: ${parsed.error_output}`);
          }
          wrapper.kill();
          process.exit(1);
        }

        if (parsed.status === 'timeout') {
          console.log('\n⏰ TIMEOUT: Command timed out');
          wrapper.kill();
          process.exit(1);
        }

      } catch (e) {
        console.log(`Raw: ${line.trim()}`);
      }
    }
  }
});

wrapper.stderr.on('data', (data) => {
  console.log(`Log: ${data.toString().trim()}`);
});

wrapper.on('close', (code) => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🏁 Process closed after ${elapsed}s (exit code: ${code})`);
});

wrapper.on('error', (error) => {
  console.error('💥 Process error:', error);
  process.exit(1);
});

// Shorter timeout for this simple test
setTimeout(() => {
  console.log('\n⏰ Test timed out');
  wrapper.kill();
  process.exit(1);
}, 45000);