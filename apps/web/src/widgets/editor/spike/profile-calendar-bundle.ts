// Read-only анализ локальных артефактов Next; запуск из apps/web после build.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';

async function assets(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? await assets(path) : /\.(js|css)$/.test(path) ? [path] : [];
      }),
    )
  ).flat();
}

async function measure(paths: string[]) {
  let bytes = 0;
  let gzipBytes = 0;
  for (const path of paths) {
    const buffer = await readFile(path);
    bytes += buffer.length;
    gzipBytes += gzipSync(buffer, { level: 9 }).length;
  }
  return { files: paths.length, bytes, gzipBytes };
}

const route = '/app/[pageId]/page';
const context: {
  globalThis: {
    __RSC_MANIFEST?: Record<string, { clientModules: Record<string, { chunks: string[] }> }>;
  };
} = { globalThis: {} };
runInNewContext(
  await readFile('.next/server/app/app/[pageId]/page_client-reference-manifest.js', 'utf8'),
  context,
);
const manifest = context.globalThis.__RSC_MANIFEST?.[route];
if (!manifest)
  throw new Error('Production Page client-reference manifest is missing. Run build first.');
const modules = Object.keys(manifest.clientModules);
const references = [
  ...new Set(Object.values(manifest.clientModules).flatMap((module) => module.chunks)),
];
const routeAssets = references
  .filter((path) => /\.(js|css)$/.test(path))
  .map((path) => join('.next', path.replace(/^\/?_next\//, '')));
console.log(
  JSON.stringify(
    {
      methodology:
        'Static JS/CSS bytes; gzip level 9 per file, summed. Not network delivery, baseline delta, or lazy dependency closure.',
      allStaticChunks: await measure(await assets('.next/static/chunks')),
      ordinaryPageClientReferenceSet: {
        route,
        ...(await measure(routeAssets)),
        calendarModuleReferences: modules.filter((name) =>
          /calendar-spike|calendar-schema|month-grid|@fullcalendar/.test(name),
        ),
      },
    },
    null,
    2,
  ),
);
