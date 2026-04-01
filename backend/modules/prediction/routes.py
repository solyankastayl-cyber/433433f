"""
Prediction API Routes

REST API for Prediction Engine V2.
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime

from .prediction_engine import (
    get_prediction_engine,
    build_prediction_quick,
)
from .prediction_engine_v3 import (
    get_prediction_engine_v3,
    DriftUpdate,
)
from .ta_interpreter import build_input_from_raw
from .types import PredictionOutput


router = APIRouter(prefix="/api/prediction", tags=["prediction"])


@router.get("/health")
async def health():
    """Health check for prediction service."""
    return {
        "status": "ok",
        "service": "prediction_engine",
        "version": "v2",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/{symbol}")
async def get_prediction(
    symbol: str,
    timeframe: str = Query("1D", description="Timeframe: 4H, 1D, 7D, 1M"),
    price: Optional[float] = Query(None, description="Current price (optional, will fetch if not provided)"),
    pattern_type: str = Query("none", description="Pattern type: triangle, range, channel, none"),
    pattern_direction: str = Query("neutral", description="Pattern direction: bullish, bearish, neutral"),
    pattern_confidence: float = Query(0.5, description="Pattern confidence 0-1"),
    pattern_target: Optional[float] = Query(None, description="Pattern target price"),
    structure_state: str = Query("range", description="Structure: trend, range, compression, expansion"),
    structure_trend: str = Query("flat", description="Trend: up, down, flat"),
    trend_strength: float = Query(0.5, description="Trend strength 0-1"),
    momentum: float = Query(0.0, description="Momentum -1 to 1"),
    volatility: float = Query(0.3, description="Volatility 0-1"),
):
    """
    Generate prediction for a symbol.
    
    Can provide TA parameters directly, or they will use defaults.
    """
    symbol = symbol.upper()
    
    # Get price if not provided
    if price is None:
        price = await _fetch_current_price(symbol)
        if price is None:
            raise HTTPException(
                status_code=400,
                detail="Price not provided and could not be fetched"
            )
    
    try:
        prediction = build_prediction_quick(
            symbol=symbol,
            timeframe=timeframe,
            price=price,
            pattern_type=pattern_type,
            pattern_direction=pattern_direction,
            pattern_confidence=pattern_confidence,
            pattern_target=pattern_target,
            structure_state=structure_state,
            structure_trend=structure_trend,
            trend_strength=trend_strength,
            momentum=momentum,
            volatility=volatility,
        )
        
        return prediction.to_dict()
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{symbol}")
async def create_prediction(
    symbol: str,
    timeframe: str = "1D",
    price: float = None,
    pattern: dict = None,
    structure: dict = None,
    indicators: dict = None,
):
    """
    Create prediction from JSON body.
    
    Accepts full TA output structure.
    """
    symbol = symbol.upper()
    
    # Get price if not provided
    if price is None:
        price = await _fetch_current_price(symbol)
        if price is None:
            raise HTTPException(
                status_code=400,
                detail="Price not provided and could not be fetched"
            )
    
    # Build input from provided data
    pattern = pattern or {}
    structure = structure or {}
    indicators = indicators or {}
    
    try:
        input_obj = build_input_from_raw(
            symbol=symbol,
            timeframe=timeframe,
            price=price,
            pattern_type=pattern.get("type", "none"),
            pattern_direction=pattern.get("direction", "neutral"),
            pattern_confidence=pattern.get("confidence", 0.5),
            pattern_target=pattern.get("target_price"),
            structure_state=structure.get("state", "range"),
            structure_trend=structure.get("trend", "flat"),
            trend_strength=indicators.get("trend_strength", 0.5),
            momentum=indicators.get("momentum", 0.0),
            volatility=indicators.get("volatility", 0.3),
        )
        
        engine = get_prediction_engine()
        prediction = engine.predict(input_obj)
        
        return prediction.to_dict()
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/scenarios")
async def get_scenarios(
    symbol: str,
    timeframe: str = "1D",
):
    """
    Get cached prediction scenarios.
    
    Returns scenarios only if prediction was already generated.
    """
    symbol = symbol.upper()
    
    engine = get_prediction_engine()
    cached = engine.get_cached(symbol, timeframe)
    
    if cached is None:
        raise HTTPException(
            status_code=404,
            detail=f"No prediction cached for {symbol} {timeframe}"
        )
    
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "direction": cached.direction.label,
        "scenarios": {
            name: {
                "probability": round(s.probability, 4),
                "target_price": round(s.target_price, 2),
                "expected_return": round(s.expected_return, 4),
            }
            for name, s in cached.scenarios.items()
        }
    }


@router.get("/v3/{symbol}")
async def get_prediction_v3(
    symbol: str,
    timeframe: str = Query("1D", description="Timeframe: 4H, 1D, 7D, 1M"),
    price: Optional[float] = Query(None, description="Current price"),
    pattern_type: str = Query("none", description="Pattern type"),
    pattern_direction: str = Query("neutral", description="Pattern direction"),
    pattern_confidence: float = Query(0.5, description="Pattern confidence 0-1"),
    structure_state: str = Query("range", description="Structure"),
    structure_trend: str = Query("flat", description="Trend"),
    trend_strength: float = Query(0.5, description="Trend strength 0-1"),
    momentum: float = Query(0.0, description="Momentum -1 to 1"),
    volatility: float = Query(0.3, description="Volatility 0-1"),
):
    """
    Generate V3 prediction with drift tracking and self-correction.
    """
    symbol = symbol.upper()
    
    if price is None:
        price = await _fetch_current_price(symbol)
        if price is None:
            raise HTTPException(status_code=400, detail="Price required")
    
    try:
        input_obj = build_input_from_raw(
            symbol=symbol,
            timeframe=timeframe,
            price=price,
            pattern_type=pattern_type,
            pattern_direction=pattern_direction,
            pattern_confidence=pattern_confidence,
            structure_state=structure_state,
            structure_trend=structure_trend,
            trend_strength=trend_strength,
            momentum=momentum,
            volatility=volatility,
        )
        
        engine = get_prediction_engine_v3()
        prediction = engine.predict(input_obj)
        
        return prediction.to_dict()
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v3/{symbol}/drift")
async def check_drift(
    symbol: str,
    timeframe: str = "1D",
    current_price: float = None,
):
    """
    Check for prediction drift and update if needed.
    
    Call this periodically to keep predictions aligned with actual price.
    """
    symbol = symbol.upper()
    
    if current_price is None:
        current_price = await _fetch_current_price(symbol)
        if current_price is None:
            raise HTTPException(status_code=400, detail="Price required")
    
    try:
        engine = get_prediction_engine_v3()
        updated, drift = engine.update_with_drift(symbol, timeframe, current_price)
        
        result = {
            "symbol": symbol,
            "timeframe": timeframe,
            "current_price": current_price,
            "drift": {
                "needs_update": drift.needs_update,
                "deviation": round(drift.deviation, 4),
                "reason": drift.reason,
            }
        }
        
        if updated:
            result["updated_prediction"] = updated.to_dict()
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v3/{symbol}/history")
async def get_prediction_history(
    symbol: str,
    timeframe: str = "1D",
):
    """
    Get prediction version history.
    """
    symbol = symbol.upper()
    
    engine = get_prediction_engine_v3()
    history = engine.get_history(symbol, timeframe)
    
    if history is None:
        raise HTTPException(status_code=404, detail="No history found")
    
    return {
        "symbol": history.symbol,
        "timeframe": history.timeframe,
        "accuracy_score": round(history.accuracy_score, 4),
        "total_corrections": history.total_corrections,
        "versions": [
            {
                "version_id": v.version_id,
                "created_at": v.created_at.isoformat(),
                "trigger": v.trigger,
                "deviation_from_prev": round(v.deviation_from_prev, 4) if v.deviation_from_prev else None,
                "direction": v.prediction.direction.label,
                "target_price": round(v.prediction.scenarios["base"].target_price, 2),
            }
            for v in history.versions
        ],
        "current_version": history.current_version.version_id if history.current_version else None,
    }


async def _fetch_current_price(symbol: str) -> Optional[float]:
    """Fetch current price from candles collection."""
    try:
        from core.database import get_database
        db = get_database()
        if db is None:
            return None
        
        doc = db.candles.find_one(
            {"symbol": symbol},
            {"_id": 0, "close": 1},
            sort=[("timestamp", -1)]
        )
        
        if doc:
            return float(doc.get("close", 0))
        
        return None
    
    except Exception:
        return None


def register_routes(app):
    """Register prediction routes with FastAPI app."""
    app.include_router(router)
