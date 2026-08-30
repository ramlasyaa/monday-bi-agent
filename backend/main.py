import os
import logging
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pandas as pd
from typing import Optional, List, Dict

# Import local modules
from data_cleaner import clean_deals_df, clean_work_orders_df, get_data_quality_report
from monday_client import fetch_board_items
from bi_agent import BIAgent, call_gemini_api

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Directory paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)

# Local spreadsheet paths
DEALS_EXCEL_PATH = "/Users/ramlasya/Documents/SkylarkDrones/Deal funnel Data.xlsx"
WO_EXCEL_PATH = "/Users/ramlasya/Documents/SkylarkDrones/Work_Order_Tracker Data.xlsx"

app = FastAPI(title="Monday.com BI Agent Backend")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# App state storage
class AppState:
    def __init__(self):
        self.api_token: Optional[str] = None
        self.deals_board_id: Optional[str] = None
        self.work_orders_board_id: Optional[str] = None
        self.gemini_api_key: Optional[str] = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        
        # Raw DataFrames
        self.deals_df_raw = pd.DataFrame()
        self.wo_df_raw = pd.DataFrame()
        
        # Cleaned DataFrames
        self.deals_df = pd.DataFrame()
        self.wo_df = pd.DataFrame()
        
        self.dq_report: Dict = {}
        self.is_demo_mode: bool = True
        self.connection_error: Optional[str] = None

state = AppState()

# Mount static folder to serve charts
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

def load_local_demo_data():
    """
    Loads raw Excel sheets locally as fallback (Demo Mode).
    """
    logger.info("Attempting to load local Excel files for Demo Mode...")
    try:
        if os.path.exists(DEALS_EXCEL_PATH) and os.path.exists(WO_EXCEL_PATH):
            state.deals_df_raw = pd.read_excel(DEALS_EXCEL_PATH)
            state.wo_df_raw = pd.read_excel(WO_EXCEL_PATH, header=1)
            
            # Clean and store
            state.deals_df = clean_deals_df(state.deals_df_raw)
            state.wo_df = clean_work_orders_df(state.wo_df_raw)
            state.dq_report = get_data_quality_report(state.deals_df, state.wo_df)
            
            state.is_demo_mode = True
            state.connection_error = None
            logger.info("Loaded local demo data successfully.")
        else:
            state.connection_error = "Local sample Excel sheets not found at expected paths."
            logger.warning(state.connection_error)
    except Exception as e:
        state.connection_error = f"Error reading local spreadsheets: {str(e)}"
        logger.error(state.connection_error)

# Auto-load demo data on startup
@app.on_event("startup")
def startup_event():
    load_local_demo_data()

@app.get("/api/status")
def get_status():
    """
    Returns API connection, data availability status.
    """
    # Auto-load if dataframes are empty and paths are available
    if state.deals_df.empty and state.is_demo_mode:
        load_local_demo_data()

    return {
        "is_demo_mode": state.is_demo_mode,
        "monday_connected": not state.is_demo_mode and not state.deals_df.empty,
        "deals_rows": len(state.deals_df),
        "wo_rows": len(state.wo_df),
        "gemini_api_key_configured": bool(state.gemini_api_key),
        "connection_error": state.connection_error,
        "dq_report": state.dq_report
    }

@app.get("/api/dashboard-metrics")
def get_dashboard_metrics():
    """
    Computes aggregated operational and financial dashboard insights.
    """
    if state.deals_df.empty and state.wo_df.empty:
        load_local_demo_data()
        
    deals = state.deals_df
    wo = state.wo_df
    
    if deals.empty or wo.empty:
        return {
            "total_deals": 0,
            "total_wo": 0,
            "financials": {
                "total_value": 0,
                "revenue_won": 0,
                "lost_value": 0,
                "open_value": 0,
                "won_count": 0,
                "dead_count": 0,
                "open_count": 0
            },
            "sectors": [],
            "operations": {
                "completed": 0,
                "ongoing": 0,
                "not_started": 0,
                "paused": 0,
                "other": 0
            },
            "health_index": 100
        }
        
    # Financial metrics
    won_deals = deals[deals['Deal Status'] == 'Won']
    dead_deals = deals[deals['Deal Status'] == 'Dead']
    open_deals = deals[deals['Deal Status'] == 'Open']
    
    revenue_won = float(won_deals['Masked Deal value'].sum())
    lost_value = float(dead_deals['Masked Deal value'].sum())
    open_value = float(open_deals['Masked Deal value'].sum())
    total_val = revenue_won + lost_value + open_value
    
    # Operations metrics
    exec_counts = wo['Execution Status'].value_counts()
    completed_count = int(exec_counts.get('Completed', 0))
    ongoing_count = int(exec_counts.get('Ongoing', 0))
    not_started_count = int(exec_counts.get('Not Started', 0))
    paused_count = int(exec_counts.get('Pause / struck', 0))
    total_wo = len(wo)
    
    # Sector analysis
    sectors_list = []
    all_sectors = set(deals['Sector/service'].dropna().unique()).union(set(wo['Sector'].dropna().unique()))
    all_sectors = [s for s in all_sectors if s and s != 'Others' and s != 'Nan' and s != 'Others']
    
    for sec in all_sectors:
        sec_deals = deals[deals['Sector/service'] == sec]
        sec_wo = wo[wo['Sector'] == sec]
        
        deals_count = len(sec_deals)
        deals_val = float(sec_deals['Masked Deal value'].sum())
        
        wo_count = len(sec_wo)
        wo_completed = len(sec_wo[sec_wo['Execution Status'] == 'Completed'])
        wo_active = wo_count - wo_completed
        
        sectors_list.append({
            "name": sec,
            "deals_count": deals_count,
            "deals_value": deals_val,
            "wo_count": wo_count,
            "wo_completed": wo_completed,
            "wo_active": wo_active
        })
        
    sectors_list.sort(key=lambda x: x['deals_value'], reverse=True)
    
    # Custom Health Index based on key missing values (resiliency index)
    key_deals_cols = ['Masked Deal value', 'Owner code', 'Client Code', 'Created Date']
    key_wo_cols = ['Amount in Rupees (Excl of GST) (Masked)', 'Date of PO/LOI', 'Execution Status', 'Sector']
    
    missing_deals = int(deals[key_deals_cols].isnull().sum().sum())
    total_deals_cells = len(deals) * len(key_deals_cols)
    
    missing_wo = int(wo[key_wo_cols].isnull().sum().sum())
    total_wo_cells = len(wo) * len(key_wo_cols)
    
    total_missing = missing_deals + missing_wo
    total_cells = total_deals_cells + total_wo_cells
    
    health_index = round((1 - (total_missing / total_cells)) * 100, 1) if total_cells > 0 else 100.0
    
    return {
        "total_deals": len(deals),
        "total_wo": len(wo),
        "financials": {
            "total_value": total_val,
            "revenue_won": revenue_won,
            "lost_value": lost_value,
            "open_value": open_value,
            "won_count": len(won_deals),
            "dead_count": len(dead_deals),
            "open_count": len(open_deals)
        },
        "sectors": sectors_list,
        "operations": {
            "completed": completed_count,
            "ongoing": ongoing_count,
            "not_started": not_started_count,
            "paused": paused_count,
            "other": total_wo - (completed_count + ongoing_count + not_started_count + paused_count)
        },
        "health_index": health_index
    }

@app.post("/api/connect")
def connect_monday(
    api_token: str = Body(..., embed=True),
    deals_board_id: str = Body(..., embed=True),
    work_orders_board_id: str = Body(..., embed=True),
    gemini_api_key: Optional[str] = Body(None, embed=True)
):
    """
    Connects dynamically to Monday.com boards and updates application state.
    """
    # Update Gemini key if provided
    if gemini_api_key:
        state.gemini_api_key = gemini_api_key.strip()
        
    api_token = api_token.strip()
    deals_board_id = deals_board_id.strip()
    work_orders_board_id = work_orders_board_id.strip()
    
    try:
        logger.info(f"Connecting to Deals board: {deals_board_id}...")
        deals_raw = fetch_board_items(api_token, deals_board_id)
        
        logger.info(f"Connecting to Work Orders board: {work_orders_board_id}...")
        wo_raw = fetch_board_items(api_token, work_orders_board_id)
        
        # Clean and store if successful
        state.deals_df_raw = deals_raw
        state.wo_df_raw = wo_raw
        
        state.deals_df = clean_deals_df(deals_raw)
        state.wo_df = clean_work_orders_df(wo_raw)
        state.dq_report = get_data_quality_report(state.deals_df, state.wo_df)
        
        # Save credentials in state
        state.api_token = api_token
        state.deals_board_id = deals_board_id
        state.work_orders_board_id = work_orders_board_id
        state.is_demo_mode = False
        state.connection_error = None
        
        logger.info("Successfully configured live Monday.com connection.")
        return {
            "success": True,
            "message": "Connected to Monday.com successfully! Loaded active data.",
            "deals_rows": len(state.deals_df),
            "wo_rows": len(state.wo_df)
        }
    except Exception as e:
        logger.error(f"Monday connection failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/disconnect")
def disconnect_monday():
    """
    Disconnects Monday.com and reverts back to local demo files.
    """
    state.api_token = None
    state.deals_board_id = None
    state.work_orders_board_id = None
    load_local_demo_data()
    return {"success": True, "message": "Disconnected and reverted to local demo sheets."}

@app.post("/api/chat")
def run_chat(
    message: str = Body(..., embed=True),
    gemini_api_key: Optional[str] = Body(None, embed=True)
):
    """
    Chat endpoint. Analyzes data using BIAgent's Python execution model.
    """
    # Use key from body or state
    api_key = (gemini_api_key or state.gemini_api_key or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=400, 
            detail="Gemini API Key is not configured. Please set it in Settings."
        )

    # Reload data if empty (e.g. service restarted)
    if state.deals_df.empty and state.wo_df.empty:
        load_local_demo_data()

    agent = BIAgent(api_key=api_key, static_dir=STATIC_DIR)
    
    try:
        response = agent.process_query(
            user_question=message, 
            deals_df=state.deals_df, 
            wo_df=state.wo_df, 
            dq_report=state.dq_report
        )
        return response
    except Exception as e:
        logger.error(f"Chat processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process query: {str(e)}")

@app.post("/api/leadership-brief")
def generate_leadership_brief(
    quarter: str = Body(..., embed=True),
    year: str = Body(..., embed=True),
    sector: str = Body(..., embed=True),
    gemini_api_key: Optional[str] = Body(None, embed=True)
):
    """
    Generates a structured, print-ready executive leadership update.
    Calculates operational metrics and formats a strategic AI brief.
    """
    api_key = (gemini_api_key or state.gemini_api_key or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=400, 
            detail="Gemini API Key is not configured. Please set it in Settings."
        )

    if state.deals_df.empty and state.wo_df.empty:
        load_local_demo_data()

    deals = state.deals_df.copy()
    wo = state.wo_df.copy()

    # Filter data based on parameters
    # Normalize inputs
    q = quarter.upper().strip() # Q1, Q2, Q3, Q4 or ALL
    yr = int(year) if year.isdigit() else 2026
    sec = sector.title().strip() # Mining, Renewables, etc. or ALL

    # Apply Sector filter
    if sec != "All":
        if 'Sector/service' in deals.columns:
            deals = deals[deals['Sector/service'] == sec]
        if 'Sector' in wo.columns:
            wo = wo[wo['Sector'] == sec]

    # Helper function to get dates by quarter
    # Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
    def filter_quarter(df, date_col):
        if date_col not in df.columns or df.empty:
            return df
        df = df[df[date_col].notnull()]
        df = df[df[date_col].dt.year == yr]
        if q == "Q1":
            return df[df[date_col].dt.month.isin([1, 2, 3])]
        elif q == "Q2":
            return df[df[date_col].dt.month.isin([4, 5, 6])]
        elif q == "Q3":
            return df[df[date_col].dt.month.isin([7, 8, 9])]
        elif q == "Q4":
            return df[df[date_col].dt.month.isin([10, 11, 12])]
        return df

    # Deals created in this quarter
    q_deals_created = filter_quarter(deals, 'Created Date')
    
    # Deals closed (won/lost) in this quarter
    q_deals_closed = filter_quarter(deals, 'Close Date (A)')
    
    # Work Orders execution in this quarter (Date of PO/LOI)
    q_wo = filter_quarter(wo, 'Date of PO/LOI')

    # Compute key metrics
    # Financial metrics from Deals
    total_pipeline = float(deals[deals['Deal Status'] == 'Open']['Masked Deal value'].sum())
    quarter_pipeline_created = float(q_deals_created[q_deals_created['Deal Status'] == 'Open']['Masked Deal value'].sum())
    
    deals_won = q_deals_closed[q_deals_closed['Deal Status'] == 'Won']
    revenue_closed = float(deals_won['Masked Deal value'].sum())
    
    total_closed_count = len(q_deals_closed)
    won_count = len(deals_won)
    win_rate = round((won_count / total_closed_count) * 100, 2) if total_closed_count > 0 else 0.0

    # Operational metrics from Work Orders
    total_wo_count = len(q_wo)
    completed_wo = q_wo[q_wo['Execution Status'].str.lower().str.contains('complete', na=False)]
    completed_wo_count = len(completed_wo)
    
    completion_rate = round((completed_wo_count / total_wo_count) * 100, 2) if total_wo_count > 0 else 0.0
    
    total_billed = float(q_wo['Billed Value in Rupees (Excl of GST.) (Masked)'].sum())
    total_receivable = float(q_wo['Amount Receivable (Masked)'].sum())
    
    # Bottleneck analysis: work orders with status "Not Started" or "Pause / struck" or "Details pending"
    bottlenecks = q_wo[q_wo['Execution Status'].str.lower().str.contains('not start|pause|struck|pending|details', na=False)]
    bottleneck_list = []
    for _, row in bottlenecks.head(5).iterrows():
        bottleneck_list.append({
            "deal_name": str(row.get('Deal name masked', 'Unknown')),
            "serial": str(row.get('Serial #', 'N/A')),
            "status": str(row.get('Execution Status', 'N/A')),
            "amount_receivable": float(row.get('Amount Receivable (Masked)', 0))
        })

    # Prepare input payload for Gemini synthesis
    metrics_summary = {
        "sector": sec,
        "quarter": q,
        "year": yr,
        "financials": {
            "total_overall_pipeline_value": total_pipeline,
            "new_pipeline_created_in_quarter": quarter_pipeline_created,
            "revenue_closed_in_quarter": revenue_closed,
            "win_rate_percentage": win_rate,
            "closed_deals_count": total_closed_count,
            "won_deals_count": won_count
        },
        "operations": {
            "work_orders_count": total_wo_count,
            "completed_work_orders_count": completed_wo_count,
            "completion_rate_percentage": completion_rate,
            "total_billed_value": total_billed,
            "total_amount_receivable": total_receivable,
            "bottlenecks_count": len(bottlenecks)
        }
    }

    # Ask Gemini to generate structured executive text
    system_instruction = "You are a professional executive writer. Compile the provided metrics into a clear, strategic, and polished Executive Briefing. Do not make up numbers, use the ones provided. Suggest strategic recommendations based on the financial and operational stats."
    
    prompt = f"""
Create a highly professional, beautifully formatted markdown Executive Brief for leadership based on this data:

Parameters:
- Sector Scope: {sec}
- Quarter/Year: {q} {yr}

Metrics Summary:
{metrics_summary}

Bottleneck Examples (Top {len(bottleneck_list)}):
{bottleneck_list}

Data Caveats (Quality):
{state.dq_report}

Ensure the report includes the following clear sections:
1. **Executive Summary**: A high-level description of overall health.
2. **Financial Highlights**: Analyze revenue closed, pipeline created, and win rate.
3. **Operational Performance**: Analyze work order completion rate, billing, and outstanding receivables.
4. **Key Risks & Bottlenecks**: Highlight paused/not started projects and the financial value locked in them.
5. **Strategic Recommendations**: Actionable bullet points for leadership to improve pipeline velocity and collection rates.

Format it beautifully using clean markdown headings, bullet points, and tables. Avoid placeholders. Mention any data quality warnings (e.g. missing deal values or date gaps) under a small 'Data Quality & Caveats' footer.
"""

    logger.info("Generating leadership brief text...")
    try:
        report_md = call_gemini_api(api_key, "gemini-2.5-flash", prompt, system_instruction)
    except Exception as e:
        report_md = f"Error generating executive brief: {str(e)}\n\nMetrics:\n{metrics_summary}"

    return {
        "metrics": metrics_summary,
        "report_markdown": report_md
    }
