import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const origin = 'http://localhost:8080';
const groups = new Set();
let stopping = false;
let cleanupPromise;
let turbo;
let warnedAboutApps = false;

function warnAboutApps(reason) {
  process.exitCode = 1;
  if (warnedAboutApps) return;
  warnedAboutApps = true;
  console.error(
    `${reason}: application processes may still be running. Inspect your dev session manually; this launcher will not kill processes by name or port.`,
  );
}

function resolveTurbo() {
  try {
    const require = createRequire(new URL('../package.json', import.meta.url));
    const turboRequire = createRequire(require.resolve('turbo/package.json'));
    const arch = process.arch === 'x64' ? '64' : process.arch;
    return turboRequire.resolve(`@turbo/${process.platform}-${arch}/bin/turbo`);
  } catch {
    throw new Error(
      'Installed native Turbo binary not found for this platform. Run pnpm install with optional dependencies enabled on this host; no automatic install or emulation is attempted.',
    );
  }
}

function startTurbo(binary) {
  checkCancellation();
  const child = spawn(binary, ['run', 'dev'], {
    cwd,
    env: { ...process.env, TURBO_ENV_MODE: 'loose' },
    shell: false,
    detached: true,
    // Turbo выбирает PTY по stdout.is_terminal, а не по ui=stream.
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(process.stdout, { end: false });
  child.stderr.pipe(process.stderr, { end: false });
  turbo = { child };
  turbo.done = new Promise((resolve) => {
    const finish = (result) => {
      turbo.result = result;
      resolve(result);
    };
    child.once('error', (error) => finish({ spawnError: error }));
    // Не ждём close: при crash потомки могут держать stdout открытым.
    child.once('exit', (code, signal) => finish({ code, signal }));
  });
  return turbo.done;
}

async function stopTurbo(signal) {
  if (!turbo) return;
  const { child, done } = turbo;
  let watchdog;
  try {
    if (turbo.result) {
      warnAboutApps('Turbo exited unexpectedly');
      return;
    }
    child.kill(signal);
    // В non-TTY режиме Turbo сам завершает task groups (force после 10s).
    const result = await Promise.race([
      done,
      new Promise((resolve) => {
        watchdog = setTimeout(() => resolve(undefined), 15_000);
      }),
    ]);
    if (!result) {
      warnAboutApps('Turbo shutdown timed out after 15s');
      if (child.pid) {
        groups.add(child.pid);
        signalGroup(child.pid, 'SIGKILL');
      }
    } else if (result.spawnError || result.signal || ![0, 1, 130, 143].includes(result.code)) {
      warnAboutApps('Turbo failed during shutdown');
    }
  } catch (error) {
    console.error(`Cannot stop native Turbo: ${error.code ?? error.message}`);
    warnAboutApps('Turbo shutdown failed');
    if (child.pid) groups.add(child.pid);
  } finally {
    clearTimeout(watchdog);
    // При abnormal exit открытые pipes не должны удерживать launcher навечно.
    child.stdout.destroy();
    child.stderr.destroy();
    child.unref();
  }
}

function checkCancellation() {
  if (stopping) throw new Error('Dev startup cancelled');
}

function signalGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') {
      groups.delete(pid);
      return false;
    }
    throw error;
  }
}

function shutdown(signal = 'SIGTERM') {
  stopping = true;
  cleanupPromise ??= (async () => {
    console.log('\nStopping owned dev processes; Postgres/Redis and their data are kept.');
    await stopTurbo(signal);
    const send = (pid, signal) => {
      try {
        return signalGroup(pid, signal);
      } catch (error) {
        console.error(`Cannot signal owned process group ${pid}: ${error.code}`);
        process.exitCode = 1;
        return true;
      }
    };
    for (const pid of groups) send(pid, 'SIGTERM');
    const deadline = Date.now() + 10_000;
    while (groups.size && Date.now() < deadline) {
      for (const pid of groups) send(pid, 0);
      if (groups.size) await delay(100);
    }
    for (const pid of groups) send(pid, 'SIGKILL');
    const killDeadline = Date.now() + 2000;
    while (groups.size && Date.now() < killDeadline) {
      for (const pid of groups) send(pid, 0);
      if (groups.size) await delay(100);
    }
    if (groups.size) {
      console.error(`Owned process groups still exist: ${[...groups].join(', ')}`);
      process.exitCode = 1;
    }
  })();
  return cleanupPromise;
}

// Обработчики действуют и во время проверок, Compose и миграций.
for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  process.on(signal, () => {
    if (!stopping) process.exitCode = code;
    void shutdown(signal);
  });
}

function launch(
  command,
  args,
  { quiet = false, capture = false, timeout = 0, env = process.env } = {},
) {
  checkCancellation();
  const child = spawn(command, args, {
    cwd,
    env,
    shell: false,
    detached: true,
    stdio: capture ? ['ignore', 'pipe', 'ignore'] : quiet ? 'ignore' : 'inherit',
  });
  if (child.pid) groups.add(child.pid);
  // Группа остаётся нашей после выхода лидера, пока не исчезнут потомки.
  const done = new Promise((resolve) => {
    let timer;
    let spawnError;
    let output = '';
    child.stdout?.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', (error) => {
      spawnError = error;
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      try {
        if (child.pid) signalGroup(child.pid, 0);
      } catch (error) {
        spawnError ??= error;
      }
      resolve({ code, signal, spawnError, output });
    });
    if (timeout) {
      timer = setTimeout(() => {
        console.error(`${command} ${args.join(' ')} timed out.`);
        process.exitCode ||= 1;
        void shutdown();
      }, timeout);
    }
  });
  return done;
}

async function run(command, args, hint, options) {
  const result = await launch(command, args, options);
  checkCancellation();
  if (result.spawnError || result.code !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.spawnError?.code ?? result.signal ?? result.code}). ${hint}`,
    );
  }
  return result.output;
}

async function envFile(path, required = true) {
  try {
    return parseEnv(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  } catch (error) {
    if (!required && error.code === 'ENOENT') return undefined;
    // Не выводим содержимое файла или сообщение парсера с возможными секретами.
    throw new Error(
      `Cannot read ${path} (${error.code ?? 'invalid env format'}). Copy the app's .env.example and check permissions/format; existing files are never overwritten.`,
    );
  }
}

function requireKeys(env, keys, location) {
  for (const key of keys) {
    if (!env[key]?.trim()) {
      throw new Error(
        `${location}: ${key} is required. Edit the env file or unset/fix the parent shell override; see .env.example.`,
      );
    }
  }
}

function expectValue(actual, expected, key, location) {
  if (actual !== expected) {
    throw new Error(
      `${location}: ${key} must be ${expected} for the root Caddyfile. Edit the env file or unset/fix the parent shell override; no files were rewritten.`,
    );
  }
}

async function checkEnv() {
  const api = { ...(await envFile('apps/api/.env')), ...process.env };
  const collab = { ...(await envFile('apps/collab/.env')), ...process.env };
  // Порядок Next dev: shell > development.local > local > development > env.
  let web = {};
  let foundWebEnv = false;
  for (const name of ['.env', '.env.development', '.env.local', '.env.development.local']) {
    const file = await envFile(`apps/web/${name}`, false);
    if (file) {
      foundWebEnv = true;
      web = { ...web, ...file };
    }
  }
  if (!foundWebEnv) {
    throw new Error('Missing web env file. Run: cp apps/web/.env.example apps/web/.env.local');
  }
  web = { ...web, ...process.env };
  requireKeys(
    api,
    [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'COLLAB_SHARED_SECRET',
    ],
    'apps/api/.env + shell',
  );
  requireKeys(
    collab,
    ['COLLAB_SHARED_SECRET', 'COLLAB_ALLOWED_ORIGINS', 'API_INTERNAL_URL'],
    'apps/collab/.env + shell',
  );
  for (const [name, env] of [
    ['api', api],
    ['collab', collab],
    ['web', web],
  ]) {
    expectValue(
      env.NODE_ENV ?? 'development',
      'development',
      'NODE_ENV',
      `apps/${name} env + shell`,
    );
  }
  expectValue(String(Number(api.PORT ?? 4000)), '4000', 'PORT', 'API env + shell');
  expectValue(String(Number(collab.PORT ?? 5000)), '5555', 'PORT', 'collab env + shell');
  expectValue(web.PORT ?? '3000', '3000', 'PORT', 'web env + shell');
  if (!['127.0.0.1', 'localhost', '::1', '0.0.0.0', '::'].includes(api.HOST ?? '0.0.0.0')) {
    throw new Error(
      'API HOST must accept localhost connections from Caddy. Use HOST=127.0.0.1 in apps/api/.env or fix the shell override.',
    );
  }
  expectValue(api.CORS_ORIGIN ?? 'http://localhost:3000', origin, 'CORS_ORIGIN', 'API env + shell');
  expectValue(
    collab.COLLAB_ALLOWED_ORIGINS,
    origin,
    'COLLAB_ALLOWED_ORIGINS',
    'collab env + shell',
  );
  expectValue(
    collab.API_INTERNAL_URL,
    'http://localhost:4000',
    'API_INTERNAL_URL',
    'collab env + shell',
  );
  // Только literal URL: интерполяцию Next ($VAR) не имитируем; используйте значение из примера.
  expectValue(
    web.NEXT_PUBLIC_API_URL,
    origin,
    'NEXT_PUBLIC_API_URL',
    'web env + shell (use a literal URL, not $VAR)',
  );
  if (
    web.API_INTERNAL_URL !== undefined &&
    !['http://localhost:4000', origin].includes(web.API_INTERNAL_URL)
  ) {
    throw new Error(
      'web API_INTERNAL_URL must be http://localhost:4000 or http://localhost:8080. Edit the web env file or fix the shell override.',
    );
  }
  if (api.COLLAB_SHARED_SECRET !== collab.COLLAB_SHARED_SECRET) {
    throw new Error(
      'COLLAB_SHARED_SECRET must match in API and collab effective env. Edit the files or fix the shell override (values are not logged).',
    );
  }
}

async function checkPorts() {
  for (const port of [8080, 3000, 4000, 5555]) {
    // На macOS wildcard bind может сосуществовать с уже занятым loopback.
    for (const host of ['127.0.0.1', '::1', '0.0.0.0', '::']) {
      checkCancellation();
      await new Promise((resolve, reject) => {
        const server = createServer();
        server.once('error', (error) => {
          if (host.includes(':') && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code))
            resolve();
          else
            reject(
              new Error(
                `Port ${port} (${host}) unavailable (${error.code}). Stop your other dev session or choose apps-only mode with your own proxy configuration. No port owner was killed.`,
              ),
            );
        });
        server.listen({ port, host, ipv6Only: true, exclusive: true }, () => server.close(resolve));
      });
    }
  }
}

try {
  if (!['darwin', 'linux'].includes(process.platform)) {
    throw new Error(
      'pnpm dev supports macOS, Linux and WSL2 only. On Windows run it inside WSL2; see README (Node 24, pnpm 11 and Caddy inside WSL).',
    );
  }
  await checkEnv();
  await checkPorts();
  const turboBinary = resolveTurbo();
  await run(
    turboBinary,
    ['--version'],
    'Check the installed native Turbo binary; run pnpm install on this host.',
    { quiet: true, timeout: 15_000 },
  );
  await run(
    'docker',
    ['compose', 'version'],
    'Install Docker with the Compose plugin; see README.',
    { quiet: true, timeout: 15_000 },
  );
  const composeHelp = await run(
    'docker',
    ['compose', 'up', '--help'],
    'Update Docker Compose to support up --wait and --wait-timeout.',
    { capture: true, timeout: 15_000 },
  );
  if (!/--wait\s/.test(composeHelp) || !/--wait-timeout\s/.test(composeHelp)) {
    throw new Error(
      'Docker Compose must support up --wait and --wait-timeout. Update Docker Desktop/the Compose plugin; see README.',
    );
  }
  await run('caddy', ['version'], 'Install Caddy on this host and add it to PATH; see README.', {
    quiet: true,
    timeout: 15_000,
  });
  await run(
    'caddy',
    ['validate', '--config', 'Caddyfile', '--adapter', 'caddyfile'],
    'Check the root Caddyfile and your Caddy version.',
    { quiet: true, timeout: 15_000 },
  );
  await run(
    'docker',
    ['info'],
    'Start Docker Desktop/the Docker daemon and check Docker socket permissions.',
    { quiet: true, timeout: 15_000 },
  );
  console.log('Starting Postgres/Redis (health timeout: 60s)…');
  await run(
    'docker',
    [
      'compose',
      '-f',
      'docker-compose.yml',
      'up',
      '-d',
      '--wait',
      '--wait-timeout',
      '60',
      'postgres',
      'redis',
    ],
    'Check docker compose ps / docker compose logs postgres redis; data is kept.',
    { timeout: 90_000 },
  );
  console.log('Applying existing API migrations (db:deploy)…');
  await run(
    'pnpm',
    ['--filter', '@noto/api', 'db:deploy'],
    'Fix the migration/connection error, then rerun pnpm dev. No reset or migration creation is attempted.',
  );
  await checkPorts();
  const caddy = launch('caddy', ['run', '--config', 'Caddyfile', '--adapter', 'caddyfile']);
  // Turbo strict отбрасывает shell overrides: loose сохраняет проверенное окружение.
  // Env приложений не сливаются: каждый app читает свой файл сам.
  const apps = startTurbo(turboBinary);
  console.log(
    `\nNoto: ${origin} (wait for app readiness in the logs). Ctrl+C stops this session only.\n`,
  );
  const result = await Promise.race([
    caddy.then((result) => ({ name: 'Caddy', ...result })),
    apps.then((result) => ({ name: 'Turbo', ...result })),
  ]);
  checkCancellation();
  throw new Error(
    `${result.name} exited unexpectedly (${result.spawnError?.code ?? result.signal ?? result.code}); stopping its peer. Check logs for port conflicts/startup errors.`,
  );
} catch (error) {
  if (!stopping) console.error(`Dev failed: ${error.message}`);
  process.exitCode ||= 1;
} finally {
  await shutdown();
}
