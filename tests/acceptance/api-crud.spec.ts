/**
 * REST API CRUD Acceptance Tests
 *
 * End-to-end tests for complete REST API scenarios.
 * Tests create, read, update, delete operations with validation and pagination.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import bunway, { Router } from "../../src";
import type { BunRequest, BunResponse, NextFunction } from "../../src";

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
  createdAt: string;
  updatedAt: string;
}

let products: Map<number, Product>;
let nextId: number;

function createProductApi() {
  const app = bunway();

  const apiRouter = new Router();
  // Note: Add JSON middleware to router since bunway skips parent middleware for child routers
  apiRouter.use(bunway.json());

  // Validation middleware
  const validateProduct = (req: BunRequest, res: BunResponse, next: NextFunction) => {
    const body = (req.body || {}) as Partial<Product>;
    const { name, price, category } = body;
    const errors: string[] = [];

    if (req.method === "POST") {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        errors.push("Name is required");
      }
      if (price === undefined || typeof price !== "number" || price < 0) {
        errors.push("Price must be a non-negative number");
      }
      if (!category || typeof category !== "string") {
        errors.push("Category is required");
      }
    } else if (req.method === "PUT" || req.method === "PATCH") {
      if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
        errors.push("Name must be a non-empty string");
      }
      if (price !== undefined && (typeof price !== "number" || price < 0)) {
        errors.push("Price must be a non-negative number");
      }
      if (category !== undefined && typeof category !== "string") {
        errors.push("Category must be a string");
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: "Validation Error", errors });
    }

    next();
  };

  // List products with pagination and filtering
  apiRouter.get("/products", (req: BunRequest, res: BunResponse) => {
    const page = parseInt(req.query.get("page") || "1");
    const limit = parseInt(req.query.get("limit") || "10");
    const category = req.query.get("category");
    const inStock = req.query.get("inStock");
    const sortBy = req.query.get("sortBy") || "createdAt";
    const sortOrder = req.query.get("sortOrder") || "desc";

    let filteredProducts = Array.from(products.values());

    // Apply filters
    if (category) {
      filteredProducts = filteredProducts.filter((p) => p.category === category);
    }
    if (inStock !== null) {
      filteredProducts = filteredProducts.filter((p) => p.inStock === (inStock === "true"));
    }

    // Apply sorting
    filteredProducts.sort((a, b) => {
      const aVal = a[sortBy as keyof Product];
      const bVal = b[sortBy as keyof Product];
      if (sortOrder === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });

    // Apply pagination
    const total = filteredProducts.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedProducts = filteredProducts.slice(offset, offset + limit);

    res.json({
      data: paginatedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  });

  // Get single product
  apiRouter.get("/products/:id", (req: BunRequest, res: BunResponse) => {
    const id = parseInt(req.params.id);
    const product = products.get(id);

    if (!product) {
      return res.status(404).json({ error: "Not Found", message: `Product with ID ${id} not found` });
    }

    res.json(product);
  });

  // Create product
  apiRouter.post("/products", validateProduct, (req: BunRequest, res: BunResponse) => {
    const body = (req.body || {}) as Partial<Product>;
    const { name, price, category, inStock = true } = body;

    const now = new Date().toISOString();
    const product: Product = {
      id: nextId++,
      name: name!.trim(),
      price: price!,
      category: category!,
      inStock,
      createdAt: now,
      updatedAt: now,
    };

    products.set(product.id, product);

    res.status(201)
      .set("Location", `/api/products/${product.id}`)
      .json(product);
  });

  // Update product (full replacement)
  apiRouter.put("/products/:id", validateProduct, (req: BunRequest, res: BunResponse) => {
    const id = parseInt(req.params.id);
    const existing = products.get(id);

    if (!existing) {
      return res.status(404).json({ error: "Not Found", message: `Product with ID ${id} not found` });
    }

    const body = (req.body || {}) as Partial<Product>;
    const { name, price, category, inStock = true } = body;

    const updated: Product = {
      ...existing,
      name: name!.trim(),
      price: price!,
      category: category!,
      inStock,
      updatedAt: new Date().toISOString(),
    };

    products.set(id, updated);
    res.json(updated);
  });

  // Partial update
  apiRouter.patch("/products/:id", validateProduct, (req: BunRequest, res: BunResponse) => {
    const id = parseInt(req.params.id);
    const existing = products.get(id);

    if (!existing) {
      return res.status(404).json({ error: "Not Found", message: `Product with ID ${id} not found` });
    }

    const body = (req.body || {}) as Partial<Product>;
    const { name, price, category, inStock } = body;

    const updated: Product = {
      ...existing,
      ...(name !== undefined && { name: name.trim() }),
      ...(price !== undefined && { price }),
      ...(category !== undefined && { category }),
      ...(inStock !== undefined && { inStock }),
      updatedAt: new Date().toISOString(),
    };

    products.set(id, updated);
    res.json(updated);
  });

  // Delete product
  apiRouter.delete("/products/:id", (req: BunRequest, res: BunResponse) => {
    const id = parseInt(req.params.id);

    if (!products.has(id)) {
      return res.status(404).json({ error: "Not Found", message: `Product with ID ${id} not found` });
    }

    products.delete(id);
    res.status(204).send(null);
  });

  // Bulk operations
  apiRouter.post("/products/bulk", (req: BunRequest, res: BunResponse) => {
    const items = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Bad Request", message: "Expected array of products" });
    }

    const created: Product[] = [];
    const errors: { index: number; errors: string[] }[] = [];

    items.forEach((item, index) => {
      const itemErrors: string[] = [];
      if (!item.name || typeof item.name !== "string") {
        itemErrors.push("Name is required");
      }
      if (item.price === undefined || typeof item.price !== "number" || item.price < 0) {
        itemErrors.push("Price must be a non-negative number");
      }
      if (!item.category) {
        itemErrors.push("Category is required");
      }

      if (itemErrors.length > 0) {
        errors.push({ index, errors: itemErrors });
      } else {
        const now = new Date().toISOString();
        const product: Product = {
          id: nextId++,
          name: item.name!.trim(),
          price: item.price!,
          category: item.category!,
          inStock: item.inStock ?? true,
          createdAt: now,
          updatedAt: now,
        };
        products.set(product.id, product);
        created.push(product);
      }
    });

    if (errors.length > 0) {
      return res.status(207).json({
        created,
        errors,
        message: `${created.length} products created, ${errors.length} failed`,
      });
    }

    res.status(201).json({ created, message: `${created.length} products created` });
  });

  app.use("/api", apiRouter);
  return app;
}

describe("REST API CRUD (Acceptance)", () => {
  beforeEach(() => {
    // Reset data before each test
    products = new Map();
    nextId = 1;
  });

  describe("Create (POST)", () => {
    it("should create a new product", async () => {
      const app = createProductApi();

      const res = await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Widget",
            price: 19.99,
            category: "Electronics",
          }),
        })
      );

      expect(res.status).toBe(201);
      expect(res.headers.get("Location")).toBe("/api/products/1");

      const body = await res.json();
      expect(body.id).toBe(1);
      expect(body.name).toBe("Widget");
      expect(body.price).toBe(19.99);
      expect(body.category).toBe("Electronics");
      expect(body.inStock).toBe(true);
      expect(body.createdAt).toBeDefined();
    });

    it("should validate required fields", async () => {
      const app = createProductApi();

      const res = await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Widget" }), // Missing price and category
        })
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.errors).toContain("Price must be a non-negative number");
      expect(body.errors).toContain("Category is required");
    });

    it("should reject negative prices", async () => {
      const app = createProductApi();

      const res = await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Widget",
            price: -10,
            category: "Electronics",
          }),
        })
      );

      expect(res.status).toBe(400);
    });

    it("should create multiple products in bulk", async () => {
      const app = createProductApi();

      const res = await app.handle(
        new Request("http://localhost/api/products/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([
            { name: "Product 1", price: 10, category: "A" },
            { name: "Product 2", price: 20, category: "B" },
            { name: "Product 3", price: 30, category: "A" },
          ]),
        })
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.created.length).toBe(3);
    });

    it("should handle partial bulk creation failures", async () => {
      const app = createProductApi();

      const res = await app.handle(
        new Request("http://localhost/api/products/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([
            { name: "Valid Product", price: 10, category: "A" },
            { name: "Invalid Product", price: -5, category: "B" }, // Invalid
            { name: "Another Valid", price: 20, category: "C" },
          ]),
        })
      );

      expect(res.status).toBe(207); // Multi-status
      const body = await res.json();
      expect(body.created.length).toBe(2);
      expect(body.errors.length).toBe(1);
      expect(body.errors[0].index).toBe(1);
    });
  });

  describe("Read (GET)", () => {
    it("should retrieve a single product", async () => {
      const app = createProductApi();

      // Create product first
      await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Widget", price: 19.99, category: "Electronics" }),
        })
      );

      // Retrieve it
      const res = await app.handle(new Request("http://localhost/api/products/1"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(1);
      expect(body.name).toBe("Widget");
    });

    it("should return 404 for non-existent product", async () => {
      const app = createProductApi();

      const res = await app.handle(new Request("http://localhost/api/products/999"));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.message).toContain("999");
    });

    it("should list all products with pagination", async () => {
      const app = createProductApi();

      // Create 15 products
      for (let i = 1; i <= 15; i++) {
        await app.handle(
          new Request("http://localhost/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: `Product ${i}`, price: i * 10, category: "Test" }),
          })
        );
      }

      // Get first page
      const page1Res = await app.handle(
        new Request("http://localhost/api/products?page=1&limit=5")
      );
      const page1 = await page1Res.json();

      expect(page1.data.length).toBe(5);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.total).toBe(15);
      expect(page1.pagination.totalPages).toBe(3);
      expect(page1.pagination.hasNext).toBe(true);
      expect(page1.pagination.hasPrev).toBe(false);

      // Get second page
      const page2Res = await app.handle(
        new Request("http://localhost/api/products?page=2&limit=5")
      );
      const page2 = await page2Res.json();

      expect(page2.data.length).toBe(5);
      expect(page2.pagination.page).toBe(2);
      expect(page2.pagination.hasNext).toBe(true);
      expect(page2.pagination.hasPrev).toBe(true);

      // Get last page
      const page3Res = await app.handle(
        new Request("http://localhost/api/products?page=3&limit=5")
      );
      const page3 = await page3Res.json();

      expect(page3.data.length).toBe(5);
      expect(page3.pagination.hasNext).toBe(false);
      expect(page3.pagination.hasPrev).toBe(true);
    });

    it("should filter products by category", async () => {
      const app = createProductApi();

      // Create products in different categories
      await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Phone", price: 500, category: "Electronics" }),
        })
      );
      await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Shirt", price: 30, category: "Clothing" }),
        })
      );
      await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Laptop", price: 1000, category: "Electronics" }),
        })
      );

      // Filter by Electronics
      const res = await app.handle(
        new Request("http://localhost/api/products?category=Electronics")
      );
      const body = await res.json();

      expect(body.data.length).toBe(2);
      expect(body.data.every((p: Product) => p.category === "Electronics")).toBe(true);
    });

    it("should filter products by inStock status", async () => {
      const app = createProductApi();

      await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "In Stock", price: 10, category: "A", inStock: true }),
        })
      );
      await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Out of Stock", price: 20, category: "B", inStock: false }),
        })
      );

      const inStockRes = await app.handle(
        new Request("http://localhost/api/products?inStock=true")
      );
      const inStock = await inStockRes.json();
      expect(inStock.data.length).toBe(1);
      expect(inStock.data[0].name).toBe("In Stock");

      const outOfStockRes = await app.handle(
        new Request("http://localhost/api/products?inStock=false")
      );
      const outOfStock = await outOfStockRes.json();
      expect(outOfStock.data.length).toBe(1);
      expect(outOfStock.data[0].name).toBe("Out of Stock");
    });

    it("should sort products", async () => {
      const app = createProductApi();

      await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Cheap", price: 5, category: "A" }),
        })
      );
      await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Expensive", price: 100, category: "A" }),
        })
      );
      await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Medium", price: 50, category: "A" }),
        })
      );

      // Sort by price ascending
      const ascRes = await app.handle(
        new Request("http://localhost/api/products?sortBy=price&sortOrder=asc")
      );
      const asc = await ascRes.json();
      expect(asc.data[0].name).toBe("Cheap");
      expect(asc.data[2].name).toBe("Expensive");

      // Sort by price descending
      const descRes = await app.handle(
        new Request("http://localhost/api/products?sortBy=price&sortOrder=desc")
      );
      const desc = await descRes.json();
      expect(desc.data[0].name).toBe("Expensive");
      expect(desc.data[2].name).toBe("Cheap");
    });
  });

  describe("Update (PUT/PATCH)", () => {
    it("should fully update a product with PUT", async () => {
      const app = createProductApi();

      // Create product
      await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Original", price: 10, category: "A" }),
        })
      );

      // Update it
      const res = await app.handle(
        new Request("http://localhost/api/products/1", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated", price: 20, category: "B" }),
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Updated");
      expect(body.price).toBe(20);
      expect(body.category).toBe("B");
    });

    it("should partially update a product with PATCH", async () => {
      const app = createProductApi();

      // Create product
      await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Original", price: 10, category: "A" }),
        })
      );

      // Partial update - only price
      const res = await app.handle(
        new Request("http://localhost/api/products/1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price: 25 }),
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Original"); // Unchanged
      expect(body.price).toBe(25); // Changed
      expect(body.category).toBe("A"); // Unchanged
    });

    it("should return 404 when updating non-existent product", async () => {
      const app = createProductApi();

      const res = await app.handle(
        new Request("http://localhost/api/products/999", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test", price: 10, category: "A" }),
        })
      );

      expect(res.status).toBe(404);
    });

    it("should update updatedAt timestamp", async () => {
      const app = createProductApi();

      // Create product
      const createRes = await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Original", price: 10, category: "A" }),
        })
      );
      const original = await createRes.json();

      // Wait a tiny bit to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));

      // Update
      const updateRes = await app.handle(
        new Request("http://localhost/api/products/1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price: 20 }),
        })
      );
      const updated = await updateRes.json();

      expect(updated.createdAt).toBe(original.createdAt);
      expect(updated.updatedAt).not.toBe(original.updatedAt);
    });
  });

  describe("Delete (DELETE)", () => {
    it("should delete a product", async () => {
      const app = createProductApi();

      // Create product
      await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "ToDelete", price: 10, category: "A" }),
        })
      );

      // Delete it
      const deleteRes = await app.handle(
        new Request("http://localhost/api/products/1", { method: "DELETE" })
      );

      expect(deleteRes.status).toBe(204);

      // Verify it's gone
      const getRes = await app.handle(new Request("http://localhost/api/products/1"));
      expect(getRes.status).toBe(404);
    });

    it("should return 404 when deleting non-existent product", async () => {
      const app = createProductApi();

      const res = await app.handle(
        new Request("http://localhost/api/products/999", { method: "DELETE" })
      );

      expect(res.status).toBe(404);
    });
  });

  describe("Full CRUD Flow", () => {
    it("should complete full create-read-update-delete cycle", async () => {
      const app = createProductApi();

      // CREATE
      const createRes = await app.handle(
        new Request("http://localhost/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test Product", price: 99.99, category: "Test" }),
        })
      );
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      const productId = created.id;

      // READ
      const readRes = await app.handle(
        new Request(`http://localhost/api/products/${productId}`)
      );
      expect(readRes.status).toBe(200);
      const read = await readRes.json();
      expect(read.name).toBe("Test Product");

      // UPDATE
      const updateRes = await app.handle(
        new Request(`http://localhost/api/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated Product", price: 149.99 }),
        })
      );
      expect(updateRes.status).toBe(200);
      const updated = await updateRes.json();
      expect(updated.name).toBe("Updated Product");
      expect(updated.price).toBe(149.99);

      // DELETE
      const deleteRes = await app.handle(
        new Request(`http://localhost/api/products/${productId}`, { method: "DELETE" })
      );
      expect(deleteRes.status).toBe(204);

      // VERIFY DELETION
      const verifyRes = await app.handle(
        new Request(`http://localhost/api/products/${productId}`)
      );
      expect(verifyRes.status).toBe(404);
    });

    it("should handle concurrent operations", async () => {
      const app = createProductApi();

      // Create multiple products concurrently
      const createPromises = Array.from({ length: 10 }, (_, i) =>
        app.handle(
          new Request("http://localhost/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: `Product ${i}`, price: i * 10, category: "Test" }),
          })
        )
      );

      const createResults = await Promise.all(createPromises);
      expect(createResults.every((r) => r.status === 201)).toBe(true);

      // Verify all created
      const listRes = await app.handle(new Request("http://localhost/api/products"));
      const list = await listRes.json();
      expect(list.data.length).toBe(10);
    });
  });
});
