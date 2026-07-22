# Dinery — Backend API (capstone-food-app-api)

Express + PostgreSQL (Neon) REST API powering **Dinery**, a web food ordering
application. Handles restaurants, menu items, orders, users, authentication
verification, and Stripe payments.

Frontend repo: `capstone-food-app`

---

## Tech Stack

- **Runtime:** Node.js + Express
- **Database:** PostgreSQL, hosted on [Neon](https://neon.tech)
- **DB Client:** `pg` (node-postgres)
- **Auth:** Firebase Admin SDK (verifies ID tokens issued by the frontend's Firebase Auth)
- **Payments:** Stripe (PaymentIntents API)
- **Testing:** Vitest + Supertest
- **Deployment:** Vercel

---

## Getting Started

### 1. Install dependencies & packages

```bash
npm install
npm install express cors pg dotenv
npm install firebase-admin
npm install stripe
```

### 2. Environment variables

Create a `.env` file in the project root:

```
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
```

### 3. Firebase Admin credentials

Download a service account key from Firebase Console → Project Settings →
Service Accounts → Generate new private key. Save it as:

```
config/serviceAccountKey.json
```

This file is git-ignored and must never be committed.

### 4. Run the database schema

Run the SQL in `schema.sql` (see below) against your Neon database via the
Neon SQL console.

### 5. Start the server

```bash
npm run dev      # nodemon, auto-restarts on file changes
# or
node index.js    # no auto-restart
```

Server runs on `http://localhost:3000`.

### 6. Run tests

```bash
npm test
```

Note: tests currently run against the real development database (no
separate test DB). Keep this in mind if seed data changes.

---

## Database Schema

```
users
├─ id (PK)
├─ firebase_uid (unique)
├─ email (unique)
├─ name
├─ role → consumer | owner | admin
└─ created_at

restaurants
├─ id (PK)
├─ owner_id (FK → users.id, nullable)
├─ name, description, address, phone, image_url
├─ is_active (used to pause a restaurant without deleting it)
├─ table_count (reserved for future dine-in/table-number feature)
└─ created_at

menu_items
├─ id (PK)
├─ restaurant_id (FK → restaurants.id)
├─ category (free text, e.g. "Mains", "Drinks")
├─ name, description, price, image_url
├─ is_available
└─ created_at

orders
├─ id (PK)
├─ consumer_id (FK → users.id, nullable — null means guest order)
├─ guest_name, guest_phone (used when consumer_id is null)
├─ restaurant_id (FK → restaurants.id)
├─ status → pending | paid | completed | cancelled
├─ payment_method → online | counter
├─ stripe_payment_id
├─ table_number (reserved for future dine-in feature)
├─ total_amount
└─ created_at

order_items
├─ id (PK)
├─ order_id (FK → orders.id)
├─ menu_item_id (FK → menu_items.id)
├─ quantity
└─ price_at_order  ← snapshot of price at time of order, so historical
                       receipts stay accurate even if the menu price changes later
```

Full `CREATE TABLE` statements are in `schema.sql`.

---

## API Endpoints

### Restaurants (`/api/restaurants`)

| Method | Route   | Access      | Description                                                                      |
| ------ | ------- | ----------- | -------------------------------------------------------------------------------- |
| GET    | `/`     | Public      | Active restaurants only (for consumer Home page)                                 |
| GET    | `/all`  | Admin       | All restaurants, including paused ones                                           |
| GET    | `/mine` | Owner/Admin | Restaurants owned by the logged-in user (array)                                  |
| GET    | `/:id`  | Public      | Single restaurant                                                                |
| POST   | `/`     | Admin       | Create restaurant                                                                |
| PUT    | `/:id`  | Owner/Admin | Update restaurant                                                                |
| DELETE | `/:id`  | Owner/Admin | Delete restaurant (blocked if it has order/menu history — see Known Limitations) |

### Menu Items (`/api/menu-items`)

| Method | Route                 | Access      | Description                                   |
| ------ | --------------------- | ----------- | --------------------------------------------- |
| GET    | `/restaurant/:id`     | Public      | Available items only (consumer menu view)     |
| GET    | `/restaurant/:id/all` | Owner/Admin | All items including unavailable ones          |
| GET    | `/:id`                | Public      | Single item                                   |
| POST   | `/`                   | Owner/Admin | Create item                                   |
| PUT    | `/:id`                | Owner/Admin | Update item                                   |
| DELETE | `/:id`                | Owner/Admin | Delete item (blocked if it has order history) |

### Orders (`/api/orders`)

| Method | Route             | Access                                               | Description                                               |
| ------ | ----------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| POST   | `/`               | Public (optional auth)                               | Place an order — works for guests and logged-in consumers |
| GET    | `/mine`           | Consumer                                             | Logged-in consumer's own order history                    |
| GET    | `/restaurant/:id` | Owner/Admin                                          | All orders for a restaurant                               |
| GET    | `/:id`            | Public (guest orders) / Owner / Order's own consumer | Single order + items. See Known Limitations.              |
| PUT    | `/:id/status`     | Owner/Admin                                          | Update order status                                       |

### Users (`/api/users`)

| Method | Route       | Access        | Description                                                     |
| ------ | ----------- | ------------- | --------------------------------------------------------------- |
| POST   | `/sync`     | Authenticated | Creates/fetches the Neon user row matching the Firebase account |
| GET    | `/me`       | Authenticated | Current user's profile + role                                   |
| GET    | `/`         | Admin         | List all users                                                  |
| PUT    | `/:id/role` | Admin         | Change a user's role                                            |

### Payments (`/api/payments`)

| Method | Route                    | Access | Description                                       |
| ------ | ------------------------ | ------ | ------------------------------------------------- |
| POST   | `/create-payment-intent` | Public | Creates a Stripe PaymentIntent for a given amount |

---

## Key Architecture Decisions

- **Order creation uses a database transaction.** Inserting the order and its
  line items happens inside `BEGIN`/`COMMIT`, with `ROLLBACK` on any failure —
  guarantees an order is never left half-created.
- **Prices are re-fetched server-side at checkout**, never trusted from the
  frontend request body, to prevent tampered client-side prices.
- **Guest checkout is supported without accounts.** `orders.consumer_id` is
  nullable; guest orders store `guest_name`/`guest_phone` instead. An
  `optionalAuth` middleware attaches `req.user` when a valid token is present,
  without rejecting the request when it isn't.
- **Deletion is blocked, not silently allowed, for anything with order
  history.** Menu items and restaurants that appear in past `order_items`
  can't be hard-deleted (Postgres foreign key constraint), by design — this
  keeps historical receipts accurate. Owners/admins use "pause" or
  "unavailable" instead. The API catches this constraint (Postgres error code
  `23503`) and returns a clear `409` message rather than a raw `500`.
- **Public vs. management data views are intentionally separate.** The
  consumer-facing restaurant/menu routes filter out paused restaurants and
  unavailable items; separate `/all` and `/mine` routes give owners/admins
  the full, unfiltered picture.

---

## Known Limitations / Future Improvements

- **Order detail access control is coarser than ideal.** Any account with
  role `owner` or `admin` can view any order's details via `GET /orders/:id`,
  not just orders for restaurants they manage. Tightening this would require
  joining through `restaurant_id` ownership — left as a future improvement.
- **No separate test database.** Backend tests run against the real
  development Neon database rather than an isolated test instance.
- **Hard-coded price/table reservations.** `restaurants.table_count` and
  `orders.table_number` columns exist for a planned dine-in/table-ordering
  feature that isn't wired into the API or UI yet.
- **No rate limiting** on any endpoint.

---

## Deployment Notes

Deployed on Vercel. Because Vercel runs Express as serverless functions,
regular long-lived Postgres connections can exhaust Neon's connection limit
under load. See the frontend README / deployment section for the driver
configuration used to mitigate this.
