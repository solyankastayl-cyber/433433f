"""
Compression Model

Predicts breakout direction from compression patterns.
Triangles, wedges, pennants → anticipate breakout.
"""

from typing import Dict, Any, Tuple


def predict_compression(inp: Dict[str, Any]) -> Tuple[str, float, float]:
    """
    Predict for compression/consolidation market.
    
    Args:
        inp: Prediction input with price, pattern, indicators
    
    Returns:
        (direction, target_price, confidence)
    """
    price = float(inp.get("price", 0))
    pattern = inp.get("pattern", {})
    indicators = inp.get("indicators", {})
    structure = inp.get("structure", {})
    
    # Pattern signals
    pattern_type = pattern.get("type", "none")
    pattern_dir = pattern.get("direction", "neutral")
    pattern_conf = float(pattern.get("confidence", 0.5))
    
    # Momentum (often breaks in momentum direction)
    momentum = float(indicators.get("momentum", 0))
    
    # Prior trend (continuation bias)
    prior_trend = structure.get("trend", "flat")
    
    # === DIRECTION LOGIC ===
    
    # 1. Pattern direction is primary signal
    if pattern_dir in ("bullish", "bearish"):
        direction = pattern_dir
    
    # 2. Ascending triangle → bullish, Descending → bearish
    elif pattern_type in ("ascending_triangle", "rising_wedge"):
        direction = "bullish"
    elif pattern_type in ("descending_triangle", "falling_wedge"):
        direction = "bearish"
    
    # 3. Symmetrical → use momentum
    elif pattern_type in ("symmetrical_triangle", "pennant"):
        if momentum > 0.2:
            direction = "bullish"
        elif momentum < -0.2:
            direction = "bearish"
        else:
            # Continuation bias
            direction = "bullish" if prior_trend == "up" else (
                "bearish" if prior_trend == "down" else "neutral"
            )
    
    # 4. Fallback to momentum
    else:
        if momentum > 0.3:
            direction = "bullish"
        elif momentum < -0.3:
            direction = "bearish"
        else:
            direction = "neutral"
    
    # === TARGET CALCULATION ===
    # Compression breakouts can be explosive: 4-15%
    base_move = 0.04 + pattern_conf * 0.10
    
    # Tighter compression → bigger move
    volatility = float(indicators.get("volatility_score", 0.5))
    if volatility < 0.3:  # Very tight
        base_move *= 1.3
    
    # Cap at 15%
    total_move = min(base_move, 0.15)
    
    if direction == "bullish":
        target = price * (1 + total_move)
    elif direction == "bearish":
        target = price * (1 - total_move)
    else:
        target = price
    
    # === CONFIDENCE ===
    # Base: pattern confidence scaled
    base_conf = 0.45 + pattern_conf * 0.35
    
    # Momentum alignment boost
    if (direction == "bullish" and momentum > 0) or \
       (direction == "bearish" and momentum < 0):
        base_conf += 0.05
    
    # Clear pattern type boost
    if pattern_type in ("ascending_triangle", "descending_triangle", 
                        "symmetrical_triangle", "pennant", "wedge"):
        base_conf += 0.05
    
    confidence = max(0.40, min(base_conf, 0.85))
    
    return direction, target, confidence
