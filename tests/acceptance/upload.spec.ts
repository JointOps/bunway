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
});
