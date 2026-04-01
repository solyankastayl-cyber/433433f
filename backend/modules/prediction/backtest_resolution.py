"""
Backtest Resolution

Resolves predictions against future candles (NO LEAKAGE).

CRITICAL RULE:
- Prediction sees ONLY candles BEFORE anchor_time
- Resolution uses ONLY candles AFTER anchor_time
"""

from typing import Dict, Any, List


def resolve_on_future(
    pred: Dict[str, Any],
    future_candles: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Resolve prediction using only future candles.
    
    Args:
        pred: Prediction payload with direction, target
        future_candles: Candles AFTER anchor_time (no leakage!)
    
    Returns:
        Resolution dict with result, resolution_type, actual_price, error_pct
    """
    if not future_candles:
        return {
            "result": "wrong",
            "resolution_type": "no_future_data",
            "actual_price": 0,
            "error_pct": 1.0
        }
    
    direction = pred.get("direction", {}).get("label", "neutral")
    target_info = pred.get("target", {})
    start = float(target_info.get("start_price", 0))
    target = float(target_info.get("target_price", 0))
    
    if start == 0 or target == 0:
        return {
            "result": "wrong",
            "resolution_type": "invalid_prediction",
            "actual_price": 0,
            "error_pct": 1.0
        }
    
    hit_target = False
    hit_invalidation = False
    final_price = float(future_candles[-1].get("close", start))
    
    # Walk through future candles
    for candle in future_candles:
        high = float(candle.get("high", 0))
        low = float(candle.get("low", 0))
        
        if direction == "bullish":
            # Check target hit (price went up to target)
            if high >= target:
                hit_target = True
                final_price = target
                break
            # Check invalidation (price dropped >3% below start)
            if low < start * 0.97:
                hit_invalidation = True
                final_price = low
                break
        
        elif direction == "bearish":
            # Check target hit (price went down to target)
            if low <= target:
                hit_target = True
                final_price = target
                break
            # Check invalidation (price rose >3% above start)
            if high > start * 1.03:
                hit_invalidation = True
                final_price = high
                break
    
    # Calculate error
    error_pct = abs(final_price - target) / target if target else 1.0
    
    # Determine result
    if hit_target:
        return {
            "result": "correct",
            "resolution_type": "target_hit",
            "actual_price": round(final_price, 2),
            "error_pct": round(error_pct, 4)
        }
    
    if hit_invalidation:
        return {
            "result": "wrong",
            "resolution_type": "wrong_early",
            "actual_price": round(final_price, 2),
            "error_pct": round(error_pct, 4)
        }
    
    # Horizon expired - check if direction was right
    if direction == "bullish":
        direction_ok = final_price >= start
        # Calculate how much of the expected move was achieved
        expected_move = target - start
        actual_move = final_price - start
        move_pct = actual_move / expected_move if expected_move != 0 else 0
    elif direction == "bearish":
        direction_ok = final_price <= start
        expected_move = start - target
        actual_move = start - final_price
        move_pct = actual_move / expected_move if expected_move != 0 else 0
    else:
        direction_ok = False
        move_pct = 0
    
    # Partial: direction was right AND achieved at least 30% of expected move
    if direction_ok and move_pct >= 0.3:
        result = "partial"
    elif direction_ok:
        # Direction was right but move was minimal
        result = "partial" if move_pct >= 0.1 else "wrong"
    else:
        result = "wrong"
    
    return {
        "result": result,
        "resolution_type": "horizon_expired",
        "actual_price": round(final_price, 2),
        "error_pct": round(error_pct, 4),
        "move_achieved_pct": round(move_pct, 3)
    }
