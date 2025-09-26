#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting debug test of worker system...');

// Start the worker process
const worker = spawn('python3', ['scripts/claude_wrapper.py'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

console.log('Worker process started with PID:', worker.pid);

let outputBuffer = '';

worker.stdout.on('data', (data) => {
  const output = data.toString();
  outputBuffer += output;
  console.log('STDOUT:', output.trim());

  // Try to parse JSON responses
  const lines = outputBuffer.split('\n');
  outputBuffer = lines.pop() || '';

  for (const line of lines) {
    if (line.trim()) {
      try {
        const parsed = JSON.parse(line.trim());
        console.log('Parsed JSON:', parsed);

        if (parsed.status === 'completed') {
          console.log('✅ Task completed successfully!');
          worker.kill();
          process.exit(0);
        }

        if (parsed.status === 'failed' || parsed.status === 'error') {
          console.log('❌ Task failed:', parsed);
          worker.kill();
          process.exit(1);
        }
      } catch (e) {
        console.log('Failed to parse JSON:', line.trim());
      }
    }
  }
});

worker.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString().trim());
});

worker.on('close', (code) => {
  console.log('Worker process closed with code:', code);
});

worker.on('error', (error) => {
  console.error('Worker process error:', error);
  process.exit(1);
});

// Send the test command
const command = {
  command: 'Create a simple hello.py file that prints "Hello World"',
  working_directory: '.',
  timeout: 60
};

console.log('Sending command:', command);
worker.stdin.write(JSON.stringify(command) + '\n');

// Set a timeout
setTimeout(() => {
  console.log('⏰ Test timed out');
  worker.kill();
  process.exit(1);
}, 90000);
