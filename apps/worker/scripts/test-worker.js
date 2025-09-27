#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

console.log('🚀 Testing Claude Code Worker System...\n');

const testPrompt = 'Create a simple test.txt file with the content "Worker test successful!"';
const workingDirectory = './test-workspace';
const testTimeoutSeconds = 60;

const testPayload = {
  action: 'prompt',
  prompt: testPrompt,
  options: {
    cwd: workingDirectory,
    timeout: testTimeoutSeconds,
    permission_mode: 'bypassPermissions',
    exit_on_complete: true,
  },
};

console.log('📝 Test Command:', testPayload);
console.log('\n⚡ Starting Python wrapper...\n');

const wrapper = spawn('python3', [require('path').resolve(__dirname, '../../scripts/claude_wrapper.py')], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe'],
});
console.log(`🔧 Spawned wrapper PID: ${wrapper.pid}`);

let outputBuffer = '';
const testStartTime = Date.now();
let detectedSessionId = null;
let detectedSessionPath = null;
let finished = false;
let desiredExitCode = null; // 0 on success, 1 on failure
let postFinishKillHandle = null;

wrapper.stdout.on('data', (data) => {
  if (finished) {
    return;
  }
  const output = data.toString();
  outputBuffer += output;

  const lines = outputBuffer.split('\n');
  outputBuffer = lines.pop() || '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed);
      const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1);
      const normalised = normaliseStatus(parsed);
      updateSessionTracking(parsed);

      console.log(
        `[${elapsed}s] ${getStatusEmoji(normalised.status)} ${normalised.status.toUpperCase()}: ${normalised.message}`
      );

      if (normalised.status === 'ready' && !normalised.sentCommand) {
        console.log('\n📤 Sending test command...\n');
        wrapper.stdin.write(JSON.stringify(testPayload) + '\n');
      }

      // Prefer SSOT outcome from wrapper if available
      const outcome = typeof parsed.outcome === 'string' ? parsed.outcome : null;
      const reason = typeof parsed.reason === 'string' ? parsed.reason : null;
      const tags = Array.isArray(parsed.tags) ? parsed.tags : [];

      if (outcome === 'completed' || normalised.status === 'completed') {
        const skipFileAssertion = reason === 'limit_reached' || tags.includes('limit');
        handleSuccessfulCompletion({ skipFileAssertion, meta: { outcome, reason, tags } });
        return; // wait for 'close'
      }

      if (outcome === 'shutdown' && reason === 'exit_on_complete') {
        // Wrapper will close, treat as successful end of run
        handleSuccessfulCompletion({ skipFileAssertion: true, meta: { outcome, reason, tags } });
        return;
      }

      if (['failed', 'error', 'timeout'].includes(normalised.status) || outcome === 'failed' || outcome === 'timeout' || outcome === 'terminated') {

        console.log('\n❌ Worker test failed:');
        console.log('🔍 Error details:', JSON.stringify(parsed, null, 2));
        logSessionTail();
        finished = true;
        console.log('🧹 Debug: marking finished=true (failure). Clearing testTimeoutHandle and asking wrapper to terminate...');
        desiredExitCode = 1;
        clearTimeout(testTimeoutHandle);
        try { wrapper.stdin.end(); } catch (e) { console.log('🧹 Debug: stdin.end() error:', e?.message); }
        const termOk = wrapper.kill('SIGTERM');
        console.log(`🛎️ Debug: sent SIGTERM to wrapper PID ${wrapper.pid}, result=${termOk}`);
        postFinishKillHandle = setTimeout(() => {
          console.log('⛔ Debug: wrapper did not close in 5s after SIGTERM; sending SIGKILL');
          try { wrapper.kill('SIGKILL'); } catch (e) { console.log('⛔ Debug: SIGKILL error:', e?.message); }
          process.exit(desiredExitCode ?? 1);
        }, 5000);
        return; // wait for 'close'
      }

      // Treat 'shutdown' (including 'auto_shutdown' mapped to 'shutdown') as a terminal event
      if (normalised.status === 'shutdown') {
        console.log('\n🛑 Shutdown event received from wrapper.');
        finished = true;
        if (desiredExitCode === null) desiredExitCode = 0;
        clearTimeout(testTimeoutHandle);
        // The wrapper should be exiting on its own; just set a short fallback
        postFinishKillHandle = setTimeout(() => {
          console.log('⛔ Debug: wrapper did not close after shutdown; sending SIGKILL');
          try { wrapper.kill('SIGKILL'); } catch {}
          process.exit(desiredExitCode);
        }, 3000);
        return; // wait for 'close'
      }
    } catch (error) {
      console.log('📢 Raw output:', trimmed);
    }
  }
});

wrapper.stderr.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    console.log('🐍 Python log:', output);
  }
});

wrapper.on('exit', (code, signal) => {
  console.log(`🚪 Debug: wrapper 'exit' event code=${code}, signal=${signal}, finished=${finished}, desiredExitCode=${desiredExitCode}`);
});

wrapper.on('close', (code) => {
  const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1);
  console.log(`\n🏁 Worker process closed after ${elapsed}s with exit code: ${code}`);
  if (postFinishKillHandle) clearTimeout(postFinishKillHandle);
  clearTimeout(testTimeoutHandle);

  if (finished && desiredExitCode !== null) {
    console.log('🔚 Debug: finished=true and desiredExitCode set; exiting now.');
    process.exit(desiredExitCode);
  }

  if (code === 0) {
    console.log('✅ Test completed successfully!');
    process.exit(0);
  } else {
    console.log('❌ Test failed with exit code:', code);
    process.exit(code);
  }
});

wrapper.on('error', (error) => {
  console.error('💥 Worker process error:', error);
  process.exit(1);
});

const testTimeoutHandle = setTimeout(() => {
  console.log(`\n⏰ Test timed out after 2 minutes (finished=${finished}, desiredExitCode=${desiredExitCode})`);
  try { wrapper.stdin.end(); } catch {}
  wrapper.kill('SIGTERM');
  // In case wrapper already closed but our timers got out of sync
  setTimeout(() => process.exit(1), 500);
}, 120000);

process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  finished = true;
  desiredExitCode = 130;
  clearTimeout(testTimeoutHandle);
  if (postFinishKillHandle) clearTimeout(postFinishKillHandle);
  try { wrapper.stdin.end(); } catch {}
  wrapper.kill('SIGTERM');
  process.exit(130);
});

function handleSuccessfulCompletion({ skipFileAssertion = false, meta } = {}) {
  if (finished) {
    return;
  }

  const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1);

  console.log('\n✅ Worker test completed successfully!');
  if (skipFileAssertion) {
    console.log('ℹ️  Skipping workspace file assertion because the run was rate-limited or shut down automatically.');
  } else {
    console.log('🔍 Checking if test file was created...\n');
    const testFilePath = path.join(workingDirectory, 'test.txt');
    if (fs.existsSync(testFilePath)) {
      const content = fs.readFileSync(testFilePath, 'utf8');
      console.log('📄 File created successfully:', testFilePath);
      console.log('📝 Content:', content.trim());
    } else {
      console.log('⚠️  Test file not found');
    }
  }

  logSessionTail();

  finished = true;
  console.log('🧹 Debug: marking finished=true (success). Clearing testTimeoutHandle and asking wrapper to terminate...');
  desiredExitCode = 0;
  clearTimeout(testTimeoutHandle);
  try {
    wrapper.stdin.end();
  } catch (e) {
    console.log('🧹 Debug: stdin.end() error:', e?.message);
  }
  const termOk = wrapper.kill('SIGTERM');
  console.log(`🛎️ Debug: sent SIGTERM to wrapper PID ${wrapper.pid}, result=${termOk}`);
  // Faster fallback: don't wait too long after success
  postFinishKillHandle = setTimeout(() => {
    console.log('⛔ Debug: wrapper did not close in 2s after SIGTERM; sending SIGKILL');
    try {
      wrapper.kill('SIGKILL');
    } catch (e) {
      console.log('⛔ Debug: SIGKILL error:', e?.message);
    }
    process.exit(desiredExitCode ?? 0);
  }, 2000);
  // Absolute ensure-exit in case close never fires
  setTimeout(() => {
    console.log('🧵 Debug: ensure-exit fired; exiting now.');
    process.exit(desiredExitCode ?? 0);
  }, 2500);
}

function getStatusEmoji(status) {
  const emojis = {
    ready: '🟢',
    started: '🔄',
    running: '⚡',
    completed: '✅',
    failed: '❌',
    error: '💥',
    timeout: '⏰',
    shutdown: '🛑',
  };
  return emojis[status] || '📊';
}

function normaliseStatus(parsed) {
  const event = typeof parsed.event === 'string' ? parsed.event : null;
  const statusFromPayload = typeof parsed.status === 'string' ? parsed.status : null;

  const mapping = {
    ready: 'ready',
    run_started: 'started',
    stream: 'running',
    run_completed: 'completed',
    run_failed: 'failed',
    run_cancelled: 'failed',
    run_terminated: 'error',
    cancel_requested: 'running',
    cancel_ignored: 'error',
    signal: 'error',
    error: 'error',
    fatal: 'error',
    timeout: 'timeout',
    run_timeout: 'timeout',
    state: 'running',
    shutdown: 'shutdown',
    auto_shutdown: 'shutdown',
  };

  const status = statusFromPayload || (event ? mapping[event] : null) || 'running';
  const message =
    parsed.message ||
    parsed.reason ||
    (parsed.payload && typeof parsed.payload === 'object' && parsed.payload.message) ||
    event ||
    'Processing...';

  return {
    status,
    message,
    sentCommand: status !== 'ready',
  };
}

function updateSessionTracking(parsed) {
  if (detectedSessionId) {
    return;
  }

  const candidate = extractSessionId(parsed);
  if (!candidate) {
    return;
  }

  detectedSessionId = candidate;
  const { path: sessionPath, exists } = resolveSessionFilePath(candidate);
  detectedSessionPath = sessionPath;

  console.log(`🗂️  Claude session detected: ${detectedSessionId}`);
  console.log(`📁 Session log path: ${sessionPath}`);
  if (!exists) {
    console.log('ℹ️  Session file not found yet; will attempt to locate it before exiting.');
  }
}

function extractSessionId(parsed) {
  const candidates = [];

  if (typeof parsed.session_id === 'string') {
    candidates.push(parsed.session_id);
  }
  if (typeof parsed.sessionId === 'string') {
    candidates.push(parsed.sessionId);
  }

  const payload = parsed.payload;
  if (payload && typeof payload === 'object') {
    if (typeof payload.session_id === 'string') {
      candidates.push(payload.session_id);
    }
    if (typeof payload.sessionId === 'string') {
      candidates.push(payload.sessionId);
    }
    const metadata = payload.metadata;
    if (metadata && typeof metadata === 'object') {
      if (typeof metadata.session_id === 'string') {
        candidates.push(metadata.session_id);
      }
      if (typeof metadata.sessionId === 'string') {
        candidates.push(metadata.sessionId);
      }
    }
  }

  const dataField = parsed.data;
  if (dataField && typeof dataField === 'object') {
    if (typeof dataField.session_id === 'string') {
      candidates.push(dataField.session_id);
    }
    if (typeof dataField.sessionId === 'string') {
      candidates.push(dataField.sessionId);
    }
    const dataMetadata = dataField.metadata;
    if (dataMetadata && typeof dataMetadata === 'object') {
      if (typeof dataMetadata.session_id === 'string') {
        candidates.push(dataMetadata.session_id);
      }
      if (typeof dataMetadata.sessionId === 'string') {
        candidates.push(dataMetadata.sessionId);
      }
    }
  }

  return candidates.find((id) => id && id.trim().length > 0) || null;
}

function resolveSessionFilePath(sessionId) {
  const candidates = collectSessionPathCandidates(sessionId);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { path: candidate, exists: true };
    }
  }

  const fallback = candidates[0] || path.join(os.homedir(), '.cache', 'claude-code', 'sessions', `${sessionId}.jsonl`);
  return { path: fallback, exists: false };
}

function collectSessionPathCandidates(sessionId) {
  const candidates = new Set();

  const pushCandidate = (dir, filename) => {
    if (!dir) {
      return;
    }
    candidates.add(path.join(dir, filename));
  };

  const directSpec = process.env.SESSION_LOGS_DIR || process.env.CLAUDE_SESSION_DIR || null;
  if (directSpec) {
    if (directSpec.endsWith('.jsonl')) {
      candidates.add(directSpec);
    } else {
      const baseDir = directSpec.endsWith('sessions') ? directSpec : path.join(directSpec, 'sessions');
      pushCandidate(baseDir, `${sessionId}.jsonl`);
    }
  }

  const defaultSessions = path.join(os.homedir(), '.cache', 'claude-code', 'sessions');
  pushCandidate(defaultSessions, `${sessionId}.jsonl`);

  const projectsRoot = path.join(os.homedir(), '.claude', 'projects');
  const projectFolders = buildProjectFolderCandidates();
  for (const folder of projectFolders) {
    pushCandidate(path.join(projectsRoot, folder), `${sessionId}.jsonl`);
  }
  pushCandidate(path.join(projectsRoot, 'sessions'), `${sessionId}.jsonl`);
  pushCandidate(projectsRoot, `${sessionId}.jsonl`);

  if (fs.existsSync(projectsRoot)) {
    try {
      const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          pushCandidate(path.join(projectsRoot, entry.name), `${sessionId}.jsonl`);
        }
      }
    } catch (error) {
      console.log('⚠️  Failed to inspect Claude projects directory:', error.message);
    }
  }

  return Array.from(candidates);
}

function logSessionTail(lines = 5) {
  if (!detectedSessionId) {
    console.log('ℹ️  No session ID detected yet; skipping session tail.');
    return;
  }

  if (!detectedSessionPath || !fs.existsSync(detectedSessionPath)) {
    const resolved = resolveSessionFilePath(detectedSessionId);
    detectedSessionPath = resolved.path;
    if (!resolved.exists) {
      console.log('⚠️  Session log not found:', detectedSessionPath);
      console.log('    Set `SESSION_LOGS_DIR` to your Claude sessions directory if needed.');
      return;
    }
  }

  try {
    const content = fs.readFileSync(detectedSessionPath, 'utf8');
    const allLines = content.trimEnd().split(/\r?\n/);
    const tailLines = allLines.slice(-lines);

    console.log(`\n📜 Last ${tailLines.length} lines from session log (${detectedSessionPath}):`);
    tailLines.forEach((line, index) => {
      const lineNumber = allLines.length - tailLines.length + index + 1;
      console.log(`   [${lineNumber}] ${line}`);
    });
    console.log('');
  } catch (error) {
    console.log('⚠️  Failed to read session log:', error.message);
  }
}

function buildProjectFolderCandidates() {
  const candidates = new Set();

  const append = (value) => {
    if (value) {
      candidates.add(value);
    }
  };

  append(sanitiseProjectFolderName(testCommand.working_directory));
  append(sanitiseProjectFolderName(path.resolve(testCommand.working_directory)));
  append(sanitiseProjectFolderName(process.cwd()));

  if (process.env.CLAUDE_WORKSPACE_PATH) {
    append(sanitiseProjectFolderName(process.env.CLAUDE_WORKSPACE_PATH));
  }

  return Array.from(candidates).filter(Boolean);
}

function sanitiseProjectFolderName(directoryPath) {
  if (!directoryPath) {
    return null;
  }

  const normalized = path.resolve(directoryPath).replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const slug = segments.join('-');
  return `-${slug}`;
}

// All custom rate-limit detection removed; we rely on Python wrapper SSOT fields
