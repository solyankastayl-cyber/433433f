"""
Trend Model

Predicts continuation in strong directional markets.
Uses trend strength and momentum to size position.
"""

from typing import Dict, Any, Tuple


def predict_trend(inp: Dict[str, Any]) -> Tuple[str, float, float]:
    """
    Predict for trending market.
    
    Args:
        inp: Prediction input with price, structure, indicators
    
    Returns:
        (direction, target_price, confidence)
    """
    price = float(inp.get("price", 0))
    structure = inp.get("structure", {})
    indicators = inp.get("indicators", {})
    pattern = inp.get("pattern", {})
    
    # Key metrics
    trend = structure.get("trend", "flat")  # up, down, flat
    trend_strength = float(indicators.get("trend_strength", 0))
    momentum = float(indicators.get("momentum", 0))
    
    # Pattern can reinforce or counter trend
    pattern_dir = pattern.get("direction", "neutral")
    pattern_conf = float(pattern.get("confidence", 0))
    
    # === DIRECTION LOGIC ===
    if trend == "up":
        direction = "bullish"
    elif trend == "down":
        direction = "bearish"
    else:
        # Flat trend - prioritize pattern, then momentum
        if pattern_dir in ("bullish", "bearish") and pattern_conf > 0.5:
            direction = pattern_dir
        elif momentum > 0.2:
            direction = "bullish"
        elif momentum < -0.2:
            direction = "bearish"
        else:
            # Last resort: use pattern even with lower confidence
            direction = pattern_dir if pattern_dir != "neutral" else "neutral"
    
    # === TARGET CALCULATION ===
    # Base move: 3-12% depending on strength
    base_move = 0.03 + trend_strength * 0.07
    
    # Momentum boost
    momentum_boost = min(abs(momentum) * 0.02, 0.03)
    
    # Pattern confidence boost
    if pattern_dir == direction and pattern_conf > 0.6:
        base_move += 0.02
    
    # Total move (capped at 12%)
    total_move = min(base_move + momentum_boost, 0.12)
    
    if direction == "bullish":
        target = price * (1 + total_move)
    elif direction == "bearish":
        target = price * (1 - total_move)
    else:
        target = price
    
    # === CONFIDENCE ===
    # Base: 55-85% depending on trend strength
    base_conf = 0.55 + trend_strength * 0.30
    
    # Momentum alignment boost
    if (direction == "bullish" and momentum > 0) or \
       (direction == "bearish" and momentum < 0):
        base_conf += min(abs(momentum) * 0.1, 0.05)
    
    # Pattern alignment penalty
    if pattern_dir != "neutral" and pattern_dir != direction:
        base_conf -= pattern_conf * 0.1
    
    confidence = max(0.45, min(base_conf, 0.85))
    
    return direction, target, confidence
