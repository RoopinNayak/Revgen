# RevGen — AI Merchant Growth / Upsell & Cross-Sell Agent

> **Razorpay Buildathon — Track 1: AI Growth & Agentic Commerce**  
> *An autonomous, safety-bounded AI agent that discovers high-upside cross-sell opportunities from merchant transaction data, formulates targeted campaign strategies, and executes safe campaigns through Razorpay Test Mode with strict human-in-the-loop merchant approval.*

---

## 🌟 Key Design Principle

> **"Deterministic analytics provide the numerical evidence, while AI provides the business reasoning. The AI recommends, but the merchant remains in control."**

RevGen does not let an AI hallucinate mathematical metrics or autonomously execute financial transactions. Instead:
- **PostgreSQL & Market Basket Algorithms** evaluate 100% of historical transactions to calculate mathematically exact Support, Confidence, Lift, and Revenue Upside.
- **Qwen3:8b (via local Ollama)** reviews the highest-ranked candidate opportunities, applies business context and historical merchant memory, and generates marketing strategies.
- **Deterministic Guardrails** strictly cap discounts ($\le 20\%$) and campaign budgets ($\le ₹5,000$).
- **Human-in-the-Loop Governance** guarantees that no campaign is executed without explicit merchant approval.
- **Campaign Execution** operates exclusively in **Razorpay Test Mode** / sandbox simulation with 0 AI latency and zero live financial risk.

---

## 🏗️ End-to-End Architecture

```mermaid
flowchart TD
    subgraph Frontend["Merchant Dashboard (Vanilla JS / Semantic HTML5)"]
        UI["Merchant Views Store KPIs & Analytics"]
        Btn["Merchant Clicks: 🔍 Run Growth Analysis"]
    end

    subgraph DataLayer["Deterministic Analytics Engine (PostgreSQL)"]
        DB[(Store Transactions & Catalog)]
        MBA["Market Basket Analysis<br/>(Support, Confidence, Lift)"]
        Rank["Opportunity Scoring & Ranking<br/>(84 Evaluated Opportunities)"]
    end

    subgraph AILayer["AI Growth Agent (Local Qwen3:8b via Ollama)"]
        LLMSel["Autonomous Opportunity Selection<br/>+ Comparative AI Reasoning"]
        LLMRec["Campaign Strategy Recommendation<br/>(Audience, Offer Type, Copywriting)"]
        Mem["Merchant Memory & Historical Context"]
    end

    subgraph SafetyGate["Deterministic Safety & Governance"]
        Guard["Safety Validator<br/>(Discount ≤ 20%, Budget ≤ ₹5,000)"]
        Approval{"Merchant Review & Approval"}
    end

    subgraph ExecEngine["Campaign Execution & Payments"]
        Exec["100% AI-Free Execution Engine"]
        RZP["Razorpay Test Mode / Sandbox<br/>(Paise-Converted Item Price)"]
        Sim["Safe Simulation Fallback<br/>(When API Keys Unavailable)"]
    end

    subgraph Reporting["Audit & Business Impact"]
        Audit["Sanitized Chronological Audit Trail"]
        RevDash["Three-Pillar Revenue & ROI Dashboard"]
    end

    UI --> Btn
    Btn --> MBA
    DB --> MBA
    MBA --> Rank
    Rank --> LLMSel
    Mem --> LLMSel
    LLMSel --> LLMRec
    LLMRec --> Guard
    Guard --> Approval
    Approval -- "Approved" --> Exec
    Exec --> RZP
    Exec --> Sim
    RZP --> Audit
    Sim --> Audit
    Audit --> RevDash
```

---

## 🚀 How RevGen Works

### 1. Deterministic Market Basket Analytics
On database initialization, RevGen evaluates transactional history across all product pairs using association rule mining:
- **Support**: Frequency of joint item purchases across transactions.
- **Confidence**: Probability that a customer buying Product A will also purchase Product B:
  $$\text{Confidence}(A \rightarrow B) = \frac{\text{Count}(A \cap B)}{\text{Count}(A)}$$
- **Lift**: Strength of association over random chance:
  $$\text{Lift}(A \rightarrow B) = \frac{\text{Confidence}(A \rightarrow B)}{\text{Support}(B)}$$
- **Estimated Revenue Opportunity**: Theoretical revenue potential if un-cross-sold customers who purchased Product A subsequently purchase Product B:
  $$\text{Estimated Opportunity} = (\text{Customers of } A - \text{Customers of } A \cap B) \times \text{Price}(B)$$

### 2. Autonomous AI Opportunity Selection
When the merchant clicks **"🔍 Run Growth Analysis"**, candidate opportunities are passed to the local **Qwen3:8b** agent. The AI:
- Compares candidates based on affinity, margin potential, and audience size.
- Synthesizes a structured JSON decision explaining *why* the top pair was chosen.
- Automatically falls back to deterministic rule scoring if Ollama is offline or times out.

### 3. AI Campaign Recommendation & Explainability
The AI crafts a targeted campaign proposal:
- **Campaign Title & Description**
- **Target Customer Segment** (`premium`, `regular`, `budget`, or `all`)
- **Recommended Offer Type** (`percentage_discount`, `fixed_bundle`, etc.)
- **Discount Percentage** (bounded $\le 20\%$)
- **Budget Limit** (bounded $\le ₹5,000$)
- **Strategic Reasoning & Customer Insights**

### 4. Human-in-the-Loop Merchant Approval Workflow
The proposed campaign is created in `draft` status. The merchant can review the AI strategy, customize copy or discount rates within guardrails, and move through the status lifecycle:
$$\text{draft} \longrightarrow \text{pending\_approval} \longrightarrow \text{approved} \longrightarrow \text{executing} \longrightarrow \text{completed} \text{ / } \text{failed}$$

### 5. Razorpay Test Mode Execution
Once approved, the merchant triggers execution:
- **100% AI-Free Execution**: No LLM calls are made during payment processing, ensuring zero latency and zero non-deterministic side effects.
- **Paise Precision**: Automatically computes the discounted item price in INR paise and generates a genuine Razorpay Test Mode order (`order_...`).
- **Strict Idempotency**: Repeated execution requests return `{ idempotent: true, razorpayCalled: false }` to prevent duplicate transactions or double-charging.
- **Controlled Failure Simulation**: Supports `?forceFail=true` to demonstrate resilient error recovery and state reset back to `draft`.

### 6. Three-Pillar Revenue & ROI Dashboard
RevGen maintains complete financial transparency by separating metrics into three distinct pillars:

| Metric Pillar | Definition | Current Prototype Value |
| :--- | :--- | :--- |
| **Estimated Revenue Opportunity** | Theoretical revenue upside across the catalog calculated by predictive market basket models. | Metric displayed across candidate opportunities |
| **Test Transaction Value** | Total order amount generated in Razorpay Test Mode / sandbox simulation. | Cumulative sandbox transaction volume |
| **Real Merchant Revenue** | Actual money received into merchant bank accounts. | **Strictly ₹0.00** *(No real customer cards charged)* |

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | Zero-framework, responsive dark-mode UI with glassmorphic cards and micro-animations. |
| **Backend** | Node.js (v18+), Express | RESTful architecture with structured error handling and parameterized queries. |
| **Database** | PostgreSQL (v14+) | Relational storage for orders, catalog, campaigns, memory, and audit trails. |
| **Local AI Engine** | Ollama + Qwen3:8b | Local LLM inference with structured JSON extraction and deterministic fallback. |
| **Payment Gateway** | Razorpay Node SDK (Test Mode) | Sandbox order creation and payment link verification. |
| **Testing** | Node Test Runner | 8 comprehensive regression suites with 161 automated tests. |

---

## 📂 Project Structure

```
revgen/
├── backend/
│   ├── server.js                          # Express server & API routes
│   ├── package.json                       # Backend dependencies & test scripts
│   ├── .env.example                       # Safe environment variable template
│   ├── src/
│   │   ├── db.js                          # PostgreSQL connection pool
│   │   ├── ai/
│   │   │   ├── llmClient.js               # Ollama connection & JSON parser
│   │   │   ├── llmGrowthAgent.js          # Multi-candidate comparison engine
│   │   │   ├── opportunitySelector.js     # Autonomous selection with fallback
│   │   │   ├── campaignRecommendationAgent.js # Strategy recommendation
│   │   │   ├── relevantAgentMemory.js     # Merchant memory retrieval
│   │   │   └── growthAnalysisOrchestrator.js # End-to-end analysis pipeline
│   │   ├── analytics/
│   │   │   ├── productPairs.js            # Market basket association mining
│   │   │   ├── opportunityScoring.js      # Deterministic opportunity scoring
│   │   │   ├── opportunityExplanation.js  # Natural language rule explanations
│   │   │   └── revenueDashboard.js        # Three-pillar revenue & ROI metrics
│   │   ├── integrations/
│   │   │   ├── razorpayClient.js          # Razorpay Test Mode configuration
│   │   │   └── razorpayCampaignExecutor.js# Safe campaign execution engine
│   │   └── models/
│   │       ├── campaignModel.js           # Campaign CRUD operations
│   │       ├── campaignWorkflowModel.js   # State machine & transition gates
│   │       ├── campaignExecutionModel.js  # Execution records & failure handling
│   │       └── agentMemoryModel.js        # Audit logs & merchant memory
│   └── test/
│       ├── opportunitySelection.test.js   # Stage 2 tests (20 tests)
│       ├── campaignRecommendationAgent.test.js # Stage 3 tests (20 tests)
│       ├── runGrowthAnalysis.test.js      # Stage 4 tests (20 tests)
│       ├── agentMemoryExplainability.test.js # Stage 5 tests (20 tests)
│       ├── razorpayIntegration.test.js    # Stage 6 tests (20 tests)
│       ├── razorpayCampaignExecution.test.js # Stage 7 tests (20 tests)
│       ├── revenueDashboard.test.js       # Stage 8 tests (21 tests)
│       └── failureHandlingAudit.test.js   # Stage 9 tests (20 tests)
├── database/
│   ├── schema.sql                         # Complete PostgreSQL schema
│   ├── seed.js                            # Deterministic dataset generator (3,000 orders)
│   └── package.json                       # Database tooling dependencies
├── frontend/
│   ├── index.html                         # Single-page dashboard interface
│   ├── style.css                          # Custom CSS design system
│   └── app.js                             # Client application logic
├── .gitignore                             # Comprehensive ignore rules
└── README.md                              # This file
```

---

## ⚡ Quick Start & Local Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v14.0 or higher
- **Ollama** *(Optional for local AI)*: `ollama run qwen3:8b` (Deterministic fallback activates automatically if Ollama is offline)

### 2. Clone & Install
```bash
git clone https://github.com/RoopinNayak/Revgen.git
cd Revgen/revgen/backend
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your local credentials in `revgen/backend/.env`:
```ini
PORT=3000
DATABASE_URL=postgres://postgres:password@localhost:5432/revgen
OLLAMA_URL=http://localhost:11434
LLM_MODEL=qwen3:8b
RAZORPAY_KEY_ID=rzp_test_YourTestKeyId
RAZORPAY_KEY_SECRET=YourTestKeySecret
```
*(If Razorpay keys are omitted, RevGen automatically operates in transparent simulation fallback mode).*

### 4. Seed the Database
Initialize the schema and seed 3,000 realistic historical transactions:
```bash
cd ../database
npm install
node seed.js
```

### 5. Start the Application
```bash
cd ../backend
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Automated Test Suite

RevGen includes a comprehensive automated test suite covering all layers of analytics, AI selection, safety bounds, Razorpay test execution, ROI calculations, and failure recovery.

To run the complete test suite:
```bash
cd revgen/backend
npm test
```

### Verified Test Results: **161 / 161 Tests PASS (100%)**
- **Stage 2** (Autonomous Opportunity Selection): `20 / 20 PASS`
- **Stage 3** (AI Campaign Recommendation): `20 / 20 PASS`
- **Stage 4** (On-Demand Growth Orchestration): `20 / 20 PASS`
- **Stage 5** (Agent Memory & Explainability): `20 / 20 PASS`
- **Stage 6** (Razorpay Test Mode Foundation): `20 / 20 PASS`
- **Stage 7** (Razorpay Campaign Execution): `20 / 20 PASS`
- **Stage 8** (Revenue & Transaction Dashboard): `21 / 21 PASS`
- **Stage 9** (Failure Handling & Audit Trail): `20 / 20 PASS`

---

## 🛡️ Trust & Security Features

- **No Secret Exposure**: All API keys, database credentials, and secrets are strictly excluded from API responses, client payloads, and audit records.
- **Sanitized Audit Trail**: Every status change, approval, and execution failure is recorded chronologically in `audit_logs` with parameterized PostgreSQL queries.
- **Live Key Protection**: The execution engine explicitly rejects production Razorpay keys (`rzp_live_...`) with HTTP `403 Forbidden` to prevent accidental real-money charges during demonstrations.

---

## ⚠️ Current Limitations

1. **Synthetic Merchant Data**: Tested against a deterministic synthetic dataset of 75 products and 3,000 orders to provide reproducible benchmark results.
2. **Razorpay Test Mode**: Integrates exclusively with Razorpay Test Mode; real customer credit cards and UPI accounts are never billed.
3. **No Automatic Customer Outreach**: The current MVP generates campaigns and test orders, but does not automatically send live WhatsApp/email promotional codes to actual shoppers.
4. **No Continuous Autonomous Activation**: Campaigns require explicit human merchant review and manual trigger; auto-execution is disabled by design.

---

## 🔮 Future Scope & Production Roadmap

1. **Live Checkout Triggering**: Activate approved cross-sell campaigns dynamically within the Razorpay Standard Checkout or Magic Checkout flow for real-time customer cart suggestions.
2. **Multi-Channel Delivery**: Direct webhook dispatch to WhatsApp Business API and Email Marketing providers (e.g., SendGrid/Klaviyo) upon merchant approval.
3. **Automated Budget Throttling**: Real-time integration with live transaction webhooks to pause campaigns automatically when discount spend reaches the approved budget cap.
4. **Reinforcement Learning from Merchant Feedback**: Continuously refine LLM opportunity scoring based on merchant approval/rejection rates and downstream campaign conversion.
