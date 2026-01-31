import pandas as pd
import sys

EXCEL_FILE = 'scripts/AESTIR_Export_Reference_Data.xlsx'

try:
    xls = pd.ExcelFile(EXCEL_FILE)
    print(f"Sheet names: {xls.sheet_names}")
    
    for sheet in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet, nrows=5)
        print(f"\nSheet: {sheet}")
        print(f"Columns: {df.columns.tolist()}")
        print(df.head(2))
except Exception as e:
    print(f"Error: {e}")
