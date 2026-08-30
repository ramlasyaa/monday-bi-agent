# Monday.com Business Intelligence Agent

A conversational Business Intelligence Agent that integrates with Monday.com boards (Work Orders and Deals data) to answer founder-level queries, analyze metrics, and prepare executive leadership updates.

Designed as a technical screening assignment for Skylark Drones by **Ram Lasya** (Student ID/Roll: AP23110010167).

---

## Architecture Overview

```
Founder / Evaluator
       │ (HTTP, Exposed via Pinggy Tunnel)
       ▼
 ┌─────────── React (Vite) Frontend ───────────┐  (Port 3000)
 │ - Interactive Chat UI                       │
 │ - Leadership Update Hub                     │
 │ - Settings & Live/Demo Mode Toggles         │
 └─────────────────────┬───────────────────────┘
                       │ (API Proxy)
                       ▼
 ┌────────── FastAPI Python Backend ───────────┐  (Port 8000)
 │ - GraphQL API Connection & Cursor Pagination│
 │ - Data Resiliency & Cleaning (data_cleaner) │
 │ - LLM Python Code Interpreter Loop (Gemini) │
 │ - Leadership Hub Report compiler            │
 └─────────────────────────────────────────────┘
```

- **Data Resiliency Layer**: Cleans duplicate header entries, standardizes irregular date structures, handles missing values, and feeds data quality metrics to the LLM agent.
- **Conversational Engine**: Converts natural language queries into Pandas aggregation queries, runs them locally, handles errors, and returns formatted responses and matplotlib charts.
- **Leadership Hub**: Computes key operational/financial metrics and compiles a strategic brief. Uses printable CSS page styling so reports can be exported cleanly as PDFs from the browser.

---

## Monday.com Setup Guide

To connect the agent to your active Monday.com boards:

1. **Import spread sheets**:
   - Log in to Monday.com.
   - Click **Add** -> **Import Data** -> **Excel**.
   - Upload `Deal funnel Data.xlsx` to create the **Deals** board.
   - Upload `Work_Order_Tracker Data.xlsx` to create the **Work Orders** board.
   - Set the column headers to match the Excel sheet's header row.

2. **Retrieve API Token**:
   - In Monday.com, click your profile picture in the bottom left -> **Administration** -> **API**.
   - Copy your **Personal API Token**.

3. **Get Board IDs**:
   - Open your imported board in Monday.com.
   - Copy the Board ID from the URL (e.g. in `https://yourspace.monday.com/boards/1234567890`, the ID is `1234567890`).

4. **Configure in App**:
   - Launch the application, navigate to the **Settings** tab, configure the tokens/IDs, and click **Save & Connect**.

---

## Local Setup & Running Instructions

The application contains a unified `run.sh` script to install and launch all components.

### Prerequisites
- Node.js (v18+)
- Python 3 (v3.10+)

### Quick Start (Single Command)

In the root of the project (`monday-bi-agent/`), run the startup script:

```bash
chmod +x run.sh
./run.sh
```

This script will automatically:
1. Create a Python virtual environment and install backend requirements.
2. Install frontend Node packages.
3. Start the FastAPI backend server on `http://localhost:8000`.
4. Start the React Vite frontend server on `http://localhost:3000`.
5. Expose the React frontend (and API proxied endpoints) to a public HTTPS URL using **Pinggy SSH reverse port forwarding** (useful for hosted prototype grading without server deployment!).

Once launched, the terminal will print:
- Your local dashboard link: `http://localhost:3000`
- The public HTTPS tunnel link: `https://xxxx.a.free.pinggy.link`

---

## Tech Stack Justifications
- **Python FastAPI**: Allows quick, lightweight async requests and leverages Pandas/NumPy for BI data manipulation.
- **React (Vite) + Vanilla CSS**: Built with a sleek dark-themed UI design featuring glassmorphism, responsive metrics grids, and smooth animations.
- **AI Engine (Gemini 2.5 Flash)**: Implements a code-interpreter self-correction loop where the LLM writes pandas queries, runs them, catches tracebacks to self-heal, and synthesizes answers.
- **Fallback Demo Mode**: If no Monday.com credentials are provided, the backend automatically reads and cleans the local sheets from `/Users/ramlasya/Documents/SkylarkDrones/`, making the app instant-testable out of the box.
