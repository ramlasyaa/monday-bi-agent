import sys
import os
import pandas as pd

# Add current dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from data_cleaner import clean_deals_df, clean_work_orders_df, get_data_quality_report
from bi_agent import execute_pandas_query

def main():
    print("=== Testing Backend Cleaning & Execution ===")
    
    deals_path = "/Users/ramlasya/Documents/SkylarkDrones/Deal funnel Data.xlsx"
    wo_path = "/Users/ramlasya/Documents/SkylarkDrones/Work_Order_Tracker Data.xlsx"
    
    if not os.path.exists(deals_path) or not os.path.exists(wo_path):
        print(f"ERROR: Sample files not found at {deals_path} and {wo_path}")
        sys.exit(1)
        
    print("1. Loading raw files...")
    deals_raw = pd.read_excel(deals_path)
    wo_raw = pd.read_excel(wo_path, header=1)
    
    print(f"   Raw deals rows: {len(deals_raw)}")
    print(f"   Raw work orders rows: {len(wo_raw)}")
    
    print("2. Cleaning DataFrames...")
    deals_clean = clean_deals_df(deals_raw)
    wo_clean = clean_work_orders_df(wo_raw)
    
    print(f"   Cleaned deals rows: {len(deals_clean)} (expected: 344)")
    print(f"   Cleaned work orders rows: {len(wo_clean)} (expected: 176)")
    
    # Assert size to ensure duplicate headers were filtered
    assert len(deals_clean) == 344, f"Expected 344 deals rows, got {len(deals_clean)}"
    assert len(wo_clean) == 176, f"Expected 176 work orders rows, got {len(wo_clean)}"
    
    print("3. Checking Data Quality reporting...")
    report = get_data_quality_report(deals_clean, wo_clean)
    print("   Data Quality Report Keys:", list(report.keys()))
    print("   Deals details:", report["deals"])
    
    print("4. Testing Sandboxed execution engine...")
    test_code = """
result = {
    'total_deals_count': len(deals_df),
    'avg_deal_value': float(deals_df['Masked Deal value'].mean()),
    'total_billed': float(wo_df['Billed Value in Rupees (Excl of GST.) (Masked)'].sum())
}
print("Executing inside sandboxed environment!")
"""
    
    exec_res = execute_pandas_query(test_code, deals_clean, wo_clean, "./static")
    print("   Stdout output:", exec_res["stdout"].strip())
    print("   Result value:", exec_res["result"])
    print("   Error:", exec_res["error"])
    
    assert exec_res["error"] is None, f"Execution failed with error: {exec_res['error']}"
    assert exec_res["result"]["total_deals_count"] == 344
    
    print("\n=== Backend Test Passed Successfully! ===")

if __name__ == "__main__":
    main()
