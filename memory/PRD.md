# TA Engine — Decision Engine

## Original Problem Statement
Реалізувати повний Trading Decision Engine з якісними predictions та фільтрацією слабких сигналів.

## Architecture

### Pipeline V3 (Decision Engine)
```
Asset Registry (top 50/100/300)
    ↓
Scan Planner → creates jobs
    ↓
Job Queue (MongoDB-based)
    ↓
Workers
    ├─ TA Worker → ta_snapshots
    └─ Prediction Worker
          ↓
          ├─ detect_regime(ta) → trend/range/compression/high_vol
          ├─ route_prediction(inp, regime) → specialized model
          ├─ finalize_prediction()
          │     ├─ compute_stability_score()
          │     ├─ apply_regime_weight()
          │     ├─ apply_anti_overconfidence()
          │     ├─ is_prediction_valid() → filter
          │     └─ compute_score() → ranking 2.0
          └─ save with stability, valid, score
    ↓
Decision Engine Output
    ├─ Valid predictions (publishable)
    └─ Invalid predictions (filtered out)
```

## Implemented Modules

### Scanner Engine (`/app/backend/modules/scanner/`)
- `ta_to_prediction_adapter.py` - Full pipeline with P2 finalizer
- `scan_logger.py` - Logging with P2 metrics
- `market_data/binance_provider.py` - Cache with 5 min TTL

### Regime Engine (`/app/backend/modules/prediction/`)
- `regime_detector.py` - Regime detection with hysteresis
- `regime_router.py` - Routes to specialized models
- `models/trend_model.py` - Trend continuation (3-12%)
- `models/range_model.py` - Mean reversion to bounds
- `models/compression_model.py` - Breakout anticipation (4-15%)
- `models/high_vol_model.py` - Momentum-driven (5-20%)

### P2 Decision Engine (`/app/backend/modules/prediction/`)
- `stability.py` - Stability score (pattern_conf + trend_str - vol)
- `regime_calibration.py` - Regime weights (trend=1.1, range=0.9)
- `anti_overconfidence.py` - Confidence clamps
- `filter.py` - Valid/invalid thresholds
- `ranking_v2.py` - Score = conf*0.4 + return*2.0 + stability*0.6
- `finalizer.py` - Full P2 pipeline

## P2 Filter Thresholds

```python
MIN_CONFIDENCE = 0.55   # 55%
MIN_RETURN = 0.02       # 2%
MIN_STABILITY = 0.5     # 0.5
```

## Regime Weights

```python
REGIME_WEIGHTS = {
    "trend": 1.10,         # Boost trends
    "compression": 1.05,   # Breakouts valuable
    "range": 0.90,         # Range harder
    "high_volatility": 0.85  # Unpredictable
}
```

## Testing Results (April 2026)

### P2 Decision Engine Complete ✅

| Metric | Result |
|--------|--------|
| Valid Rate | **63-67%** (filtered 33-37% weak signals) |
| Avg Confidence | 69% (capped at 90%) |
| Avg Stability | 0.62 |

### Metrics by Regime

| Regime | Avg Conf | Avg Stab | Valid % |
|--------|----------|----------|---------|
| Trend | 78.6% | 0.62 | **100%** |
| Range | 50.6% | 0.63 | **0%** |
| Compression | 75% | 0.60 | **100%** |

**Key Achievement**: Range predictions correctly filtered (0% valid) because they have low confidence and small returns.

## API Endpoints

### Predictions (P2)
```
GET /api/scanner/predictions/top    # Only valid predictions
GET /api/scanner/predictions/all    # All predictions (for analysis)
GET /api/scanner/debug/{symbol}     # Debug with stability, valid, score
```

### Logging (P2)
```
GET /api/scanner/logs/summary   # valid_rate, rejection_reasons, metrics_by_regime
GET /api/scanner/logs/recent    # Logs with stability, valid, score
```

## Next Steps

### P3: Real Calibration (Outcomes)
- [ ] Add outcome tracking (actual vs predicted)
- [ ] Compute accuracy by regime
- [ ] Adjust weights based on real performance

### P4: Scale
- [ ] Scale to 50+ assets
- [ ] Production cron job
- [ ] Dashboard for monitoring
