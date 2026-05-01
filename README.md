# AncaVisuals

AncaVisuals is a React + TypeScript wedding and events platform with server-side rendering, an Express backend, and a small admin area for managing bookings and event operations.

The project combines a public marketing site, client delivery flows, QR-based guest media uploads, invitation pages, SEO landing pages, and internal admin tooling in a single codebase.

## Overview

The application is split into two main parts:

- `src/client`: the SSR React frontend rendered through Vite
- `src/server`: Express routes, controllers, services, and integrations

The runtime entrypoint is [`server.ts`](/Users/daniel.anca/IdeaProjects/ancavisuals/ancavisuals/server.ts), which:

- boots the Express server
- mounts API routes
- serves static assets
- runs Vite middleware in development
- renders the React app on the server for public routes

## Main Features

### Public website

- Homepage, About, Portfolio, Contact, Bio, Privacy, Terms, and Copyright pages
- SSR-first React routing for improved crawlability and initial load behavior
- SEO-oriented location pages generated from route data

### Client and event flows

- Media album pages for delivered galleries
- Share pages for distributed album links
- Invitation verification and invitation landing pages
- Delivery address collection flows
- QR Moments uploads for guests to submit photo, video, and audio content

### Admin area

- Firebase-backed login flow
- Protected admin routes
- Event dashboard
- Booking and availability management
- Calendar-style overview of booked dates
- Admin event settings and revenue goals

### Instagram Proposals

Logged-in users (family members or collaborators with Firebase accounts) can propose photos from a delivered album for Instagram posting.

- A 📸 button appears on hover over each photo when viewing an album while authenticated
- Clicking it saves the photo as a proposal in the `instagramProposals` Firestore collection with `pending` status
- The proposal is attributed to the logged-in user's email
- A proposals panel appears at the bottom of the album page, visible only to authenticated users
- The supreme admin can mark each proposal as **Postat** or **Respins**, or delete it

API routes (all require Firebase auth):

- `POST /api/instagram-proposals` — create a proposal
- `GET /api/instagram-proposals/album/:slug` — list proposals for an album
- `PATCH /api/instagram-proposals/:id` — update status (supreme admin only)
- `DELETE /api/instagram-proposals/:id` — delete a proposal (supreme admin only)

To give a family member access, create a Firebase account for them from the Firebase Console and share the album link.

### Backend integrations

- Firebase / Firestore for auth and admin data
- Bunny CDN / Bunny Storage for media access and uploads
- File signing and download proxying for protected assets
- PM2-based production process management

## Tech Stack

- React 18
- TypeScript
- Vite
- Express
- React Router
- Firebase Auth
- Firebase Admin / Firestore
- Sass
- Tailwind CSS
- Vitest
- PM2

## Important Routes

Public routes are defined primarily in [`src/client/routes/publicRoutes.ts`](/Users/daniel.anca/IdeaProjects/ancavisuals/ancavisuals/src/client/routes/publicRoutes.ts).

Examples:

- `/`
- `/despre`
- `/portofoliu`
- `/contact`
- `/media/:slug`
- `/share/:id`
- `/invitatie/:slug`
- `/invitatie/:slug/invitation`
- `/qr-moments/:eventDate`
- `/delivery-address/:slug`

Admin routes are wired in [`src/client/App.tsx`](/Users/daniel.anca/IdeaProjects/ancavisuals/ancavisuals/src/client/App.tsx).

Examples:

- `/login`
- `/admin`
- `/admin/calendar`
- `/admin/create-event`
- `/admin/create-event-wedding`

## API Surface

The backend exposes route groups for albums, files, downloads, sharing, events, admin operations, QR Moments, assistant/chat endpoints, and SSR support.

Mounted route prefixes include:

- `/api/album`
- `/api/download`
- `/api/share`
- `/api/event`
- `/api/admin`
- `/api/assistant`
- `/api/chatbot`
- `/api/urlcheck`
- `/f`
- `/health`

## Project Structure

```text
.
|-- server.ts
|-- src
|   |-- client
|   |   |-- App.tsx
|   |   |-- entry-client.tsx
|   |   |-- entry-server.tsx
|   |   |-- components
|   |   |-- pages
|   |   |-- routes
|   |   |-- hooks
|   |   `-- styles
|   `-- server
|       |-- controllers
|       |-- routes
|       |-- services
|       |-- utils
|       `-- functions
|-- public
|-- data
|-- dist
`-- ecosystem.config.cjs
```

## Prerequisites

- Node.js matching [`.nvmrc`](/Users/daniel.anca/IdeaProjects/ancavisuals/ancavisuals/.nvmrc) if you want to follow the repo default exactly
- `npm`
- Access to the required Firebase and Bunny credentials

## Installation

```bash
npm install
```

## Development

Run the full app:

```bash
npm run dev
```

This starts:

- `npm run dev:server` for the Express server
- `npm run dev:client` for the Vite client

Default local ports:

- Express app: `1994`
- Vite dev server: `3000`

Health check:

```bash
curl http://127.0.0.1:1994/health
```

## Build

```bash
npm run build
```

The build produces:

- `dist/client`
- `dist/server`

The build pipeline:

1. Cleans the output directory
2. Compiles TypeScript
3. Builds the client bundle
4. Builds the SSR server bundle
5. Copies public assets into the final distribution
6. Fixes generated extensions where needed

## Production

Serve through PM2:

```bash
npm run serve
```

Useful deployment scripts:

- `npm run deploy`
- `npm run deploy:quick`
- `npm run deploy:no-build`
- `npm run pm2:start`
- `npm run pm2:restart`
- `npm run pm2:reload`
- `npm run pm2:stop`
- `npm run pm2:delete`
- `npm run pm2:logs`

Production PM2 config lives in [`ecosystem.config.cjs`](/Users/daniel.anca/IdeaProjects/ancavisuals/ancavisuals/ecosystem.config.cjs).

## Testing and Quality

Run tests:

```bash
npm test
```

Run TypeScript checks:

```bash
npm run typecheck
```

Other maintenance commands:

- `npm run lint`
- `npm run format`
- `npm run test:watch`
- `npm run test:coverage`

## Environment Variables

The project depends on environment variables for storage, auth, mapping, and API integrations.

Typical variables used by the codebase include:

- `PORT`
- `NODE_ENV`
- `BUNNY_STORAGE_ZONE`
- `BUNNY_STORAGE_KEY`
- `BUNNY_STORAGE_PASSWORD`
- `BUNNY_CDN_DOMAIN`
- `VITE_BUNNY_READ_KEY`
- `VITE_GOOGLE_MAPS_BROWSER_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `FIREBASE_SERVICE_ACCOUNT_BASE64`
- `IPINFO_TOKEN`
- `ANTHROPIC_API_KEY`

Recommended setup:

1. Keep local secrets in an untracked `.env`
2. Provide production secrets through the host or process manager
3. Avoid hardcoding credentials in committed config files

## Notes for Contributors

- The repo currently contains both frontend and backend concerns, so changes often affect SSR behavior as well as API behavior.
- Public routes should remain SSR-safe unless a page is intentionally client-only.
- Admin pages rely on Firebase auth state and protected route wrappers.
- Media and delivery flows rely on the backend route layer, not only client navigation.

## README Changelog

### 2026-04-30

- **AdminBar**: restored top bar (email + logout + Dashboard button) on all admin pages including `/admin`; trimmed email to show only the part before `@`; increased bar height to 48px; added `whiteSpace: nowrap` on buttons
- **Event cheltuieli**: added `EventExpense` type to `ClientEvent`; new inline expenses section in `EventCard` — add/delete per-event expenses (label + RON amount), total computed automatically, persisted to Firestore via PATCH
- **Dashboard quick nav — drag to reorder**: long-press (280ms) any nav tile to enter drag mode, drag over another to reorder; new order saved in `/api/admin/ui-state` as `quickNavOrder` and restored on next load; `onContextMenu` suppresses browser right-click/long-press menu on touchpad
- **EventCard header**: event type (Nuntă / Botez etc.) now shown in header row next to name; Nuntă rendered in green
- **Mementouri — edit**: added edit button (✎) on each memento card; opens `EditMementoModal` pre-filled with title, description, due date, category, reminder, and recurrence; PATCH endpoint extended to accept all editable fields (not just `completed`)
- **Conturi admin (`/admin/accounts`)**: new page listing all Firebase Auth users with role (Admin / Moderator), creation date, last sign-in; inline form to update email and/or password; protected by `requireSupremeAdmin` middleware; accessible from Dashboard quick nav

### 2026-04

- Replaced the inherited template README with project-specific documentation
- Added setup, scripts, architecture, route overview, and deployment notes
- Documented the main product flows present in this repository
- Added Instagram Proposals feature for authenticated family/collaborator users
