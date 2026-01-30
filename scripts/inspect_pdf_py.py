
import pdfplumber

pdf_path = 'scripts/appendix_d.pdf'

with pdfplumber.open(pdf_path) as pdf:
    # Check page 2 (index 1) and 3 (index 2)
    for i in range(1, 4):
        if i >= len(pdf.pages): break
        page = pdf.pages[i]
        print(f"\n--- Page {i+1} ---")
        print(page.extract_text()[:500])
        tables = page.extract_tables()
        if tables:
            print(f"Found {len(tables)} tables")
            for row in tables[0][:5]:
                print(row)
        else:
            print("No tables found")
