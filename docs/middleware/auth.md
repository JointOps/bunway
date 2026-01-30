---
title: Authentication Middleware
description: Learn how to use bunWay's Passport-compatible authentication middleware for user authentication with various strategies.
---

# Authentication Middleware

bunway includes a Passport-compatible authentication middleware that works with the familiar `passport` API pattern. If you've used Passport.js with Express, you'll feel right at home.

::: tip Coming from Express?
This works exactly like Passport.js. Same API, same strategy pattern, same session integration.
:::

## Quick start

```ts
import bunway, { passport, session } from "bunway";

const app = bunway();

// Session middleware required for persistent login
app.use(session({ secret: "keyboard cat" }));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Define how to serialize/deserialize users
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = findUserById(id);
  done(null, user);
});
```

## Using strategies

Register authentication strategies using `passport.use()`:

```ts
import { passport } from "bunway";

// Local strategy example
const LocalStrategy = {
  name: "local",
  authenticate(req, options) {
    const { username, password } = req.body;

    const user = findUser(username, password);
    if (user) {
      this.success(user);
    } else {
      this.fail("Invalid credentials");
    }
  },
};

passport.use(LocalStrategy);
```

## Authenticating requests

Use `passport.authenticate()` to protect routes:

```ts
// Redirect on failure
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  })
);

// Custom callback
app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info });

    req.login(user, (err) => {
      if (err) return next(err);
      res.json({ message: "Logged in", user });
    });
  })(req, res, next);
});
```

## Session integration

When used with the session middleware, passport automatically:

1. Serializes the user to the session on login
2. Deserializes the user from the session on each request
3. Makes `req.user` available in all subsequent handlers

```ts
// Protected route
app.get("/profile", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ user: req.user });
});
```

## Request methods

After `passport.initialize()`, the following methods are available on `req`:

| Method              | Description                          |
| ------------------- | ------------------------------------ |
| `req.login(user)`   | Log in the user                      |
| `req.logout()`      | Log out the user                     |
| `req.isAuthenticated()` | Check if user is authenticated   |
| `req.isUnauthenticated()` | Check if user is not authenticated |
| `req.user`          | The authenticated user (if any)      |

## Authentication options

```ts
passport.authenticate("local", {
  session: true, // Save to session (default: true)
  successRedirect: "/dashboard", // Redirect on success
  failureRedirect: "/login", // Redirect on failure
  failureFlash: "Invalid credentials", // Flash message on failure
  successFlash: "Welcome!", // Flash message on success
  failWithError: true, // Pass error to next() instead of responding
});
```

## Creating custom strategies

Implement the `Strategy` interface:

```ts
import type { Strategy } from "bunway";

const JWTStrategy: Strategy = {
  name: "jwt",
  authenticate(req, options) {
    const token = req.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
      this.fail("No token provided", 401);
      return;
    }

    try {
      const decoded = verifyJWT(token);
      const user = findUserById(decoded.sub);

      if (user) {
        this.success(user);
      } else {
        this.fail("User not found", 401);
      }
    } catch (err) {
      this.error(err);
    }
  },
};

passport.use(JWTStrategy);
```

### Strategy action methods

Inside `authenticate()`, use these methods:

| Method                | Description                           |
| --------------------- | ------------------------------------- |
| `this.success(user)`  | Authentication succeeded              |
| `this.fail(msg, status)` | Authentication failed              |
| `this.redirect(url)`  | Redirect to URL                       |
| `this.pass()`         | Skip this strategy                    |
| `this.error(err)`     | Internal error occurred               |

## Multiple strategies

Try multiple strategies in order:

```ts
app.post(
  "/login",
  passport.authenticate(["local", "ldap"], {
    failureRedirect: "/login",
  })
);
```

The first successful strategy wins; failures cascade to the next strategy.

## Authorization (separate from authentication)

Use `passport.authorize()` to connect additional accounts without affecting `req.user`:

```ts
app.get(
  "/connect/github",
  passport.authorize("github", { scope: ["user:email"] })
);

// Connected account available as req.account
app.get("/connect/github/callback", passport.authorize("github"), (req, res) => {
  // req.user is still the logged-in user
  // req.account is the newly authorized account
  linkAccounts(req.user, req.account);
  res.redirect("/profile");
});
```

## Example: Complete login flow

```ts
import bunway, { passport, session, json } from "bunway";

const app = bunway();

app.use(json());
app.use(session({ secret: "keyboard cat" }));
app.use(passport.initialize());
app.use(passport.session());

// Serialize user ID to session
passport.serializeUser((user, done) => done(null, user.id));

// Deserialize user from session
passport.deserializeUser((id, done) => {
  const user = users.find((u) => u.id === id);
  done(null, user || false);
});

// Local strategy
passport.use({
  name: "local",
  authenticate(req) {
    const { email, password } = req.body;
    const user = users.find((u) => u.email === email && u.password === password);
    if (user) this.success(user);
    else this.fail("Invalid credentials");
  },
});

// Routes
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  })
);

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

app.get("/dashboard", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  res.json({ message: "Welcome!", user: req.user });
});

app.listen({ port: 3000 });
```

For type details see `AuthenticateOptions` and `Strategy` in the [API Reference](/api/index.html).
