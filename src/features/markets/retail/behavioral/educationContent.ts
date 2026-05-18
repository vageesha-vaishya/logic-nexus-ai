// src/features/markets/retail/behavioral/educationContent.ts
import type { EducationContent, EducationId } from './types';

export const EDUCATION_CONTENT: Record<EducationId, EducationContent> = {
  high_conviction_signal: {
    id: 'high_conviction_signal',
    title: 'High Conviction — what does it mean?',
    beginner:
      'This pick has been right more often than most — but nothing is ever guaranteed. Only invest what you can afford to lose.',
    casual:
      "High Conviction signals have historically been right ~68% of the time. That means 32% of the time they were wrong. Past performance doesn't guarantee future results.",
    self_directed:
      'Historical accuracy ~68% over 847 signals (2 years), 32% failure rate. Confidence interval: 65–71%. Always validate with your own analysis. Position-size to risk, not conviction.',
  },
  first_stop_loss: {
    id: 'first_stop_loss',
    title: 'What is a stop-loss?',
    beginner:
      "A stop-loss automatically sells if the price falls to your level. It limits losses — but won't protect against very fast overnight drops.",
    casual:
      'Stop-losses are exchange-side GTT orders — they survive even if your app is offline. Gap risk: if news hits overnight and the stock opens below your stop, you\'ll sell at the open price, not your stop price.',
    self_directed:
      'GTT stops are exchange-side. Gap risk: price may open through your stop on bad news — fill occurs at open price, not stop. For high-risk names consider a hard floor stop below the GTT to cap gap exposure.',
  },
  fo_enable: {
    id: 'fo_enable',
    title: 'F&O carries higher risk',
    beginner:
      'Options and futures can lose value quickly — even to zero. They are complex instruments best suited for experienced investors.',
    casual:
      'F&O involves leverage. Your maximum loss on options is the premium paid. Futures carry unlimited loss risk. Time decay (theta) erodes option value every day.',
    self_directed:
      'Check IV rank before entry. High IV → consider selling premium. Low IV → consider buying. PCR and max pain are sentiment indicators, not price predictors. Manage expiry risk explicitly.',
  },
  concentration_warning: {
    id: 'concentration_warning',
    title: 'Concentration risk',
    beginner:
      'Your portfolio has a lot in one stock. If that company has problems, it could significantly hurt your returns.',
    casual:
      'Diversified portfolios typically keep no single stock above 10%. High concentration means company-specific risk dominates your portfolio returns.',
    self_directed:
      'Single-stock concentration >40% implies idiosyncratic risk exceeds systematic risk. Consider reducing to <15% per name. Factor correlation with other holdings before sizing.',
  },
  first_intraday: {
    id: 'first_intraday',
    title: 'Intraday means sell today',
    beginner:
      'Intraday trades must be closed before 3:30 PM today. If you forget, your broker will auto-close at market price — which may not be favourable.',
    casual:
      'Intraday positions are auto-squared off between 3:15–3:30 PM at whatever price the market is at. Set a reminder. Slippage on forced squareoffs can be significant.',
    self_directed:
      'Brokers squareoff at ~3:20 PM via market orders. On volatile days, impact cost can be 0.3–1.5%. Factor this into your intraday P&L calculation. Use time-based exit rules.',
  },
  high_vix_execution: {
    id: 'high_vix_execution',
    title: 'High volatility right now',
    beginner:
      'Markets are moving fast today. Your order might fill at a very different price than shown. Consider waiting for calmer conditions.',
    casual:
      'India VIX is elevated — bid-ask spreads are wider and prices are moving quickly. Use limit orders instead of market orders to control your fill price.',
    self_directed:
      'Elevated VIX correlates with wider spreads and higher slippage. Consider reducing position size by 20–30% to maintain consistent risk in vol-adjusted terms. Avoid market orders.',
  },
  mf_comparison: {
    id: 'mf_comparison',
    title: 'Expense ratio compounds',
    beginner:
      'Even small differences in fees add up over time. A fund that costs less often beats one that costs more — even if returns look similar today.',
    casual:
      'A 1.3% difference in expense ratio on ₹1 lakh over 20 years at 12% CAGR costs ~₹47,000 in foregone returns. Direct plans of the same fund save 0.5–1.5% annually versus regular plans.',
    self_directed:
      'Expense ratio drag compounds over N years: (1/(1+ER))^N vs (1/(1+ER_low))^N. For a 20-year horizon, 1.5% vs 0.3% ER is a ~29% total return differential on principal.',
  },
  first_sip: {
    id: 'first_sip',
    title: 'How SIP works',
    beginner:
      'A SIP invests the same amount every month, no matter what markets are doing. When prices fall, you buy more units — this helps smooth out ups and downs over time.',
    casual:
      'SIP uses rupee cost averaging: fixed amount ÷ NAV = units purchased. In bear markets you accumulate more units at lower NAV. The benefit is psychological discipline as much as mathematical.',
    self_directed:
      'Rupee cost averaging outperforms lump sum in sideways/bearish markets and slightly underperforms in persistent bull markets. For long-duration goals (>7 years), SIP XIRR typically converges to CAGR of the underlying fund.',
  },
  approaching_trade_limit: {
    id: 'approaching_trade_limit',
    title: 'Tax classification warning',
    beginner:
      'Trading very frequently might mean your gains are taxed differently — and more heavily. Consider slowing down.',
    casual:
      'More than 20–30 trades/month may lead the tax department to classify gains as business income (taxed at up to 30%) rather than capital gains (STCG 20%, LTCG 12.5%).',
    self_directed:
      'IT Dept classifies frequent equity trading (intent to profit from price movements) as business income. No fixed threshold — intent, frequency, and volume are assessed together. Keep detailed records.',
  },
  green_day_check: {
    id: 'green_day_check',
    title: 'Stay the course',
    beginner:
      'Great day! Long-term investors who stay invested through ups and downs tend to do better than those who try to time the market.',
    casual:
      'Single-day gains feel great but rarely predict tomorrow. Missing the 10 best days in a 20-year period can halve your total returns. Staying invested matters more than timing.',
    self_directed:
      'JP Morgan data: missing 10 best days in 20 years (S&P) cuts returns from ~9.5% to ~5% CAGR. Indian equity shows similar patterns. Resist recency bias after green days.',
  },
  enable_autonomous: {
    id: 'enable_autonomous',
    title: 'Before enabling automation',
    beginner:
      'Automation means the system can place trades for you. Make sure you understand your stop-loss levels and have tested it in paper trading first.',
    casual:
      'Autonomous execution runs pre-defined rules — no AI guesses. The kill switch (in Settings → Risk Controls) stops everything immediately if something goes wrong. Test it before going live.',
    self_directed:
      'Mandatory paper trading: 30 days minimum before Micro-Live. All autonomous orders tagged with Algo-ID (SEBI requirement). Tax: >20–30 trades/month risks business income classification.',
  },
  low_liquidity: {
    id: 'low_liquidity',
    title: 'Low liquidity warning',
    beginner:
      "This stock doesn't trade much. It may be hard to buy or sell at the price shown.",
    casual:
      'Low daily volume means your order could move the price against you. Spread between buy/sell price may be wide. Consider whether you can exit when needed.',
    self_directed:
      'Your order is a significant % of daily volume — expect market impact cost. Liquidity risk: exit may require multiple days or significant price concession. Use limit orders and break into smaller tranches.',
  },
};
