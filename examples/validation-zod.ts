/**
 * Example: Request validation with Zod
 *
 * bunWay doesn't include built-in validation - we let you choose your library.
 * This example shows how to use Zod for request validation.
 *
 * Install: bun add zod
 */

import bunway, { HttpError } from "../src";
import { z, ZodError, ZodSchema } from "zod";

const app = bunway();

app.use(bunway.json());

// Validation middleware factory
function validate<T>(schema: ZodSchema<T>, source: "body" | "query" | "params" = "body") {
  return (req: any, res: any, next: (err?: any) => void) => {
    try {
      let data: unknown;
      if (source === "body") {
        data = req.body;
      } else if (source === "query") {
        data = Object.fromEntries(req.query);
      } else {
        data = req.params;
      }

      const result = schema.parse(data);

      if (source === "body") {
        req.body = result;
      } else if (source === "query") {
        req.validatedQuery = result;
      } else {
        req.validatedParams = result;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: "Validation failed",
          details: error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

// Schemas
const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email format"),
  age: z.number().int().min(0).max(150).optional(),
});

const updateUserSchema = createUserSchema.partial();

const userIdSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// Routes with validation
app.post("/users", validate(createUserSchema), (req, res) => {
  const { name, email, age } = req.body as z.infer<typeof createUserSchema>;
  res.status(201).json({
    id: crypto.randomUUID(),
    name,
    email,
    age,
    createdAt: new Date().toISOString(),
  });
});

app.get("/users", validate(paginationSchema, "query"), (req, res) => {
  const { page, limit } = (req as any).validatedQuery as z.infer<typeof paginationSchema>;
  res.json({
    users: [],
    pagination: { page, limit, total: 0 },
  });
});

app.get("/users/:id", validate(userIdSchema, "params"), (req, res) => {
  const { id } = (req as any).validatedParams as z.infer<typeof userIdSchema>;
  res.json({ id, name: "Example User" });
});

app.patch("/users/:id", validate(userIdSchema, "params"), validate(updateUserSchema), (req, res) => {
  const { id } = (req as any).validatedParams;
  const updates = req.body as z.infer<typeof updateUserSchema>;
  res.json({ id, ...updates, updatedAt: new Date().toISOString() });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 3000;
app.listen(Number(PORT));

console.log(`Validation example running on http://localhost:${PORT}`);
console.log(`
Try:
  curl -X POST http://localhost:${PORT}/users \\
    -H "Content-Type: application/json" \\
    -d '{"name": "John", "email": "john@example.com"}'

  curl -X POST http://localhost:${PORT}/users \\
    -H "Content-Type: application/json" \\
    -d '{"name": "", "email": "invalid"}'
`);
