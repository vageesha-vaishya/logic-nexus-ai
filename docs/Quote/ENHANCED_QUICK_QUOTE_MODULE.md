# Enhanced Quick Quote Module Documentation

## 1. Overview
The Enhanced Quick Quote Module is a high-performance, AI-driven quotation system designed to provide logistics professionals with instant, multi-modal freight estimates. It combines legacy rate engine lookups with Generative AI (OpenAI GPT-4o) to offer a comprehensive view of the market, including predictive pricing, route optimization, and risk analysis.

## 2. Key Features

### 2.1 Multi-Source Quote Generation
- **Hybrid Architecture**: Simultaneously fetches "Standard" rates from the internal database (via `rate-engine`) and "Smart" quotes from the AI Advisor.
- **Parallel Processing**: Uses `Promise.all` to ensure minimal latency, defaulting to standard rates if AI services are unavailable.

### 2.2 AI-Powered Smart Quotes
- **Market Analysis**: AI analyzes the trade lane (e.g., Shanghai -> LA) to identify trends, congestion risks, and weather impacts.
- **Strategic Tiers**: Generates 5 distinct options:
  - **Best Value**: Optimal balance of cost and speed.
  - **Cheapest**: Lowest cost, potentially longer transit.
  - **Fastest**: Priority air or express ocean services.
  - **Greenest**: Low carbon footprint options (e.g., slow steaming, rail).
  - **Most Reliable**: Carriers with high on-time performance.
- **Anomaly Detection**: Flags prices that deviate significantly from historical averages.

### 2.3 Multi-Modal Routing Visualization
- **Visual Legs**: Displays the full journey chain (e.g., Factory -> Truck -> Port -> Ocean -> Port -> Truck -> Warehouse).
- **Leg Details**: Tooltips provide specific mode, carrier, and transit time for each leg of the journey.

### 2.4 Comparison & List Views
- **List View**: Standard card-based layout for quick scanning.
- **Comparison View**: Side-by-side table view to compare:
  - Total Cost
  - Transit Time
  - Reliability Scores
  - CO2 Emissions
  - AI Explanations

## 3. Technical Architecture

### 3.1 Frontend Components
- `QuickQuoteModal.tsx`: Main container managing form state, API orchestration, and view switching.
- `QuoteResultsList.tsx`: Renders the card-based list view with "Legs Visualizer".
- `QuoteComparisonView.tsx`: Renders the comparison table.
- `QuoteLegsVisualizer.tsx`: Reusable component for drawing the multi-modal route chain.

### 3.2 Backend (Supabase Edge Functions)
- **`rate-engine`**:
  - Connects to `carrier_rates` table.
  - Performs deterministic lookups based on origin/destination/mode.
- **`ai-advisor`**:
  - **Action**: `generate_smart_quotes`
  - **Model**: OpenAI GPT-4o
  - **Logic**:
    1. Receives shipment payload.
    2. Injects historical context (mocked or DB-fetched).
    3. Prompts LLM to generate valid JSON structure with 5 strategic options.
    4. Validates output and returns structured data + market analysis text.

## 4. Usage Guide

1. **Access**: Open the "Quick Quote" modal from the dashboard or Quotes module.
2. **Input**:
   - Select Mode (Air/Ocean/Road).
   - Enter Origin/Destination (supports code lookup).
   - Enter Cargo Details (Commodity, Weight, Volume).
3. **Generate**:
   - Toggle "Include AI Market Analysis" to enable Smart features.
   - Click "Generate Comprehensive Quotes".
4. **Analyze**:
   - Review the "Market Analysis" card for risks.
   - Use "Compare" tab to see options side-by-side.
   - Hover over route icons to see leg details.
5. **Convert**: Click "Select Quote" or "Convert to Quote" to promote the estimate to a full Quotation record.

## 5. Future Roadmap
- **Real-time API Integration**: Connect directly to Maersk/Hapag-Lloyd APIs via `rate-engine`.
- **User Feedback Loop**: Allow users to "Rate" AI suggestions to fine-tune the model.
- **Cached Scenarios**: Store common lane queries in Redis/Supabase for sub-second responses.
