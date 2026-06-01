# Report Notes for Part A

Use these notes to write the Part A section of your final report in your own words.

## Architecture

The self-developed API follows a layered Express architecture. Routes define the public REST endpoints, controllers handle HTTP request and response logic, services contain business rules, repositories isolate data access, and middleware handles authentication, validation and errors. This separation improves maintainability and makes the system easier to extend for Part B third-party API integration.

## Database Design

For demonstration purposes, the API uses a local JSON file for persistent storage. The file stores two related collections:

- `users`: registered traveller accounts with hashed passwords.
- `trips`: travel records linked to one user through `user_id`.

The one-to-many relationship means each user can manage many trips while only seeing their own records. The repository layer keeps this storage choice separate from the rest of the API, so the JSON file can be replaced with MySQL, MongoDB, PostgreSQL or SQLite later without changing the controller or route structure.

## Security

JWT authentication protects all trip endpoints. Passwords are hashed using bcrypt before storage, so plaintext passwords are never stored. Helmet adds secure HTTP headers and rate limiting reduces brute-force or abuse risk. API secrets are loaded from environment variables instead of being hard coded.

## Error Handling and Validation

Zod validates request bodies, route parameters and query strings before the controller runs. Invalid input returns a clear `400` response with details. A centralized error handler returns consistent JSON errors across the API. Missing or expired JWTs return `401`, while trips that do not belong to the current user return `404`.

## Why This Supports the Smart Travel Planner

The API stores the user-specific travel data required by the assignment, including destinations, dates, notes, preferences, budget and trip status. The Part B planner endpoint combines this stored trip information with Open-Meteo weather data and OpenStreetMap attraction data to produce meaningful travel planning results.

## Part B Third-Party API Integration

The endpoint `GET /api/v1/planner/trips/:id/summary` demonstrates third-party API integration. It first reads the authenticated user's saved trip from the self-developed API, then sends the trip destination to Open-Meteo's geocoding API to obtain latitude and longitude. These coordinates are then used with Open-Meteo's forecast API to fetch current weather conditions and with OpenStreetMap Overpass API to fetch nearby attractions.

The final response combines internal and external data in one JSON result: the saved trip, weather provider, resolved location, current temperature, humidity, wind speed, weather description, nearby attractions and a simple travel recommendation. This meets the requirement to merge data from both the self-developed API and third-party APIs.
