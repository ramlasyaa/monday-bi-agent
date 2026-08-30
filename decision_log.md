# Decision Log - Monday.com Business Intelligence Agent

This document outlines the key design choices, assumptions, trade-offs, and architectural justifications made during the development of the Monday.com BI Agent.

**Author: Ram Lasya** (Roll/Student ID: AP23110010167)

---

## 1. Architectural Decisions & Tech Stack

We chose a decoupled **Full-Stack Architecture**:
- **Backend**: Python (FastAPI)
- **Frontend**: React (Vite) styled with **Vanilla CSS**
- **AI Engine**: Google Gemini (utilizing a Python Code Interpreter paradigm)

### Justifications:
- **FastAPI (Python)**: Business intelligence requires data manipulation, filtering, and cross-board joins. Python is the industry standard for data science due to `pandas` and `numpy`. Implementing this logic in Node.js/JavaScript would make complex groupings, date standardizations, and joins highly error-prone for an LLM. FastAPI provides a fast, async REST API with automatic OpenAPI docs.
- **React (Vite)**: Scaffolded a highly responsive SPA. We implemented an elegant, minimal "English Heritage" light theme styling system in `src/index.css` using soft warm-sand backgrounds, pure white cards, and muted sage/teal/crimson accents. This avoids standard dark-mode / purple-glow AI styling, making the interface feel handcrafted, bespoke, and professional.
- **Gemini & Code Interpreter**: Instead of writing rigid endpoints for every possible query, we designed a **Code Interpreter Loop** in the backend. Gemini writes pandas query code, which is executed safely inside a local context. This handles *any* cross-board questions dynamically.

---

## 2. Key Assumptions & Messy Data Gaps

Real-world corporate data is messy, which we handled via a dedicated `data_cleaner.py` pre-processing step:

1. **Duplicate Headers in Middle of Data**:
   * *Observation*: Rows 50 and 179 in the Deals sheet were copy-pasted column header headers, with name labels overwritten as `Nezuko` and `Bugs Bunny`.
   * *Resolution*: We identify and drop these rows dynamically by filtering out items where `Deal Status == 'Deal Status'` or `Execution Status == 'Execution Status'`.
2. **Date Inconsistencies**:
   * *Observation*: Date columns contain string formulas, datetimes, and empty float values.
   * *Resolution*: We map and clean all date fields using `pd.to_datetime(..., errors='coerce')` so that they normalize to clean timestamps or NaNs.
3. **Numeric Gaps / Financial Masking**:
   * *Observation*: 52.03% of Deals are missing values for the key KPI `Masked Deal value`.
   * *Resolution*: The agent is supplied with a **Data Quality Report** generated dynamically by the backend, detailing missing values per column. During chat synthesis, the agent is instructed to transparently display these caveats to the founder (e.g. *"Note: 179 deals are missing values, and are excluded from the calculated average"*).
4. **Monday.com Column Names**:
   * *Assumption*: When a user imports a CSV/Excel file into Monday.com, Monday.com assigns randomized column IDs (like `numbers_1` or `text_a`), but preserves the spreadsheet column header as the **Title**.
   * *Resolution*: Our GraphQL client retrieves `column_values { title text }` and builds the DataFrame keys dynamically from `title`. This ensures our backend code works *identically* on both the local Excel files and live Monday.com boards without hardcoding random column IDs.

---

## 3. Interpretation of "Leadership Updates"

We interpreted "The agent should help prepare data for leadership updates" by implementing a dedicated **Executive Leadership Hub**:
1. **Interactive Dashboard**: Quick metrics showing total deals, work orders, and an automated data quality scorecard.
2. **Executive Report Generator**: The founder can filter by Sector (e.g. Mining, Renewables) and Quarter/Year (e.g. Q4 2025). The backend programmatically slices the datasets, computes standard financial and operational metrics (e.g. closed revenue, deal win rate, work order completion rate, billing status, and receivables), and feeds this structure to Gemini.
3. **AI-Generated Strategic Brief**: Gemini synthesizes these metrics into a polished markdown brief covering overall health, risk assessment, paused bottlenecks, and recommended actions.
4. **Print-Ready CSS Layouts**: Styled the briefing sheet using CSS `@media print` rules, allowing the user to print or save the document as a clean, corporate PDF with a single click.

---

## 4. Trade-offs & Compromises

1. **Local Sandboxed Execution vs. Dockerized Container**:
   * *Trade-off*: Running LLM-generated code locally via `exec` can be risky in multi-tenant environments.
   * *Choice*: For a development prototype under a 5-hour limit, we isolated the environment by copying dataframes to local variables and restricting available globals (`deals_df`, `wo_df`, `pd`, `np`, `plt`). In a production SaaS, this execution should occur inside a containerized sandbox (e.g., AWS Lambda or gVisor sandbox).
2. **Three-Way Gemini Fallback API**:
   * *Trade-off*: Using the modern `google-genai` client library is clean, but version differences in pip environments can cause imports to crash.
   * *Choice*: We wrote a three-way wrapper that attempts `google-genai` first, falls back to legacy `google-generativeai`, and finally defaults to a zero-dependency HTTP call using `requests`. This guarantees the agent works under *any* evaluator environment.
3. **Live API vs. Demo Mode Fallback**:
   * *Trade-off*: Testing live Monday.com connections requires setup.
   * *Choice*: Built a prominent **Demo Mode** fallback. If the evaluator runs the app without Monday.com credentials, it loads and cleans the local sheets automatically so they can test the BI chat instantly.

---

## 5. What We'd Do Differently with More Time

1. **Interactive Dashboard Widgets**: Implement dynamic interactive dashboards using React Charting libraries (like `Recharts`) rather than relying purely on static matplotlib charts generated in Python.
2. **Write-Back to Monday.com**: Implement write capabilities. For example, if the BI agent detects that a deal is missing a close date or has inconsistent formatting, it could prompt: *"I found 3 inconsistencies in the Renewables sector. Would you like me to fix them directly on your Monday board?"*
3. **Auto-Scheduling (Cron Alerts)**: Build an active email trigger using a worker process to email the leadership brief weekly to executives (using the `/schedule` capability).
