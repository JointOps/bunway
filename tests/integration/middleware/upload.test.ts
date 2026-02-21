import { describe, expect, it, afterAll } from "bun:test";
import bunway, { upload } from "../../../src";
import { buildRequest } from "../../utils/testUtils";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const TEST_UPLOAD_DIR = join(import.meta.dir, ".tmp-uploads");

function ensureUploadDir() {
  if (!existsSync(TEST_UPLOAD_DIR)) mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
}

afterAll(() => {
  rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
});

function buildMultipartBody(
  parts: Array<{
    name: string;
    filename?: string;
    contentType?: string;
    data: string | Buffer;
  }>,
): { body: Buffer; contentType: string } {
  const boundary = "----TestBoundary" + Date.now();
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

describe("upload() middleware", () => {
  describe("upload.single()", () => {
    it("parses single file upload correctly", async () => {
      const app = bunway();
      app.post("/upload", upload.single("avatar"), (req, res) => {
        res.json({
          hasFile: req.file !== null,
          fieldname: req.file?.fieldname,
          originalname: req.file?.originalname,
          mimetype: req.file?.mimetype,
          size: req.file?.size,
        });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "avatar", filename: "photo.jpg", contentType: "image/jpeg", data: "fake-image-data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.hasFile).toBe(true);
      expect(data.fieldname).toBe("avatar");
      expect(data.originalname).toBe("photo.jpg");
      expect(data.mimetype).toBe("image/jpeg");
      expect(data.size).toBe(15);
    });

    it("sets req.file with buffer in memory storage", async () => {
      const app = bunway();
      app.post("/upload", upload.single("doc"), (req, res) => {
        const buf = req.file?.buffer;
        res.json({
          hasBuffer: buf instanceof Buffer,
          content: buf?.toString("utf8"),
        });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "doc", filename: "test.txt", contentType: "text/plain", data: "hello world" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.hasBuffer).toBe(true);
      expect(data.content).toBe("hello world");
    });

    it("sets req.body with non-file fields", async () => {
      const app = bunway();
      app.post("/upload", upload.single("avatar"), (req, res) => {
        res.json({ body: req.body, hasFile: req.file !== null });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "username", data: "john" },
        { name: "avatar", filename: "pic.png", contentType: "image/png", data: "png-data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.body.username).toBe("john");
      expect(data.hasFile).toBe(true);
    });

    it("rejects unexpected field names", async () => {
      const app = bunway();
      app.post("/upload", upload.single("avatar"), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "photo", filename: "pic.png", contentType: "image/png", data: "data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Unexpected field");
    });

    it("handles empty file (0 bytes)", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ size: req.file?.size, hasBuffer: req.file?.buffer instanceof Buffer });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "empty.txt", contentType: "text/plain", data: "" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.size).toBe(0);
      expect(data.hasBuffer).toBe(true);
    });
  });

  describe("upload.array()", () => {
    it("parses multiple files on same field", async () => {
      const app = bunway();
      app.post("/upload", upload.array("photos"), (req, res) => {
        const files = req.files as Array<{ fieldname: string; originalname: string }>;
        res.json({
          count: files.length,
          names: files.map((f) => f.originalname),
        });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "photos", filename: "a.jpg", contentType: "image/jpeg", data: "aaa" },
        { name: "photos", filename: "b.jpg", contentType: "image/jpeg", data: "bbb" },
        { name: "photos", filename: "c.jpg", contentType: "image/jpeg", data: "ccc" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.count).toBe(3);
      expect(data.names).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    });

    it("enforces maxCount limit", async () => {
      const app = bunway();
      app.post("/upload", upload.array("photos", 2), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "photos", filename: "a.jpg", contentType: "image/jpeg", data: "aaa" },
        { name: "photos", filename: "b.jpg", contentType: "image/jpeg", data: "bbb" },
        { name: "photos", filename: "c.jpg", contentType: "image/jpeg", data: "ccc" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain("Too many files");
    });

    it("sets req.files as array", async () => {
      const app = bunway();
      app.post("/upload", upload.array("docs"), (req, res) => {
        res.json({ isArray: Array.isArray(req.files) });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "docs", filename: "a.pdf", contentType: "application/pdf", data: "pdf-data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.isArray).toBe(true);
    });
  });

  describe("upload.fields()", () => {
    it("parses mixed file fields with correct grouping", async () => {
      const app = bunway();
      app.post(
        "/upload",
        upload.fields([
          { name: "avatar", maxCount: 1 },
          { name: "gallery", maxCount: 3 },
        ]),
        (req, res) => {
          const files = req.files as Record<string, Array<{ originalname: string }>>;
          res.json({
            avatarCount: files.avatar?.length || 0,
            galleryCount: files.gallery?.length || 0,
            avatarName: files.avatar?.[0]?.originalname,
          });
        },
      );

      const { body, contentType } = buildMultipartBody([
        { name: "avatar", filename: "me.jpg", contentType: "image/jpeg", data: "avatar-data" },
        { name: "gallery", filename: "g1.jpg", contentType: "image/jpeg", data: "g1" },
        { name: "gallery", filename: "g2.jpg", contentType: "image/jpeg", data: "g2" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.avatarCount).toBe(1);
      expect(data.galleryCount).toBe(2);
      expect(data.avatarName).toBe("me.jpg");
    });

    it("sets req.files as object keyed by field name", async () => {
      const app = bunway();
      app.post(
        "/upload",
        upload.fields([{ name: "doc", maxCount: 2 }]),
        (req, res) => {
          const files = req.files as Record<string, unknown[]>;
          res.json({ isObject: !Array.isArray(req.files), hasDoc: "doc" in files });
        },
      );

      const { body, contentType } = buildMultipartBody([
        { name: "doc", filename: "a.pdf", contentType: "application/pdf", data: "pdf" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.isObject).toBe(true);
      expect(data.hasDoc).toBe(true);
    });

    it("enforces per-field maxCount", async () => {
      const app = bunway();
      app.post(
        "/upload",
        upload.fields([{ name: "photos", maxCount: 1 }]),
        (req, res) => {
          res.json({ ok: true });
        },
      );

      const { body, contentType } = buildMultipartBody([
        { name: "photos", filename: "a.jpg", contentType: "image/jpeg", data: "a" },
        { name: "photos", filename: "b.jpg", contentType: "image/jpeg", data: "b" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(413);
    });

    it("rejects unexpected field names", async () => {
      const app = bunway();
      app.post(
        "/upload",
        upload.fields([{ name: "avatar", maxCount: 1 }]),
        (req, res) => {
          res.json({ ok: true });
        },
      );

      const { body, contentType } = buildMultipartBody([
        { name: "unknown", filename: "x.jpg", contentType: "image/jpeg", data: "x" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Unexpected field");
    });
  });

  describe("upload.none()", () => {
    it("parses text-only multipart form", async () => {
      const app = bunway();
      app.post("/form", upload.none(), (req, res) => {
        res.json({ body: req.body });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "username", data: "alice" },
        { name: "email", data: "alice@example.com" },
      ]);

      const response = await app.handle(
        buildRequest("/form", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.body.username).toBe("alice");
      expect(data.body.email).toBe("alice@example.com");
    });

    it("rejects file uploads with 400 error", async () => {
      const app = bunway();
      app.post("/form", upload.none(), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "avatar", filename: "pic.jpg", contentType: "image/jpeg", data: "data" },
      ]);

      const response = await app.handle(
        buildRequest("/form", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("File upload not allowed");
    });
  });

  describe("upload.any()", () => {
    it("accepts all files regardless of field name", async () => {
      const app = bunway();
      app.post("/upload", upload.any(), (req, res) => {
        const files = req.files as Array<{ fieldname: string }>;
        res.json({
          count: files.length,
          fieldnames: files.map((f) => f.fieldname),
        });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "avatar", filename: "a.jpg", contentType: "image/jpeg", data: "a" },
        { name: "banner", filename: "b.png", contentType: "image/png", data: "b" },
        { name: "resume", filename: "c.pdf", contentType: "application/pdf", data: "c" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.count).toBe(3);
      expect(data.fieldnames).toEqual(["avatar", "banner", "resume"]);
    });

    it("sets req.files as flat array", async () => {
      const app = bunway();
      app.post("/upload", upload.any(), (req, res) => {
        res.json({ isArray: Array.isArray(req.files) });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "x.txt", contentType: "text/plain", data: "x" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.isArray).toBe(true);
    });
  });

  describe("Limits", () => {
    it("enforces fileSize limit (413 response)", async () => {
      const app = bunway();
      const configured = upload({ limits: { fileSize: 10 } });
      app.post("/upload", configured.single("file"), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "big.bin", contentType: "application/octet-stream", data: "x".repeat(50) },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain("File too large");
    });

    it("enforces files count limit", async () => {
      const app = bunway();
      const configured = upload({ limits: { files: 1 } });
      app.post("/upload", configured.any(), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "a", filename: "a.txt", data: "a" },
        { name: "b", filename: "b.txt", data: "b" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain("Too many files");
    });

    it("enforces fields count limit", async () => {
      const app = bunway();
      const configured = upload({ limits: { fields: 1 } });
      app.post("/upload", configured.none(), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "field1", data: "val1" },
        { name: "field2", data: "val2" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain("Too many fields");
    });

    it("enforces fieldSize limit", async () => {
      const app = bunway();
      const configured = upload({ limits: { fieldSize: 5 } });
      app.post("/upload", configured.none(), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "msg", data: "this is way too long" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain("Field value too large");
    });

    it("enforces fieldNameSize limit", async () => {
      const app = bunway();
      const configured = upload({ limits: { fieldNameSize: 5 } });
      app.post("/upload", configured.none(), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "a_very_long_field_name", data: "val" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain("Field name too long");
    });
  });

  describe("File filter", () => {
    it("accepts matching files (mimetype check)", async () => {
      const app = bunway();
      const configured = upload({
        fileFilter: (_req, file, cb) => {
          cb(null, file.mimetype.startsWith("image/"));
        },
      });
      app.post("/upload", configured.single("photo"), (req, res) => {
        res.json({ uploaded: req.file !== null });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "photo", filename: "pic.jpg", contentType: "image/jpeg", data: "img-data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.uploaded).toBe(true);
    });

    it("rejects non-matching files", async () => {
      const app = bunway();
      const configured = upload({
        fileFilter: (_req, file, cb) => {
          if (file.mimetype.startsWith("image/")) cb(null, true);
          else cb(new Error("Only images allowed"), false);
        },
      });
      app.post("/upload", configured.single("doc"), (req, res) => {
        res.json({ ok: true });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "doc", filename: "test.pdf", contentType: "application/pdf", data: "pdf-data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Only images allowed");
    });
  });

  describe("Storage", () => {
    it("memory storage stores buffer on file object", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({
          hasBuffer: req.file?.buffer instanceof Buffer,
          bufferLength: req.file?.buffer?.length,
        });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "data.bin", contentType: "application/octet-stream", data: "binary-content" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.hasBuffer).toBe(true);
      expect(data.bufferLength).toBe(14);
    });

    it("disk storage writes to correct destination with custom filename", async () => {
      ensureUploadDir();
      const app = bunway();
      const configured = upload({
        storage: upload.diskStorage({
          destination: TEST_UPLOAD_DIR,
          filename: (_req, file, cb) => cb(null, "custom-" + file.originalname),
        }),
      });
      app.post("/upload", configured.single("file"), (req, res) => {
        res.json({
          destination: req.file?.destination,
          filename: req.file?.filename,
          path: req.file?.path,
          size: req.file?.size,
        });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "test.txt", contentType: "text/plain", data: "disk-content" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.destination).toBe(TEST_UPLOAD_DIR);
      expect(data.filename).toBe("custom-test.txt");
      expect(data.size).toBe(12);
      expect(existsSync(join(TEST_UPLOAD_DIR, "custom-test.txt"))).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("skips non-multipart content type", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ skipped: true });
      });

      const response = await app.handle(
        buildRequest("/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: "test" }),
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.skipped).toBe(true);
    });

    it("returns 400 for missing boundary", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ ok: true });
      });

      const response = await app.handle(
        buildRequest("/upload", {
          method: "POST",
          headers: { "Content-Type": "multipart/form-data" },
          body: Buffer.from("no boundary data"),
        }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Missing multipart boundary");
    });

    it("handles malformed multipart data", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ ok: true });
      });

      const response = await app.handle(
        buildRequest("/upload", {
          method: "POST",
          headers: { "Content-Type": "multipart/form-data; boundary=testbound" },
          body: Buffer.from("this is not valid multipart data at all"),
        }),
      );

      expect(response.status).toBe(400);
    });

    it("preservePath keeps full path", async () => {
      const app = bunway();
      const configured = upload({ preservePath: true });
      app.post("/upload", configured.single("file"), (req, res) => {
        res.json({ originalname: req.file?.originalname });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "path/to/file.txt", contentType: "text/plain", data: "content" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.originalname).toBe("path/to/file.txt");
    });

    it("strips directory from filename by default", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ originalname: req.file?.originalname });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "path/to/file.txt", contentType: "text/plain", data: "content" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.originalname).toBe("file.txt");
    });
  });

  describe("Integration", () => {
    it("works as route-specific middleware", async () => {
      const app = bunway();
      app.get("/other", (_req, res) => res.json({ route: "other" }));
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ uploaded: req.file !== null });
      });

      const getRes = await app.handle(buildRequest("/other", { method: "GET" }));
      expect(getRes.status).toBe(200);
      expect((await getRes.json()).route).toBe("other");

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "x.txt", contentType: "text/plain", data: "x" },
      ]);
      const postRes = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );
      expect(postRes.status).toBe(200);
      expect((await postRes.json()).uploaded).toBe(true);
    });

    it("works with bunway.upload factory method", async () => {
      const app = bunway();
      app.post("/upload", bunway.upload.single("doc"), (req, res) => {
        res.json({ name: req.file?.originalname });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "doc", filename: "readme.md", contentType: "text/markdown", data: "# Hello" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.name).toBe("readme.md");
    });

    it("configured instance with options", async () => {
      const app = bunway();
      const configured = upload({ limits: { fileSize: 1024 * 1024 } });
      app.post("/upload", configured.single("file"), (req, res) => {
        res.json({ size: req.file?.size });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "small.txt", contentType: "text/plain", data: "small" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.size).toBe(5);
    });

    it("verifies file metadata (encoding field)", async () => {
      const app = bunway();
      app.post("/upload", upload.single("file"), (req, res) => {
        res.json({ encoding: req.file?.encoding });
      });

      const { body, contentType } = buildMultipartBody([
        { name: "file", filename: "test.bin", contentType: "application/octet-stream", data: "data" },
      ]);

      const response = await app.handle(
        buildRequest("/upload", { method: "POST", headers: { "Content-Type": contentType }, body }),
      );

      const data = await response.json();
      expect(data.encoding).toBe("7bit");
    });
  });
});
