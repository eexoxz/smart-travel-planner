# Technical Report Notes

This document summarises the main technical decisions behind the Smart Travel Planner API and application.

## Architecture

The API follows a layered Express architecture. Routes define the public REST endpoints, controllers handle HTTP request and response logic, services contain business rules, repositories isolate data access, and middleware handles authentication, validation and errors. This separation improves maintainability and makes the system easier to extend.

## Database Design

The API uses a local SQLite database for persistent storage. The database stores two related tables:

- `users`: registered traveller accounts with hashed passwords.
- `trips`: travel records linked to one user through `user_id`.

The one-to-many relationship means each user can manage many trips while only seeing their own records. The repository layer keeps SQL access separate from the rest of the API, so the controller and route structure stay focused on HTTP behaviour rather than database details.

## Security

JWT authentication protects all trip endpoints. Passwords are hashed using bcrypt before storage, so plaintext passwords are never stored. Helmet adds secure HTTP headers and rate limiting reduces brute-force or abuse risk. API secrets are loaded from environment variables instead of being hard coded.

## Error Handling and Validation

Zod validates request bodies, route parameters and query strings before the controller runs. Invalid input returns a clear `400` response with details. A centralized error handler returns consistent JSON errors across the API. Missing or expired JWTs return `401`, while trips that do not belong to the current user return `404`.

## Why This Supports the Smart Travel Planner

The API stores user-specific travel data including destinations, dates, notes, preferences, budget and trip status. The planner endpoint combines this stored trip information with Open-Meteo weather data and OpenStreetMap nearby point-of-interest data to produce meaningful travel planning results.

## Third-Party API Integration

The endpoint `GET /api/v1/planner/trips/:id/summary` demonstrates third-party API integration. It first reads the authenticated user's saved trip from the self-developed API, then sends the trip destination to Open-Meteo's geocoding API to obtain latitude and longitude. These coordinates are then used with Open-Meteo's forecast API to fetch current weather conditions and with OpenStreetMap Overpass API to fetch nearby places such as cafes, restaurants, attractions, museums, parks, beaches and shops. If the radius-based place search returns no usable results, the backend performs dynamic Nominatim searches using the saved destination, region, country and selected preferences. If those searches also return no useful places, Wikimedia geosearch is used with the resolved coordinates.

The final response combines internal and external data in one JSON result: the saved trip, weather provider, resolved location, current temperature, humidity, wind speed, weather description, nearby attractions and a simple travel recommendation. This meets the requirement to merge data from both the self-developed API and third-party APIs.

## Application Layer

The application layer is implemented as a web interface using HTML, CSS and JavaScript. It is served from the Express backend at `/app`, so no separate frontend server is required. Users can register or log in, create travel records, view saved trips, update or delete trips and generate a travel plan for a selected trip.

The travel plan view demonstrates the full system workflow because it takes user-specific trip data from the self-developed API and combines it with third-party weather and point-of-interest data. It returns weather advice, suggested nearby places, a day-by-day itinerary, a main location and recommended visiting time for each day, and preparation tips. If preference-specific places cannot be found, the response explains the limitation and falls back to broader live destination searches instead of returning misleading results. The form also supports a country to region/state to city dropdown flow, selectable travel preference chips and budget currency selection, which makes the planning workflow easier to use.
