#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const { Queue, QueueEvents, Worker } = require('bullmq');
const IORedis = require('ioredis');
const path = require('path');

const QUEUE_NAME = 'claude-code-queue';
const REDIS_CONFIG = { host: 'localhost', port: 6379 };
const WRAPPER_SCRIPT = path.resolve(__dirname, '../../../scripts/claude_wrapper.py');
const DEFAULT_TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function ensureRedis() {
  if (await canConnectToRedis()) {
    console.log('✅ Redis is running on localhost:6379');
    return;
  }

  console.log('🛠️ Redis not reachable on localhost:6379. Attempting to start Docker container `claude-redis`...');

  if (!dockerAvailable()) {
    throw new Error(
      'Redis is not running and Docker is unavailable. Please start Redis manually (e.g., `sudo systemctl start redis-server`).'
    );
  }

  try {
    startRedisViaDocker();
  } catch (err) {
    throw new Error(`Failed to start Redis via Docker: ${err.message}`);
  }

  console.log('⏳ Waiting for Redis to become available...');
  await waitForRedis();
  console.log('✅ Redis is now ready.');
}

async function canConnectToRedis() {
  const redis = new IORedis({ host: 'localhost', port: 6379, lazyConnect: true });
  try {
    await redis.connect();
    await redis.ping();
    return true;
  } catch (err) {
    return false;
  } finally {
    redis.disconnect();
  }
}

function dockerAvailable() {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch (err) {
    console.error('❌ Docker does not appear to be installed or accessible.');
    return false;
  }
}

function startRedisViaDocker() {
  const containerName = 'claude-redis';
  const existingContainer = dockerCommand(`ps -aq -f name=^${containerName}$`);

  if (existingContainer) {
    const runningContainer = dockerCommand(`ps -q -f name=^${containerName}$`);
    if (runningContainer) {
      console.log('ℹ️ Docker container `claude-redis` is already running.');
      return;
    }

    console.log('▶️ Starting existing Docker container `claude-redis`...');
    dockerCommand(`start ${containerName}`);
    return;
  }

  console.log('📦 Creating and starting Docker container `claude-redis` (redis:7-alpine)...');
  dockerCommand(`run -d --name ${containerName} -p 6379:6379 redis:7-alpine`);
}

function dockerCommand(args) {
  try {
    return execSync(`docker ${args}`, { stdio: 'pipe' }).toString().trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    const stdout = err.stdout ? err.stdout.toString().trim() : '';
    const message = stderr || stdout || err.message;
    throw new Error(message);
  }
}

async function waitForRedis(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await canConnectToRedis()) {
      return;
    }
    await delay(1000);
  }
  throw new Error('Redis did not become ready within the expected time.');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testRealClaude() {
  console.log('🚀 Testing Real Claude Code Worker System');
  console.log('=========================================');

  await ensureRedis();

  const queue = new Queue(QUEUE_NAME, {
    connection: REDIS_CONFIG,
  });

  const queueEvents = new QueueEvents(QUEUE_NAME, {
    connection: REDIS_CONFIG,
  });

  await queueEvents.waitUntilReady();

  const worker = createLocalWorker();
  let progressInterval = null;
  let progressCount = 0;
  let exitCode = 0;

  try {
    console.log('📤 Submitting Claude Code job...');

    const job = await queue.add('claude-code-task', {
      taskId: `real-claude-${Date.now()}`,
      prompt: 'Create a simple Python script called hello.py that prints "Hello from Claude!" and also create a README.md explaining what it does',
      sessionName: `claude-session-${Date.now()}`,
      workingDirectory: process.cwd() + '/test-workspace',
      options: { timeout: 60 },
      timeoutMs: 60000,
    }, {
      removeOnComplete: true,
      removeOnFail: false,
    });

    console.log(`📋 Job ID: ${job.id}`);
    console.log('⏳ Waiting for Claude to process (this may take a moment)...');

    // Add progress monitoring
    progressInterval = setInterval(() => {
      progressCount++;
      console.log(`⌛ Processing... ${progressCount * 5}s`);
    }, 5000);

    const result = await job.waitUntilFinished(queueEvents);

    exitCode = result && result.success === false ? 1 : 0;

    console.log('\n🎉 Claude Code job completed!');
    console.log('📊 Results:');
    console.log('  - Task ID:', result.taskId);
    console.log('  - Success:', result.success);
    console.log('  - State:', result.state);
    console.log('  - Processing Time:', new Date(result.endTime) - new Date(result.startTime), 'ms');

    if (result.error) {
      console.log('  - Error:', result.error);
    }

    if (result.limitReached) {
      console.log('  - Limit reached:', result.limitDetails?.matchedText || 'Rate limit triggered');
      if (result.limitDetails?.detectedAt) {
        console.log('  - Limit detected at:', new Date(result.limitDetails.detectedAt).toISOString());
      }
      if (result.limitDetails?.payload?.result) {
        console.log('  - Limit payload result:', result.limitDetails.payload.result);
      }
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
    exitCode = 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Test failed:', message);
    if (error && typeof error === 'object') {
      const context = error.context ?? error.details ?? error.cause;
      if (context) {
        console.error('ℹ️ Failure context:', context);
      }
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    }
  } finally {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }

    await Promise.allSettled([
      worker.close(),
      queueEvents.close(),
      queue.close(),
    ]);
  }

  return exitCode;
}

function createLocalWorker() {
  console.log('👷 Starting in-process BullMQ worker backed by Python wrapper...');

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { id, data } = job;
      console.log('🔧 Worker picked up job', { jobId: id, taskId: data.taskId });
      const start = Date.now();

      try {
        const result = await runWithPythonWrapper(data);
        console.log('✅ Worker completed job', {
          jobId: id,
          taskId: data.taskId,
          durationMs: Date.now() - start,
          success: result.success,
        });
        return result;
      } catch (error) {
        console.error('💥 Worker failed job', {
          jobId: id,
          taskId: data.taskId,
          durationMs: Date.now() - start,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    {
      connection: REDIS_CONFIG,
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    console.log('📗 Worker completion event', { jobId: job.id, taskId: job.data.taskId });
  });

  worker.on('failed', (job, err) => {
    console.error('📕 Worker failure event', {
      jobId: job?.id,
      taskId: job?.data?.taskId,
      error: err?.message,
    });
  });

  worker.on('error', (err) => {
    console.error('⚠️ Worker runtime error', err);
  });

  return worker;
}

async function runWithPythonWrapper(jobData) {
  const startTime = new Date();
  const timeoutMs = jobData.timeoutMs || DEFAULT_TASK_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const wrapper = spawn('python3', [WRAPPER_SCRIPT], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    console.log('🐍 Spawned Python wrapper', { pid: wrapper.pid, taskId: jobData.taskId });

    const payload = buildWrapperPayload(jobData);
    let stdoutBuffer = '';
    let sentCommand = false;
    let completed = false;
    let lastStatus = 'initialising';
    let limitReached = false;
    let limitMessage = null;
    const recentEvents = [];

    const timeoutHandle = setTimeout(() => {
      if (completed) return;
      console.error('⏰ Wrapper timeout reached; terminating process', { taskId: jobData.taskId });
      completed = true;
      try { wrapper.stdin.end(); } catch {}
      try { wrapper.kill('SIGTERM'); } catch {}
      reject(new Error(`Wrapper timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    wrapper.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();

      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (completed) {
          continue;
        }

        let parsed;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          console.log('📢 Wrapper stdout (raw):', trimmed);
          continue;
        }

        const status = normaliseStatus(parsed);
        lastStatus = status.status;
        console.log('📡 Wrapper event', {
          taskId: jobData.taskId,
          status: status.status,
          message: status.message,
          event: parsed.event,
        });

        recentEvents.push({
          event: parsed.event || null,
          status: status.status,
          message: status.message,
          timestamp: parsed.timestamp || null,
          payloadSubtype:
            parsed.payload && typeof parsed.payload === 'object' && typeof parsed.payload.subtype === 'string'
              ? parsed.payload.subtype
              : null,
          payloadResult:
            parsed.payload && typeof parsed.payload === 'object' && typeof parsed.payload.result === 'string'
              ? parsed.payload.result
              : null,
        });
        if (recentEvents.length > 20) {
          recentEvents.shift();
        }

        const outcome = typeof parsed.outcome === 'string' ? parsed.outcome : null;
        const reason = typeof parsed.reason === 'string' ? parsed.reason : null;
        const tags = Array.isArray(parsed.tags) ? parsed.tags : [];

        if (parsed.event === 'limit_notice' || reason === 'limit_reached' || tags.includes('limit')) {
          limitReached = true;
          limitMessage = parsed.message || (parsed.payload && parsed.payload.result) || 'Usage limit reached';
        }

        if (status.status === 'ready' && !sentCommand) {
          console.log('📨 Sending command to wrapper', { taskId: jobData.taskId });
          wrapper.stdin.write(JSON.stringify(payload) + '\n');
          sentCommand = true;
        }

        if (outcome === 'completed' || status.status === 'completed') {
          finalize(true, {
            taskId: jobData.taskId,
            state: 'completed',
            success: true,
            startTime,
            endTime: new Date(),
            message: limitMessage || status.message,
            limitReached: !!limitReached,
            limitDetails: limitReached
              ? { matchedText: limitMessage, event: parsed.event, detectedAt: new Date() }
              : undefined,
          });
        }

        if (['failed', 'error', 'timeout'].includes(status.status) || outcome === 'failed' || outcome === 'timeout' || outcome === 'terminated') {
          if (limitReached) {
            console.log('✅ Treating Claude limit notification as successful completion', {
              taskId: jobData.taskId,
              limitText: limitMessage,
            });
            finalize(true, {
              taskId: jobData.taskId,
              state: 'limit_reached',
              success: true,
              startTime,
              endTime: new Date(),
              message: limitMessage || 'Usage limit reached',
              limitReached: true,
              limitDetails: { matchedText: limitMessage, event: parsed.event, detectedAt: new Date() },
            });
          } else {
            const error = new Error(status.message || status.status || outcome || 'failed');
            error.context = { lastStatus, recentEvents, parsed };
            finalize(false, error);
          }
        }
      }
    });

    wrapper.stderr.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) {
        console.log('🐍 Wrapper stderr:', text);
      }
    });

    wrapper.on('error', (err) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeoutHandle);
      reject(err);
    });

    wrapper.on('close', (code) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeoutHandle);
      if (code === 0 && sentCommand) {
        resolve({
          taskId: jobData.taskId,
          state: 'completed',
          success: true,
          startTime,
          endTime: new Date(),
          message: `Wrapper exited cleanly after status ${lastStatus}`,
        });
      } else {
        reject(new Error(`Wrapper exited with code ${code}`));
      }
    });

    function finalize(success, payloadOrError) {
      if (completed) return;
      completed = true;
      clearTimeout(timeoutHandle);
      try { wrapper.stdin.end(); } catch {}
      try { wrapper.kill('SIGTERM'); } catch {}

      if (success) {
        resolve(payloadOrError);
      } else {
        reject(payloadOrError instanceof Error ? payloadOrError : new Error(String(payloadOrError)));
      }
    }
  });
}

function buildWrapperPayload(jobData) {
  const timeoutSeconds = Math.ceil((jobData.timeoutMs || DEFAULT_TASK_TIMEOUT_MS) / 1000);

  return {
    action: 'prompt',
    prompt: jobData.prompt,
    options: {
      cwd: jobData.workingDirectory,
      timeout: timeoutSeconds,
      permission_mode: jobData.options?.permission_mode || 'bypassPermissions',
      exit_on_complete: true,
    },
    metadata: {
      taskId: jobData.taskId,
      sessionName: jobData.sessionName,
    },
  };
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
  };
}

// All custom rate-limit detection removed; we rely on Python wrapper SSOT fields

function detectLimitInRawLine(rawLine) {
  if (typeof rawLine !== 'string' || rawLine.length === 0) {
    return null;
  }

  const limitPattern = /(limit\s+reached|rate\s+limit|usage\s+limit)/i;
  const match = rawLine.match(limitPattern);
  if (!match) {
    return null;
  }

  let parsedPayload = null;
  try {
    parsedPayload = JSON.parse(rawLine);
  } catch {
    parsedPayload = null;
  }

  return {
    event: parsedPayload && typeof parsedPayload.event === 'string' ? parsedPayload.event : null,
    matchedText: match[0],
    payload: parsedPayload && typeof parsedPayload.payload === 'object' ? parsedPayload.payload : null,
    subtype:
      parsedPayload && parsedPayload.payload && typeof parsedPayload.payload.subtype === 'string'
        ? parsedPayload.payload.subtype
        : null,
    isError:
      parsedPayload && parsedPayload.payload && typeof parsedPayload.payload.is_error === 'boolean'
        ? parsedPayload.payload.is_error
        : null,
  };
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

testRealClaude()
  .then((exitCode) => {
    process.exit(typeof exitCode === 'number' ? exitCode : 0);
  })
  .catch((error) => {
    console.error('❌ Unexpected failure during BullMQ test run:', error);
    if (error && typeof error === 'object' && 'context' in error) {
      console.error('🧾 Failure context:', JSON.stringify(error.context, null, 2));
    }
    process.exit(1);
  });