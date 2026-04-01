"""
Backtest Runner

Core engine for running historical backtests.

CRITICAL: Prediction sees ONLY past candles, resolution uses ONLY future candles.
"""

from typing import Dict, Any, List, Callable
import time

from .backtest_resolution import resolve_on_future


def run_backtest(
    symbol: str,
    timeframe: str,
    candles: List[Dict[str, Any]],
    ta_builder: Callable,
    prediction_builder: Callable,
    step: int = 2,
    horizon_bars: int = 10,
    min_history: int = 100
) -> List[Dict[str, Any]]:
    """
    Run backtest over historical candles.
    
    Args:
        symbol: Asset symbol
        timeframe: Timeframe (4H, 1D)
        candles: Full historical candle data (oldest first)
        ta_builder: Function(candles, symbol, tf) -> TA payload
        prediction_builder: Function(ta_input) -> Prediction payload
        step: How many candles to skip between predictions
        horizon_bars: How many future candles to use for resolution
        min_history: Minimum candles before first prediction
    
    Returns:
        List of backtest results
    """
    results = []
    total_candles = len(candles)
    
    if total_candles < min_history + horizon_bars:
        print(f"[Backtest] Not enough candles: {total_candles} < {min_history + horizon_bars}")
        return results
    
    # Walk through history
    for i in range(min_history, total_candles - horizon_bars, step):
        try:
            # CRITICAL: Only see PAST candles
            visible_candles = candles[:i+1]
            
            # Build TA from visible history only
            ta = ta_builder(visible_candles, symbol, timeframe)
            
            # Build prediction input
            pred_input = _adapt_ta_to_prediction_input(ta, symbol, timeframe)
            
            # Build prediction
            pred = prediction_builder(pred_input)
            
            # Skip neutral predictions (no meaningful target)
            direction = pred.get("direction", {}).get("label", "neutral")
            if direction == "neutral":
                continue
            
            # Skip predictions with no expected return
            expected_return = pred.get("target", {}).get("expected_return", 0)
            if abs(expected_return) < 0.01:  # Less than 1%
                continue
            
            # CRITICAL: Only use FUTURE candles for resolution
            future_candles = candles[i+1:i+1+horizon_bars]
            
            # Resolve prediction
            resolution = resolve_on_future(pred, future_candles)
            
            # Get anchor time from last visible candle
            anchor_time = visible_candles[-1].get("time", int(time.time()))
            
            results.append({
                "symbol": symbol,
                "timeframe": timeframe,
                "mode": "historical_backtest",
                "anchor_time": anchor_time,
                "regime": pred.get("regime", "unknown"),
                "model": pred.get("model", "unknown"),
                "prediction_payload": pred,
                "resolution": resolution,
            })
            
        except Exception as e:
            print(f"[Backtest] Error at index {i}: {e}")
            continue
    
    return results


def _adapt_ta_to_prediction_input(
    ta: Dict[str, Any],
    symbol: str,
    timeframe: str
) -> Dict[str, Any]:
    """Convert TA output to prediction input format."""
    # TA uses 'current_price', not 'price'
    price = ta.get("price") or ta.get("current_price", 0)
    
    # Build structure dict from TA output
    structure_state = ta.get("structure_state", {})
    structure = {
        "state": structure_state.get("regime", "range"),
        "trend": structure_state.get("bias", "flat"),  # bias maps to trend
        "trend_strength": abs(float(structure_state.get("trend_strength", 0))),
        "levels": {},
    }
    
    # Map bias to trend direction
    bias = structure_state.get("bias", "neutral")
    if bias == "bullish":
        structure["trend"] = "up"
    elif bias == "bearish":
        structure["trend"] = "down"
    else:
        structure["trend"] = "flat"
    
    # Build pattern dict from primary_pattern
    primary_pattern = ta.get("primary_pattern", {})
    pattern_render = ta.get("pattern_render_contract", {})
    
    if primary_pattern:
        pattern = {
            "type": primary_pattern.get("type", "none"),
            "direction": primary_pattern.get("direction", "neutral"),
            "confidence": float(primary_pattern.get("confidence", 0.5)),
            "bounds": primary_pattern.get("bounds", {}),
        }
    elif pattern_render:
        # Try pattern_render_contract
        pattern = {
            "type": pattern_render.get("type", "none"),
            "direction": pattern_render.get("direction", "neutral"),
            "confidence": float(pattern_render.get("confidence", 0.5)),
            "bounds": pattern_render.get("bounds", {}),
        }
    else:
        pattern = {
            "type": "none",
            "direction": "neutral",
            "confidence": 0.0,
        }
    
    # Build indicators dict
    ta_layers = ta.get("ta_layers", {})
    structure_state = ta.get("structure_state", {})
    
    # Calculate momentum from price change or use structure info
    candles = ta.get("candles", [])
    if candles and len(candles) >= 10:
        recent_close = float(candles[-1].get("close", 0))
        older_close = float(candles[-10].get("close", 0))
        momentum = (recent_close - older_close) / older_close if older_close else 0
    else:
        momentum = float(structure_state.get("trend_strength", 0))
    
    indicators = {
        "trend_strength": abs(float(structure_state.get("trend_strength", 0.5))),
        "momentum": momentum,
        "volatility_score": float(structure_state.get("compression_score", 0.5)),
    }
    
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "price": price,
        "structure": structure,
        "pattern": pattern,
        "indicators": indicators,
    }


def compute_horizon_bars(timeframe: str, horizon_days: int = 5) -> int:
    """
    Compute number of bars for horizon based on timeframe.
    
    Args:
        timeframe: "4H" or "1D"
        horizon_days: Default 5 days
    
    Returns:
        Number of bars
    """
    if timeframe == "4H":
        # 6 bars per day
        return horizon_days * 6
    elif timeframe == "1D":
        return horizon_days
    elif timeframe == "1H":
        return horizon_days * 24
    else:
        return horizon_days * 6  # Default to 4H
