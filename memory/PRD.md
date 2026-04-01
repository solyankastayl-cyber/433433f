# TA Engine — Full System with Historical Backtest

## System Summary

Complete Trading Decision Engine with:
- **P0**: Scanner Engine (asset registry, job queue, workers)
- **P1**: Regime Engine (4 specialized models)
- **P2**: Decision Engine (stability, filter, ranking)
- **P3**: Outcome Tracking (resolution rules)
- **P4**: Real Calibration (dynamic weights)
- **P5**: Anti-Drift (model health, calibration guard)
- **P6**: Historical Backtest (fast learning from history)

## P6 Historical Backtest

### Architecture
```
Historical Candles (180 days)
    ↓
Backtest Runner (step through history)
    ├─ visible_candles = candles[:i] (NO LEAKAGE)
    ├─ ta = build_ta_from_candles(visible)
    ├─ pred = build_prediction(ta)
    └─ future_candles = candles[i+1:i+horizon]
    ↓
Resolution (future only)
    ├─ target_hit → correct
    ├─ wrong_early (>3% against) → wrong
    └─ horizon_expired → partial/wrong
    ↓
Metrics by regime/model/symbol
    ↓
Calibration input
```

### API Endpoints
```
POST /api/scanner/backtest/run/{symbol}     # Single asset backtest
POST /api/scanner/backtest/run-multi        # Multi-asset backtest
GET  /api/scanner/backtest/metrics          # Global metrics
GET  /api/scanner/backtest/metrics/by-regime
GET  /api/scanner/backtest/metrics/by-model
GET  /api/scanner/backtest/metrics/by-symbol
GET  /api/scanner/backtest/summary
DELETE /api/scanner/backtest/clear
```

### First Backtest Results (BTC+ETH+SOL 4H, 180 days)

| Metric | Value |
|--------|-------|
| Total Predictions | 103 |
| Accuracy | 3.9% |
| Partial | 29.1% |
| Wrong | 67.0% |
| Wrong Early | 52.4% |

### Key Findings

1. **Bearish Bias Detected**
   - 80 bearish vs 23 bullish predictions
   - Wrong early rate 52.4% (price went opposite direction)

2. **Compression Model Issues**
   - All predictions were compression regime
   - Target too aggressive (12-15% moves)
   - Direction often wrong (bearish in bullish market)

3. **Needed Calibration**
   - Reduce compression target multiplier
   - Fix bearish bias in pattern detection
   - Consider market trend context

## Next Steps

### Immediate (Based on Backtest)
- [ ] Fix bearish bias in compression model
- [ ] Reduce target multipliers (0.85x for compression)
- [ ] Add market context awareness

### P7: Calibration from Backtest
- [ ] Use backtest metrics for initial calibration
- [ ] Apply calibration weights to live predictions
- [ ] Compare backtest vs live accuracy

### Production
- [ ] Cron jobs for workers
- [ ] Scale to 50+ assets
- [ ] Dashboard for monitoring

## File Structure

```
/app/backend/modules/prediction/
├── backtest_runner.py       # Core backtest engine
├── backtest_resolution.py   # Future-only resolution
├── backtest_repository.py   # Storage
├── backtest_metrics.py      # Metrics computation
├── regime_detector.py       # Regime detection
├── models/                  # Specialized models
├── calibration_*.py         # P4 calibration
└── stability_*.py           # P5 anti-drift
```
