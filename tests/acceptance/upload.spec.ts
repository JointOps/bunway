import { describe, expect, it, afterAll } from "bun:test";
import bunway, { upload } from "../../src";
import { existsSync, mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";

const UPLOAD_DIR = join(import.meta.dir, ".tmp-acceptance-uploads");

function ensureDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

afterAll(() => {
  rmSync(UPLOAD_DIR, { recursive: true, force: true });
});

function buildMultipartBody(
  parts: Array<{
    name: string;
    filename?: string;
    contentType?: string;
    data: string | Buffer;
  }>,
): { body: Buffer; contentType: string } {
  const boundary = "----AcceptBound" + Date.now();
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

describe("File Upload Acceptance", () => {
  it("full round-trip: upload image via single(), verify metadata", async () => {
    ensureDir();
    const app = bunway();
    const configured = upload({
      storage: upload.diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => cb(null, "uploaded-" + file.originalname),
      }),
    });

    app.post("/avatar", configured.single("avatar"), (req, res) => {
      res.json({
        fieldname: req.file?.fieldname,
        originalname: req.file?.originalname,
        mimetype: req.file?.mimetype,
        size: req.file?.size,
        path: req.file?.path,
      });
    });

    const imageData = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) imageData[i] = i;

    const { body, contentType } = buildMultipartBody([
      { name: "avatar", filename: "profile.png", contentType: "image/png", data: imageData },
    ]);

    const response = await app.handle(
      new Request("http://localhost/avatar", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.fieldname).toBe("avatar");
    expect(data.originalname).toBe("profile.png");
    expect(data.mimetype).toBe("image/png");
    expect(data.size).toBe(256);

    const savedPath = join(UPLOAD_DIR, "uploaded-profile.png");
    expect(existsSync(savedPath)).toBe(true);
    const saved = readFileSync(savedPath);
    expect(saved.length).toBe(256);
    expect(saved[0]).toBe(0);
    expect(saved[255]).toBe(255);
  });

  it("full round-trip: upload + text fields together", async () => {
    const app = bunway();
    app.post("/profile", upload.single("photo"), (req, res) => {
      const body = req.body as Record<string, string>;
      res.json({
        name: body.name,
        bio: body.bio,
        photoName: req.file?.originalname,
        photoSize: req.file?.size,
      });
    });

    const { body, contentType } = buildMultipartBody([
      { name: "name", data: "Jane Doe" },
      { name: "bio", data: "Software engineer" },
      { name: "photo", filename: "headshot.jpg", contentType: "image/jpeg", data: "jpeg-binary-data" },
    ]);

    const response = await app.handle(
      new Request("http://localhost/profile", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe("Jane Doe");
    expect(data.bio).toBe("Software engineer");
    expect(data.photoName).toBe("headshot.jpg");
    expect(data.photoSize).toBe(16);
  });

  it("full round-trip: exceed limit, verify 413", async () => {
    const app = bunway();
    const configured = upload({ limits: { fileSize: 100 } });
    app.post("/upload", configured.single("file"), (req, res) => {
      res.json({ ok: true });
    });

    const largeData = Buffer.alloc(500, 0x42);
    const { body, contentType } = buildMultipartBody([
      { name: "file", filename: "large.bin", contentType: "application/octet-stream", data: largeData },
    ]);

    const response = await app.handle(
      new Request("http://localhost/upload", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      }),
    );

    expect(response.status).toBe(413);
    const data = await response.json();
    expect(data.error).toContain("File too large");
  });

  it("full round-trip: file filter rejection", async () => {
    const app = bunway();
    const configured = upload({
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === "image/jpeg") cb(null, true);
        else cb(new Error("Only JPEG files are accepted"), false);
      },
    });
    app.post("/upload", configured.single("photo"), (req, res) => {
      res.json({ uploaded: req.file !== null });
    });

    const { body, contentType } = buildMultipartBody([
      { name: "photo", filename: "doc.pdf", contentType: "application/pdf", data: "pdf-content" },
    ]);

    const response = await app.handle(
      new Request("http://localhost/upload", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      }),
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Only JPEG files are accepted");
  });

  it("memory storage: buffer populated, no disk path", async () => {
    const app = bunway();
    const configured = upload({ storage: upload.memoryStorage() });
    app.post("/upload", configured.single("file"), (req, res) => {
      res.json({
        hasBuffer: Buffer.isBuffer(req.file?.buffer),
        bufferLength: req.file?.buffer?.length,
        hasPath: req.file?.path !== undefined,
        size: req.file?.size,
      });
    });

    const fileData = Buffer.from("hello memory storage");
    const { body, contentType } = buildMultipartBody([
      { name: "file", filename: "test.txt", contentType: "text/plain", data: fileData },
    ]);

    const response = await app.handle(
      new Request("http://localhost/upload", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.hasBuffer).toBe(true);
    expect(data.bufferLength).toBe(fileData.length);
    expect(data.hasPath).toBe(false);
    expect(data.size).toBe(fileData.length);
  });

  it("array(): multiple files same field → req.files is array", async () => {
    const app = bunway();
    app.post("/photos", upload.array("photos"), (req, res) => {
      const files = req.files as import("../../src").UploadedFile[];
      res.json({
        count: files?.length,
        names: files?.map((f) => f.originalname),
      });
    });

    const { body, contentType } = buildMultipartBody([
      { name: "photos", filename: "a.jpg", contentType: "image/jpeg", data: "img-a" },
      { name: "photos", filename: "b.jpg", contentType: "image/jpeg", data: "img-b" },
    ]);

    const response = await app.handle(
      new Request("http://localhost/photos", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.count).toBe(2);
    expect(data.names).toEqual(["a.jpg", "b.jpg"]);
  });

  it("array(): maxCount exceeded → 413", async () => {
    const app = bunway();
    const configured = upload({ storage: upload.memoryStorage() });
    app.post("/photos", configured.array("photos", 2), (req, res) => {
      res.json({ ok: true });
    });

    const { body, contentType } = buildMultipartBody([
      { name: "photos", filename: "a.jpg", contentType: "image/jpeg", data: "a" },
      { name: "photos", filename: "b.jpg", contentType: "image/jpeg", data: "b" },
      { name: "photos", filename: "c.jpg", contentType: "image/jpeg", data: "c" },
    ]);

    const response = await app.handle(
      new Request("http://localhost/photos", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      }),
    );

    expect(response.status).toBe(413);
    const data = await response.json();
    expect(data.error).toContain("Too many files");
  });

  it("fields(): multiple named fields → req.files keyed by field name", async () => {
    const app = bunway();
    app.post(
      "/upload",
      upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "gallery", maxCount: 3 },
      ]),
      (req, res) => {
        const files = req.files as Record<string, import("../../src").UploadedFile[]>;
        res.json({
          avatarCount: files.avatar?.length,
          avatarName: files.avatar?.[0]?.originalname,
          galleryCount: files.gallery?.length,
          galleryNames: files.gallery?.map((f) => f.originalname),
        });
      },
    );

    const { body, contentType } = buildMultipartBody([
      { name: "avatar", filename: "me.png", contentType: "image/png", data: "avatar-data" },
      { name: "gallery", filename: "p1.jpg", contentType: "image/jpeg", data: "photo1" },
      { name: "gallery", filename: "p2.jpg", contentType: "image/jpeg", data: "photo2" },
    ]);

    const response = await app.handle(
      new Request("http://localhost/upload", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.avatarCount).toBe(1);
    expect(data.avatarName).toBe("me.png");
    expect(data.galleryCount).toBe(2);
    expect(data.galleryNames).toEqual(["p1.jpg", "p2.jpg"]);
  });

  it("none(): rejects any file upload with 400", async () => {
    const app = bunway();
    app.post("/upload", upload.none(), (req, res) => {
      res.json({ ok: true });
    });

    const { body, contentType } = buildMultipartBody([
      { name: "file", filename: "secret.txt", contentType: "text/plain", data: "data" },
    ]);

    const response = await app.handle(
      new Request("http://localhost/upload", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      }),
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("File upload not allowed");
  });

  it("none(): passes through when no files are sent", async () => {
    const app = bunway();
    app.post("/form", upload.none(), (req, res) => {
      const body = req.body as Record<string, string>;
      res.json({ name: body.name });
    });

    const { body, contentType } = buildMultipartBody([{ name: "name", data: "Alice" }]);

    const response = await app.handle(
      new Request("http://localhost/form", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe("Alice");
  });
});
