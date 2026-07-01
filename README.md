# Financial Planning Platform

A premium full-stack financial planning workspace with:

- React frontend for dashboards, goals, budgets, projections, and personalized planning
- FastAPI backend for planning data, profile-based guidance, and scenario analysis
- Shared API shapes across the stack for a consistent contract

## Repository Layout

- `apps/frontend` - React + Vite frontend
- `apps/backend` - FastAPI backend

## Development

Install dependencies in the frontend workspace with npm and Python dependencies for the backend, then run the root dev script.

From the repository root:

```bash
npm install
pip install -r apps/backend/requirements.txt
npm run dev
```

The React app runs on port 5173 and proxies `/api` traffic to the FastAPI backend on port 4000.
