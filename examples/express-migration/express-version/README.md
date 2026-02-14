# TaskAPI - Express Version

Reference implementation of TaskAPI using Express.js.

## Features

- **Authentication**: Passport.js with local strategy
- **Sessions**: express-session with cookie-based sessions
- **Security**: Helmet for security headers, CORS, rate limiting
- **File Uploads**: Multer for multipart/form-data
- **Static Files**: express.static middleware
- **Error Handling**: Error middleware for sync and async errors
- **Validation**: Request body validation
- **CRUD Operations**: Full task management

## Installation

```bash
npm install
```

## Run

```bash
npm start
```

Server runs on http://localhost:3000

## Test Users

- `admin` / `password123`
- `user` / `userpass`

## Endpoints

### Public

- `GET /` - API info
- `GET /api/health` - Health check
- `POST /api/auth/login` - Login

### Authenticated

- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/upload/avatar` - Upload avatar

## Migration to bunway

See `../bunway-version/` for the bunway equivalent with minimal changes.
