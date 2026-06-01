# Smart Travel Planner API

This is the Part A self-developed API for the Smart Travel Planner coursework. It is designed to meet the higher bands of the marking rubric by showing RESTful routing, versioning, modular architecture, persistent data storage, JWT authentication, validation, centralized error handling, OpenAPI documentation, and automated tests.

## Distinction-Level Evidence

| Rubric area | Evidence in this API |
|---|---|
| API Design & Architecture | `/api/v1` versioning, MVC-style layers, separate routes/controllers/services/repositories |
| Functionality & Business Logic | Full CRUD for user-owned trip records with filtering and ownership checks |
| Security Implementation | JWT login, hashed passwords, Helmet security headers, rate limiting, no hard-coded production secrets |
| Data Storage & Integration | JSON file storage with related `users` and `trips` collections for demo purposes |
| Code Quality | Small modules, meaningful names, reusable validation and error handling |
| Testing & Error Handling | Jest/Supertest tests, centralized JSON error responses, validation feedback |
| Documentation & Presentation | OpenAPI spec and Swagger UI at `/api-docs` |

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
copy .env.example .env
```

3. Edit `.env` and replace `JWT_SECRET` with a long random value.

4. Start the API:

```bash
npm run dev
```

5. Open the API documentation:

```text
http://localhost:3000/api-docs
```

Opening `http://localhost:3000` redirects to the same documentation page.

## Storage Choice

This demo version uses a local JSON file at `data/travel-planner.json` instead of SQLite or MongoDB. This avoids native package installation issues during demonstration while still showing persistent storage, user-owned trip records, and a clear repository layer that can later be swapped for a full database.

## Main Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create a user account and receive JWT |
| `POST` | `/api/v1/auth/login` | Login and receive JWT |
| `POST` | `/api/v1/trips` | Create a trip record |
| `GET` | `/api/v1/trips` | List authenticated user's trips |
| `GET` | `/api/v1/trips/:id` | Read one trip |
| `PUT` | `/api/v1/trips/:id` | Update one trip |
| `DELETE` | `/api/v1/trips/:id` | Delete one trip |

All `/trips` endpoints require:

```text
Authorization: Bearer <JWT_TOKEN>
```

## Example Trip Request

```json
{
  "destination": "Kyoto",
  "country": "Japan",
  "startDate": "2026-07-10",
  "endDate": "2026-07-16",
  "notes": "Prefer cultural sites, local food and train-friendly routes.",
  "preferenceTags": ["culture", "food", "museums"],
  "budgetAmount": 2500,
  "status": "planned"
}
```

## Testing

Run automated tests:

```bash
npm test
```

For the report and demonstration, include screenshots of:

- A successful user registration or login.
- A successful `POST /api/v1/trips`.
- A successful `GET /api/v1/trips`.
- A failed request such as missing JWT or invalid date range.
- Swagger UI showing the documented endpoints.

## Suggested GitHub Commit History

Use real commits while developing. A single final upload usually looks weak for this assignment.

```bash
git add .
git commit -m "Set up Express API structure"
git commit -m "Add JWT authentication and user schema"
git commit -m "Implement trip CRUD endpoints"
git commit -m "Use JSON file storage for demo persistence"
git commit -m "Add validation and centralized error handling"
git commit -m "Add OpenAPI documentation and tests"
```

## AI Use Acknowledgement

If you use this scaffold, acknowledge AI assistance in the final report. Keep the percentage honest and be ready to explain the code during the face-to-face demonstration.
