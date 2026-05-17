/**
 * NSE Sector Mapping — static lookup table for portfolio sector allocation.
 * Maps NSE instrument symbols to sector names and provides Nifty 50
 * benchmark sector weights for over/under-weight comparison.
 */

export const NSE_SECTOR_MAP: Record<string, string> = {
  // Financial Services
  HDFCBANK: "Financial Services", ICICIBANK: "Financial Services", KOTAKBANK: "Financial Services",
  SBIN: "Financial Services", AXISBANK: "Financial Services", BAJFINANCE: "Financial Services",
  BAJAJFINSV: "Financial Services", HDFCLIFE: "Financial Services", SBILIFE: "Financial Services",
  ICICIGI: "Financial Services", SHRIRAMFIN: "Financial Services", CHOLAFIN: "Financial Services",
  // IT
  TCS: "Information Technology", INFY: "Information Technology", WIPRO: "Information Technology",
  HCLTECH: "Information Technology", TECHM: "Information Technology", LTIM: "Information Technology",
  MPHASIS: "Information Technology", COFORGE: "Information Technology", PERSISTENT: "Information Technology",
  // Energy
  RELIANCE: "Energy", ONGC: "Energy", NTPC: "Energy", POWERGRID: "Energy", BPCL: "Energy",
  IOC: "Energy", GAIL: "Energy", TATAPOWER: "Energy", ADANIGREEN: "Energy", ADANIPORTS: "Energy",
  // Consumer
  ITC: "Consumer Staples", HINDUNILVR: "Consumer Staples", NESTLEIND: "Consumer Staples",
  BRITANNIA: "Consumer Staples", DABUR: "Consumer Staples", MARICO: "Consumer Staples",
  // Auto
  MARUTI: "Automobile", MM: "Automobile", TATAMOTORS: "Automobile", BAJAJ_AUTO: "Automobile",
  HEROMOTOCO: "Automobile", EICHERMOT: "Automobile", ASHOKLEY: "Automobile",
  // Healthcare
  SUNPHARMA: "Healthcare", DRREDDY: "Healthcare", CIPLA: "Healthcare", APOLLOHOSP: "Healthcare",
  DIVISLAB: "Healthcare", AUROPHARMA: "Healthcare", TORNTPHARM: "Healthcare",
  // Metals & Mining
  TATASTEEL: "Metals & Mining", JSWSTEEL: "Metals & Mining", HINDALCO: "Metals & Mining",
  VEDL: "Metals & Mining", COALINDIA: "Metals & Mining", NMDC: "Metals & Mining",
  // Telecom
  BHARTIARTL: "Telecom", IDEA: "Telecom",
  // Cement
  ULTRACEMCO: "Cement", SHREECEM: "Cement", AMBUJACEM: "Cement", ACC: "Cement",
  // Consumer Discretionary
  TITAN: "Consumer Discretionary", ASIANPAINT: "Consumer Discretionary", PIDILITIND: "Consumer Discretionary",
  DMART: "Consumer Discretionary", TRENT: "Consumer Discretionary", HAVELLS: "Consumer Discretionary",
  // Infrastructure / Capital Goods
  LT: "Capital Goods", SIEMENS: "Capital Goods", ABB: "Capital Goods", BHEL: "Capital Goods",
  // Others
  ZOMATO: "Consumer Internet", NYKAA: "Consumer Internet", POLICYBZR: "Consumer Internet",
};

export function getSector(symbol: string): string {
  return NSE_SECTOR_MAP[symbol.toUpperCase()] ?? "Other";
}

// Nifty 50 sector weights (approximate, for benchmark comparison)
export const NIFTY50_SECTOR_WEIGHTS: Record<string, number> = {
  "Financial Services": 33.5,
  "Information Technology": 13.8,
  "Energy": 12.1,
  "Consumer Staples": 7.5,
  "Automobile": 6.8,
  "Healthcare": 5.2,
  "Metals & Mining": 4.8,
  "Telecom": 4.1,
  "Cement": 2.5,
  "Consumer Discretionary": 6.2,
  "Capital Goods": 3.5,
};
