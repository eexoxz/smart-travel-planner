# Smart Travel Planner API

Smart Travel Planner is a full-stack travel planning application built with a Node.js and Express REST API, SQLite persistence, third-party travel data integration, and a browser-based HTML/CSS/JavaScript interface.

## Technical Overview

| Area | Implementation |
|---|---|
| API Design & Architecture | `/api/v1` versioning, MVC-style layers, separate routes/controllers/services/repositories |
| Functionality & Business Logic | Full CRUD for user-owned trip records with filtering and ownership checks |
| Security Implementation | JWT login, hashed passwords, Helmet security headers, rate limiting, no hard-coded production secrets |
| Data Storage & Integration | SQLite database with related `users` and `trips` tables |
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

Open the application interface:

```text
http://localhost:3000/app
```

Opening `http://localhost:3000` redirects to the application interface.

## Database Choice

This version uses a local SQLite database at `data/travel-planner.sqlite`. The database contains related `users` and `trips` tables, with each trip linked to the authenticated user who owns it.

## Third-Party API Integration

Part B uses two public external APIs. No API key or extra package is required.

- Open-Meteo for geocoding and current weather.
- OpenStreetMap Overpass API with a Nominatim fallback for nearby cafes, restaurants, attractions and points of interest.

The combined endpoint is:

```text
GET /api/v1/planner/trips/:id/summary
```

It combines:

- the authenticated user's saved trip from the local API
- geocoded destination coordinates from Open-Meteo
- current weather from Open-Meteo
- nearby places from OpenStreetMap Overpass or Nominatim
- a short travel recommendation based on the weather

## Application Layer

Part C is implemented as a plain HTML/CSS/JavaScript web interface served by the Express backend. No extra frontend setup is required.

The interface supports:

- register and login
- create, read, update and delete trips
- searchable country selection
- country to region/state to city dropdown flow
- city options fetched from a public country-state-city API
- selectable travel preference chips used by the travel plan
- budget amount with currency
- generate a travel plan that combines saved trip data with weather and nearby points of interest
- view a day-by-day itinerary based on trip dates and preferences
- open Swagger documentation for API testing

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
| `GET` | `/api/v1/planner/trips/:id/summary` | Combine saved trip with live weather and attractions |

All `/trips` endpoints require:

```text
Authorization: Bearer <JWT_TOKEN>
```

In Swagger's **Authorize** popup, paste only the token value without quotation marks. Swagger adds the `Bearer` prefix automatically.

## Example Trip Request

```json
{
  "destination": "Kyoto",
  "country": "Japan",
  "region": "Kansai",
  "startDate": "2026-07-10",
  "endDate": "2026-07-16",
  "notes": "Prefer cultural sites, local food and train-friendly routes.",
  "preferenceTags": ["culture", "food", "museums"],
  "budgetAmount": 2500,
  "budgetCurrency": "JPY",
  "status": "planned"
}
```

## Testing

Run automated tests:

```bash
npm test
```

Manual API checks can be run with the Postman collection at `postman/smart-travel-planner-api.postman_collection.json`.

For review or presentation, useful screenshots include:

- A successful user registration or login.
- The `/app` interface showing saved trips.
- A successful `POST /api/v1/trips`.
- A successful `GET /api/v1/trips`.
- A failed request such as missing JWT or invalid date range.
- A successful `GET /api/v1/planner/trips/:id/summary` showing third-party weather and attractions integration.
- Swagger UI showing the documented endpoints.

## Development Progress

The repository history shows the project being built in stages: API structure, authentication, trip CRUD, SQLite persistence, validation, documentation, tests, external APIs, and the application interface.
