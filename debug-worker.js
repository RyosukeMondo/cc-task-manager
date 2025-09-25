#!/usr/bin/env node

const { spawn } = require('child_process');
const { join } = require('path');

async function debugWorkerProcess() {
  console.log('🔍 Debugging Worker Process Execution');
  console.log('=====================================');

  const pythonWrapperPath = join(process.cwd(), 'scripts/claude_wrapper.py');
  const workingDir = join(process.cwd(), 'test-workspace');

  const testInput = JSON.stringify({
    command: "Create a simple Python script called debug-hello.py that prints 'Debug Hello World'",
    working_directory: workingDir,
    timeout: 30
  });

  console.log('📤 Spawning Python wrapper process...');
  console.log('Wrapper path:', pythonWrapperPath);
  console.log('Working directory:', workingDir);
  console.log('Test input:', testInput);
  console.log('');

  const childProcess = spawn('python3', [pythonWrapperPath], {
    cwd: workingDir,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let outputReceived = false;
  let exitCode = null;
  let exitSignal = null;

  // Monitor stdout
  childProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const parsed = JSON.parse(line);
        console.log('📥 Wrapper output:', parsed);

        if (parsed.status === 'ready' && !outputReceived) {
          console.log('✅ Wrapper ready, sending input...');
          childProcess.stdin.write(testInput + '\n');
        }

        if (parsed.status === 'completed' && parsed.return_code === 0) {
          console.log('✅ Wrapper reports SUCCESS (return_code: 0)');
          outputReceived = true;
        }
      } catch (err) {
        console.log('📄 Raw output:', line);
      }
    });
  });

  // Monitor stderr
  childProcess.stderr.on('data', (data) => {
    console.log('🔧 Wrapper stderr:', data.toString().trim());
  });

  // Monitor process exit
  childProcess.on('exit', (code, signal) => {
    exitCode = code;
    exitSignal = signal;
    console.log('');
    console.log('🏁 Process Exit Event:');
    console.log('  Exit Code:', code);
    console.log('  Signal:', signal);
    console.log('  Expected: code should be 0 for success');

    if (code === 0) {
      console.log('✅ CORRECT: Worker should report this as SUCCESS');
    } else {
      console.log('❌ PROBLEM: Worker will report this as FAILURE');
      console.log('   This explains why our jobs are failing!');
    }
  });

  childProcess.on('error', (error) => {
    console.error('❌ Process error:', error.message);
  });

  // Wait for completion
  return new Promise((resolve) => {
    setTimeout(() => {
      if (exitCode !== null) {
        resolve({ exitCode, exitSignal, outputReceived });
      } else {
        childProcess.kill();
        resolve({ exitCode: 'timeout', exitSignal: null, outputReceived });
      }
    }, 45000);
  });
}

debugWorkerProcess().then((result) => {
  console.log('');
  console.log('🎯 Debug Results:');
  console.log('  Final Exit Code:', result.exitCode);
  console.log('  Output Received:', result.outputReceived);
  console.log('');

  if (result.exitCode === 0) {
    console.log('✅ The Python wrapper is working correctly!');
    console.log('   The issue must be elsewhere in the worker system.');
  } else {
    console.log('❌ The Python wrapper is not exiting with code 0');
    console.log('   This is why the worker reports failure.');
  }
}).catch(console.error);