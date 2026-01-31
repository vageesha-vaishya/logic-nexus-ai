import psycopg2
import os
import json
import xml.etree.ElementTree as ET
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")

class ReportGenerator:
    def __init__(self):
        self.conn = psycopg2.connect(DB_URL)
        
    def get_stats(self):
        cur = self.conn.cursor()
        cur.execute("SELECT COUNT(*) FROM master_hts")
        total = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM master_hts WHERE verified_flag = true")
        verified = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM master_hts WHERE is_active = true")
        active = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM discrepancy_logs WHERE status = 'OPEN'")
        discrepancies = cur.fetchone()[0]
        
        cur.execute("SELECT hts_code, description, source_citation, verified_flag FROM master_hts ORDER BY hts_code LIMIT 20")
        sample_rows = cur.fetchall()
        
        cur.close()
        return {
            'total': total, 'verified': verified, 'active': active, 
            'discrepancies': discrepancies, 'sample': sample_rows
        }

    def generate_pdf_markdown(self, stats, filepath):
        """Generates a Markdown report that serves as the PDF content."""
        with open(filepath, 'w') as f:
            f.write(f"# HTS Verification Report\n")
            f.write(f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(f"## Executive Summary\n")
            f.write(f"- **Total HTS Codes:** {stats['total']}\n")
            f.write(f"- **Verified Codes:** {stats['verified']} ({(stats['verified']/stats['total'])*100:.2f}%)\n")
            f.write(f"- **Active Codes:** {stats['active']}\n")
            f.write(f"- **Open Discrepancies:** {stats['discrepancies']}\n\n")
            
            f.write(f"## Compliance Statement\n")
            f.write(f"This report certifies that the HTS codes listed herein have been cross-referenced against the U.S. Census Bureau's AES Concordance and Federal Register notices. Codes marked as 'Verified' match the official source 100%.\n\n")
            
            f.write(f"## Sample Verification List (First 20)\n")
            f.write(f"| HTS Code | Description | Verified | Source |\n")
            f.write(f"|---|---|---|---|\n")
            for row in stats['sample']:
                desc = (row[1][:50] + '...') if len(row[1]) > 50 else row[1]
                verified = "✅" if row[3] else "❌"
                f.write(f"| {row[0]} | {desc} | {verified} | {row[2]} |\n")
            
            f.write(f"\n*End of Report*")
        print(f"Report (PDF-ready Markdown) generated: {filepath}")

    def generate_xbrl_xml(self, stats, filepath):
        """Generates a simplified XBRL-like XML export."""
        root = ET.Element("xbrl", xmlns="http://www.xbrl.org/2003/instance")
        
        context = ET.SubElement(root, "context", id="AsOfNow")
        period = ET.SubElement(context, "period")
        instant = ET.SubElement(period, "instant")
        instant.text = datetime.now().strftime('%Y-%m-%d')
        
        unit = ET.SubElement(root, "unit", id="u-pure")
        measure = ET.SubElement(unit, "measure")
        measure.text = "pure"
        
        # Facts
        fact_total = ET.SubElement(root, "HTSTotalCodes", contextRef="AsOfNow", unitRef="u-pure")
        fact_total.text = str(stats['total'])
        
        fact_verified = ET.SubElement(root, "HTSVerifiedCodes", contextRef="AsOfNow", unitRef="u-pure")
        fact_verified.text = str(stats['verified'])
        
        # List of items (simplified for demo, usually XBRL is strictly schema-bound)
        items = ET.SubElement(root, "HTSLineItems")
        for row in stats['sample']:
            item = ET.SubElement(items, "HTSItem")
            ET.SubElement(item, "Code").text = row[0]
            ET.SubElement(item, "Verified").text = str(row[3])
            
        tree = ET.ElementTree(root)
        tree.write(filepath, encoding='utf-8', xml_declaration=True)
        print(f"Report (XBRL/XML) generated: {filepath}")

if __name__ == "__main__":
    gen = ReportGenerator()
    stats = gen.get_stats()
    gen.generate_pdf_markdown(stats, "hts_verification_report.md")
    gen.generate_xbrl_xml(stats, "hts_verification_report.xml")
