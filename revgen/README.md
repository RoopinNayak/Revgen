# RevGen — AI Merchant Growth Agent

An AI-powered merchant growth assistant built for **Track 1: AI Growth & Agentic Commerce** at the Razorpay Buildathon.

RevGen analyzes merchant sales and product data, identifies upsell and cross-sell opportunities, generates campaigns, and integrates with Razorpay — all governed by safety rules and merchant approval workflows.

---

## Technology Stack

| Layer     | Technology        |
| --------- | ----------------- |
| Frontend  | HTML, CSS, Vanilla JS |
| Backend   | Node.js, Express  |
| Database  | PostgreSQL        |
| Package Manager | npm         |

---

## Project Structure

```
revgen/
├── frontend/          # Static frontend files
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── backend/           # Express API server
│   ├── server.js
│   ├── package.json
│   ├── .env           # Local env vars (git-ignored)
│   └── .env.example   # Template for env vars
│
├── database/          # DB migrations & seeds (future)
│
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

### Install Dependencies

```bash
cd revgen/backend
npm install
```

### Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env if you want to change the port (default: 3000)
```

### Start the Backend

```bash
npm start
```

The server will start at **http://localhost:3000**.

### Test the Health Check

Open your browser or run:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "RevGen API"
}
```

### View the Frontend

Open `frontend/index.html` directly in your browser. The frontend is not connected to the backend at this stage.

---

## Project Status

- [x] **Day 1 — Stage 1:** Project structure, Express server, health-check endpoint, landing page
- [ ] Day 1 — Stage 2: *(coming next)*
- [ ] Day 2: Data layer & seed data
- [ ] Day 3: AI agent integration
- [ ] Day 4: Campaign generation & approval flow
- [ ] Day 5: Razorpay integration
- [ ] Day 6: Audit trail, failure recovery & polish

---

## License

ISC
