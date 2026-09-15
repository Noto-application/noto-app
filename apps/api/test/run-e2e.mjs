import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const project = `noto-e2e-${randomUUID()}`;
const composeArgs = ['compose', '-f', 'test/compose.e2e.yml', '-p', project];
const args = process.argv.slice(2);
const repeatArg = args.find((arg) => arg.startsWith('--repeat='));
const repeats = repeatArg ? Number(repeatArg.slice('--repeat='.length)) : 1;
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) {
  throw new Error('--repeat должен быть целым числом от 1 до 20');
}
const jestArgs = args.filter((arg) => arg !== repeatArg);
const seedArg = jestArgs.find((arg) => arg.startsWith('--seed='));
const seed = seedArg ? Number(seedArg.slice('--seed='.length)) : 121;
if (!Number.isInteger(seed)) throw new Error('--seed должен быть целым числом');
let activeChild;
let interrupted = false;

function run(command, argv, env = process.env, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, {
      cwd,
      env,
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    });
    activeChild = child;
    let output = '';
    child.stdout?.on('data', (data) => {
      output += data;
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      activeChild = undefined;
      if (code === 0) resolve(output.trim());
      else reject(new Error(`${command} завершился: ${signal ?? code}`));
    });
  });
}

// Обычная отмена тоже проходит через finally и удаляет только наш Compose project.
function interrupt() {
  interrupted = true;
  activeChild?.kill('SIGTERM');
}
process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);

try {
  console.log(`Изолированное e2e-окружение: ${project}`);
  await run('docker', [...composeArgs, 'up', '-d', '--wait', '--wait-timeout', '60']);
  const pgAddress = await run(
    'docker',
    [...composeArgs, 'port', 'postgres', '5432'],
    process.env,
    true,
  );
  const redisAddress = await run(
    'docker',
    [...composeArgs, 'port', 'redis', '6379'],
    process.env,
    true,
  );
  const env = {
    ...process.env,
    // Все настройки auth фиксированы: .env не влияет на TTL, Secure и CORS.
    NODE_ENV: 'test',
    DATABASE_URL: `postgresql://noto:noto@${pgAddress}/noto_e2e`,
    REDIS_URL: `redis://${redisAddress}`,
    CORS_ORIGIN: 'http://localhost:3000',
    JWT_ACCESS_SECRET: 'e2e-access-secret',
    JWT_REFRESH_SECRET: 'e2e-refresh-secret',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    JWT_REFRESH_GRACE_TTL: '10s',
    COLLAB_SHARED_SECRET: 'e2e-collab-secret',
    NOTO_E2E_ISOLATED: '1',
    NODE_OPTIONS: '--experimental-vm-modules',
  };
  if (interrupted) throw new Error('E2E отменены');
  await run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], env);
  for (let index = 0; index < repeats; index += 1) {
    if (interrupted) throw new Error('E2E отменены');
    console.log(`E2E: прогон ${index + 1}/${repeats}`);
    // Suite выполняются последовательно; другой процесс получает другие сервисы.
    await run(
      'pnpm',
      [
        'exec',
        'jest',
        '--config',
        'test/jest-e2e.json',
        '--randomize',
        `--seed=${seed + index}`,
        ...jestArgs.filter((arg) => arg !== seedArg),
        '--runInBand',
      ],
      env,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
  try {
    await run('docker', [...composeArgs, 'down', '--volumes', '--remove-orphans']);
  } catch (error) {
    console.error(`Не удалось удалить ${project}: ${error.message}`);
    process.exitCode = 1;
  }
}
