# TA Engine — Scanner Engine + Regime Engine

## Original Problem Statement
Реалізувати Scanning Engine для масштабування Prediction Engine на 100+ активів з якісними predictions.

## Architecture

### Pipeline V2 (with Regime Engine)
```
Asset Registry (top 50/100/300)
    ↓
Scan Planner → creates jobs
    ↓
Job Queue (MongoDB-based)
    ↓
Workers
    ├─ TA Worker → saves ta_snapshots
    ├─ Prediction Worker (REGIME-AWARE) → saves prediction_snapshots
    │     ↓
    │     ├─ detect_regime(ta, prev_regime) → trend/range/compression/high_vol
    │     ├─ route_prediction(inp, regime) → specialized model
    │     ├─ apply_bias_fixes(direction, target, confidence)
    │     └─ save with regime metadata
    └─ Evaluation Worker
    ↓
Ranking → score + publishability filter
    ↓
API → /predictions/latest, /predictions/top
```

## Implemented Modules

### Scanner Engine (`/app/backend/modules/scanner/`)
| File | Purpose |
|------|---------|
| `types.py` | ScanJob, AssetRegistryItem, TASnapshot, PredictionSnapshot |
| `asset_registry.py` | Manages asset universe (top 50 crypto) |
| `job_queue.py` | MongoDB-based job queue |
| `scan_planner.py` | Creates ta_scan + prediction_build jobs |
| `ta_worker.py` | Processes TA jobs |
| `prediction_scan_worker.py` | Processes prediction jobs |
| `ranking.py` | Score formula + publishability filter |
| `scheduler.py` | Orchestrates batch processing |
| `routes.py` | REST API endpoints |
| `ta_to_prediction_adapter.py` | Connects TA → Regime-aware Prediction |
| `scan_logger.py` | Logging with regime metrics |
| `market_data/provider.py` | Abstract MarketDataProvider |
| `market_data/binance_provider.py` | Binance sync with cache |

### Regime Engine (`/app/backend/modules/prediction/`)
| File | Purpose |
|------|---------|
| `regime_detector.py` | Detects regime with hysteresis |
| `regime_router.py` | Routes to specialized models + bias fixes |
| `prediction_engine_v3.py` | Build regime-aware predictions |
| `models/trend_model.py` | Trend continuation (3-12% moves) |
| `models/range_model.py` | Mean reversion to bounds |
| `models/compression_model.py` | Breakout anticipation (4-15%) |
| `models/high_vol_model.py` | Momentum-driven (5-20%) |

## Regime Detection Logic

```python
# Priority order:
1. volatility > 0.7 → high_volatility
2. compression patterns → compression
3. trend_strength > 0.6 → trend
4. else → range

# Hysteresis: don't flip regime on small changes
if prev_regime == "trend" and trend_strength > 0.50:
    return "trend"  # Stay in trend
```

## Model Routing

| Regime | Model | Strategy | Target Range |
|--------|-------|----------|--------------|
| trend | trend_momentum_v1 | Continuation | 3-12% |
| range | range_mean_reversion_v1 | Bounce from extremes | To bounds |
| compression | compression_breakout_v1 | Breakout direction | 4-15% |
| high_volatility | high_vol_momentum_v1 | Follow momentum | 5-20% |

## Testing Results (April 2026)

### P0 Complete ✅
- Real TA Engine connected
- Real Prediction Engine connected
- BinanceProvider with cache

### P1 Regime Engine Complete ✅
- 4 specialized models implemented
- Hysteresis in regime detector
- Bias fixes (pattern override, momentum override)
- Logging with regime metrics

### Quality Metrics
| Metric | Before | After Regime |
|--------|--------|--------------|
| Avg Confidence | 58% | **71.0%** |
| Direction Variety | ✅ | ✅ (8 bull, 11 bear, 1 neutral) |
| Non-zero Targets | some 0% | **all non-zero** for trend |

### Metrics by Regime
- **Trend**: 74.6% confidence, 38% bullish / 62% bearish
- **Range**: 63.3% confidence, 50% bull / 33% bear / 17% neutral
- **Compression**: 71% confidence

## API Endpoints

### Scanner
```
POST /api/scanner/full-scan      # Run universe scan
GET  /api/scanner/debug/{symbol} # Debug single asset (regime info)
GET  /api/scanner/predictions/top # Top ranked predictions
```

### Logging
```
GET  /api/scanner/logs/recent    # Recent scans
GET  /api/scanner/logs/summary   # Stats with regime_distribution, metrics_by_regime
POST /api/scanner/logs/clear     # Clear logs
```

## Next Steps

### P2: Regime Calibration
- [ ] Tune weights per regime
- [ ] Add stability score filter
- [ ] Scale to 50+ assets after calibration

### P3: Evaluation
- [ ] Outcome tracking
- [ ] Accuracy metrics by regime
- [ ] Model improvement based on results
