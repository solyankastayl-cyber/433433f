"""
Regime Detector

Detects market regime with hysteresis to prevent jumping between states.

Regimes:
- trend: Strong directional movement
- range: Price oscillating between support/resistance
- compression: Tightening volatility, potential breakout
- high_volatility: Extreme price swings
"""

from typing import Dict, Any, Optional


def detect_regime(ta: Dict[str, Any], prev_regime: Optional[str] = None) -> str:
    """
    Detect market regime from TA output with hysteresis.
    
    Args:
        ta: TA payload with indicators, structure, pattern
        prev_regime: Previous regime (for hysteresis)
    
    Returns:
        Regime string: "trend", "range", "compression", "high_volatility"
    """
    indicators = ta.get("indicators", {})
    structure = ta.get("structure", {})
    pattern = ta.get("pattern", {})
    
    # Extract key metrics
    trend_strength = float(indicators.get("trend_strength", 0))
    volatility_score = float(indicators.get("volatility_score", 0))
    momentum = abs(float(indicators.get("momentum", 0)))
    
    # Structure state
    state = structure.get("state", "range")  # trend, range, compression
    trend_dir = structure.get("trend", "flat")  # up, down, flat
    
    # Pattern info
    pattern_type = pattern.get("type", "none")
    pattern_conf = float(pattern.get("confidence", 0))
    
    # === REGIME DETECTION LOGIC ===
    
    # 1. High volatility takes priority (market stress)
    if volatility_score > 0.7 or momentum > 0.8:
        regime = "high_volatility"
    
    # 2. Compression patterns (triangles, wedges)
    elif state == "compression" or pattern_type in [
        "symmetrical_triangle", "ascending_triangle", "descending_triangle",
        "wedge", "pennant", "tight_range"
    ]:
        regime = "compression"
    
    # 3. Strong trend
    elif trend_strength > 0.6 or state == "trend":
        regime = "trend"
    
    # 4. Default to range
    else:
        regime = "range"
    
    # === HYSTERESIS (prevent regime jumping) ===
    if prev_regime and regime != prev_regime:
        # Stay in trend if still moderately strong
        if prev_regime == "trend" and trend_strength > 0.50:
            return "trend"
        
        # Stay in range if trend not clearly established
        if prev_regime == "range" and trend_strength < 0.65:
            return "range"
        
        # Stay in compression if pattern still holds
        if prev_regime == "compression" and pattern_conf > 0.5:
            return "compression"
        
        # Exit high_volatility only when clearly calmed
        if prev_regime == "high_volatility" and (volatility_score > 0.5 or momentum > 0.5):
            return "high_volatility"
    
    return regime


def get_regime_confidence(ta: Dict[str, Any], regime: str) -> float:
    """
    Calculate confidence in detected regime.
    
    Returns 0.0-1.0 confidence score.
    """
    indicators = ta.get("indicators", {})
    structure = ta.get("structure", {})
    
    trend_strength = float(indicators.get("trend_strength", 0))
    volatility_score = float(indicators.get("volatility_score", 0))
    state = structure.get("state", "range")
    
    if regime == "trend":
        # Higher trend strength = higher confidence
        return min(0.4 + trend_strength * 0.6, 0.95)
    
    elif regime == "range":
        # Range confidence = inverse of trend strength
        return min(0.5 + (1 - trend_strength) * 0.4, 0.85)
    
    elif regime == "compression":
        # Based on pattern confidence
        pattern_conf = float(ta.get("pattern", {}).get("confidence", 0.5))
        return min(0.4 + pattern_conf * 0.5, 0.9)
    
    elif regime == "high_volatility":
        # Higher volatility = higher confidence
        return min(0.5 + volatility_score * 0.4, 0.95)
    
    return 0.5


def regime_to_model_name(regime: str) -> str:
    """Map regime to model name for tracking."""
    return {
        "trend": "trend_momentum_v1",
        "range": "range_mean_reversion_v1",
        "compression": "compression_breakout_v1",
        "high_volatility": "high_vol_momentum_v1",
    }.get(regime, "fallback_v1")
