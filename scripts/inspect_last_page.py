import pdfplumber
import sys

def inspect_last_page(pdf_path):
    print(f"Inspecting last page of: {pdf_path}")
    try:
        with pdfplumber.open(pdf_path) as pdf:
            last_page_idx = len(pdf.pages) - 1
            page = pdf.pages[last_page_idx]
            print(f"\n--- Page {last_page_idx + 1} ---")
            
            text = page.extract_text()
            print("Raw Text Preview (last 500 chars):")
            print(text[-500:] if text else "No text found")
            
            tables = page.extract_tables()
            if tables:
                print(f"Last table Last Row: {tables[-1][-1]}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_last_page("scripts/appendix_d.pdf")
