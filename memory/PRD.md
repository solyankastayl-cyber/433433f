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

## Implemented Modules

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
| `dummy_builders.py` | Placeholder TA/Prediction builders |

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
```

### Predictions
```
GET  /api/scanner/predictions/latest  # Latest snapshots
GET  /api/scanner/predictions/top     # Top ranked publishable
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

## Batch Processing Intervals

| Timeframe | Scan Interval |
|-----------|---------------|
| 4H | Every 10 minutes |
| 1D | Every 30 minutes |
| Cleanup | Every 1 hour |

## Testing Status

- ✅ Asset registry seeding: 50 crypto assets
- ✅ Full scan: 10 assets × 2 TF = 20 TA + 20 predictions
- ✅ Top predictions API: Returns ranked publishable signals
- ✅ Queue stats working
- ⏳ Real TA integration (using dummy builders now)

## Next Steps

### P1 (Immediate)
- [ ] Connect real TA Engine to ta_worker
- [ ] Connect real Prediction Engine to prediction_worker
- [ ] Set up cron for scheduler.tick()

### P2 (After Real Integration)
- [ ] Scale to 100 assets
- [ ] Add evaluation worker
- [ ] Build metrics dashboard

### P3 (Advanced)
- [ ] Regime-based models (trend/range/compression)
- [ ] Scale to 300+ assets

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
└── dummy_builders.py
```
