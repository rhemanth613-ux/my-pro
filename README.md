# AI Sports Talent Assessment Platform

Mobile-first MVP with:

- Player and coach registration/login
- Role-based dashboards
- Sports selection
- Performance video upload
- Mock AI analysis with charts and score bars
- Coach shortlist management

## Tech

- Frontend: React + Vite
- Backend: Node.js + Express
- Storage: Local JSON file database + uploaded media on disk

## Run

1. Install dependencies:

```bash
npm run install:all
```

2. Start backend:

```bash
npm run dev:server
```

3. Start frontend in another terminal:

```bash
npm run dev:client
```

Frontend runs on `http://localhost:5173` and API runs on `http://localhost:4000`.

## Notes

- This MVP uses a local JSON datastore for easy setup in this workspace.
- The backend structure is ready to be swapped to MongoDB/Mongoose later.
- AI analysis is simulated with deterministic scoring from upload metadata, suitable for demo and product validation.
