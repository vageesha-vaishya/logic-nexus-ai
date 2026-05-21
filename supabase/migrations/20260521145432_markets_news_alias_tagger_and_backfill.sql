-- News tagger with NIFTY-50 alias dictionary + one-time backfill over the
-- last 90 days. Closed-beta dealbreaker #D2 from
-- docs/audits/2026-05-21-content-coverage.md.
--
-- The existing markets-enrich-news edge function matches only the literal
-- ticker symbol against headlines, so "Tata Motors quarterly results"
-- never tagged TATAMOTORS. This function adds common-name aliases for
-- ~50 NIFTY-50 stocks. The edge function will be retrofitted to call
-- this function in a follow-up; for now it's the backfill workhorse.

CREATE OR REPLACE FUNCTION markets.tag_news_event_with_aliases(p_title text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_aliases  jsonb := '{
    "RELIANCE":   ["Reliance Industries", "Reliance", "RIL"],
    "TCS":        ["Tata Consultancy Services", "Tata Consultancy"],
    "HDFCBANK":   ["HDFC Bank"],
    "INFY":       ["Infosys"],
    "ICICIBANK":  ["ICICI Bank"],
    "HINDUNILVR": ["Hindustan Unilever", "HUL"],
    "ITC":        ["ITC Ltd", "ITC Limited"],
    "SBIN":       ["State Bank of India", "SBI"],
    "BHARTIARTL": ["Bharti Airtel", "Airtel"],
    "KOTAKBANK":  ["Kotak Mahindra Bank", "Kotak Bank"],
    "LT":         ["Larsen & Toubro", "Larsen and Toubro", "L&T"],
    "AXISBANK":   ["Axis Bank"],
    "BAJFINANCE": ["Bajaj Finance"],
    "BAJAJFINSV": ["Bajaj Finserv"],
    "MARUTI":     ["Maruti Suzuki"],
    "ASIANPAINT": ["Asian Paints"],
    "HCLTECH":    ["HCL Technologies", "HCL Tech"],
    "WIPRO":      ["Wipro"],
    "TECHM":      ["Tech Mahindra"],
    "ONGC":       ["Oil and Natural Gas Corp", "ONGC"],
    "NTPC":       ["NTPC Ltd"],
    "POWERGRID":  ["Power Grid Corp", "PowerGrid"],
    "COALINDIA":  ["Coal India"],
    "M&M":        ["Mahindra & Mahindra", "Mahindra and Mahindra"],
    "TATAMOTORS": ["Tata Motors"],
    "SUNPHARMA":  ["Sun Pharma", "Sun Pharmaceutical"],
    "ULTRACEMCO": ["UltraTech Cement"],
    "NESTLEIND":  ["Nestle India"],
    "TITAN":      ["Titan Company"],
    "ADANIENT":   ["Adani Enterprises"],
    "ADANIPORTS": ["Adani Ports", "APSEZ"],
    "DRREDDY":    ["Dr Reddy", "Dr. Reddy", "Dr Reddys"],
    "CIPLA":      ["Cipla"],
    "EICHERMOT":  ["Eicher Motors"],
    "GRASIM":     ["Grasim Industries"],
    "HEROMOTOCO": ["Hero MotoCorp", "Hero Honda"],
    "INDUSINDBK": ["IndusInd Bank"],
    "JSWSTEEL":   ["JSW Steel"],
    "TATASTEEL":  ["Tata Steel"],
    "HINDALCO":   ["Hindalco Industries", "Hindalco"],
    "BRITANNIA":  ["Britannia Industries", "Britannia"],
    "BAJAJ-AUTO": ["Bajaj Auto"],
    "DIVISLAB":   ["Divi''s Laboratories", "Divis Labs"],
    "APOLLOHOSP": ["Apollo Hospitals"],
    "SHRIRAMFIN": ["Shriram Finance"],
    "TATACONSUM": ["Tata Consumer Products", "Tata Consumer"],
    "ADANIGREEN": ["Adani Green"],
    "ADANITRANS": ["Adani Transmission"],
    "ADANIPOWER": ["Adani Power"],
    "ADANITOTAL": ["Adani Total Gas"],
    "BPCL":       ["Bharat Petroleum", "BPCL"],
    "IOC":        ["Indian Oil"]
  }'::jsonb;
  v_symbol   text;
  v_aliases_arr text[];
  v_alias    text;
  v_matched  text[] := ARRAY[]::text[];
  v_pattern  text;
BEGIN
  IF p_title IS NULL OR length(p_title) = 0 THEN
    RETURN v_matched;
  END IF;

  FOR v_symbol, v_aliases_arr IN
    SELECT key, ARRAY(SELECT jsonb_array_elements_text(value)) FROM jsonb_each(v_aliases)
  LOOP
    FOREACH v_alias IN ARRAY v_aliases_arr LOOP
      -- Word-boundary, case-insensitive match. Escape regex specials by
      -- substituting \& semantics; for the alias content here we just
      -- need to handle "." and "&" — replace_all keeps it readable.
      v_pattern := '\m' ||
                   regexp_replace(v_alias, '([.&()*+?[\]^$|\\])', E'\\\\\\1', 'g') ||
                   '\M';
      IF p_title ~* v_pattern THEN
        v_matched := array_append(v_matched, v_symbol);
        EXIT;  -- one alias hit is enough per symbol
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_matched;
END;
$$;

COMMENT ON FUNCTION markets.tag_news_event_with_aliases(text) IS
  'Match a news headline against NIFTY-50 common-name aliases, returning ticker symbols. Used by the markets-enrich-news edge function (follow-up to be retrofitted) and one-time backfills.';

-- One-time backfill: merge the alias matches into instruments[] for every
-- news_events row from the last 90 days that has either no instruments
-- tagged OR is missing aliases we now recognise. Unions with existing
-- instruments so we never drop tags that the previous tagger or an LLM
-- already set.

WITH candidates AS (
  SELECT id, title, instruments AS old_inst,
         markets.tag_news_event_with_aliases(title) AS alias_inst
  FROM markets.news_events
  WHERE ts >= now() - interval '90 days'
),
to_update AS (
  SELECT id,
         ARRAY(
           SELECT DISTINCT unnest(COALESCE(old_inst, ARRAY[]::text[]) || alias_inst)
         ) AS new_inst
  FROM candidates
  WHERE array_length(alias_inst, 1) > 0
)
UPDATE markets.news_events n
SET    instruments = u.new_inst
FROM   to_update u
WHERE  n.id = u.id
  AND  (n.instruments IS DISTINCT FROM u.new_inst);
