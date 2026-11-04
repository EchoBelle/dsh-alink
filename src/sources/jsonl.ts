import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { stat, rm, chmod } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { parse, stringify } from 'lossless-json';

const parseNativeNumber = (text: string): number | bigint => {
  const value = Number(text);
  return /^-?\d+$/.test(text) && !Number.isSafeInteger(value) ? BigInt(text) : value;
};
export const MAX_LINE_BYTES = 16 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = 2 * 1024 ** 3;
export function encode(value: unknown): string { return stringify(value)!; }
export async function* readJsonl(file: string, options: { signal?: AbortSignal; maxLineBytes?: number; lossless?: boolean } = {}): AsyncGenerator<any> {
  yield* readJsonStream(createReadStream(file, { signal: options.signal }), options);
}
export async function* readJsonStream(input: AsyncIterable<Buffer>, options: { signal?: AbortSignal; maxLineBytes?: number; lossless?: boolean } = {}): AsyncGenerator<any> {
  const limit = options.maxLineBytes ?? MAX_LINE_BYTES;
  let pending: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  for await (const chunk of input) {
    options.signal?.throwIfAborted();
    pending = Buffer.concat([pending, chunk]);
    let end: number;
    while ((end = pending.indexOf(10)) !== -1) {
      if (end > limit) throw new Error('JSONL line exceeds size limit');
      const text = pending.subarray(0, end).toString('utf8').trim();
      pending = pending.subarray(end + 1);
      if (text) yield options.lossless ? parse(text, null, parseNativeNumber) : JSON.parse(text);
    }
    if (pending.length > limit) throw new Error('JSONL line exceeds size limit');
  }
  if (pending.toString('utf8').trim()) yield options.lossless ? parse(pending.toString('utf8'), null, parseNativeNumber) : JSON.parse(pending.toString('utf8'));
}
export async function snapshotFile(source: string, destination: string, maxBytes = MAX_ARCHIVE_BYTES, signal?: AbortSignal): Promise<void> {
  const before = await stat(source, { bigint: true });
  if (!before.isFile() || before.size > BigInt(maxBytes)) throw new Error('Source exceeds size limit');
  let total = 0, created = false;
  const out = createWriteStream(destination, { flags: 'wx', mode: 0o600 });
  out.once('open', () => { created = true; });
  try {
    await pipeline(createReadStream(source), new Transform({ transform(chunk, _encoding, callback) {
      total += chunk.length;
      callback(total > maxBytes ? new Error('Source exceeds size limit') : null, chunk);
    } }), out, { signal });
    const after = await stat(source, { bigint: true });
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ino !== after.ino || BigInt(total) !== after.size) throw new Error('SOURCE_CHANGED');
    await chmod(destination, 0o600);
  } catch (error) { if (created) await rm(destination, { force: true }); throw error; }
}

export async function snapshotPrefix(source: string, destination: string, bytes: number, signal?: AbortSignal): Promise<void> {
  const before = await stat(source);
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_ARCHIVE_BYTES || !before.isFile() || before.size < bytes) throw new Error('Invalid history prefix');
  const hash = createHash('sha256'); let total = 0, last = 0;
  try {
    await pipeline(createReadStream(source, { end: bytes - 1 }), new Transform({ transform(chunk, _encoding, done) {
      total += chunk.length; last = chunk.at(-1); hash.update(chunk); done(null, chunk);
    } }), createWriteStream(destination, { flags: 'wx', mode: 0o600 }), { signal });
    if (total !== bytes || last !== 10) throw new Error('Invalid history prefix boundary');
    const verify = createHash('sha256');
    for await (const chunk of createReadStream(source, { end: bytes - 1, signal })) verify.update(chunk);
    if (hash.digest('hex') !== verify.digest('hex') || before.ino !== (await stat(source)).ino) throw new Error('SOURCE_CHANGED');
  } catch (error) { await rm(destination, { force: true }); throw error; }
}
