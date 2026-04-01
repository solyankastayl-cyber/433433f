# TA Engine — Full Decision Engine with Truth Layer

## Original Problem Statement
Побудувати повний Trading Decision Engine з якісними predictions, outcome tracking, self-calibration та anti-drift protection.

## Architecture

### Pipeline V4 (Decision Engine + Truth Layer)
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
          ├─ apply_calibration() [P4]
          ├─ apply_stability() [P5]
          ├─ finalize_prediction() [P2]
          │     ├─ compute_stability_score()
          │     ├─ apply_regime_weight()
          │     ├─ apply_anti_overconfidence()
          │     ├─ is_prediction_valid() → filter
          │     └─ compute_score() → ranking 2.0
          └─ save with regime, model, status=pending
    ↓
Outcome Resolution Worker [P3]
    ├─ try_early_resolution() → target_hit/wrong_early
    └─ resolve_at_horizon() → correct/partial/wrong
    ↓
Calibration Worker [P4]
    ├─ compute regime/model stats from resolved
    └─ adjust weights, target_multipliers, confidence_bias
    ↓
Stability Worker [P5]
    ├─ detect_regime_instability()
    ├─ detect_model_health()
    └─ calibration_guard()
    ↓
Metrics API
    ├─ accuracy by regime/model
    ├─ confidence calibration
    └─ model health status
```

## Implemented Layers

### P0: Scanner Engine ✅
- Asset registry, job queue, TA/prediction workers
- BinanceProvider with cache

### P1: Regime Engine ✅
- 4 models: trend, range, compression, high_vol
- Hysteresis in regime detection
- Pattern/momentum bias fixes

### P2: Decision Engine ✅
- Stability score
- Regime calibration weights
- Anti-overconfidence
- Filter (MIN_CONFIDENCE=55%, MIN_RETURN=2%, MIN_STABILITY=0.5)
- Ranking 2.0

### P3: Outcome Tracking ✅
- Prediction lifecycle: pending → resolved/expired
- Resolution types: target_hit, correct_early, wrong_early, horizon_expired
- Results: correct, partial, wrong
- Error tracking

### P4: Real Calibration ✅
- Stats by regime/model from resolved outcomes
- Dynamic weights: regime_weights, model_weights
- Target multipliers (reduce if too aggressive)
- Confidence bias (align with actual accuracy)

### P5: Anti-Drift + Stability ✅
- Regime instability detection
- Model health tracking (healthy/weak/degrading)
- Model penalties for degrading performance
- Calibration guard (freeze if accuracy drops)

## API Endpoints

### P3: Outcomes & Metrics
```
POST /api/scanner/outcomes/resolve    # Run outcome resolution
GET  /api/scanner/metrics             # Global metrics
GET  /api/scanner/metrics/by-regime   # Accuracy by regime
GET  /api/scanner/metrics/by-model    # Accuracy by model
POST /api/scanner/metrics/compute     # Compute new snapshot
```

### P4: Calibration
```
GET  /api/scanner/calibration/status  # Current calibration
POST /api/scanner/calibration/recalibrate # Run recalibration
```

### P5: Stability
```
GET  /api/scanner/stability/status    # Full stability status
GET  /api/scanner/stability/models    # Model health
POST /api/scanner/stability/rebuild   # Rebuild stability
```

## Resolution Rules

```python
# Correct: target hit
if actual_price >= target_price (bullish):
    result = "correct"

# Partial: direction right, close to target (<5% error)
if direction_ok and error_pct < 0.05:
    result = "partial"

# Wrong early: strong move against prediction (>3%)
if actual_price < start_price * 0.97 (bullish):
    result = "wrong", resolution_type = "wrong_early"

# Wrong at horizon: didn't hit target, direction wrong
else:
    result = "wrong", resolution_type = "horizon_expired"
```

## Calibration Rules

```python
# Accuracy impact on weight
if accuracy >= 0.62: weight += 0.08
if accuracy <= 0.45: weight -= 0.08

# Error impact on target multiplier
if error >= 0.10: multiplier = 0.85
if error >= 0.06: multiplier = 0.92

# Confidence bias (align with accuracy)
bias = (accuracy - confidence) * 0.25
```

## Stability Rules

```python
# Model degradation (last 20 vs full history)
if last_acc < full_acc - 0.10:
    status = "degrading", penalty = 0.88

# Regime instability (frequent direction changes)
if instability > 0.20:
    conf *= 0.88

# Calibration guard (accuracy drop)
if current_acc < last_acc - 0.05:
    freeze = True, conf *= 0.92
```

## Testing Results (April 2026)

### P3/P4/P5 Tests: 86.7% pass rate
- ✅ Prediction structure with all fields
- ✅ Outcome resolution workflow
- ✅ Metrics computation
- ✅ Calibration engine
- ✅ Stability engine with model health

## MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `prediction_snapshots` | Predictions with status, resolution |
| `ta_snapshots` | TA analysis data |
| `prediction_metrics_snapshots` | Metrics over time |
| `prediction_calibration` | Current calibration weights |
| `prediction_stability` | Model health, regime instability |
| `prediction_resolution_events` | Debug logs |

## Next Steps

### P6: Historical Backtest
- [ ] Replay system on historical data
- [ ] Fast validation without waiting
- [ ] Large sample testing

### Production
- [ ] Scale to 50+ assets
- [ ] Cron job for workers
- [ ] Dashboard for monitoring
