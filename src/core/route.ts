import type { Handler } from "../types";
import type { Router } from "./router";

export class Route {
  private path: string;
  private router: Router;

  constructor(path: string, router: Router) {
    this.path = path;
    this.router = router;
  }

  get(...handlers: Handler[]): this {
    this.router.get(this.path, ...handlers);
    return this;
  }

  post(...handlers: Handler[]): this {
    this.router.post(this.path, ...handlers);
    return this;
  }

  put(...handlers: Handler[]): this {
    this.router.put(this.path, ...handlers);
    return this;
  }

  delete(...handlers: Handler[]): this {
    this.router.delete(this.path, ...handlers);
    return this;
  }

  patch(...handlers: Handler[]): this {
    this.router.patch(this.path, ...handlers);
    return this;
  }

  options(...handlers: Handler[]): this {
    this.router.options(this.path, ...handlers);
    return this;
  }

  head(...handlers: Handler[]): this {
    this.router.head(this.path, ...handlers);
    return this;
  }

  all(...handlers: Handler[]): this {
    this.router.all(this.path, ...handlers);
    return this;
  }
}
