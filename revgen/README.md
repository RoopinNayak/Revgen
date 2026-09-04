# RevGen — AI Merchant Growth Agent

> **Submission for Razorpay Buildathon — Track 1: AI Growth & Agentic Commerce**  
> *An autonomous, safety-bounded AI agent that discovers high-upside cross-sell opportunities from merchant transaction data, formulates targeted campaign strategies, and executes safe campaigns through Razorpay Test Mode with strict human-in-the-loop merchant approval.*

---

## 📹 Demo Video

> **📺 Demonstration Video**: [Add final demo video link]

---

## Overview

**RevGen** is an AI-powered merchant growth agent built for the **Razorpay Buildathon (Track 1: AI Growth & Agentic Commerce)**.

RevGen analyzes historical merchant sales, order relationships, and catalog items to identify high-value upsell and cross-sell opportunities. It uses local AI reasoning to formulate an explainable campaign strategy, enforces deterministic safety boundaries, requires mandatory merchant approval, and safely executes test transactions via **Razorpay Test Mode**.

---

## Problem

E-commerce merchants collect significant transaction, customer, and product catalog data, but unlocking incremental revenue remains a major challenge:
- **Manual Discovery is Impractical**: Finding strong multi-item affinity pairs across large catalogs requires complex association rule mining.
- **Generic Promotions Fail**: Static discounts often eat into margins without driving meaningful cross-sell conversions.
- **Fear of Autonomous Actions**: Merchants cannot trust black-box AI tools that unilaterally discount items, charge budgets, or execute transactions without oversight.

**RevGen solves this** by transforming raw historical purchase records into ranked, actionable, and explainable growth campaigns while keeping the merchant fully in control.

---

## Core Design Principle

> **"Deterministic analytics provide the numerical evidence, while AI provides the business reasoning. The AI recommends, but the merchant remains in control."**

RevGen strictly separates mathematical truth from generative business strategy:
- **Deterministic Analytics Engine**: Evaluates 100% of historical transactions to calculate mathematically exact Support, Confidence, Lift, and Estimated Revenue Opportunity.
- **Qwen3:8b AI Growth Agent**: Evaluates candidate opportunities, incorporates merchant memory context, explains the business reasoning, and generates campaign strategy, audience targeting, and copy.
- **Deterministic Safety Guardrails**: Enforces non-negotiable limits on discounts ($\le 20\%$) and budgets ($\le ₹5,000$).
- **Human-in-the-Loop Governance**: The LLM cannot directly modify the database or execute financial actions. Every campaign requires explicit merchant approval before execution.

---

## Architecture

```mermaid
flowchart TD
    subgraph Step1["1. Merchant Interface"]
        UI["Merchant Dashboard"]
        Trigger["Click: 🔍 Run Growth Analysis"]
    end

    subgraph Step2["2. Deterministic Analytics"]
        DB[(PostgreSQL Store Data)]
        MBA["Market Basket Analysis<br/>(Support, Confidence, Lift)"]
        Score["Opportunity Scoring Engine<br/>(84 Evaluated Opportunities)"]
    end

    subgraph Step3["3. AI Growth Agent"]
        Qwen["Qwen3:8b Reasoning Agent<br/>(via Local Ollama)"]
        Strategy["Campaign Recommendation<br/>(Audience, Offer Type, Copy)"]
        Memory["Merchant Memory & History Context"]
    end

    subgraph Step4["4. Safety & Governance"]
        Guard["Safety Validator<br/>(Max 20% Discount, Max ₹5,000 Budget)"]
        Approval{"Merchant Review & Approval"}
    end

    subgraph Step5["5. Execution & Gateway"]
        Exec["100% AI-Free Execution Engine"]
        RZP["Razorpay Test Mode / Sandbox<br/>(Discounted Item Price in Paise)"]
    end

    subgraph Step6["6. Reporting & Audit"]
        Audit["Sanitized Chronological Audit Trail"]
        Dashboard["Three-Pillar Revenue & ROI Dashboard"]
    end

    UI --> Trigger
    Trigger --> MBA
    DB --> MBA
    MBA --> Score
    Score --> Qwen
    Memory --> Qwen
    Qwen --> Strategy
    Strategy --> Guard
    Guard --> Approval
    Approval -- "Merchant Approves" --> Exec
    Exec --> RZP
    RZP --> Audit
    Audit --> Dashboard
```

### Architecture Pipeline Stages:
1. **Merchant Dashboard**: Displays store performance and provides an explicit on-demand trigger (**"🔍 Run Growth Analysis"**). Opening the dashboard does not invoke AI models.
2. **PostgreSQL / Deterministic Analytics**: Calculates association rules across the full order dataset.
3. **Opportunity Scoring**: Ranks product affinity pairs deterministically by statistical strength and revenue upside.
4. **Qwen3 AI Growth Agent**: Evaluates top candidate pairs with comparative business reasoning and merchant memory.
5. **Campaign Recommendation**: Formulates audience segments, discount parameters, and promotional copy.
6. **Safety Validation**: Validates discount and budget limits deterministically.
7. **Merchant Approval**: Places the campaign into a reviewable state; auto-execution is strictly disabled.
8. **Razorpay Test Mode**: Executes the approved campaign via Razorpay sandbox order creation without AI latency.
9. **Audit Trail & Revenue Dashboard**: Records tamper-evident audit logs and presents three-pillar financial metrics.

---

## Key Features

1. **On-Demand AI Growth Analysis**: Merchant-triggered pipeline that runs deterministic analytics and AI reasoning on live transaction data.
2. **Autonomous Opportunity Selection**: Evaluates the full opportunity landscape and selects the highest-conviction cross-sell pair with structured reasoning.
3. **AI Campaign Recommendation**: Crafts tailored campaign parameters including targeted customer segments, offer types, and promotional messaging.
4. **Safety & Guardrails**:
   - Maximum discount strictly bounded at **20%**.
   - Maximum campaign budget strictly capped at **₹5,000**.
   - **Merchant approval is mandatory** before any execution.
   - **Automatic execution is disabled by design**.
   - **Execution is idempotent** (re-running completed campaigns creates no duplicate orders).
   - **Financial execution does not invoke the LLM** (100% AI-free execution).
5. **Merchant Approval Workflow**: Complete state machine lifecycle (`draft` $\rightarrow$ `pending_approval` $\rightarrow$ `approved` $\rightarrow$ `executing` $\rightarrow$ `completed` / `failed`).
6. **Razorpay Test Mode Execution**: Safe sandbox order generation for the discounted item price converted to INR paise.
7. **Agent Memory**: Learns from previous merchant approval/rejection decisions to provide context-aware recommendations over time.
8. **Explainability**: Clear breakdowns of deterministic analytics evidence, customer purchase insight, and AI reasoning behind every selection.
9. **Failure Handling & Recovery**: Safe simulation and error handling with reset transitions back to draft on gateway failure.
10. **Sanitized Audit Trail**: Chronological event logs with zero leaked API keys, authorization tokens, or stack traces.
11. **Revenue & ROI Dashboard**: Clean separation of predictive upside, sandbox transactions, and real merchant revenue.

---

## Example Opportunity

The following real cross-sell opportunity is discovered and demonstrated from the historical store dataset:

### **Phone Case + Smartphone**
- **Association Lift**: `4.13×` *(Customers purchasing a Smartphone are 4.13× more likely to buy a Phone Case)*
- **Confidence**: `25.6%`
- **Estimated Revenue Opportunity**: `₹85,398.78`
- **Potential Target Audience Identified from Historical Data**: `122 customers`
- **Recommended Strategy**: Cross-sell bundle
- **Discount Percentage**: `10%`
- **Campaign Budget**: `₹2,500`
- **Target Segment**: Regular
- **Expected Additional Customers**: `12`

> [!IMPORTANT]
> **Terminology & Transparency Notice**:
> - **₹85,398.78 is an ESTIMATED REVENUE OPPORTUNITY**, not realized revenue. It reflects the theoretical upside if un-cross-sold historical customers were converted.
> - The **122 customers** represent a potential target audience identified from historical purchase behavior. The current MVP **does NOT automatically send discounts or promotional messages** to these customers.

---

## Razorpay Integration

- RevGen operates exclusively against **Razorpay Test Mode** (`rzp_test_...`).
- Approved campaigns generate a Razorpay Test Mode order for the discounted unit price in paise (e.g., `₹699` at `10% off` $\rightarrow$ `₹629.10` $\rightarrow$ `62910 paise`).
- **No real money is involved, and no real customer cards are charged.**
- Live keys (`rzp_live_...`) are blocked with HTTP `403 Forbidden` to prevent accidental production transactions.
- **Execution Flow**:
  $$\text{Merchant Approval} \longrightarrow \text{Execute Campaign} \longrightarrow \text{Razorpay Test Mode Order} \longrightarrow \text{Audit Trail Log}$$

---

## Revenue & ROI Transparency

RevGen maintains clear financial distinctions across three metric pillars:

| Metric Pillar | Definition | Value in Prototype |
| :--- | :--- | :--- |
| **Estimated Revenue Opportunity** | Theoretical revenue upside across the catalog predicted by market basket analytics. | Displayed on opportunity cards |
| **Test Transaction Value** | Total order value generated during Razorpay Test Mode sandbox simulations. | Cumulative test orders |
| **Real Merchant Revenue** | Actual money deposited into merchant accounts. | **Strictly ₹0.00** |

> **"Real Merchant Revenue is ₹0.00 in the current prototype because Razorpay Test Mode is used."**

The ROI displayed by the system is an **Estimated ROI** calculated from the campaign's estimated opportunity and budget ($(\text{Net Opportunity} / \text{Budget}) \times 100$), **not realized financial ROI**. Realized ROI remains `N/A` until verified real-money transactions occur.

---

## Agent Memory & Explainability

- **Contextual Memory**: Previous merchant approval, rejection, and reset decisions are stored in `agent_memory` and retrieved to enrich subsequent prompt contexts.
- **Analytics Remain Authoritative**: Historical decisions influence contextual reasoning only; current transactional analytics remain the source of mathematical truth.
- **Evidence-First Presentation**: Every campaign card displays both the deterministic analytics evidence (Lift, Confidence, Missed Customers) and the LLM's natural language justification.

---

## Failure Handling & Recovery

RevGen includes a deterministic failure mechanism (`?forceFail=true`) for demonstration:
- **Graceful Failure**: If a gateway error or timeout occurs during execution, the campaign transitions to `failed`.
- **Zero Fake Success**: **No** fake Razorpay order ID is created, and **no** fake revenue is added to the dashboard.
- **Audit Trace**: The audit trail records `campaign_execution_started` followed by `campaign_execution_failed` with a sanitized error description.
- **Merchant Recovery**: The merchant can reset the failed campaign back to `draft` via `POST /api/campaigns/:id/reset` to modify parameters and retry.

---

## Technology Stack

### Frontend
- **HTML5**: Semantic document structure
- **CSS3**: Custom dark-mode design system with CSS custom properties
- **Vanilla JavaScript**: Zero-framework asynchronous UI logic

### Backend
- **Node.js** (v18+)
- **Express**: RESTful API service

### Database
- **PostgreSQL** (v14+): Relational database with parameterized queries

### AI Engine
- **Ollama**: Local model runtime
- **Qwen3:8b**: Structured reasoning model with deterministic fallback

### Payments
- **Razorpay Node SDK** (Test Mode / Sandbox)

### Testing
- **Node.js Native Test Runner**

---

## Project Structure

```
revgen/
├── backend/
│   ├── server.js                          # Express server & API routes
│   ├── package.json                       # Backend dependencies & test scripts
│   ├── .env.example                       # Environment variable template
│   ├── src/
│   │   ├── db.js                          # PostgreSQL connection pool
│   │   ├── ai/
│   │   │   ├── llmClient.js               # Ollama connection & JSON parser
│   │   │   ├── llmGrowthAgent.js          # Multi-opportunity comparison
│   │   │   ├── opportunitySelector.js     # Autonomous selection with fallback
│   │   │   ├── campaignRecommendationAgent.js # Campaign strategy formulation
│   │   │   ├── relevantAgentMemory.js     # Merchant memory retrieval
│   │   │   └── growthAnalysisOrchestrator.js # End-to-end analysis orchestrator
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
│   ├── schema.sql                         # PostgreSQL schema definition
│   ├── seed.js                            # Deterministic dataset generator (3,000 orders)
│   ├── package.json                       # Database tooling dependencies
│   └── README.md                          # Database setup documentation
├── frontend/
│   ├── index.html                         # Merchant dashboard interface
│   ├── app.js                             # Client-side UI & modal controller
│   └── style.css                          # Custom design stylesheet
├── .gitignore                             # Repository ignore rules
└── README.md                              # This documentation file
```

---

## Setup & Installation

### 1. Prerequisites
- **Node.js**: v18 or higher
- **PostgreSQL**: v14 or higher running locally
- **Ollama** *(Optional for local AI)*: `ollama run qwen3:8b` (Deterministic fallback activates automatically if Ollama is unavailable)

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/RoopinNayak/Revgen.git
cd Revgen/revgen/backend
npm install
```

### 3. Environment Configuration
Create `.env` in `revgen/backend/`:
```bash
cp .env.example .env
```

Configure local environment variables in `revgen/backend/.env`:
```ini
PORT=3000
DATABASE_URL=postgres://postgres:password@localhost:5432/revgen
OLLAMA_URL=http://localhost:11434
LLM_MODEL=qwen3:8b
RAZORPAY_KEY_ID=rzp_test_YourTestKeyId
RAZORPAY_KEY_SECRET=YourTestKeySecret
```
*(If Razorpay keys are omitted, RevGen automatically falls back to transparent simulation mode).*

### 4. Initialize and Seed Database
```bash
cd ../database
npm install
node seed.js
```

### 5. Start the Server
```bash
cd ../backend
npm start
```
Access the dashboard at **[http://localhost:3000](http://localhost:3000)**.

---

## Testing

RevGen includes a full regression test suite with **161 automated tests** passing across 8 stage test suites:

```bash
cd revgen/backend
npm test
```

### Verified Test Results: **161 / 161 PASS (100%)**
- **Stage 2** — Opportunity Selector: `20/20 PASS`
- **Stage 3** — AI Campaign Recommendation: `20/20 PASS`
- **Stage 4** — Growth Orchestrator: `20/20 PASS`
- **Stage 5** — Agent Memory & Explainability: `20/20 PASS`
- **Stage 6** — Razorpay Test Mode Foundation: `20/20 PASS`
- **Stage 7** — Razorpay Campaign Execution: `20/20 PASS`
- **Stage 8** — Revenue & Transaction Dashboard: `21/21 PASS`
- **Stage 9** — Failure Handling & Audit Trail: `20/20 PASS`

---

## Security

- **Environment Secrets**: `.env` is strictly gitignored. `.env.example` contains only safe placeholder templates.
- **No Hardcoded Secrets**: Zero credentials or private keys are stored in source code.
- **No Secret Leakage**: API responses, audit trails, and client payloads never expose credentials or database passwords.
- **Sandbox Isolation**: Operates exclusively in Razorpay Test Mode.

---

## Current Limitations

1. **Synthetic Merchant Data**: Evaluated on a deterministic synthetic dataset (75 products, 3,000 orders) to ensure reproducible benchmarking.
2. **Razorpay Test Mode**: Uses test mode only; no real payment methods or live consumer cards are charged.
3. **No Real Customer Outreach**: Does not send unsolicited emails, SMS, or WhatsApp promotional messages.
4. **No Real-Time Future Customer Activation**: Campaigns are created and tested in the merchant portal; automatic cart injection for future checkout customers is not enabled in this prototype.
5. **Merchant-Triggered Analysis**: Growth analysis is executed on demand by the merchant rather than via continuous background polling.

---

## Future Scope

1. **Checkout-Integrated Dynamic Offers**: Inject approved cross-sell offers dynamically into Razorpay Standard Checkout and Magic Checkout when eligible cart conditions are met.
2. **Multi-Channel Delivery**: Connect approved campaigns to WhatsApp Business API and email marketing platforms.
3. **Budget Throttling & Live Signals**: Automatically monitor redemption webhooks and pause campaigns when budget limits are reached.
4. **Production Razorpay Gateway**: Support production key verification with merchant OAuth integration.
5. **Continuous Optimization**: Refine opportunity ranking based on downstream conversion analytics and merchant feedback loops.

---

## Important Prototype Note

RevGen demonstrates a controlled, safety-bounded end-to-end growth workflow using historical/synthetic data and Razorpay Test Mode. It does not claim real merchant revenue or active customer outreach in this hackathon prototype.
