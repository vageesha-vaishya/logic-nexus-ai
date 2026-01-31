import argparse
import requests
import psycopg2
import os
import json
import hashlib
from datetime import datetime, timedelta
from abc import ABC, abstractmethod
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
DB_URL = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
FEDERAL_REGISTER_API = "https://www.federalregister.gov/api/v1/documents.json"
CENSUS_CONCORDANCE_URL = "https://www.census.gov/foreign-trade/aes/documentlibrary/concordance/expaes.txt"

# --- Utils ---
def get_db_connection():
    return psycopg2.connect(DB_URL)

def calculate_checksum(record_dict):
    """
    Generate SHA-256 checksum for a record.
    Sorts keys to ensure determinism.
    """
    # Filter out metadata keys that change
    filtered = {k: v for k, v in record_dict.items() if k not in ['created_at', 'updated_at', 'last_verified_at', 'checksum_sha256', 'id']}
    serialized = json.dumps(filtered, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode('utf-8')).hexdigest()

def create_jira_ticket_stub(title, description, priority="Medium"):
    """
    Mock JIRA ticket creation.
    In production, this would use the JIRA REST API.
    """
    print(f"\n[JIRA] Creating Ticket: {title}")
    print(f"[JIRA] Priority: {priority}")
    print(f"[JIRA] Description: {description[:100]}...")
    return f"JIRA-{int(datetime.now().timestamp())}"

# --- Source Abstraction ---
class HTSSource(ABC):
    @abstractmethod
    def fetch_data(self):
        """Returns a list of standardized dictionaries."""
        pass
        
    @abstractmethod
    def get_source_name(self):
        pass

# --- Census Source ---
class CensusSource(HTSSource):
    def get_source_name(self):
        return "Census AES Concordance"
        
    def fetch_data(self):
        print(f"Fetching from {self.get_source_name()}...")
        try:
            resp = requests.get(CENSUS_CONCORDANCE_URL, timeout=30)
            resp.raise_for_status()
            lines = resp.text.splitlines()
            records = []
            for line in lines:
                if len(line) < 10: continue
                code = line[0:10].strip()
                desc = line[15:165].strip()
                uom1 = line[170:173].strip()
                uom2 = line[178:181].strip()
                
                if not code or not code.isdigit(): continue
                
                # Normalize code to 4.2.2.2 format
                fmt_code = f"{code[:4]}.{code[4:6]}.{code[6:8]}.{code[8:10]}"
                
                records.append({
                    'hts_code': fmt_code,
                    'description': desc,
                    'unit_of_measure_primary': uom1,
                    'unit_of_measure_secondary': uom2,
                    'source_citation': f"Census Export Concordance {datetime.now().year}"
                })
            return records
        except Exception as e:
            print(f"Error fetching Census data: {e}")
            return []

# --- Federal Register Source ---
class FederalRegisterSource(HTSSource):
    def get_source_name(self):
        return "Federal Register"
        
    def fetch_data(self):
        print(f"Fetching from {self.get_source_name()}...")
        # Search for HTS changes in the last 30 days (simulated window for demo)
        # In full prod, this would be incremental based on last run
        params = {
            "conditions[term]": "Harmonized Tariff Schedule",
            "conditions[publication_date][gte]": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d"),
            "per_page": 5 # Limit for demo
        }
        try:
            resp = requests.get(FEDERAL_REGISTER_API, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            
            updates = []
            for doc in data.get('results', []):
                # Parsing FR text to find specific HTS codes is complex NLP.
                # Here we simulate finding a "potential update" flag.
                updates.append({
                    'hts_code': 'UPDATE_FLAG', 
                    'description': f"Potential update from FR Doc {doc['document_number']}: {doc['title']}",
                    'source_citation': f"Federal Register {doc['publication_date']}"
                })
            return updates
        except Exception as e:
            print(f"Error fetching Federal Register: {e}")
            return []

# --- USITC Source (Simulated) ---
class USITCSource(HTSSource):
    def get_source_name(self):
        return "USITC Tariff Database"
        
    def fetch_data(self):
        print(f"Fetching from {self.get_source_name()} (Simulated)...")
        # Mocking some data that might differ from Census to trigger logic
        return [
            {
                'hts_code': '0101.21.00.00', # Match
                'description': 'Purebred breeding horses', # Match
                'unit_of_measure_primary': 'NO',
                'source_citation': 'USITC 2026'
            },
            {
                'hts_code': '9999.99.99.99', # New/Different
                'description': 'USITC Specific Test Item',
                'unit_of_measure_primary': 'X',
                'source_citation': 'USITC 2026'
            }
        ]

# --- ETL Pipeline ---
class HTSPipeline:
    def __init__(self, sources):
        self.sources = sources
        self.conn = get_db_connection()
        self.stats = {'processed': 0, 'updated': 0, 'discrepancies': 0}

    def log_discrepancy(self, code, source_a, source_b, details, severity="WARNING"):
        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO public.discrepancy_logs 
            (hts_code, source_primary, source_secondary, mismatch_details, root_cause, severity, status)
            VALUES (%s, %s, %s, %s, 'source_error', %s, 'OPEN')
        """, (code, source_a, source_b, json.dumps(details), severity))
        self.conn.commit()
        cur.close()
        
        create_jira_ticket_stub(
            f"HTS Discrepancy: {code}",
            f"Mismatch between {source_a} and {source_b}. Details: {details}"
        )
        self.stats['discrepancies'] += 1

    def run(self):
        print("Starting ETL Pipeline...")
        
        # 1. Fetch from Primary Source (Census) as baseline
        census_source = next((s for s in self.sources if isinstance(s, CensusSource)), None)
        if not census_source:
            print("Census source required as baseline.")
            return

        census_data = census_source.fetch_data()
        
        cur = self.conn.cursor()
        
        # 2. Process Baseline
        for record in census_data:
            self.stats['processed'] += 1
            record['checksum_sha256'] = calculate_checksum(record)
            record['verified_flag'] = True # Census is trusted source
            record['last_verified_at'] = datetime.now()
            
            # Upsert into Master HTS
            cur.execute("""
                INSERT INTO public.master_hts (
                    hts_code, description, unit_of_measure_primary, unit_of_measure_secondary,
                    source_citation, verified_flag, last_verified_at, checksum_sha256
                ) VALUES (
                    %(hts_code)s, %(description)s, %(unit_of_measure_primary)s, %(unit_of_measure_secondary)s,
                    %(source_citation)s, %(verified_flag)s, %(last_verified_at)s, %(checksum_sha256)s
                )
                ON CONFLICT (hts_code) DO UPDATE SET
                    description = EXCLUDED.description,
                    unit_of_measure_primary = EXCLUDED.unit_of_measure_primary,
                    last_verified_at = NOW(),
                    checksum_sha256 = EXCLUDED.checksum_sha256
                RETURNING id;
            """, record)
        
        self.conn.commit()
        print(f"Baseline processed. {self.stats['processed']} records.")
        
        # 3. Cross-Verify with Secondary Sources
        for source in self.sources:
            if isinstance(source, CensusSource): continue
            
            data = source.fetch_data()
            for item in data:
                if item.get('hts_code') == 'UPDATE_FLAG':
                    # Log FR updates as info/warning to check
                    self.log_discrepancy(
                        "FR-NOTICE", source.get_source_name(), "Manual Review", 
                        item, severity="INFO"
                    )
                    continue
                    
                # Check against DB
                cur.execute("SELECT description, checksum_sha256 FROM master_hts WHERE hts_code = %s", (item['hts_code'],))
                res = cur.fetchone()
                
                if res:
                    db_desc, db_checksum = res
                    # Simple comparison logic
                    if item.get('description') and item['description'] != db_desc:
                        # Calculate similarity? For now, strict inequality
                        self.log_discrepancy(
                            item['hts_code'], "MasterDB", source.get_source_name(),
                            {"db": db_desc, "new": item['description']},
                            severity="WARNING"
                        )
                else:
                    # New code in secondary source?
                    self.log_discrepancy(
                        item['hts_code'], "MasterDB", source.get_source_name(),
                        {"msg": "Code exists in secondary but not master"},
                        severity="INFO"
                    )

        self.conn.close()
        print("Pipeline Complete.")
        print(self.stats)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--full", action="store_true", help="Run full extraction")
    args = parser.parse_args()
    
    pipeline = HTSPipeline([
        CensusSource(),
        FederalRegisterSource(),
        USITCSource()
    ])
    pipeline.run()
