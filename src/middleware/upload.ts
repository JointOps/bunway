import type { Handler } from "../types";
import type { UploadedFile } from "../types";
import type { BunRequest } from "../core/request";
import { join } from "path";
import { unlink, mkdir } from "fs/promises";

export interface UploadLimits {
  fileSize?: number;
  files?: number;
  fields?: number;
  fieldSize?: number;
  fieldNameSize?: number;
  parts?: number;
}

export interface FieldSpec {
  name: string;
  maxCount: number;
}

type FileFilterCallback = (error: Error | null, accept: boolean) => void;
type FileFilter = (
  req: BunRequest,
  file: { fieldname: string; originalname: string; mimetype: string; encoding: string },
  cb: FileFilterCallback,
) => void;

type DiskDestinationFn = (
  req: BunRequest,
  file: { fieldname: string; originalname: string; mimetype: string },
  cb: (error: Error | null, destination: string) => void,
) => void;

type DiskFilenameFn = (
  req: BunRequest,
  file: { fieldname: string; originalname: string; mimetype: string },
  cb: (error: Error | null, filename: string) => void,
) => void;

export interface DiskStorageOptions {
  destination?: string | DiskDestinationFn;
  filename?: DiskFilenameFn;
}

export interface UploadOptions {
  storage?: StorageEngine;
  limits?: UploadLimits;
  fileFilter?: FileFilter;
  preservePath?: boolean;
}

export interface UploadInstance {
  single(fieldname: string): Handler;
  array(fieldname: string, maxCount?: number): Handler;
  fields(specs: FieldSpec[]): Handler;
  none(): Handler;
  any(): Handler;
}

interface WriteHandle {
  write(chunk: Uint8Array): void;
  end(): Promise<Partial<UploadedFile>>;
  abort(): Promise<void>;
}

export interface StorageEngine {
  createWriter(
    req: BunRequest,
    fileInfo: { fieldname: string; originalname: string; mimetype: string; encoding: string },
  ): Promise<WriteHandle>;
}

export interface PartHeaders {
  name: string;
  filename?: string;
  contentType: string;
  encoding: string;
}

type UploadStrategy =
  | { type: "single"; fieldname: string }
  | { type: "array"; fieldname: string; maxCount?: number }
  | { type: "fields"; specs: FieldSpec[] }
  | { type: "none" }
  | { type: "any" };

const DEFAULT_LIMITS: Required<UploadLimits> = {
  fileSize: Infinity,
  files: Infinity,
  fields: Infinity,
  fieldSize: 1024 * 1024,
  fieldNameSize: 100,
  parts: Infinity,
};

const CRLF = new Uint8Array([13, 10]);
const DOUBLE_CRLF = new Uint8Array([13, 10, 13, 10]);
const DASH_DASH = new Uint8Array([45, 45]);

export function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

export function findSequence(data: Uint8Array, needle: Uint8Array, offset = 0): number {
  const dLen = data.length;
  const nLen = needle.length;
  if (dLen < nLen + offset) return -1;
  const end = dLen - nLen;
  outer: for (let i = offset; i <= end; i++) {
    for (let j = 0; j < nLen; j++) {
      if (data[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function startsWith(data: Uint8Array, prefix: Uint8Array, offset = 0): boolean {
  if (data.length - offset < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (data[offset + i] !== prefix[i]) return false;
  }
  return true;
}

export function parsePartHeaders(headerBytes: Uint8Array): PartHeaders {
  const text = new TextDecoder().decode(headerBytes);
  const lines = text.split("\r\n");
  let name = "";
  let filename: string | undefined;
  let contentType = "application/octet-stream";
  let encoding = "7bit";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("content-disposition:")) {
      const nameMatch = line.match(/\bname="([^"]*)"/) || line.match(/\bname=([^\s;]+)/);
      if (nameMatch && nameMatch[1] !== undefined) name = nameMatch[1];
      const filenameMatch = line.match(/\bfilename="([^"]*)"/) || line.match(/\bfilename=([^\s;]+)/);
      if (filenameMatch && filenameMatch[1] !== undefined) filename = filenameMatch[1];
    } else if (lower.startsWith("content-type:")) {
      contentType = line.slice(line.indexOf(":") + 1).trim();
    } else if (lower.startsWith("content-transfer-encoding:")) {
      encoding = line.slice(line.indexOf(":") + 1).trim();
    }
  }

  return { name, filename, contentType, encoding };
}

export function makeUploadError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

interface ParseResult {
  fields: Record<string, string>;
  files: UploadedFile[];
}

async function parseMultipartStream(
  stream: ReadableStream<Uint8Array>,
  boundary: string,
  options: {
    storage: StorageEngine;
    limits: Required<UploadLimits>;
    fileFilter?: (file: { fieldname: string; originalname: string; mimetype: string; encoding: string }) => Promise<boolean>;
    preservePath: boolean;
    strategy: UploadStrategy;
    req: BunRequest;
  },
): Promise<ParseResult> {
  const dashBoundary = new TextEncoder().encode("--" + boundary);
  const crlfDashBoundary = new TextEncoder().encode("\r\n--" + boundary);

  const reader = stream.getReader();
  let buf: Uint8Array = new Uint8Array(0);
  let done = false;

  const fields: Record<string, string> = {};
  const files: UploadedFile[] = [];
  const activeWriters: WriteHandle[] = [];
  let fileCount = 0;
  let fieldCount = 0;
  let partCount = 0;

  const fieldCountPerField: Record<string, number> = {};

  async function read(): Promise<void> {
    const result = await reader.read();
    if (result.done) {
      done = true;
      return;
    }
    const chunk = new Uint8Array(result.value.buffer, result.value.byteOffset, result.value.byteLength);
    buf = concat(buf, chunk);
  }

  async function ensureData(minBytes: number): Promise<boolean> {
    while (buf.length < minBytes && !done) {
      await read();
    }
    return buf.length >= minBytes;
  }

  function validateStrategy(partName: string, isFile: boolean): void {
    const s = options.strategy;
    if (s.type === "none" && isFile) {
      throw makeUploadError("File upload not allowed", 400);
    }
    if (s.type === "single" && isFile && partName !== s.fieldname) {
      throw makeUploadError(`Unexpected field: ${partName}`, 400);
    }
    if (s.type === "array" && isFile) {
      if (partName !== s.fieldname) {
        throw makeUploadError(`Unexpected field: ${partName}`, 400);
      }
      if (s.maxCount !== undefined && fileCount >= s.maxCount) {
        throw makeUploadError("Too many files", 413);
      }
    }
    if (s.type === "fields" && isFile) {
      const spec = s.specs.find((sp) => sp.name === partName);
      if (!spec) {
        throw makeUploadError(`Unexpected field: ${partName}`, 400);
      }
      const current = fieldCountPerField[partName] || 0;
      if (current >= spec.maxCount) {
        throw makeUploadError("Too many files", 413);
      }
    }
  }

  async function abortAll(): Promise<void> {
    for (const w of activeWriters) {
      try {
        await w.abort();
      } catch {}
    }
    activeWriters.length = 0;
  }

  try {
    await ensureData(dashBoundary.length + 2);

    let idx = findSequence(buf, dashBoundary);
    if (idx === -1) throw makeUploadError("Malformed multipart data", 400);
    buf = buf.subarray(idx + dashBoundary.length);

    if (startsWith(buf, DASH_DASH)) return { fields, files };
    if (startsWith(buf, CRLF)) {
      buf = buf.subarray(CRLF.length);
    } else {
      await ensureData(2);
      if (startsWith(buf, DASH_DASH)) return { fields, files };
      if (startsWith(buf, CRLF)) buf = buf.subarray(CRLF.length);
    }

    while (true) {
      while (findSequence(buf, DOUBLE_CRLF) === -1 && !done) {
        await read();
      }
      const headerEnd = findSequence(buf, DOUBLE_CRLF);
      if (headerEnd === -1) throw makeUploadError("Malformed multipart data", 400);

      const headerBytes = buf.subarray(0, headerEnd);
      buf = buf.subarray(headerEnd + DOUBLE_CRLF.length);

      const headers = parsePartHeaders(headerBytes);
      partCount++;
      if (partCount > options.limits.parts) throw makeUploadError("Too many parts", 413);

      if (headers.name.length > options.limits.fieldNameSize) {
        throw makeUploadError("Field name too long", 413);
      }

      const isFile = headers.filename !== undefined;
      validateStrategy(headers.name, isFile);

      if (isFile) {
        fileCount++;
        if (fileCount > options.limits.files) throw makeUploadError("Too many files", 413);

        const originalname = options.preservePath
          ? headers.filename!
          : (headers.filename!.split(/[/\\]/).pop() || headers.filename!);

        const fileInfo = {
          fieldname: headers.name,
          originalname,
          mimetype: headers.contentType,
          encoding: headers.encoding,
        };

        if (options.fileFilter) {
          const accepted = await options.fileFilter(fileInfo);
          if (!accepted) {
            let fileSize = 0;
            while (true) {
              await ensureData(crlfDashBoundary.length + 2);
              const bIdx = findSequence(buf, crlfDashBoundary);
              if (bIdx >= 0) {
                buf = buf.subarray(bIdx + crlfDashBoundary.length);
                break;
              }
              const safe = buf.length - crlfDashBoundary.length;
              if (safe > 0) {
                fileSize += safe;
                buf = buf.subarray(safe);
              }
              if (done) throw makeUploadError("Malformed multipart data", 400);
            }
            if (startsWith(buf, DASH_DASH)) return { fields, files };
            if (startsWith(buf, CRLF)) buf = buf.subarray(CRLF.length);
            else {
              await ensureData(2);
              if (startsWith(buf, DASH_DASH)) return { fields, files };
              if (startsWith(buf, CRLF)) buf = buf.subarray(CRLF.length);
            }
            continue;
          }
        }

        if (options.strategy.type === "fields") {
          fieldCountPerField[headers.name] = (fieldCountPerField[headers.name] || 0) + 1;
        }

        const writer = await options.storage.createWriter(options.req, fileInfo);
        activeWriters.push(writer);
        let fileSize = 0;

        while (true) {
          await ensureData(crlfDashBoundary.length + 2);
          const bIdx = findSequence(buf, crlfDashBoundary);
          if (bIdx >= 0) {
            const chunk = buf.subarray(0, bIdx);
            if (chunk.length > 0) {
              fileSize += chunk.length;
              if (fileSize > options.limits.fileSize) throw makeUploadError("File too large", 413);
              writer.write(chunk);
            }
            const info = await writer.end();
            activeWriters.pop();
            files.push({
              fieldname: fileInfo.fieldname,
              originalname: fileInfo.originalname,
              encoding: fileInfo.encoding,
              mimetype: fileInfo.mimetype,
              size: fileSize,
              ...info,
            });
            buf = buf.subarray(bIdx + crlfDashBoundary.length);
            break;
          }

          const safe = buf.length - crlfDashBoundary.length;
          if (safe > 0) {
            const chunk = buf.subarray(0, safe);
            fileSize += chunk.length;
            if (fileSize > options.limits.fileSize) throw makeUploadError("File too large", 413);
            writer.write(chunk);
            buf = buf.subarray(safe);
          }

          if (done) throw makeUploadError("Malformed multipart data", 400);
        }

        if (startsWith(buf, DASH_DASH)) return { fields, files };
        if (startsWith(buf, CRLF)) {
          buf = buf.subarray(CRLF.length);
        } else {
          await ensureData(2);
          if (startsWith(buf, DASH_DASH)) return { fields, files };
          if (startsWith(buf, CRLF)) buf = buf.subarray(CRLF.length);
        }
      } else {
        fieldCount++;
        if (fieldCount > options.limits.fields) throw makeUploadError("Too many fields", 413);

        const chunks: Uint8Array[] = [];
        let fieldSize = 0;

        while (true) {
          await ensureData(crlfDashBoundary.length + 2);
          const bIdx = findSequence(buf, crlfDashBoundary);
          if (bIdx >= 0) {
            const chunk = buf.subarray(0, bIdx);
            if (chunk.length > 0) {
              fieldSize += chunk.length;
              if (fieldSize > options.limits.fieldSize) throw makeUploadError("Field value too large", 413);
              chunks.push(chunk);
            }
            let combined: Uint8Array;
            if (chunks.length === 1 && chunks[0]) {
              combined = chunks[0];
            } else {
              let totalLen = 0;
              for (const c of chunks) totalLen += c.length;
              combined = new Uint8Array(totalLen);
              let offset = 0;
              for (const c of chunks) {
                combined.set(c, offset);
                offset += c.length;
              }
            }
            fields[headers.name] = new TextDecoder().decode(combined);
            buf = buf.subarray(bIdx + crlfDashBoundary.length);
            break;
          }

          const safe = buf.length - crlfDashBoundary.length;
          if (safe > 0) {
            const chunk = buf.subarray(0, safe);
            fieldSize += chunk.length;
            if (fieldSize > options.limits.fieldSize) throw makeUploadError("Field value too large", 413);
            chunks.push(chunk);
            buf = buf.subarray(safe);
          }

          if (done) throw makeUploadError("Malformed multipart data", 400);
        }

        if (startsWith(buf, DASH_DASH)) return { fields, files };
        if (startsWith(buf, CRLF)) {
          buf = buf.subarray(CRLF.length);
        } else {
          await ensureData(2);
          if (startsWith(buf, DASH_DASH)) return { fields, files };
          if (startsWith(buf, CRLF)) buf = buf.subarray(CRLF.length);
        }
      }
    }
  } catch (err) {
    await abortAll();
    throw err;
  }
}

export function memoryStorage(): StorageEngine {
  return {
    async createWriter() {
      const chunks: Uint8Array[] = [];
      return {
        write(chunk: Uint8Array) {
          chunks.push(new Uint8Array(chunk));
        },
        async end(): Promise<Partial<UploadedFile>> {
          return { buffer: Buffer.concat(chunks) };
        },
        async abort() {
          chunks.length = 0;
        },
      };
    },
  };
}

export function diskStorage(options: DiskStorageOptions = {}): StorageEngine {
  const getDestination: DiskDestinationFn =
    typeof options.destination === "function"
      ? options.destination
      : (_req, _file, cb) => cb(null, (options.destination as string) || "./uploads");

  const getFilename: DiskFilenameFn =
    options.filename || ((_req, _file, cb) => cb(null, crypto.randomUUID()));

  function promisifyDest(
    req: BunRequest,
    file: { fieldname: string; originalname: string; mimetype: string },
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      getDestination(req, file, (err, val) => (err ? reject(err) : resolve(val)));
    });
  }

  function promisifyFname(
    req: BunRequest,
    file: { fieldname: string; originalname: string; mimetype: string },
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      getFilename(req, file, (err, val) => (err ? reject(err) : resolve(val)));
    });
  }

  return {
    async createWriter(req, fileInfo) {
      const dest = await promisifyDest(req, fileInfo);
      const fname = await promisifyFname(req, fileInfo);
      const fullPath = join(dest, fname);

      await mkdir(dest, { recursive: true });

      const writer = Bun.file(fullPath).writer();

      return {
        write(chunk: Uint8Array) {
          writer.write(chunk);
        },
        async end(): Promise<Partial<UploadedFile>> {
          await writer.end();
          return { destination: dest, filename: fname, path: fullPath };
        },
        async abort() {
          try {
            await writer.end();
          } catch {}
          await unlink(fullPath).catch(() => {});
        },
      };
    },
  };
}

function createUploadInstance(opts: UploadOptions = {}): UploadInstance {
  const storage = opts.storage || memoryStorage();
  const limits = { ...DEFAULT_LIMITS, ...opts.limits };
  const fileFilter = opts.fileFilter;
  const preservePath = opts.preservePath ?? false;

  function makeHandler(strategy: UploadStrategy): Handler {
    return async (req, res, next) => {
      if (req.isBodyParsed()) {
        next();
        return;
      }

      const contentType = req.get("content-type") || "";
      if (!contentType.includes("multipart/form-data")) {
        next();
        return;
      }

      const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
      if (!boundaryMatch || !boundaryMatch[1]) {
        res.status(400).json({ error: "Missing multipart boundary" });
        return;
      }

      const stream = req.original.body;
      if (!stream) {
        res.status(400).json({ error: "Missing request body" });
        return;
      }

      let filterFn: ((file: { fieldname: string; originalname: string; mimetype: string; encoding: string }) => Promise<boolean>) | undefined;
      if (fileFilter) {
        filterFn = (file) =>
          new Promise<boolean>((resolve, reject) => {
            fileFilter(req, file, (err, accept) => {
              if (err) reject(err);
              else resolve(accept);
            });
          });
      }

      try {
        const result = await parseMultipartStream(stream, boundaryMatch[1], {
          storage,
          limits,
          fileFilter: filterFn,
          preservePath,
          strategy,
          req,
        });

        req.body = result.fields;

        if (strategy.type === "single") {
          req.file = result.files[0] || null;
        } else if (strategy.type === "none") {
          // no files
        } else if (strategy.type === "fields") {
          const grouped: Record<string, UploadedFile[]> = {};
          for (const file of result.files) {
            if (!grouped[file.fieldname]) grouped[file.fieldname] = [];
            grouped[file.fieldname]!.push(file);
          }
          req.files = grouped;
        } else {
          req.files = result.files;
        }

        next();
      } catch (err) {
        const status = (err as { status?: number }).status || 400;
        const message = err instanceof Error ? err.message : "Upload failed";
        res.status(status).json({ error: message });
      }
    };
  }

  return {
    single(fieldname: string) {
      return makeHandler({ type: "single", fieldname });
    },
    array(fieldname: string, maxCount?: number) {
      return makeHandler({ type: "array", fieldname, maxCount });
    },
    fields(specs: FieldSpec[]) {
      return makeHandler({ type: "fields", specs });
    },
    none() {
      return makeHandler({ type: "none" });
    },
    any() {
      return makeHandler({ type: "any" });
    },
  };
}

export interface UploadFactory extends UploadInstance {
  (options?: UploadOptions): UploadInstance;
  memoryStorage(): StorageEngine;
  diskStorage(options?: DiskStorageOptions): StorageEngine;
}

const defaultInstance = createUploadInstance();

export const upload: UploadFactory = Object.assign(
  (options?: UploadOptions) => (options ? createUploadInstance(options) : defaultInstance),
  {
    single: (fieldname: string) => defaultInstance.single(fieldname),
    array: (fieldname: string, maxCount?: number) => defaultInstance.array(fieldname, maxCount),
    fields: (specs: FieldSpec[]) => defaultInstance.fields(specs),
    none: () => defaultInstance.none(),
    any: () => defaultInstance.any(),
    memoryStorage,
    diskStorage,
  },
) as UploadFactory;
