"""
TA → Prediction Adapter

Connects the real TA Engine into the Scanner pipeline.

Pipeline:
    1. get_candles(symbol, tf) via MarketDataProvider
    2. per_tf_builder.build(candles) → full TA payload
    3. extract_ta_summary(ta_payload) → slim dict for prediction
    4. ta_interpreter.interpret_ta_output(summary) → PredictionInput
    5. prediction_engine.predict(input) → PredictionOutput
    6. output.to_dict() → prediction_payload

IMPORTANT: All functions are SYNC. No async anywhere.
"""

import time
from typing import Dict, Any, Optional, Tuple

from modules.scanner.market_data import get_market_data_provider


def build_real_ta(symbol: str, timeframe: str) -> Dict[str, Any]:
    """
    Build real TA payload for a symbol/timeframe.
    
    This replaces dummy_builders.build_dummy_ta().
    
    Args:
        symbol: Internal symbol (e.g., BTCUSDT)
        timeframe: System timeframe (e.g., 4H, 1D)
    
    Returns:
        TA payload dict with structure, pattern, indicators, price
    """
    start = time.time()
    
    # 1. Get candles from market data provider
    provider = get_market_data_provider()
    
    # Normalize symbol for internal use (BTC → BTCUSDT)
    internal_symbol = symbol.upper()
    if not internal_symbol.endswith("USDT"):
        internal_symbol = internal_symbol + "USDT"
    
    try:
        candles = provider.get_candles(symbol, timeframe, limit=200)
    except Exception as e:
        print(f"[TA Adapter] Failed to get candles for {symbol}:{timeframe}: {e}")
        return _empty_ta(symbol, timeframe, error=str(e))
    
    if not candles or len(candles) < 30:
        print(f"[TA Adapter] Not enough candles for {symbol}:{timeframe}: {len(candles) if candles else 0}")
        return _empty_ta(symbol, timeframe, error="not_enough_candles")
    
    current_price = candles[-1]["close"]
    
    # 2. Run TA Engine
    try:
        from modules.ta_engine.per_tf_builder import get_per_timeframe_builder
        builder = get_per_timeframe_builder()
        
        ta_result = builder.build(
            candles=candles,
            symbol=internal_symbol,
            timeframe=timeframe,
        )
    except Exception as e:
        print(f"[TA Adapter] TA Engine failed for {symbol}:{timeframe}: {e}")
        import traceback
        traceback.print_exc()
        return _empty_ta(symbol, timeframe, error=str(e), price=current_price)
    
    # 3. Extract summary for prediction pipeline
    summary = extract_ta_summary(ta_result, symbol, timeframe, current_price)
    
    elapsed = time.time() - start
    print(f"[TA Adapter] {symbol}:{timeframe} done in {elapsed:.1f}s "
          f"pattern={summary.get('pattern', {}).get('type', 'none')} "
          f"structure={summary.get('structure', {}).get('state', '?')} "
          f"trend={summary.get('structure', {}).get('trend', '?')}")
    
    return summary


def extract_ta_summary(
    ta_result: Dict[str, Any],
    symbol: str,
    timeframe: str,
    current_price: float,
) -> Dict[str, Any]:
    """
    Extract prediction-relevant fields from full TA payload.
    
    Maps the complex per_tf_builder output to the slim format
    that ta_interpreter.py expects.
    
    Output schema matches what ta_interpreter.interpret_ta_output() consumes:
        {
            "symbol", "timeframe", "price",
            "pattern": {"type", "direction", "confidence", "breakout_level", "target_price"},
            "structure": {"state", "trend", "trend_strength"},
            "indicators": {"momentum", "trend_strength", "volatility", "rsi", "macd"},
        }
    """
    # --- Pattern ---
    pattern = _extract_pattern_from_ta(ta_result)
    
    # --- Structure ---
    structure = _extract_structure_from_ta(ta_result)
    
    # --- Indicators ---
    indicators = _extract_indicators_from_ta(ta_result)
    
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "price": current_price,
        "pattern": pattern,
        "structure": structure,
        "indicators": indicators,
        # Keep raw TA layers reference for debugging
        "_ta_layers_regime": (ta_result.get("ta_layers") or {}).get("regime", {}).get("regime", "unknown"),
        "_ta_source": "real_ta_engine",
    }


def _extract_pattern_from_ta(ta: Dict) -> Dict[str, Any]:
    """Extract best pattern from TA result."""
    # Priority 1: pattern_render_contract (most reliable geometry)
    prc = ta.get("pattern_render_contract")
    if prc and prc.get("display_approved"):
        ptype = prc.get("type", "none")
        direction = (
            prc.get("direction")
            or prc.get("bias")
            or prc.get("meta", {}).get("direction")
            or "neutral"
        )
        confidence = prc.get("confidence", 0.0)
        
        # Extract target/levels from projection if available
        projection = prc.get("projection_contract", {})
        primary_proj = (projection.get("projection", {}) or {}).get("primary", {})
        target_price = primary_proj.get("target")
        
        # Breakout level
        breakout = prc.get("breakout_level")
        if not breakout:
            geo = prc.get("geometry_contract", {})
            boundaries = geo.get("boundaries", {})
            upper = boundaries.get("upper", {})
            breakout = upper.get("y2")
        
        return {
            "type": ptype,
            "direction": direction,
            "confidence": confidence,
            "breakout_level": breakout,
            "target_price": target_price,
            "source": "pattern_render_contract",
        }
    
    # Priority 2: primary_pattern
    primary = ta.get("primary_pattern")
    if primary:
        if hasattr(primary, "to_dict"):
            primary = primary.to_dict()
        return {
            "type": primary.get("type", "none"),
            "direction": primary.get("direction", primary.get("bias", "neutral")),
            "confidence": primary.get("confidence", 0.0),
            "breakout_level": primary.get("breakout_level"),
            "target_price": primary.get("target_price"),
            "source": "primary_pattern",
        }
    
    # Priority 3: pro_pattern (loose patterns)
    pro = ta.get("pro_pattern_payload", {})
    if pro and pro.get("pattern"):
        meta = pro.get("pattern_meta", {})
        return {
            "type": meta.get("label", "none"),
            "direction": meta.get("direction", "neutral"),
            "confidence": meta.get("confidence", 0.0),
            "source": "pro_pattern",
        }
    
    # No pattern found
    return {
        "type": "none",
        "direction": "neutral",
        "confidence": 0.0,
    }


def _extract_structure_from_ta(ta: Dict) -> Dict[str, Any]:
    """Extract market structure from TA result."""
    # Primary source: structure_context
    sc = ta.get("structure_context", {})
    
    # State from regime
    state = sc.get("regime", "range")
    # Map to prediction-compatible states
    state_map = {
        "TREND": "trend",
        "RANGE": "range",
        "COMPRESSION": "compression",
        "EXPANSION": "expansion",
        "trend": "trend",
        "range": "range",
        "compression": "compression",
        "expansion": "expansion",
    }
    state = state_map.get(state, "range")
    
    # Trend from bias
    bias = sc.get("bias", "neutral")
    trend_map = {
        "bullish": "up",
        "bearish": "down",
        "neutral": "flat",
        "BULLISH": "up",
        "BEARISH": "down",
    }
    trend = trend_map.get(bias, "flat")
    
    # Trend strength
    trend_strength = sc.get("trend_strength", 0.5)
    if isinstance(trend_strength, str):
        trend_strength = {"strong": 0.8, "moderate": 0.5, "weak": 0.3}.get(trend_strength, 0.5)
    trend_strength = max(0.0, min(1.0, float(trend_strength)))
    
    # Fallback: ta_layers has more accurate regime
    ta_layers = ta.get("ta_layers")
    if ta_layers:
        regime = ta_layers.get("regime", {})
        if isinstance(regime, dict):
            layer_regime = regime.get("regime", "")
            if layer_regime:
                state = state_map.get(layer_regime, state)
        
        prob = ta_layers.get("probability", {})
        if isinstance(prob, dict):
            dom_bias = prob.get("dominant_bias", "")
            if dom_bias:
                trend = trend_map.get(dom_bias, trend)
    
    return {
        "state": state,
        "trend": trend,
        "trend_strength": trend_strength,
    }


def _extract_indicators_from_ta(ta: Dict) -> Dict[str, Any]:
    """Extract indicator signals from TA result."""
    result = {
        "momentum": 0.0,
        "trend_strength": 0.5,
        "volatility": 0.3,
        "rsi": None,
        "macd": None,
    }
    
    # Source 1: indicator_insights
    insights = ta.get("indicator_insights")
    if insights:
        if hasattr(insights, "to_dict"):
            insights = insights.to_dict()
        
        if isinstance(insights, dict):
            # Momentum from overall bias
            overall = insights.get("overall", {})
            if overall:
                bias = overall.get("bias", "neutral")
                if bias == "bullish":
                    result["momentum"] = 0.3
                elif bias == "bearish":
                    result["momentum"] = -0.3
    
    # Source 2: indicators_viz (visualization data has raw values)
    viz = ta.get("indicators")
    if isinstance(viz, dict):
        panes = viz.get("panes", [])
        for pane in panes:
            if not isinstance(pane, dict):
                continue
            pane_id = pane.get("id", "")
            
            # RSI
            if pane_id == "rsi":
                series_list = pane.get("series", [])
                for s in series_list:
                    data = s.get("data", [])
                    if data:
                        last_val = data[-1]
                        if isinstance(last_val, dict):
                            result["rsi"] = last_val.get("value")
                        elif isinstance(last_val, (int, float)):
                            result["rsi"] = float(last_val)
            
            # MACD
            if pane_id == "macd":
                series_list = pane.get("series", [])
                for s in series_list:
                    if s.get("id") == "histogram" or s.get("label", "").lower() == "histogram":
                        data = s.get("data", [])
                        if data:
                            last_val = data[-1]
                            if isinstance(last_val, dict):
                                val = last_val.get("value", 0)
                            else:
                                val = float(last_val) if last_val else 0
                            result["macd"] = {"histogram": val}
                            if val > 0:
                                result["momentum"] = min(1.0, result["momentum"] + 0.2)
                            elif val < 0:
                                result["momentum"] = max(-1.0, result["momentum"] - 0.2)
    
    # RSI → adjust momentum
    rsi = result["rsi"]
    if rsi is not None:
        if rsi > 60:
            result["momentum"] = min(1.0, result["momentum"] + 0.1)
        elif rsi < 40:
            result["momentum"] = max(-1.0, result["momentum"] - 0.1)
    
    # Trend strength from structure
    sc = ta.get("structure_context", {})
    ts = sc.get("trend_strength")
    if ts is not None:
        if isinstance(ts, str):
            ts = {"strong": 0.8, "moderate": 0.5, "weak": 0.3}.get(ts, 0.5)
        result["trend_strength"] = max(0.0, min(1.0, float(ts)))
    
    # Volatility from market state
    ms = ta.get("market_state")
    if ms:
        if hasattr(ms, "volatility"):
            result["volatility"] = max(0.0, min(1.0, float(ms.volatility)))
        elif isinstance(ms, dict) and "volatility" in ms:
            result["volatility"] = max(0.0, min(1.0, float(ms["volatility"])))
    
    # Clamp momentum
    result["momentum"] = max(-1.0, min(1.0, result["momentum"]))
    
    return result


def build_real_prediction(ta_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build real prediction from TA payload.
    
    This replaces dummy_builders.build_dummy_prediction().
    
    Args:
        ta_payload: Output from build_real_ta()
    
    Returns:
        Prediction payload dict (same schema as dummy version)
    """
    symbol = ta_payload.get("symbol", "UNKNOWN")
    timeframe = ta_payload.get("timeframe", "1D")
    
    # Check for error TA
    if ta_payload.get("_error"):
        print(f"[Prediction Adapter] Skipping {symbol}:{timeframe} — TA had error: {ta_payload['_error']}")
        return _fallback_prediction(ta_payload)
    
    try:
        from modules.prediction.ta_interpreter import interpret_ta_output
        from modules.prediction.prediction_engine import get_prediction_engine
        
        # 1. Interpret TA output → PredictionInput
        pred_input = interpret_ta_output(ta_payload, symbol, timeframe)
        
        # 2. Run prediction engine
        engine = get_prediction_engine()
        prediction = engine.predict(pred_input)
        
        # 3. Convert to dict
        result = prediction.to_dict()
        result["_ta_source"] = ta_payload.get("_ta_source", "unknown")
        result["_ta_pattern"] = ta_payload.get("pattern", {}).get("type", "none")
        result["_ta_regime"] = ta_payload.get("_ta_layers_regime", "unknown")
        
        return result
    
    except Exception as e:
        print(f"[Prediction Adapter] Prediction failed for {symbol}:{timeframe}: {e}")
        import traceback
        traceback.print_exc()
        return _fallback_prediction(ta_payload)


def _empty_ta(
    symbol: str,
    timeframe: str,
    error: str = "",
    price: float = 0.0,
) -> Dict[str, Any]:
    """Return empty TA payload when data is unavailable."""
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "price": price,
        "pattern": {"type": "none", "direction": "neutral", "confidence": 0.0},
        "structure": {"state": "range", "trend": "flat", "trend_strength": 0.5},
        "indicators": {"momentum": 0.0, "trend_strength": 0.5, "volatility": 0.3},
        "_error": error,
        "_ta_source": "empty",
    }


def _fallback_prediction(ta_payload: Dict) -> Dict[str, Any]:
    """Minimal prediction when engine fails."""
    price = ta_payload.get("price", 0)
    return {
        "symbol": ta_payload.get("symbol", "UNKNOWN"),
        "timeframe": ta_payload.get("timeframe", "1D"),
        "current_price": price,
        "direction": {"label": "neutral", "score": 0.0},
        "confidence": {"value": 0.0, "label": "LOW"},
        "scenarios": {
            "base": {
                "probability": 1.0,
                "target_price": price,
                "expected_return": 0.0,
            }
        },
        "horizon_days": 5,
        "version": "v2",
        "_error": "prediction_failed",
    }
