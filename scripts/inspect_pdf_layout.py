import pdfplumber
import sys

def inspect_pdf(pdf_path):
    print(f"Inspecting: {pdf_path}")
    try:
        with pdfplumber.open(pdf_path) as pdf:
            print(f"Total Pages: {len(pdf.pages)}")
            
            # Inspect first 3 pages
            for i in range(min(3, len(pdf.pages))):
                page = pdf.pages[i]
                print(f"\n--- Page {i+1} ---")
                print(f"Dimensions: {page.width}x{page.height}")
                
                # Extract text to see raw content
                text = page.extract_text()
                print("Raw Text Preview (first 500 chars):")
                print(text[:500] if text else "No text found")
                
                # Check tables
                tables = page.extract_tables()
                print(f"Tables found: {len(tables)}")
                if tables:
                    print(f"First table Row 0: {tables[0][0]}")
                    print(f"First table Row 1: {tables[0][1] if len(tables[0]) > 1 else 'N/A'}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_pdf("scripts/appendix_d.pdf")
