-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515025726; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Seed markets.instruments with the canonical Indian-market reference set:
--   NIFTY 50 equity constituents (NSE)
--   Major broad / sector indices (NSE + BSE)
--   Major ETFs (NSE)
-- All idempotent — re-running is a no-op.
-- ISINs left NULL where I do not have a verified source; can be backfilled
-- in a follow-up ingestion pass from NSE/BSE bhavcopy.

-- Use a CTE-VALUES seed list, then INSERT only the rows that don't already exist.
WITH seed (symbol, exchange, isin, instrument_type, lot_size, metadata) AS (
  VALUES
    -- ===== NIFTY 50 equities (NSE) — 50 names =====
    ('RELIANCE'   , 'NSE', 'INE002A01018', 'equity', 250 , '{"sector":"Energy","mcap_tier":"large"}'::jsonb),
    ('TCS'        , 'NSE', 'INE467B01029', 'equity', 175 , '{"sector":"IT","mcap_tier":"large"}'::jsonb),
    ('HDFCBANK'   , 'NSE', 'INE040A01034', 'equity', 550 , '{"sector":"Banking","mcap_tier":"large"}'::jsonb),
    ('ICICIBANK'  , 'NSE', 'INE090A01021', 'equity', 700 , '{"sector":"Banking","mcap_tier":"large"}'::jsonb),
    ('INFY'       , 'NSE', 'INE009A01021', 'equity', 400 , '{"sector":"IT","mcap_tier":"large"}'::jsonb),
    ('HINDUNILVR' , 'NSE', 'INE030A01027', 'equity', 300 , '{"sector":"FMCG","mcap_tier":"large"}'::jsonb),
    ('ITC'        , 'NSE', 'INE154A01025', 'equity', 1600, '{"sector":"FMCG","mcap_tier":"large"}'::jsonb),
    ('SBIN'       , 'NSE', 'INE062A01020', 'equity', 750 , '{"sector":"Banking","mcap_tier":"large"}'::jsonb),
    ('BHARTIARTL' , 'NSE', 'INE397D01024', 'equity', 475 , '{"sector":"Telecom","mcap_tier":"large"}'::jsonb),
    ('KOTAKBANK'  , 'NSE', 'INE237A01028', 'equity', 400 , '{"sector":"Banking","mcap_tier":"large"}'::jsonb),
    ('LT'         , 'NSE', 'INE018A01030', 'equity', 150 , '{"sector":"Capital Goods","mcap_tier":"large"}'::jsonb),
    ('HCLTECH'    , 'NSE', 'INE860A01027', 'equity', 350 , '{"sector":"IT","mcap_tier":"large"}'::jsonb),
    ('AXISBANK'   , 'NSE', 'INE238A01034', 'equity', 625 , '{"sector":"Banking","mcap_tier":"large"}'::jsonb),
    ('ASIANPAINT' , 'NSE', 'INE021A01026', 'equity', 200 , '{"sector":"Consumer Durables","mcap_tier":"large"}'::jsonb),
    ('MARUTI'     , 'NSE', 'INE585B01010', 'equity', 50  , '{"sector":"Auto","mcap_tier":"large"}'::jsonb),
    ('BAJFINANCE' , 'NSE', 'INE296A01024', 'equity', 75  , '{"sector":"NBFC","mcap_tier":"large"}'::jsonb),
    ('TITAN'      , 'NSE', 'INE280A01028', 'equity', 175 , '{"sector":"Consumer Durables","mcap_tier":"large"}'::jsonb),
    ('SUNPHARMA'  , 'NSE', 'INE044A01036', 'equity', 350 , '{"sector":"Pharma","mcap_tier":"large"}'::jsonb),
    ('ULTRACEMCO' , 'NSE', 'INE481G01011', 'equity', 50  , '{"sector":"Cement","mcap_tier":"large"}'::jsonb),
    ('NESTLEIND'  , 'NSE', 'INE239A01024', 'equity', 25  , '{"sector":"FMCG","mcap_tier":"large"}'::jsonb),
    ('WIPRO'      , 'NSE', 'INE075A01022', 'equity', 1200, '{"sector":"IT","mcap_tier":"large"}'::jsonb),
    ('NTPC'       , 'NSE', 'INE733E01010', 'equity', 1500, '{"sector":"Power","mcap_tier":"large"}'::jsonb),
    ('TATAMOTORS' , 'NSE', 'INE155A01022', 'equity', 350 , '{"sector":"Auto","mcap_tier":"large"}'::jsonb),
    ('M&M'        , 'NSE', 'INE101A01026', 'equity', 350 , '{"sector":"Auto","mcap_tier":"large"}'::jsonb),
    ('POWERGRID'  , 'NSE', 'INE752E01010', 'equity', 1900, '{"sector":"Power","mcap_tier":"large"}'::jsonb),
    ('TATASTEEL'  , 'NSE', 'INE081A01020', 'equity', 5500, '{"sector":"Metals","mcap_tier":"large"}'::jsonb),
    ('BAJAJFINSV' , 'NSE', 'INE918I01026', 'equity', 500 , '{"sector":"NBFC","mcap_tier":"large"}'::jsonb),
    ('TECHM'      , 'NSE', 'INE669C01036', 'equity', 600 , '{"sector":"IT","mcap_tier":"large"}'::jsonb),
    ('ONGC'       , 'NSE', 'INE213A01029', 'equity', 3850, '{"sector":"Energy","mcap_tier":"large"}'::jsonb),
    ('HDFCLIFE'   , 'NSE', 'INE795G01014', 'equity', 1100, '{"sector":"Insurance","mcap_tier":"large"}'::jsonb),
    ('SBILIFE'    , 'NSE', 'INE123W01016', 'equity', 375 , '{"sector":"Insurance","mcap_tier":"large"}'::jsonb),
    ('JSWSTEEL'   , 'NSE', 'INE019A01038', 'equity', 675 , '{"sector":"Metals","mcap_tier":"large"}'::jsonb),
    ('GRASIM'     , 'NSE', 'INE047A01021', 'equity', 250 , '{"sector":"Cement","mcap_tier":"large"}'::jsonb),
    ('INDUSINDBK' , 'NSE', 'INE095A01012', 'equity', 500 , '{"sector":"Banking","mcap_tier":"large"}'::jsonb),
    ('ADANIENT'   , 'NSE', 'INE423A01024', 'equity', 250 , '{"sector":"Diversified","mcap_tier":"large"}'::jsonb),
    ('ADANIPORTS' , 'NSE', 'INE742F01042', 'equity', 625 , '{"sector":"Infrastructure","mcap_tier":"large"}'::jsonb),
    ('COALINDIA'  , 'NSE', 'INE522F01014', 'equity', 1400, '{"sector":"Mining","mcap_tier":"large"}'::jsonb),
    ('CIPLA'      , 'NSE', 'INE059A01026', 'equity', 425 , '{"sector":"Pharma","mcap_tier":"large"}'::jsonb),
    ('DRREDDY'    , 'NSE', 'INE089A01023', 'equity', 125 , '{"sector":"Pharma","mcap_tier":"large"}'::jsonb),
    ('EICHERMOT'  , 'NSE', 'INE066A01021', 'equity', 175 , '{"sector":"Auto","mcap_tier":"large"}'::jsonb),
    ('TATACONSUM' , 'NSE', 'INE192A01025', 'equity', 550 , '{"sector":"FMCG","mcap_tier":"large"}'::jsonb),
    ('BRITANNIA'  , 'NSE', 'INE216A01030', 'equity', 200 , '{"sector":"FMCG","mcap_tier":"large"}'::jsonb),
    ('APOLLOHOSP' , 'NSE', 'INE437A01024', 'equity', 125 , '{"sector":"Healthcare","mcap_tier":"large"}'::jsonb),
    ('BAJAJ-AUTO' , 'NSE', 'INE917I01010', 'equity', 75  , '{"sector":"Auto","mcap_tier":"large"}'::jsonb),
    ('HEROMOTOCO' , 'NSE', 'INE158A01026', 'equity', 175 , '{"sector":"Auto","mcap_tier":"large"}'::jsonb),
    ('HINDALCO'   , 'NSE', 'INE038A01020', 'equity', 1075, '{"sector":"Metals","mcap_tier":"large"}'::jsonb),
    ('DIVISLAB'   , 'NSE', 'INE361B01024', 'equity', 200 , '{"sector":"Pharma","mcap_tier":"large"}'::jsonb),
    ('BPCL'       , 'NSE', 'INE029A01011', 'equity', 1800, '{"sector":"Energy","mcap_tier":"large"}'::jsonb),
    ('LTIM'       , 'NSE', 'INE214T01019', 'equity', 100 , '{"sector":"IT","mcap_tier":"large"}'::jsonb),
    ('SHRIRAMFIN' , 'NSE', 'INE721A01013', 'equity', 300 , '{"sector":"NBFC","mcap_tier":"large"}'::jsonb),

    -- ===== Major indices =====
    ('NIFTY 50'         , 'NSE', NULL, 'index', NULL, '{"description":"NSE NIFTY 50 broad-market index"}'::jsonb),
    ('NIFTY BANK'       , 'NSE', NULL, 'index', NULL, '{"description":"NSE Bank Nifty"}'::jsonb),
    ('NIFTY IT'         , 'NSE', NULL, 'index', NULL, '{"description":"NSE IT sector index"}'::jsonb),
    ('NIFTY NEXT 50'    , 'NSE', NULL, 'index', NULL, '{"description":"NSE Next 50 (post-NIFTY 50)"}'::jsonb),
    ('NIFTY MIDCAP 100' , 'NSE', NULL, 'index', NULL, '{"description":"NSE midcap 100 index"}'::jsonb),
    ('NIFTY SMALLCAP 100','NSE', NULL, 'index', NULL, '{"description":"NSE smallcap 100 index"}'::jsonb),
    ('NIFTY FMCG'       , 'NSE', NULL, 'index', NULL, '{"description":"NSE FMCG sector index"}'::jsonb),
    ('NIFTY PHARMA'     , 'NSE', NULL, 'index', NULL, '{"description":"NSE Pharma sector index"}'::jsonb),
    ('NIFTY AUTO'       , 'NSE', NULL, 'index', NULL, '{"description":"NSE Auto sector index"}'::jsonb),
    ('SENSEX'           , 'BSE', NULL, 'index', NULL, '{"description":"BSE SENSEX 30 index"}'::jsonb),
    ('BANKEX'           , 'BSE', NULL, 'index', NULL, '{"description":"BSE Bankex index"}'::jsonb),

    -- ===== Major ETFs (NSE) =====
    ('NIFTYBEES'  , 'NSE', 'INF732E01037', 'etf', NULL, '{"underlying":"NIFTY 50","sponsor":"Nippon India MF"}'::jsonb),
    ('BANKBEES'   , 'NSE', 'INF732E01045', 'etf', NULL, '{"underlying":"NIFTY BANK","sponsor":"Nippon India MF"}'::jsonb),
    ('GOLDBEES'   , 'NSE', 'INF732E01045', 'etf', NULL, '{"underlying":"Gold","sponsor":"Nippon India MF"}'::jsonb),
    ('LIQUIDBEES' , 'NSE',  NULL          , 'etf', NULL, '{"underlying":"Liquid","sponsor":"Nippon India MF"}'::jsonb),
    ('JUNIORBEES' , 'NSE',  NULL          , 'etf', NULL, '{"underlying":"NIFTY NEXT 50","sponsor":"Nippon India MF"}'::jsonb),
    ('CPSEETF'    , 'NSE',  NULL          , 'etf', NULL, '{"underlying":"CPSE Index","sponsor":"Nippon India MF"}'::jsonb),
    ('ITBEES'     , 'NSE',  NULL          , 'etf', NULL, '{"underlying":"NIFTY IT","sponsor":"Nippon India MF"}'::jsonb)
)
INSERT INTO markets.instruments
  (symbol, exchange, isin, instrument_type, lot_size, metadata, is_active)
SELECT s.symbol, s.exchange, s.isin, s.instrument_type, s.lot_size, s.metadata, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM markets.instruments i
  WHERE i.exchange = s.exchange
    AND i.symbol = s.symbol
    AND COALESCE(i.expiry, '1970-01-01'::date) = '1970-01-01'::date
    AND COALESCE(i.strike, 0::numeric) = 0::numeric
);