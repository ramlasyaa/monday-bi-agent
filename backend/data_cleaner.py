import pandas as pd
import numpy as np

def clean_deals_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans raw Deals board data.
    - Filters out duplicate header rows (where Deal Status == 'Deal Status').
    - Converts Date fields to datetime.
    - Converts numeric Masked Deal value to float.
    - Strips whitespace and standardizes Sectors.
    """
    if df.empty:
        return df
        
    # Copy to avoid modifying original
    df = df.copy()
    
    # Identify header rows duplicated in data: status contains column headers
    if 'Deal Status' in df.columns:
        df = df[df['Deal Status'] != 'Deal Status'].copy()
        
    # Standardize string fields
    string_cols = ['Deal Name', 'Owner code', 'Client Code', 'Deal Status', 'Deal Stage', 'Product deal', 'Sector/service']
    for col in string_cols:
        if col in df.columns:
            df[col] = df[col].fillna('').astype(str).str.strip()
            df[col] = df[col].replace({'nan': '', 'None': '', 'NaN': ''})
            
    # Normalize Sector
    if 'Sector/service' in df.columns:
        # Standardize sector naming to title case
        df['Sector/service'] = df['Sector/service'].apply(lambda x: str(x).title() if x else 'Others')
        df['Sector/service'] = df['Sector/service'].replace({'': 'Others', 'Others': 'Others'})
        
    # Convert numeric fields
    if 'Masked Deal value' in df.columns:
        df['Masked Deal value'] = pd.to_numeric(df['Masked Deal value'], errors='coerce')
        
    # Convert dates
    date_cols = ['Created Date', 'Close Date (A)', 'Tentative Close Date']
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
            
    return df

def clean_work_orders_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans raw Work Orders tracker data.
    - Filters out duplicate headers (if any).
    - Converts Date fields.
    - Converts all masked amount columns to float.
    - Standardizes Sector and Status fields.
    """
    if df.empty:
        return df
        
    df = df.copy()
    
    # Filter duplicate headers
    if 'Execution Status' in df.columns:
        df = df[df['Execution Status'] != 'Execution Status'].copy()
        
    # Standardize string fields
    string_cols = [
        'Deal name masked', 'Customer Name Code', 'Serial #', 'Nature of Work', 
        'Execution Status', 'Document Type', 'BD/KAM Personnel code', 'Sector', 
        'Type of Work', 'Is any Skylark software platform part of the client deliverables in this deal?', 
        'latest invoice no.', 'AR Priority account', 'Invoice Status', 'WO Status (billed)', 
        'Collection status', 'Billing Status'
    ]
    for col in string_cols:
        if col in df.columns:
            df[col] = df[col].fillna('').astype(str).str.strip()
            df[col] = df[col].replace({'nan': '', 'None': '', 'NaN': ''})
            
    # Normalize Sector
    if 'Sector' in df.columns:
        df['Sector'] = df['Sector'].apply(lambda x: str(x).title() if x else 'Others')
        df['Sector'] = df['Sector'].replace({'': 'Others', 'Others': 'Others'})
        
    # Convert numeric columns
    num_cols = [
        'Amount in Rupees (Excl of GST) (Masked)', 
        'Amount in Rupees (Incl of GST) (Masked)',
        'Billed Value in Rupees (Excl of GST.) (Masked)',
        'Billed Value in Rupees (Incl of GST.) (Masked)',
        'Collected Amount in Rupees (Incl of GST.) (Masked)',
        'Amount to be billed in Rs. (Exl. of GST) (Masked)',
        'Amount to be billed in Rs. (Incl. of GST) (Masked)',
        'Amount Receivable (Masked)',
        'Quantity by Ops',
        'Quantity billed (till date)',
        'Balance in quantity'
    ]
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            
    # Convert dates
    date_cols = [
        'Data Delivery Date', 'Date of PO/LOI', 'Probable Start Date', 
        'Probable End Date', 'Last invoice date', 'Collection Date'
    ]
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
            
    return df

def get_data_quality_report(deals_df: pd.DataFrame, wo_df: pd.DataFrame) -> dict:
    """
    Analyzes missing values, duplicate header anomalies, and basic sizes
    to communicate to the user or supply as context to the LLM.
    """
    report = {
        "deals": {
            "total_rows": len(deals_df),
            "missing_values": {},
            "date_ranges": {}
        },
        "work_orders": {
            "total_rows": len(wo_df),
            "missing_values": {},
            "date_ranges": {}
        }
    }
    
    # Deals report
    if not deals_df.empty:
        for col in ['Masked Deal value', 'Sector/service', 'Created Date']:
            if col in deals_df.columns:
                missing = int(deals_df[col].isnull().sum())
                report["deals"]["missing_values"][col] = {
                    "count": missing,
                    "percentage": round((missing / len(deals_df)) * 100, 2)
                }
        if 'Created Date' in deals_df.columns:
            min_date = deals_df['Created Date'].min()
            max_date = deals_df['Created Date'].max()
            report["deals"]["date_ranges"]["Created Date"] = {
                "min": str(min_date.date()) if pd.notnull(min_date) else None,
                "max": str(max_date.date()) if pd.notnull(max_date) else None
            }
            
    # Work Orders report
    if not wo_df.empty:
        key_wo_cols = [
            'Amount in Rupees (Excl of GST) (Masked)',
            'Billed Value in Rupees (Excl of GST.) (Masked)',
            'Amount Receivable (Masked)',
            'Execution Status',
            'Sector'
        ]
        for col in key_wo_cols:
            if col in wo_df.columns:
                missing = int(wo_df[col].isnull().sum())
                report["work_orders"]["missing_values"][col] = {
                    "count": missing,
                    "percentage": round((missing / len(wo_df)) * 100, 2)
                }
        if 'Date of PO/LOI' in wo_df.columns:
            min_date = wo_df['Date of PO/LOI'].min()
            max_date = wo_df['Date of PO/LOI'].max()
            report["work_orders"]["date_ranges"]["Date of PO/LOI"] = {
                "min": str(min_date.date()) if pd.notnull(min_date) else None,
                "max": str(max_date.date()) if pd.notnull(max_date) else None
            }
            
    return report
