---
title: File Upload Middleware
description: Handle multipart file uploads with bunWay's multer-compatible upload middleware, supporting memory and disk storage.
---

# File Upload Middleware

Handle multipart file uploads with a multer-compatible API. Memory and disk storage engines included out of the box.

::: tip Coming from Express?
This works just like `multer`. Same `.single()`, `.array()`, `.fields()` API. Same file object shape. Drop-in replacement.
:::

## Quick Start

```ts
import bunway, { upload } from 'bunway';

const app = bunway();

app.post('/avatar', upload.single('avatar'), (req, res) => {
  res.json({
    filename: req.file.originalname,
    size: req.file.size
  });
});

app.listen(3000);
```

::: code-group

```ts [Server]
app.post('/avatar', upload.single('avatar'), (req, res) => {
  res.json({ file: req.file });
});
```

```bash [Client]
curl -X POST http://localhost:3000/avatar \
  -F "avatar=@photo.jpg"
```

:::

## Upload Strategies

### Single File

Accept one file from a named field. The file is available on `req.file`.

```ts
app.post('/avatar', upload.single('avatar'), (req, res) => {
  // req.file → UploadedFile
  res.json({
    name: req.file.originalname,
    type: req.file.mimetype,
    size: req.file.size
  });
});
```

### Multiple Files (Same Field)

Accept multiple files from a single field. Set an optional max count. Files are available on `req.files` as an array.

```ts
app.post('/photos', upload.array('photos', 5), (req, res) => {
  // req.files → UploadedFile[]
  res.json({
    count: req.files.length,
    files: req.files.map(f => f.originalname)
  });
});
```

### Mixed Fields

Accept files from multiple named fields, each with its own max count. Files are available on `req.files` as an object keyed by field name.

```ts
app.post('/profile', upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'gallery', maxCount: 8 }
]), (req, res) => {
  // req.files → { avatar: UploadedFile[], gallery: UploadedFile[] }
  const avatar = req.files.avatar[0];
  const gallery = req.files.gallery;

  res.json({
    avatar: avatar.originalname,
    galleryCount: gallery.length
  });
});
```

### Text Only (No Files)

Accept only text fields. Rejects any file uploads with a `400` error.

```ts
app.post('/text-form', upload.none(), (req, res) => {
  // req.body contains text fields only
  res.json(req.body);
});
```

### Any Files

Accept files from any field name. Files are available on `req.files` as an array.

```ts
app.post('/upload', upload.any(), (req, res) => {
  // req.files → UploadedFile[]
  res.json({ count: req.files.length });
});
```

::: warning Use with caution
`upload.any()` accepts files from any field. Prefer `upload.single()`, `upload.array()`, or `upload.fields()` to enforce expected fields explicitly.
:::

## Configured Instance

The default `upload` export uses memory storage with no limits. Create a configured instance for more control:

```ts
import { upload, diskStorage } from 'bunway';

const configured = upload({
  storage: diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  }
});

app.post('/avatar', configured.single('avatar'), (req, res) => {
  res.json({ path: req.file.path });
});
```

## Storage Engines

### Memory Storage (Default)

Files are stored as `Buffer` in memory. Best for small files or when you need to process data before saving.

```ts
import { upload, memoryStorage } from 'bunway';

const configured = upload({ storage: memoryStorage() });

app.post('/process', configured.single('file'), (req, res) => {
  // req.file.buffer → Buffer containing the file data
  const content = req.file.buffer.toString('utf-8');
  res.json({ length: content.length });
});
```

::: warning Memory usage
Memory storage holds entire files in memory. For large files or high traffic, use disk storage instead.
:::

### Disk Storage

Files are written to disk using `Bun.file().writer()`. Use this for large files or persistent storage.

```ts
import { upload, diskStorage } from 'bunway';

const configured = upload({
  storage: diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    }
  })
});

app.post('/upload', configured.single('document'), (req, res) => {
  // req.file.path → full path to saved file
  // req.file.destination → './uploads'
  // req.file.filename → generated filename
  res.json({ path: req.file.path });
});
```

#### Disk Storage Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `destination` | `string \| (req, file, cb) => void` | — | Directory to store uploaded files |
| `filename` | `(req, file, cb) => void` | `crypto.randomUUID()` | Custom filename generator |

Dynamic destination based on request data:

```ts
const configured = upload({
  storage: diskStorage({
    destination: (req, file, cb) => {
      const dir = file.mimetype.startsWith('image/')
        ? './uploads/images'
        : './uploads/documents';
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  })
});
```

## File Object

Each uploaded file has the following shape:

```ts
interface UploadedFile {
  fieldname: string;      // Form field name
  originalname: string;   // Original filename from client
  encoding: string;       // File encoding (e.g., '7bit')
  mimetype: string;       // MIME type (e.g., 'image/png')
  size: number;           // File size in bytes
  buffer?: Buffer;        // File contents (memory storage only)
  destination?: string;   // Upload directory (disk storage only)
  filename?: string;      // Generated filename (disk storage only)
  path?: string;          // Full file path (disk storage only)
}
```

## Limits

Restrict uploads by size and count:

```ts
const configured = upload({
  limits: {
    fileSize: 5 * 1024 * 1024,   // 5 MB max file size
    files: 10,                    // Max 10 file fields
    fields: 20,                   // Max 20 non-file fields
    fieldSize: 1024,              // Max field value size (bytes)
    fieldNameSize: 100,           // Max field name length (bytes)
    parts: 30                     // Max total parts (files + fields)
  }
});
```

### Limits Reference

| Option | Type | Description |
|--------|------|-------------|
| `fileSize` | `number` | Max file size in bytes |
| `files` | `number` | Max number of file fields |
| `fields` | `number` | Max number of non-file fields |
| `fieldSize` | `number` | Max field value size in bytes |
| `fieldNameSize` | `number` | Max field name size in bytes |
| `parts` | `number` | Max total parts (files + fields) |

## File Filter

Accept or reject files before they are stored:

```ts
const imageOnly = upload({
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);   // Accept
    } else {
      cb(new Error('Only image files are allowed'), false);  // Reject
    }
  }
});

app.post('/avatar', imageOnly.single('avatar'), (req, res) => {
  res.json({ file: req.file.originalname });
});
```

Filter by extension:

```ts
const docsOnly = upload({
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`File type ${ext} not allowed`), false);
  }
});
```

## Error Handling

Upload errors are returned as HTTP responses with appropriate status codes:

| Condition | Status | Message |
|-----------|--------|---------|
| Missing multipart boundary | 400 | Missing multipart boundary |
| Missing request body | 400 | Missing request body |
| File too large | 413 | File too large |
| Too many files | 413 | Too many files |
| Unexpected field name | 400 | Unexpected field: {name} |
| File sent to `none()` | 400 | File upload not allowed |
| `fileFilter` rejection | 400 | Custom error message |

Handle errors in your own error middleware:

```ts
app.post('/upload', configured.single('file'), (req, res) => {
  res.json({ file: req.file.originalname });
});

app.use((err, req, res, next) => {
  if (err.message === 'File too large') {
    return res.status(413).json({ error: 'File exceeds 5 MB limit' });
  }
  if (err.message.startsWith('Unexpected field')) {
    return res.status(400).json({ error: 'Use the "file" field name' });
  }
  next(err);
});
```

## Examples

### Profile Picture Upload

```ts
import bunway, { upload, diskStorage } from 'bunway';

const app = bunway();

const avatarUpload = upload({
  storage: diskStorage({
    destination: './uploads/avatars',
    filename: (req, file, cb) => {
      const ext = file.originalname.split('.').pop();
      cb(null, `${req.params.userId}.${ext}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
  }
});

app.post('/users/:userId/avatar', avatarUpload.single('avatar'), (req, res) => {
  res.json({
    message: 'Avatar uploaded',
    path: req.file.path
  });
});
```

### Multi-File Gallery

```ts
const galleryUpload = upload({
  storage: diskStorage({
    destination: './uploads/gallery',
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 20
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  }
});

app.post('/gallery', galleryUpload.array('images', 20), (req, res) => {
  res.json({
    uploaded: req.files.length,
    files: req.files.map(f => ({
      name: f.originalname,
      size: f.size,
      path: f.path
    }))
  });
});
```

### Form with Mixed Fields

```ts
const formUpload = upload({
  storage: diskStorage({ destination: './uploads' }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.post('/submit', formUpload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'coverLetter', maxCount: 1 },
  { name: 'portfolio', maxCount: 5 }
]), (req, res) => {
  const resume = req.files.resume?.[0];
  const coverLetter = req.files.coverLetter?.[0];
  const portfolio = req.files.portfolio || [];

  res.json({
    applicant: req.body.name,
    email: req.body.email,
    resume: resume?.originalname,
    coverLetter: coverLetter?.originalname,
    portfolioCount: portfolio.length
  });
});
```

## Migration from multer

The API is a drop-in replacement:

```js
// Express + multer
const multer = require('multer');
const upload = multer({ dest: './uploads' });
app.post('/upload', upload.single('file'), handler);

// bunWay
import { upload, diskStorage } from 'bunway';
const configured = upload({
  storage: diskStorage({ destination: './uploads' })
});
app.post('/upload', configured.single('file'), handler);
```

Same patterns. Same file object shape. Just faster.
