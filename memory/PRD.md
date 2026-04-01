# TA Engine — Prediction Engine with Validation Layer

## Original Problem Statement
Реалізувати Validation Layer для Prediction Engine:
- Debug endpoint
- Prediction repository (зберігання в MongoDB)
- Evaluation Engine (оцінка predictions)
- Metrics Engine (accuracy, error %)
- Sanity Checks
- Calibration Engine (адаптивні ваги)

## Architecture

### Pipeline
```
TA Engine
    ↓
Prediction Engine (V2/V3)
    ↓
Sanity Check
    ↓
Save to MongoDB
    ↓
Worker (cron) - evaluates when horizon passes
    ↓
Evaluation
    ↓
Metrics + Calibration
```

### Core Principle
```
Prediction = f(TA Engine output)
```

## Implemented Modules

### Prediction Engine
- `prediction_engine.py` - V2 базовий engine
- `prediction_engine_v3.py` - V3 з drift/self-correction
- `direction.py` - Direction calculator
- `confidence.py` - Confidence scorer
- `scenarios.py` - Bull/Base/Bear scenarios
- `path_builder.py` - Curved paths + bands
- `ta_interpreter.py` - TA → Input bridge

### Validation Layer
- `prediction_repository.py` - MongoDB storage
- `prediction_evaluator.py` - Evaluation logic
- `prediction_metrics.py` - Accuracy metrics
- `prediction_sanity.py` - Sanity checks
- `calibration_engine.py` - Adaptive weights
- `prediction_worker.py` - Background worker

## API Endpoints

### Prediction
```
GET  /api/prediction/health
GET  /api/prediction/{symbol}          # V2 prediction
POST /api/prediction/{symbol}          # V2 with JSON
GET  /api/prediction/v3/{symbol}       # V3 with drift
POST /api/prediction/v3/{symbol}/drift # Check drift
GET  /api/prediction/v3/{symbol}/history
```

### Validation & Debug
```
GET  /api/prediction/debug/{symbol}    # Full breakdown
POST /api/prediction/save/{symbol}     # Save for validation
GET  /api/prediction/pending           # Awaiting evaluation
POST /api/prediction/evaluate/{id}     # Manual evaluate
```

### Metrics & Calibration
```
GET  /api/prediction/metrics           # Accuracy stats
GET  /api/prediction/calibration/status
POST /api/prediction/calibration/run   # Trigger calibration
POST /api/prediction/calibration/reset
POST /api/prediction/worker/run        # Trigger worker
```

## Evaluation Logic

Results:
- **correct**: Direction correct AND error < 3%
- **partial**: Direction correct BUT error 3-10%
- **wrong**: Direction wrong

## Calibration Logic

Weights update formula:
```python
score[factor] = correct_weighted_contribution / total_contribution
new_weight[factor] = clamp(score / sum(scores), 0.1, 0.7)
```

Minimum 50 predictions required.

## Metrics Tracked

- `accuracy` - % correct
- `accuracy_with_partial` - (correct + 0.5*partial) / total
- `direction_accuracy` - % correct direction
- `avg_error_pct` - Average price error
- `bias.skew` - Bull vs Bear accuracy difference
- `calibration` - Expected vs Actual by confidence level
- `contribution_performance` - Performance per factor

## MongoDB Collections

### predictions
```json
{
  "symbol": "BTC",
  "timeframe": "1D",
  "created_at": 1712000000,
  "price_at_prediction": 68000,
  "prediction": {...},
  "contributions": {...},
  "status": "pending|resolved|expired",
  "evaluation": {...}
}
```

### prediction_weights
```json
{
  "_id": "default",
  "weights": {"pattern": 0.4, "structure": 0.3, "momentum": 0.3},
  "performance_scores": {...},
  "last_calibration": "..."
}
```

## Testing Status
- ✅ Debug endpoint working
- ✅ Save prediction working
- ✅ Pending list working
- ✅ Manual evaluate working
- ✅ Metrics calculation working
- ✅ Calibration status working
- ⏳ Auto-evaluation worker (needs cron setup)

## Next Steps

### P1 (Immediate)
- [ ] Set up cron for prediction worker
- [ ] Create 50+ predictions for calibration test
- [ ] Dry run: BTC/ETH/SOL 100 predictions

### P2 (After Validation)
- [ ] Connect to frontend chart
- [ ] Display prediction overlay
- [ ] Add prediction toggle in UI

## Files Created

```
/app/backend/modules/prediction/
├── __init__.py
├── types.py
├── direction.py
├── confidence.py
├── scenarios.py
├── path_builder.py
├── ta_interpreter.py
├── prediction_engine.py
├── prediction_engine_v3.py
├── prediction_repository.py
├── prediction_evaluator.py
├── prediction_metrics.py
├── prediction_sanity.py
├── calibration_engine.py
├── prediction_worker.py
└── routes.py
```
