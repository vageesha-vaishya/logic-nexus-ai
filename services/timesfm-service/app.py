from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

app = FastAPI(title="Forecast Service", version="0.1.0")

class SeriesPoint(BaseModel):
    timestamp: str
    value: float

class ForecastRequest(BaseModel):
    series: List[SeriesPoint]
    horizon: int = 14
    seasonality: Optional[int] = None  # e.g., 7 for weekly seasonality
    trend: Optional[str] = "add"
    seasonal: Optional[str] = "add"

class ForecastResponse(BaseModel):
    ok: bool
    forecast: List[float]
    timestamps: List[str]

@app.post("/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest):
    try:
        if not req.series or len(req.series) < 5:
            raise HTTPException(status_code=400, detail="Insufficient data points")
        df = pd.DataFrame([{"ds": p.timestamp, "y": p.value} for p in req.series])
        df["ds"] = pd.to_datetime(df["ds"])
        df = df.sort_values("ds")

        seasonal_periods = req.seasonality or 7
        model = ExponentialSmoothing(
            df["y"].astype(float),
            trend=req.trend,
            seasonal=req.seasonal,
            seasonal_periods=seasonal_periods,
            initialization_method="estimated",
        )
        fit = model.fit(optimized=True)
        pred = fit.forecast(req.horizon)

        last_ts = df["ds"].iloc[-1]
        freq = pd.infer_freq(df["ds"]) or "D"
        future_idx = pd.date_range(last_ts, periods=req.horizon + 1, freq=freq)[1:]

        return ForecastResponse(
            ok=True,
            forecast=[float(x) for x in pred.tolist()],
            timestamps=[str(ts) for ts in future_idx],
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
