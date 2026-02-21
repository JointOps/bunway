import { describe, expect, it, afterAll } from "bun:test";
import {
  concat,
  findSequence,
  startsWith,
  parsePartHeaders,
  makeUploadError,
  memoryStorage,
  diskStorage,
  upload,
} from "../../../src/middleware/upload";
import type { PartHeaders } from "../../../src/middleware/upload";
import bunway from "../../../src";
import { buildRequest } from "../../utils/testUtils";
import { existsSync, mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";

const UNIT_UPLOAD_DIR = join(import.meta.dir, ".tmp-unit-uploads");

function ensureDir() {
  if (!existsSync(UNIT_UPLOAD_DIR)) mkdirSync(UNIT_UPLOAD_DIR, { recursive: true });
}

afterAll(() => {
  rmSync(UNIT_UPLOAD_DIR, { recursive: true, force: true });
});

function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function buildMultipartBody(
  parts: Array<{
    name: string;
    filename?: string;
    contentType?: string;
    encoding?: string;
    data: string | Buffer;
  }>,
): { body: Buffer; contentType: string } {
  const boundary = "----UnitTestBound" + Date.now();
  const chunks: Buffer[] = [];

  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (part.filename !== undefined) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`,
        ),
      );
      chunks.push(Buffer.from(`Content-Type: ${part.contentType || "application/octet-stream"}\r\n`));
      if (part.encoding) {
        chunks.push(Buffer.from(`Content-Transfer-Encoding: ${part.encoding}\r\n`));
      }
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n`));
    }
    chunks.push(Buffer.from("\r\n"));
    chunks.push(Buffer.isBuffer(part.data) ? part.data : Buffer.from(part.data));
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe("Upload Middleware (Unit)", () => {
  describe("concat()", () => {
    it("concatenates two non-empty arrays", () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([4, 5, 6]);
      const result = concat(a, b);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
    });

    it("handles empty first array", () => {
      const a = new Uint8Array([]);
      const b = new Uint8Array([1, 2]);
      expect(concat(a, b)).toEqual(new Uint8Array([1, 2]));
    });

    it("handles empty second array", () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([]);
      expect(concat(a, b)).toEqual(new Uint8Array([1, 2]));
    });

    it("handles both empty arrays", () => {
      expect(concat(new Uint8Array([]), new Uint8Array([]))).toEqual(new Uint8Array([]));
    });

    it("returns Uint8Array instance", () => {
      const result = concat(new Uint8Array([1]), new Uint8Array([2]));
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it("handles single-byte arrays", () => {
      expect(concat(new Uint8Array([0xff]), new Uint8Array([0x00]))).toEqual(
        new Uint8Array([0xff, 0x00]),
      );
    });

    it("preserves high-byte values", () => {
      const a = new Uint8Array([0, 127, 128, 255]);
      const b = new Uint8Array([255, 128, 127, 0]);
      const result = concat(a, b);
      expect(result[0]).toBe(0);
      expect(result[3]).toBe(255);
      expect(result[4]).toBe(255);
      expect(result[7]).toBe(0);
    });

    it("handles large arrays", () => {
      const a = new Uint8Array(10000).fill(0xaa);
      const b = new Uint8Array(10000).fill(0xbb);
      const result = concat(a, b);
      expect(result.length).toBe(20000);
      expect(result[0]).toBe(0xaa);
      expect(result[9999]).toBe(0xaa);
      expect(result[10000]).toBe(0xbb);
      expect(result[19999]).toBe(0xbb);
    });
  });

  describe("findSequence()", () => {
    it("finds sequence at the start", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const needle = new Uint8Array([1, 2]);
      expect(findSequence(data, needle)).toBe(0);
    });

    it("finds sequence in the middle", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const needle = new Uint8Array([3, 4]);
      expect(findSequence(data, needle)).toBe(2);
    });

    it("finds sequence at the end", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const needle = new Uint8Array([4, 5]);
      expect(findSequence(data, needle)).toBe(3);
    });

    it("returns -1 when needle not found", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const needle = new Uint8Array([6, 7]);
      expect(findSequence(data, needle)).toBe(-1);
    });

    it("respects offset parameter", () => {
      const data = new Uint8Array([1, 2, 3, 1, 2, 3]);
      const needle = new Uint8Array([1, 2]);
      expect(findSequence(data, needle, 1)).toBe(3);
    });

    it("returns -1 when offset skips past all matches", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const needle = new Uint8Array([1, 2]);
      expect(findSequence(data, needle, 3)).toBe(-1);
    });

    it("returns -1 when needle is longer than data", () => {
      const data = new Uint8Array([1, 2]);
      const needle = new Uint8Array([1, 2, 3]);
      expect(findSequence(data, needle)).toBe(-1);
    });

    it("returns -1 for empty data", () => {
      expect(findSequence(new Uint8Array([]), new Uint8Array([1]))).toBe(-1);
    });

    it("returns -1 when offset equals data length", () => {
      const data = new Uint8Array([1, 2, 3]);
      expect(findSequence(data, new Uint8Array([1]), 3)).toBe(-1);
    });

    it("returns -1 when offset exceeds data length", () => {
      const data = new Uint8Array([1, 2, 3]);
      expect(findSequence(data, new Uint8Array([1]), 100)).toBe(-1);
    });

    it("finds single-byte needle", () => {
      const data = new Uint8Array([10, 20, 30]);
      expect(findSequence(data, new Uint8Array([20]))).toBe(1);
    });

    it("finds needle equal to entire data", () => {
      const data = new Uint8Array([1, 2, 3]);
      expect(findSequence(data, new Uint8Array([1, 2, 3]))).toBe(0);
    });

    it("finds first occurrence when multiple matches exist", () => {
      const data = new Uint8Array([1, 2, 1, 2, 1, 2]);
      expect(findSequence(data, new Uint8Array([1, 2]))).toBe(0);
    });

    it("handles boundary-like byte sequences", () => {
      const boundary = encode("--boundary");
      const data = concat(encode("data before"), concat(encode("\r\n"), boundary));
      expect(findSequence(data, boundary)).toBe(13);
    });
  });

  describe("startsWith()", () => {
    it("returns true when prefix matches at start", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      expect(startsWith(data, new Uint8Array([1, 2]))).toBe(true);
    });

    it("returns false when prefix does not match at start", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      expect(startsWith(data, new Uint8Array([2, 3]))).toBe(false);
    });

    it("works with offset parameter", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      expect(startsWith(data, new Uint8Array([2, 3]), 1)).toBe(true);
    });

    it("returns false when offset is too large for prefix", () => {
      const data = new Uint8Array([1, 2, 3]);
      expect(startsWith(data, new Uint8Array([3, 4]), 2)).toBe(false);
    });

    it("returns false when data is empty", () => {
      expect(startsWith(new Uint8Array([]), new Uint8Array([1]))).toBe(false);
    });

    it("handles prefix equal to data", () => {
      const data = new Uint8Array([1, 2, 3]);
      expect(startsWith(data, new Uint8Array([1, 2, 3]))).toBe(true);
    });

    it("returns false when prefix is longer than remaining data after offset", () => {
      const data = new Uint8Array([1, 2, 3]);
      expect(startsWith(data, new Uint8Array([2, 3, 4]), 1)).toBe(false);
    });

    it("handles high-byte values", () => {
      const data = new Uint8Array([0xff, 0xfe, 0xfd]);
      expect(startsWith(data, new Uint8Array([0xff, 0xfe]))).toBe(true);
    });

    it("checks CRLF-style prefix", () => {
      const data = new Uint8Array([13, 10, 45, 45]);
      expect(startsWith(data, new Uint8Array([13, 10]))).toBe(true);
    });

    it("checks DASH_DASH prefix", () => {
      const data = new Uint8Array([45, 45, 0]);
      expect(startsWith(data, new Uint8Array([45, 45]))).toBe(true);
    });
  });

  describe("parsePartHeaders()", () => {
    it("extracts name from Content-Disposition with quotes", () => {
      const headers = encode('Content-Disposition: form-data; name="avatar"');
      const result = parsePartHeaders(headers);
      expect(result.name).toBe("avatar");
      expect(result.filename).toBeUndefined();
    });

    it("extracts name and filename from Content-Disposition", () => {
      const headers = encode(
        'Content-Disposition: form-data; name="file"; filename="photo.jpg"\r\nContent-Type: image/jpeg',
      );
      const result = parsePartHeaders(headers);
      expect(result.name).toBe("file");
      expect(result.filename).toBe("photo.jpg");
      expect(result.contentType).toBe("image/jpeg");
    });

    it("extracts unquoted name", () => {
      const headers = encode("Content-Disposition: form-data; name=avatar");
      const result = parsePartHeaders(headers);
      expect(result.name).toBe("avatar");
    });

    it("extracts unquoted filename", () => {
      const headers = encode("Content-Disposition: form-data; name=file; filename=photo.jpg");
      const result = parsePartHeaders(headers);
      expect(result.filename).toBe("photo.jpg");
    });

    it("defaults Content-Type to application/octet-stream", () => {
      const headers = encode('Content-Disposition: form-data; name="file"; filename="data.bin"');
      const result = parsePartHeaders(headers);
      expect(result.contentType).toBe("application/octet-stream");
    });

    it("defaults encoding to 7bit", () => {
      const headers = encode('Content-Disposition: form-data; name="file"; filename="data.bin"');
      const result = parsePartHeaders(headers);
      expect(result.encoding).toBe("7bit");
    });

    it("parses Content-Transfer-Encoding", () => {
      const headers = encode(
        'Content-Disposition: form-data; name="file"; filename="data.bin"\r\nContent-Transfer-Encoding: base64',
      );
      const result = parsePartHeaders(headers);
      expect(result.encoding).toBe("base64");
    });

    it("handles case-insensitive header names", () => {
      const headers = encode(
        'content-disposition: form-data; name="test"; filename="t.txt"\r\ncontent-type: text/plain\r\ncontent-transfer-encoding: binary',
      );
      const result = parsePartHeaders(headers);
      expect(result.name).toBe("test");
      expect(result.filename).toBe("t.txt");
      expect(result.contentType).toBe("text/plain");
      expect(result.encoding).toBe("binary");
    });

    it("handles Content-Type with charset parameter", () => {
      const headers = encode(
        'Content-Disposition: form-data; name="file"; filename="data.json"\r\nContent-Type: application/json; charset=utf-8',
      );
      const result = parsePartHeaders(headers);
      expect(result.contentType).toBe("application/json; charset=utf-8");
    });

    it("handles extra whitespace in header values", () => {
      const headers = encode(
        'Content-Disposition: form-data; name="file";  filename="test.txt"\r\nContent-Type:   text/plain  ',
      );
      const result = parsePartHeaders(headers);
      expect(result.filename).toBe("test.txt");
      expect(result.contentType).toBe("text/plain");
    });

    it("returns empty name when missing", () => {
      const headers = encode("Content-Disposition: form-data");
      const result = parsePartHeaders(headers);
      expect(result.name).toBe("");
    });

    it("handles filename with spaces", () => {
      const headers = encode(
        'Content-Disposition: form-data; name="file"; filename="my document.pdf"',
      );
      const result = parsePartHeaders(headers);
      expect(result.filename).toBe("my document.pdf");
    });

    it("handles empty filename", () => {
      const headers = encode(
        'Content-Disposition: form-data; name="file"; filename=""',
      );
      const result = parsePartHeaders(headers);
      expect(result.filename).toBe("");
    });

    it("parses multiple headers correctly", () => {
      const headers = encode(
        'Content-Disposition: form-data; name="avatar"; filename="pic.png"\r\nContent-Type: image/png\r\nContent-Transfer-Encoding: binary',
      );
      const result: PartHeaders = parsePartHeaders(headers);
      expect(result.name).toBe("avatar");
      expect(result.filename).toBe("pic.png");
      expect(result.contentType).toBe("image/png");
      expect(result.encoding).toBe("binary");
    });
  });

  describe("makeUploadError()", () => {
    it("creates Error instance with message", () => {
      const err = makeUploadError("Test error", 400);
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe("Test error");
    });

    it("attaches status property", () => {
      const err = makeUploadError("Too large", 413) as Error & { status: number };
      expect(err.status).toBe(413);
    });

    it("works with different status codes", () => {
      const err400 = makeUploadError("Bad", 400) as Error & { status: number };
      const err413 = makeUploadError("Large", 413) as Error & { status: number };
      const err500 = makeUploadError("Server", 500) as Error & { status: number };
      expect(err400.status).toBe(400);
      expect(err413.status).toBe(413);
      expect(err500.status).toBe(500);
    });

    it("has correct error stack trace", () => {
      const err = makeUploadError("Trace test", 400);
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain("Trace test");
    });
  });

  describe("memoryStorage()", () => {
    it("creates a storage engine with createWriter", () => {
      const storage = memoryStorage();
      expect(typeof storage.createWriter).toBe("function");
    });

    it("write + end returns buffer with correct data", async () => {
      const storage = memoryStorage();
      const writer = await storage.createWriter(null as any, {
        fieldname: "file",
        originalname: "test.bin",
        mimetype: "application/octet-stream",
        encoding: "7bit",
      });

      writer.write(new Uint8Array([1, 2, 3]));
      writer.write(new Uint8Array([4, 5, 6]));
      const result = await writer.end();

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer!.length).toBe(6);
      expect(result.buffer![0]).toBe(1);
      expect(result.buffer![5]).toBe(6);
    });

    it("handles empty file (no writes)", async () => {
      const storage = memoryStorage();
      const writer = await storage.createWriter(null as any, {
        fieldname: "file",
        originalname: "empty.txt",
        mimetype: "text/plain",
        encoding: "7bit",
      });

      const result = await writer.end();
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer!.length).toBe(0);
    });

    it("preserves binary data with all byte values", async () => {
      const storage = memoryStorage();
      const writer = await storage.createWriter(null as any, {
        fieldname: "file",
        originalname: "all-bytes.bin",
        mimetype: "application/octet-stream",
        encoding: "7bit",
      });

      const allBytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) allBytes[i] = i;
      writer.write(allBytes);

      const result = await writer.end();
      expect(result.buffer!.length).toBe(256);
      for (let i = 0; i < 256; i++) {
        expect(result.buffer![i]).toBe(i);
      }
    });

    it("preserves null bytes and high bytes", async () => {
      const storage = memoryStorage();
      const writer = await storage.createWriter(null as any, {
        fieldname: "file",
        originalname: "nulls.bin",
        mimetype: "application/octet-stream",
        encoding: "7bit",
      });

      writer.write(new Uint8Array([0x00, 0x00, 0xff, 0x00, 0xff]));
      const result = await writer.end();
      expect(result.buffer![0]).toBe(0);
      expect(result.buffer![1]).toBe(0);
      expect(result.buffer![2]).toBe(255);
      expect(result.buffer![3]).toBe(0);
      expect(result.buffer![4]).toBe(255);
    });

    it("abort clears accumulated chunks", async () => {
      const storage = memoryStorage();
      const writer = await storage.createWriter(null as any, {
        fieldname: "file",
        originalname: "abort.bin",
        mimetype: "application/octet-stream",
        encoding: "7bit",
      });

      writer.write(new Uint8Array([1, 2, 3]));
      writer.write(new Uint8Array([4, 5, 6]));
      await writer.abort();

      const result = await writer.end();
      expect(result.buffer!.length).toBe(0);
    });

    it("handles multiple sequential writes of varying sizes", async () => {
      const storage = memoryStorage();
      const writer = await storage.createWriter(null as any, {
        fieldname: "file",
        originalname: "multi.bin",
        mimetype: "application/octet-stream",
        encoding: "7bit",
      });

      writer.write(new Uint8Array([1]));
      writer.write(new Uint8Array(1000).fill(2));
      writer.write(new Uint8Array([3, 4, 5]));
      const result = await writer.end();
      expect(result.buffer!.length).toBe(1004);
      expect(result.buffer![0]).toBe(1);
      expect(result.buffer![1]).toBe(2);
      expect(result.buffer![1000]).toBe(2);
      expect(result.buffer![1001]).toBe(3);
    });
  });

  describe("diskStorage()", () => {
    it("writes file to specified destination", async () => {
      ensureDir();
      const storage = diskStorage({ destination: UNIT_UPLOAD_DIR });
      const fakeReq = { original: new Request("http://localhost/upload") } as any;
      const writer = await storage.createWriter(fakeReq, {
        fieldname: "file",
        originalname: "disk-test.txt",
        mimetype: "text/plain",
        encoding: "7bit",
      });

      writer.write(new Uint8Array([72, 101, 108, 108, 111]));
      const result = await writer.end();

      expect(result.destination).toBe(UNIT_UPLOAD_DIR);
      expect(result.filename).toBeDefined();
      expect(result.path).toBeDefined();
      expect(existsSync(result.path!)).toBe(true);

      const content = readFileSync(result.path!);
      expect(content.toString()).toBe("Hello");
    });

    it("uses custom filename callback", async () => {
      ensureDir();
      const storage = diskStorage({
        destination: UNIT_UPLOAD_DIR,
        filename: (_req, file, cb) => cb(null, "custom-" + file.originalname),
      });
      const fakeReq = { original: new Request("http://localhost/upload") } as any;
      const writer = await storage.createWriter(fakeReq, {
        fieldname: "file",
        originalname: "myfile.txt",
        mimetype: "text/plain",
        encoding: "7bit",
      });

      writer.write(new Uint8Array([65, 66, 67]));
      const result = await writer.end();

      expect(result.filename).toBe("custom-myfile.txt");
      expect(existsSync(join(UNIT_UPLOAD_DIR, "custom-myfile.txt"))).toBe(true);
    });

    it("uses destination as callback function", async () => {
      ensureDir();
      const subDir = join(UNIT_UPLOAD_DIR, "subdir-" + Date.now());
      const storage = diskStorage({
        destination: (_req, _file, cb) => cb(null, subDir),
      });
      const fakeReq = { original: new Request("http://localhost/upload") } as any;
      const writer = await storage.createWriter(fakeReq, {
        fieldname: "file",
        originalname: "dest-cb.txt",
        mimetype: "text/plain",
        encoding: "7bit",
      });

      writer.write(new Uint8Array([68]));
      const result = await writer.end();

      expect(result.destination).toBe(subDir);
      expect(existsSync(result.path!)).toBe(true);
    });

    it("generates UUID filename by default", async () => {
      ensureDir();
      const storage = diskStorage({ destination: UNIT_UPLOAD_DIR });
      const fakeReq = { original: new Request("http://localhost/upload") } as any;
      const writer = await storage.createWriter(fakeReq, {
        fieldname: "file",
        originalname: "original.txt",
        mimetype: "text/plain",
        encoding: "7bit",
      });

      writer.write(new Uint8Array([1]));
      const result = await writer.end();

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      expect(result.filename).toMatch(uuidRegex);
    });

    it("creates nested directory automatically", async () => {
      const deepDir = join(UNIT_UPLOAD_DIR, "a", "b", "c-" + Date.now());
      const storage = diskStorage({ destination: deepDir });
      const fakeReq = { original: new Request("http://localhost/upload") } as any;
      const writer = await storage.createWriter(fakeReq, {
        fieldname: "file",
        originalname: "deep.txt",
        mimetype: "text/plain",
        encoding: "7bit",
      });

      writer.write(new Uint8Array([1, 2, 3]));
      const result = await writer.end();
      expect(existsSync(result.path!)).toBe(true);
    });

    it("abort cleans up partial file", async () => {
      ensureDir();
      const storage = diskStorage({
        destination: UNIT_UPLOAD_DIR,
        filename: (_req, _file, cb) => cb(null, "aborted-" + Date.now() + ".tmp"),
      });
      const fakeReq = { original: new Request("http://localhost/upload") } as any;
      const writer = await storage.createWriter(fakeReq, {
        fieldname: "file",
        originalname: "abort.txt",
        mimetype: "text/plain",
        encoding: "7bit",
      });

      writer.write(new Uint8Array([1, 2, 3]));
      const endResult = await storage.createWriter(fakeReq, {
        fieldname: "file",
        originalname: "abort2.txt",
        mimetype: "text/plain",
        encoding: "7bit",
      });
      writer.write(new Uint8Array([4, 5]));
      await writer.abort();
    });

    it("propagates destination callback error", async () => {
      const storage = diskStorage({
        destination: (_req, _file, cb) => cb(new Error("Dest error"), ""),
      });
      const fakeReq = { original: new Request("http://localhost/upload") } as any;

      try {
        await storage.createWriter(fakeReq, {
          fieldname: "file",
          originalname: "err.txt",
          mimetype: "text/plain",
          encoding: "7bit",
        });
        expect(true).toBe(false);
      } catch (err) {
        expect((err as Error).message).toBe("Dest error");
      }
    });

    it("propagates filename callback error", async () => {
      ensureDir();
      const storage = diskStorage({
        destination: UNIT_UPLOAD_DIR,
        filename: (_req, _file, cb) => cb(new Error("Fname error"), ""),
      });
      const fakeReq = { original: new Request("http://localhost/upload") } as any;

      try {
        await storage.createWriter(fakeReq, {
          fieldname: "file",
          originalname: "err.txt",
          mimetype: "text/plain",
          encoding: "7bit",
        });
        expect(true).toBe(false);
      } catch (err) {
        expect((err as Error).message).toBe("Fname error");
      }
    });

    it("preserves binary data on disk", async () => {
      ensureDir();
      const storage = diskStorage({
        destination: UNIT_UPLOAD_DIR,
        filename: (_req, _file, cb) => cb(null, "binary-" + Date.now() + ".bin"),
      });
      const fakeReq = { original: new Request("http://localhost/upload") } as any;
      const writer = await storage.createWriter(fakeReq, {
        fieldname: "file",
        originalname: "binary.bin",
        mimetype: "application/octet-stream",
        encoding: "7bit",
      });

      const allBytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) allBytes[i] = i;
      writer.write(allBytes);
      const result = await writer.end();

      const saved = readFileSync(result.path!);
      expect(saved.length).toBe(256);
      for (let i = 0; i < 256; i++) {
        expect(saved[i]).toBe(i);
      }
    });
  });

  describe("Factory pattern", () => {
    it("upload() with no args returns default instance", () => {
      const instance = upload();
      expect(typeof instance.single).toBe("function");
      expect(typeof instance.array).toBe("function");
      expect(typeof instance.fields).toBe("function");
      expect(typeof instance.none).toBe("function");
      expect(typeof instance.any).toBe("function");
    });

    it("upload() with options creates a new instance", () => {
      const instance = upload({ limits: { fileSize: 100 } });
      expect(typeof instance.single).toBe("function");
    });

    it("upload.single() uses default instance", () => {
      const handler = upload.single("file");
      expect(typeof handler).toBe("function");
    });

    it("upload.array() uses default instance", () => {
      const handler = upload.array("files", 5);
      expect(typeof handler).toBe("function");
    });

    it("upload.fields() uses default instance", () => {
      const handler = upload.fields([{ name: "avatar", maxCount: 1 }]);
      expect(typeof handler).toBe("function");
    });

    it("upload.none() uses default instance", () => {
      const handler = upload.none();
      expect(typeof handler).toBe("function");
    });

    it("upload.any() uses default instance", () => {
      const handler = upload.any();
      expect(typeof handler).toBe("function");
    });

    it("upload.memoryStorage returns storage engine", () => {
      const storage = upload.memoryStorage();
      expect(typeof storage.createWriter).toBe("function");
    });

    it("upload.diskStorage returns storage engine", () => {
      const storage = upload.diskStorage({ destination: "/tmp" });
      expect(typeof storage.createWriter).toBe("function");
    });

    it("multiple instances do not share state", async () => {
      const app = bunway();
      const small = upload({ limits: { fileSize: 5 } });
      const large = upload({ limits: { fileSize: 100000 } });

      app.post("/small", small.single("file"), (req, res) => {
        res.json({ ok: true });
      });
      app.post("/large", large.single("file"), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "test.bin", contentType: "application/octet-stream", data: "x".repeat(50) },
      ]);

      const smallRes = await app.handle(
        buildRequest("/small", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );
      expect(smallRes.status).toBe(413);

      const largeRes = await app.handle(
        buildRequest("/large", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );
      expect(largeRes.status).toBe(200);
    });

    it("bunway.upload is same as upload export", () => {
      expect(typeof bunway.upload.single).toBe("function");
      expect(typeof bunway.upload.array).toBe("function");
      expect(typeof bunway.upload.fields).toBe("function");
      expect(typeof bunway.upload.none).toBe("function");
      expect(typeof bunway.upload.any).toBe("function");
      expect(typeof bunway.upload.memoryStorage).toBe("function");
      expect(typeof bunway.upload.diskStorage).toBe("function");
    });
  });

  describe("Middleware guard behavior", () => {
    it("skips when body is already parsed", async () => {
      const app = bunway();
      app.use((req, _res, next) => {
        req.body = { already: "parsed" };
        (req as any)._bodyParsed = true;
        next();
      });
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ body: req.body });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "test.txt", data: "data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.body.already).toBe("parsed");
    });

    it("skips for application/json content type", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ skipped: true });
      });

      const response = await app.handle(
        buildRequest("/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hello: "world" }),
        }),
      );

      expect(response.status).toBe(200);
    });

    it("skips for application/x-www-form-urlencoded", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ skipped: true });
      });

      const response = await app.handle(
        buildRequest("/upload", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "key=value",
        }),
      );

      expect(response.status).toBe(200);
    });

    it("returns 400 for multipart/form-data without boundary", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ ok: true });
      });

      const response = await app.handle(
        buildRequest("/upload", {
          method: "POST",
          headers: { "Content-Type": "multipart/form-data" },
          body: Buffer.from("no boundary"),
        }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Missing multipart boundary");
    });

    it("handles Content-Type with charset parameter", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ hasFile: req.file !== null });
      });

      const boundary = "----TestBound" + Date.now();
      const rawBody = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n`,
        `Content-Type: text/plain\r\n`,
        `\r\n`,
        `hello\r\n`,
        `--${boundary}--\r\n`,
      ].join("");

      const response = await app.handle(
        buildRequest("/upload", {
          method: "POST",
          headers: { "Content-Type": `multipart/form-data; charset=utf-8; boundary=${boundary}` },
          body: Buffer.from(rawBody),
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.hasFile).toBe(true);
    });
  });

  describe("Strategy validation edge cases", () => {
    it("single() with no file uploaded: req.file is null", async () => {
      const app = bunway();
      app.post("/upload", upload.single("avatar"), (req, res) => {
        res.json({ file: req.file });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "username", data: "john" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.file).toBeNull();
    });

    it("array() rejects files on wrong fieldname", async () => {
      const app = bunway();
      app.post("/upload", upload.array("photos", 5), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "avatars", filename: "a.jpg", contentType: "image/jpeg", data: "data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Unexpected field");
    });

    it("array() with no maxCount allows many files", async () => {
      const app = bunway();
      app.post("/upload", upload.array("photos"), (req, res) => {
        const files = req.files as Array<{ originalname: string }>;
        res.json({ count: files.length });
      });

      const parts = [];
      for (let i = 0; i < 10; i++) {
        parts.push({ name: "photos", filename: `p${i}.jpg`, contentType: "image/jpeg", data: `d${i}` });
      }
      const { body, contentType } = buildMultipartBody(parts);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.count).toBe(10);
    });

    it("any() with no files returns empty array", async () => {
      const app = bunway();
      app.post("/upload", upload.any(), (req, res) => {
        const files = req.files as Array<unknown>;
        res.json({ count: files.length, isArray: Array.isArray(req.files) });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "username", data: "john" },
        { name: "email", data: "john@test.com" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.count).toBe(0);
      expect(data.isArray).toBe(true);
    });

    it("any() with mixed files and text fields", async () => {
      const app = bunway();
      app.post("/upload", upload.any(), (req, res) => {
        const files = req.files as Array<{ fieldname: string }>;
        const body = req.body as Record<string, string>;
        res.json({
          fileCount: files.length,
          fieldnames: files.map((f) => f.fieldname),
          username: body.username,
        });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "username", data: "alice" },
        { name: "avatar", filename: "a.jpg", contentType: "image/jpeg", data: "img" },
        { name: "banner", filename: "b.png", contentType: "image/png", data: "img2" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fileCount).toBe(2);
      expect(data.fieldnames).toEqual(["avatar", "banner"]);
      expect(data.username).toBe("alice");
    });

    it("none() with both files and fields rejects file part", async () => {
      const app = bunway();
      app.post("/upload", upload.none(), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "username", data: "alice" },
        { name: "avatar", filename: "pic.jpg", contentType: "image/jpeg", data: "data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("File upload not allowed");
    });

    it("fields() with empty specs array rejects all files", async () => {
      const app = bunway();
      app.post("/upload", upload.fields([]), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "avatar", filename: "a.jpg", contentType: "image/jpeg", data: "data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Unexpected field");
    });

    it("fields() with text-only fields succeeds", async () => {
      const app = bunway();
      app.post("/upload", upload.fields([{ name: "avatar", maxCount: 1 }]), (req, res) => {
        const body = req.body as Record<string, string>;
        res.json({ username: body.username });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "username", data: "alice" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.username).toBe("alice");
    });
  });

  describe("Limit enforcement edge cases", () => {
    it("file exactly at fileSize limit passes", async () => {
      const app = bunway();
      const configured = upload({ limits: { fileSize: 10 } });
      app.post("/upload", configured.single("file"), (req, res) => {
        res.json({ size: req.file?.size });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "exact.bin", contentType: "application/octet-stream", data: "x".repeat(10) },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.size).toBe(10);
    });

    it("file 1 byte over fileSize limit fails", async () => {
      const app = bunway();
      const configured = upload({ limits: { fileSize: 10 } });
      app.post("/upload", configured.single("file"), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "over.bin", contentType: "application/octet-stream", data: "x".repeat(11) },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain("File too large");
    });

    it("field exactly at fieldSize limit passes", async () => {
      const app = bunway();
      const configured = upload({ limits: { fieldSize: 10 } });
      app.post("/upload", configured.none(), (req, res) => {
        const body = req.body as Record<string, string>;
        res.json({ value: body.msg });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "msg", data: "0123456789" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.value).toBe("0123456789");
    });

    it("field 1 byte over fieldSize limit fails", async () => {
      const app = bunway();
      const configured = upload({ limits: { fieldSize: 10 } });
      app.post("/upload", configured.none(), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "msg", data: "01234567890" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain("Field value too large");
    });

    it("field name exactly at fieldNameSize limit passes", async () => {
      const app = bunway();
      const configured = upload({ limits: { fieldNameSize: 5 } });
      app.post("/upload", configured.none(), (req, res) => {
        const body = req.body as Record<string, string>;
        res.json({ value: body.abcde });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "abcde", data: "val" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.value).toBe("val");
    });

    it("parts limit enforcement", async () => {
      const app = bunway();
      const configured = upload({ limits: { parts: 2 } });
      app.post("/upload", configured.any(), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "field1", data: "v1" },
        { name: "field2", data: "v2" },
        { name: "field3", data: "v3" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain("Too many parts");
    });
  });

  describe("File filter edge cases", () => {
    it("filter accepts some files and rejects others in same request", async () => {
      const app = bunway();
      const configured = upload({
        fileFilter: (_req, file, cb) => {
          if (file.mimetype === "image/jpeg") cb(null, true);
          else cb(null, false);
        },
      });
      app.post("/upload", configured.any(), (req, res) => {
        const files = req.files as Array<{ originalname: string }>;
        res.json({ names: files.map((f) => f.originalname) });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "photo1", filename: "a.jpg", contentType: "image/jpeg", data: "jpeg" },
        { name: "doc", filename: "b.pdf", contentType: "application/pdf", data: "pdf" },
        { name: "photo2", filename: "c.jpg", contentType: "image/jpeg", data: "jpeg2" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.names).toEqual(["a.jpg", "c.jpg"]);
    });

    it("filter error propagates as 400 response", async () => {
      const app = bunway();
      const configured = upload({
        fileFilter: (_req, _file, cb) => {
          cb(new Error("Custom filter error"), false);
        },
      });
      app.post("/upload", configured.single("file"), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "test.txt", contentType: "text/plain", data: "data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Custom filter error");
    });

    it("filter receives correct file info", async () => {
      let receivedInfo: any = null;
      const app = bunway();
      const configured = upload({
        fileFilter: (_req, file, cb) => {
          receivedInfo = { ...file };
          cb(null, true);
        },
      });
      app.post("/upload", configured.single("avatar"), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "avatar", filename: "pic.jpg", contentType: "image/jpeg", data: "img" },
      ]);

      await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(receivedInfo).not.toBeNull();
      expect(receivedInfo.fieldname).toBe("avatar");
      expect(receivedInfo.originalname).toBe("pic.jpg");
      expect(receivedInfo.mimetype).toBe("image/jpeg");
      expect(receivedInfo.encoding).toBe("7bit");
    });
  });

  describe("Data integrity", () => {
    it("preserves binary data with all 256 byte values via upload", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        const buf = req.file?.buffer;
        const bytes = buf ? Array.from(buf) : [];
        res.json({ length: buf?.length, bytes });
      });

      const allBytes = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) allBytes[i] = i;

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "all-bytes.bin", contentType: "application/octet-stream", data: allBytes },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBe(256);
      for (let i = 0; i < 256; i++) {
        expect(data.bytes[i]).toBe(i);
      }
    });

    it("preserves file with null bytes", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        const buf = req.file?.buffer;
        const bytes = buf ? Array.from(buf) : [];
        res.json({ bytes });
      });

      const nullData = Buffer.from([0x00, 0x00, 0x00, 0xff, 0x00, 0xff]);
      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "nulls.bin", contentType: "application/octet-stream", data: nullData },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.bytes).toEqual([0, 0, 0, 255, 0, 255]);
    });

    it("preserves file containing boundary-like bytes", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        const content = req.file?.buffer?.toString("utf8");
        res.json({ content, size: req.file?.size });
      });

      const trickContent = "data--boundary\r\n--fake\r\n\r\nmore data";
      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "trick.txt", contentType: "text/plain", data: trickContent },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.content).toBe(trickContent);
      expect(data.size).toBe(trickContent.length);
    });

    it("preserves file with CRLF sequences inside", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        const content = req.file?.buffer?.toString("utf8");
        res.json({ content });
      });

      const crlfContent = "line1\r\nline2\r\nline3\r\n";
      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "crlf.txt", contentType: "text/plain", data: crlfContent },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.content).toBe(crlfContent);
    });

    it("handles Unicode field values", async () => {
      const app = bunway();
      app.post("/upload", upload.none(), (req, res) => {
        const body = req.body as Record<string, string>;
        res.json({ name: body.name, bio: body.bio });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "name", data: "日本語テスト" },
        { name: "bio", data: "Ünïcödé with émojis 🎉🚀" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe("日本語テスト");
      expect(data.bio).toBe("Ünïcödé with émojis 🎉🚀");
    });

    it("handles large file upload (1MB)", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ size: req.file?.size });
      });

      const largeData = Buffer.alloc(1024 * 1024, 0x42);
      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "large.bin", contentType: "application/octet-stream", data: largeData },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.size).toBe(1024 * 1024);
    });
  });

  describe("Path handling", () => {
    it("strips backslash paths by default", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ originalname: req.file?.originalname });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "C:\\Users\\test\\photo.jpg", contentType: "image/jpeg", data: "data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.originalname).toBe("photo.jpg");
    });

    it("strips mixed slash paths by default", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ originalname: req.file?.originalname });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "path/to\\nested/file.txt", contentType: "text/plain", data: "data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.originalname).toBe("file.txt");
    });

    it("preservePath=true keeps full backslash path", async () => {
      const app = bunway();
      const configured = upload({ preservePath: true });
      app.post("/upload", configured.single("file"), (req, res) => {
        res.json({ originalname: req.file?.originalname });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "C:\\Users\\test\\photo.jpg", contentType: "image/jpeg", data: "data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.originalname).toBe("C:\\Users\\test\\photo.jpg");
    });
  });

  describe("Error handling edge cases", () => {
    it("handles malformed multipart: no valid boundary in body", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ ok: true });
      });

      const response = await app.handle(
        buildRequest("/upload", {
          method: "POST",
          headers: { "Content-Type": "multipart/form-data; boundary=testbound" },
          body: Buffer.from("completely invalid data with no boundary"),
        }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Malformed multipart data");
    });

    it("handles truncated multipart: stream ends mid-file", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ ok: true });
      });

      const boundary = "----Truncated" + Date.now();
      const truncated = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\ndata without closing boundary`,
      );

      const response = await app.handle(
        buildRequest("/upload", {
          method: "POST",
          headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
          body: truncated,
        }),
      );

      expect(response.status).toBe(400);
    });

    it("handles empty multipart body (just boundaries)", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ file: req.file });
      });

      const boundary = "----EmptyBound" + Date.now();
      const emptyMultipart = Buffer.from(`--${boundary}--\r\n`);

      const response = await app.handle(
        buildRequest("/upload", {
          method: "POST",
          headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
          body: emptyMultipart,
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.file).toBeNull();
    });

    it("handles truncated multipart: stream ends mid-field", async () => {
      const app = bunway();
      app.post("/upload", upload.none(), (req, res) => {
        res.json({ ok: true });
      });

      const boundary = "----TruncField" + Date.now();
      const truncated = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue without closing`,
      );

      const response = await app.handle(
        buildRequest("/upload", {
          method: "POST",
          headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
          body: truncated,
        }),
      );

      expect(response.status).toBe(400);
    });
  });

  describe("File metadata completeness", () => {
    it("single() sets all metadata fields", async () => {
      const app = bunway();
      app.post("/upload", upload.single("doc"), (req, res) => {
        res.json({
          fieldname: req.file?.fieldname,
          originalname: req.file?.originalname,
          encoding: req.file?.encoding,
          mimetype: req.file?.mimetype,
          size: req.file?.size,
          hasBuffer: req.file?.buffer instanceof Buffer,
        });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "doc", filename: "readme.md", contentType: "text/markdown", data: "# Title" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.fieldname).toBe("doc");
      expect(data.originalname).toBe("readme.md");
      expect(data.encoding).toBe("7bit");
      expect(data.mimetype).toBe("text/markdown");
      expect(data.size).toBe(7);
      expect(data.hasBuffer).toBe(true);
    });

    it("disk storage sets destination, filename, and path metadata", async () => {
      ensureDir();
      const app = bunway();
      const configured = upload({
        storage: upload.diskStorage({
          destination: UNIT_UPLOAD_DIR,
          filename: (_req, _file, cb) => cb(null, "meta-test-" + Date.now() + ".txt"),
        }),
      });
      app.post("/upload", configured.single("file"), (req, res) => {
        res.json({
          hasDestination: typeof req.file?.destination === "string",
          hasFilename: typeof req.file?.filename === "string",
          hasPath: typeof req.file?.path === "string",
          hasBuffer: req.file?.buffer !== undefined,
        });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "test.txt", contentType: "text/plain", data: "content" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.hasDestination).toBe(true);
      expect(data.hasFilename).toBe(true);
      expect(data.hasPath).toBe(true);
      expect(data.hasBuffer).toBe(false);
    });

    it("Content-Transfer-Encoding header is captured", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ encoding: req.file?.encoding });
      });

      const boundary = "----EncBound" + Date.now();
      const rawBody = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="encoded.bin"\r\n`,
        `Content-Type: application/octet-stream\r\n`,
        `Content-Transfer-Encoding: base64\r\n`,
        `\r\n`,
        `SGVsbG8=\r\n`,
        `--${boundary}--\r\n`,
      ].join("");

      const response = await app.handle(
        buildRequest("/upload", {
          method: "POST",
          headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
          body: Buffer.from(rawBody),
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.encoding).toBe("base64");
    });
  });

  describe("Multiple file uploads", () => {
    it("array() preserves file order", async () => {
      const app = bunway();
      app.post("/upload", upload.array("files"), (req, res) => {
        const files = req.files as Array<{ originalname: string; size: number }>;
        res.json({
          names: files.map((f) => f.originalname),
          sizes: files.map((f) => f.size),
        });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "files", filename: "first.txt", contentType: "text/plain", data: "aaa" },
        { name: "files", filename: "second.txt", contentType: "text/plain", data: "bb" },
        { name: "files", filename: "third.txt", contentType: "text/plain", data: "c" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.names).toEqual(["first.txt", "second.txt", "third.txt"]);
      expect(data.sizes).toEqual([3, 2, 1]);
    });

    it("fields() groups files correctly by field name", async () => {
      const app = bunway();
      app.post(
        "/upload",
        upload.fields([
          { name: "avatars", maxCount: 2 },
          { name: "banners", maxCount: 3 },
        ]),
        (req, res) => {
          const files = req.files as Record<string, Array<{ originalname: string }>>;
          res.json({
            avatarNames: files.avatars?.map((f) => f.originalname) || [],
            bannerNames: files.banners?.map((f) => f.originalname) || [],
          });
        },
      );

      const { body, contentType } = buildMultipartBody([
        { name: "avatars", filename: "a1.jpg", contentType: "image/jpeg", data: "a1" },
        { name: "banners", filename: "b1.png", contentType: "image/png", data: "b1" },
        { name: "avatars", filename: "a2.jpg", contentType: "image/jpeg", data: "a2" },
        { name: "banners", filename: "b2.png", contentType: "image/png", data: "b2" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.avatarNames).toEqual(["a1.jpg", "a2.jpg"]);
      expect(data.bannerNames).toEqual(["b1.png", "b2.png"]);
    });
  });
});
