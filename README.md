> Increase throughput, reduce wait times, and grow revenue across every location.

# Restaurant SaaS System — Enterprise operations for multi-branch restaurants 🚀

Centralized order management, branch-scoped carts, and real-time fulfillment for restaurant groups.

## Overview

Restaurant SaaS System helps multi-location restaurants operate consistently and efficiently. Branch-scoped ordering prevents fulfillment errors; real-time updates and dashboards reduce delays and surface revenue-driving insights.

## Key Features

- Multi-branch management with centralized menus and per-branch reporting.
- Branch-isolated cart and checkout to prevent cross-location mistakes.
- Role-based access (Admin / Staff / Customer) with least-privilege controls.
- Full order lifecycle and branch queues for kitchen and front-of-house.
- Real-time order tracking via WebSockets for staff and customers.
- Active order persistence (localStorage) to reduce abandonment.
- Operational dashboards: revenue, peak hours, and product performance.
- Easy integrations: payments, delivery partners, analytics.

## Tech Stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query.
- Backend: PHP, MySQL, Redis.
- Dev & Ops: Node.js, Composer, Docker Compose, Nginx, GitHub Actions.
- Testing & Observability: PHPUnit, Cypress, Sentry, Prometheus/Grafana.

## Screenshots

![Dashboard](./screenshots/dashboard.png)  
_Dashboard analytics and KPIs._

![Menu - Branch View](./screenshots/menu.png)  
_Branch-specific menu and URL preview._

![Cart](./screenshots/cart.png)  
_Branch-scoped cart with persistent session._

![Order Tracking](./screenshots/tracking.png)  
_Live order tracking and status updates._

## Installation & Setup

Prerequisites: Node.js 18+, PHP 8.1+, Composer, MySQL 8+, Redis (recommended), Docker (recommended).

Clone

```bash
git clone <REPO_URL>
cd restaurant-saas
```

Backend (example)

```bash
cd backend   # or backend-ree
composer install
cp .env.example .env   # set DB_*, REDIS_*, BROADCAST_DRIVER
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve --host=0.0.0.0 --port=8000
# (separate terminal)
php artisan websockets:serve --port=6001
```

Frontend

```bash
cd frontend
npm install
cp .env.example .env   # point API URL to backend
npm run dev
```

Production (quick)

```bash
cd frontend && npm run build
cd backend
composer install --no-dev --optimize-autoloader
php artisan config:cache && php artisan route:cache
php artisan migrate --force
```

## Usage

- Admin: configure restaurants, branches, menus, staff, and branding; run promotions and view KPIs.
- Staff: receive orders in real time, update statuses, and manage branch queues.
- Customer: select a branch, build a cart (persisted), checkout, and track order status live.

## Project Structure

- `frontend/` — React TypeScript SPA (pages, components, hooks).
- `backend/` or `backend-ree/` — PHP API (controllers, services, broadcast logic).
- `database/` — schema and seed scripts.
- `config/` — environment and app settings.
- `uploads/` — media assets (logos, product images).

Data is scoped by `branch_id` to ensure strict isolation and accurate reporting.

## Future Improvements

- PCI-compliant payments and subscription billing for SaaS monetization.
- Tenant onboarding and white-label branding for enterprise customers.
- Native mobile apps / PWA for offline ordering and retention.
- Advanced analytics (LTV, cohort analysis) and automated reporting.

## Author

Shihap Gaper — Full Stack Developer focused on SaaS and real-time systems; Portfolio: https://shihap-gaper-portfolio-fajj.vercel.app/ • GitHub: https://github.com/shihap12 • LinkedIn: https://www.linkedin.com/in/shihap-gaper-b490b4382/

---

## Interview Training

### 1) Interview pitch (60–90s)

I built the Restaurant SaaS System to help multi-location restaurants run reliably and scale operations. It centralizes menu and branch management, enforces branch-scoped carts so orders are routed and fulfilled at the correct location, and adds real-time visibility for staff and customers using WebSockets. The stack is a TypeScript React SPA (Zustand + TanStack Query) and a PHP backend (Laravel) with MySQL and Redis; WebSockets and Redis pub/sub deliver live events. The business outcome is clear: fewer fulfillment errors, faster service, and dashboards that help managers act on revenue and peak-hour data.

### 2) Technical deep dive (how to explain)

- System architecture — Frontend: React + TypeScript SPA, local UI state in Zustand, server state via TanStack Query. Backend: Laravel REST API, MySQL as the source of truth, Redis for cache and pub/sub, WebSocket server for live updates. Background workers handle heavy tasks (notifications, reports).

- Order flow — Customer selects a branch, builds a cart (cart keyed by `branch_id`), then submits an order with an idempotency key. Backend validates items, snapshots prices, and creates order + items inside a DB transaction. After commit the backend publishes `NewOrderPlaced` and `OrderStatusChanged` events to `branch.{branchId}` and `order.{orderNumber}` channels so staff and the customer update instantly.

- Real-time design — Events are domain-driven: broadcast after DB commit, sent into Redis pub/sub, and then delivered by the WebSocket server to subscribed clients. Channels are scoped (`branch.{id}`, `order.{num}`, `user.{id}`). For scale we use multiple WebSocket nodes with Redis bridging, or a managed provider to offload connection management.

- State management & persistence — UI splits transient vs server state: transient UI uses Zustand; server data via TanStack Query. Cart persistence uses a persist middleware keyed by `branch_id` so carts survive refresh and network blips. On reconnect the client reconciles local state with server state using timestamps and simple merge rules (server wins for confirmed orders).

- Data consistency & safety — Order creation uses DB transactions; idempotency keys and unique constraints prevent duplicates; snapshotting product data avoids post-order drift. For high contention (inventory) we use row-level locks or reservations; reconciliation jobs clean up edge cases.

### 3) System design talking points

- Why branch-scoped architecture — operational reality: different kitchens, inventory and pricing per branch. Scoping simplifies fulfillment, lowers human error, and enables branch-level KPIs.

- Preventing cross-branch leaks — enforce `branch_id` on every relevant model, validate ownership in middleware, add DB constraints where possible, and audit suspicious requests. Tests and monitoring alert on anomalies.

- Scaling to 100+ restaurants — horizontally scale API servers and WebSocket nodes, add read replicas for MySQL, push hot data to Redis, partition heavy write domains (e.g., inventory) by branch or shard, and use background workers for reports. If connections grow, move to a managed real-time platform or autoscale WebSocket nodes behind a load balancer with Redis pub/sub.

### 4) Five common interview questions (with short, practical answers)

1. How do you prevent duplicate orders?  
   I require an idempotency key on order submission, store that key with the order, and return the existing order if the same key is received. DB unique constraints and the transaction boundary guarantee safety.

2. How do you scale real-time updates?  
   Use Redis pub/sub to bridge multiple WebSocket nodes so any node can publish/subscribe, run multiple WebSocket instances behind a load balancer, and optionally adopt a managed provider to reduce operational overhead.

3. How does cart persistence work across refreshes?  
   The cart is stored in Zustand and persisted to localStorage with a `branch_id` key. On app start we reconcile with server-side state and merge or discard local items based on timestamps and order status.

4. How do you handle inventory race conditions?  
   For low scale: DB transaction with `SELECT ... FOR UPDATE`. For higher throughput: reservation pattern (reserve on order placement, finalize on payment) and Redis atomic operations for immediate decrements.

5. How is RBAC enforced?  
   Auth uses token-based flows (Sanctum or similar) and middleware checks roles/permissions per endpoint. UI components hide controls based on role and the backend enforces authorization on every action.

### 5) Three hard questions and confident answers

1. Accurate stock with thousands of concurrent orders?  
   Use a reservation system: decrement an available quantity atomically (Redis or DB row lock) when an order is accepted, then finalize or release on payment/timeout. Partition stock by branch to reduce contention and run reconciliation jobs that detect and correct anomalies.

2. Zero-downtime DB migrations?  
   Perform additive migrations first (new columns, tables), deploy code that supports both old and new schemas, backfill data while both versions run, then switch behavior and remove legacy columns. Use feature flags for rollout and avoid destructive changes during traffic peaks.

3. WebSocket delivery guarantees and reconnects?  
   Treat the real-time layer as best-effort for UX; persist canonical state in the DB and restore on reconnect. Implement client-side reconnection with exponential backoff, re-subscribe to channels, refetch authoritative state via REST, and use idempotent handlers so duplicated events are safe.

---

For deployment templates, CI/CD examples, or a production `docker-compose.yml`, contact the maintainer via the links above.
