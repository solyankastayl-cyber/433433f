# TA Engine — Scanner Engine Implementation

## Original Problem Statement
Реалізувати Scanning Engine для масштабування Prediction Engine на 100+ активів.

## Architecture

### Pipeline
```
Asset Registry (top 50/100/300)
    ↓
Scan Planner → creates jobs
    ↓
Job Queue (MongoDB-based)
    ↓
Workers
    ├─ TA Worker → saves ta_snapshots
    ├─ Prediction Worker → saves prediction_snapshots
    └─ Evaluation Worker
    ↓
Ranking → score + publishability filter
    ↓
API → /predictions/latest, /predictions/top
```

### Core Principle
```
NOT per-request, but continuous scanning system
Asset Universe → Queue → TA → Prediction → Save → Evaluate → Rank
```

## Implemented Modules (April 2026)

### Scanner Engine (`/app/backend/modules/scanner/`)

| File | Purpose |
|------|---------|
| `types.py` | ScanJob, AssetRegistryItem, TASnapshot, PredictionSnapshot |
| `asset_registry.py` | Manages asset universe (top 50 crypto seeded) |
| `job_queue.py` | MongoDB-based job queue with claim/done/fail |
| `scan_planner.py` | Creates ta_scan + prediction_build jobs |
| `ta_worker.py` | Processes ta_scan jobs → saves ta_snapshots |
| `prediction_scan_worker.py` | Processes prediction_build jobs → saves prediction_snapshots |
| `ranking.py` | Score formula + publishability filter |
| `scheduler.py` | Orchestrates batch processing |
| `routes.py` | REST API endpoints |
| `ta_to_prediction_adapter.py` | **NEW** Connects real TA Engine + Prediction Engine |
| `scan_logger.py` | **NEW** Logging for monitoring |
| `market_data/provider.py` | **NEW** Abstract MarketDataProvider interface |
| `market_data/binance_provider.py` | **NEW** Binance sync provider with cache |

## API Endpoints

### Assets
```
GET  /api/scanner/assets           # List active assets
POST /api/scanner/assets/seed      # Seed top 50 crypto
GET  /api/scanner/assets/stats     # Registry stats
```

### Queue
```
GET  /api/scanner/queue/stats      # Queue statistics
GET  /api/scanner/queue/pending    # Pending jobs
POST /api/scanner/queue/cleanup    # Clean stale jobs
```

### Scanning
```
POST /api/scanner/scan/universe    # Enqueue universe scan
POST /api/scanner/scan/asset/{sym} # Scan single asset
POST /api/scanner/tick             # Manual scheduler tick
POST /api/scanner/full-scan        # Full universe scan
GET  /api/scanner/status           # Scheduler status
GET  /api/scanner/debug/{symbol}   # Debug single asset (real TA+Prediction)
```

### Predictions
```
GET  /api/scanner/predictions/latest  # Latest snapshots
GET  /api/scanner/predictions/top     # Top ranked publishable
```

### Logging (NEW)
```
GET  /api/scanner/logs/recent      # Recent scan logs
GET  /api/scanner/logs/summary     # Direction/pattern distribution
POST /api/scanner/logs/clear       # Clear logs
```

## Ranking Formula

```python
score = confidence * 0.5 + |expected_return| * 2.5 + |direction_score| * 0.2
```

## Publishability Thresholds

- `confidence >= 0.55`
- `|expected_return| >= 0.02` (2%)

## MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `asset_registry` | Active assets with volume_rank |
| `scan_jobs` | Job queue with status |
| `ta_snapshots` | TA analysis snapshots |
| `prediction_snapshots` | Prediction snapshots with score |

## Testing Status (April 2026)

### P0 Complete ✅
- ✅ Asset registry seeding: 50 crypto assets
- ✅ BinanceProvider with cache (5 min TTL)
- ✅ Real TA Engine connected (per_tf_builder)
- ✅ Real Prediction Engine connected
- ✅ Full scan: 10 assets × 2 TF = 20 TA + 20 predictions
- ✅ Top predictions API: Returns ranked publishable signals
- ✅ Pattern diversity: 7+ different patterns
- ✅ Direction diversity: bullish/bearish/neutral
- ✅ Logging: scan_logger.py with monitoring

### P1 (Verified in Testing)
- ✅ direction is logical (bearish on double_top, bullish on double_bottom)
- ✅ not always bullish (9 bullish, 23 bearish, 12 neutral in test)
- ✅ target doesn't fly away
- ✅ confidence varies (0.43-0.64)
- ✅ pattern actually used in prediction

## Next Steps

### P1 (After P0)
- [ ] Scale to 50+ assets
- [ ] Set up cron for scheduler.tick()
- [ ] Add evaluation worker for outcome tracking

### P2 (After Real Integration)
- [ ] Scale to 100 assets
- [ ] Build metrics dashboard
- [ ] Add CoincbaseProvider as fallback

### P3 (Advanced)
- [ ] Regime-based models (trend/range/compression)
- [ ] Scale to 300+ assets
- [ ] Multi-provider rotation

## File Structure

```
/app/backend/modules/scanner/
├── __init__.py
├── types.py
├── asset_registry.py
├── job_queue.py
├── scan_planner.py
├── ta_worker.py
├── prediction_scan_worker.py
├── ranking.py
├── scheduler.py
├── routes.py
├── ta_to_prediction_adapter.py    # NEW: Real TA + Prediction
├── scan_logger.py                 # NEW: Monitoring
├── dummy_builders.py              # DEPRECATED
└── market_data/
    ├── __init__.py
    ├── provider.py                # Abstract interface
    └── binance_provider.py        # Sync with cache
```
