# TA Engine — Prediction Engine Implementation

## Original Problem Statement
Реалізувати чистий TA-based Prediction Engine без залежності від Exchange/Sentiment/Fractal як ядра.

## Architecture

### Core Principle
```
Prediction = f(TA Engine output)
```

### Stack
- **Backend**: Python FastAPI
- **Prediction Module**: `/app/backend/modules/prediction/`

## Implemented Features

### April 1, 2026 - Prediction Engine V2/V3

#### V2 - Base Prediction Engine
Files:
- `types.py` - PredictionInput, PredictionOutput, Scenario, PathPoint
- `direction.py` - Direction calculation from TA signals
- `confidence.py` - Confidence scoring
- `scenarios.py` - Bull/Base/Bear scenario builder
- `path_builder.py` - Curved paths with ease-out + confidence bands
- `ta_interpreter.py` - Bridge from TA Engine output
- `prediction_engine.py` - Main V2 engine

Features:
- Direction: bullish/bearish/neutral with score (-1 to 1)
- 3 Scenarios: bull (55%), base (30%), bear (15%) based on direction
- Curved paths (ease-out quadratic)
- Confidence bands (wider over time + volatility)
- Reasoning list for transparency

#### V3 - Advanced Prediction Engine
File: `prediction_engine_v3.py`

Features:
- **Drift Detection**: Minor (2%), Major (5%), Critical (10%)
- **Self-Correction**: Learning from historical accuracy
- **Version History**: Track V1 → V2 → V3 transitions
- **Path Noise**: Realistic random walk
- **Outcome Recording**: Update correction factors

### API Endpoints

```
GET  /api/prediction/health
GET  /api/prediction/{symbol}           # V2 prediction
POST /api/prediction/{symbol}           # V2 with JSON body
GET  /api/prediction/{symbol}/scenarios
GET  /api/prediction/v3/{symbol}        # V3 prediction
POST /api/prediction/v3/{symbol}/drift  # Check/update drift
GET  /api/prediction/v3/{symbol}/history
```

## Direction Calculation

Weights:
- Pattern: 40%
- Structure: 30%
- Momentum: 30%

Thresholds:
- Bullish: score > 0.2
- Bearish: score < -0.2
- Neutral: otherwise

## Scenario Probabilities

Based on direction score:
- Strong bullish (>0.3): 55% bull, 30% base, 15% bear
- Moderate bullish: 45% bull, 35% base, 20% bear
- Neutral: 33% each
- Moderate bearish: 20% bull, 35% base, 45% bear
- Strong bearish (<-0.3): 15% bull, 30% base, 55% bear

## Path Generation

```python
# Ease-out quadratic curve
curve = 1 - (1 - t)^2

# Band spread
spread = price × volatility × 0.5 × time_factor
```

## What's NOT in Prediction Engine

❌ Exchange Intelligence as core
❌ Sentiment/Reflexivity as core
❌ Fractal Intelligence as core

These are OPTIONAL modifiers only.

## Next Tasks

### P1 (To Do)
- [ ] Connect Prediction Engine to frontend chart
- [ ] Display prediction overlay on TechAnalysis page
- [ ] Add prediction toggle in chart controls

### P2 (Enhancement)
- [ ] Add optional Exchange/Fractal modifiers (+/- 8% confidence)
- [ ] Backtest validation module
- [ ] Accuracy tracking dashboard

## File Structure

```
/app/backend/modules/prediction/
├── __init__.py
├── types.py              # Data structures
├── direction.py          # Direction calculator
├── confidence.py         # Confidence scorer
├── scenarios.py          # Scenario builder
├── path_builder.py       # Path + bands
├── ta_interpreter.py     # TA → Input bridge
├── prediction_engine.py  # V2 engine
├── prediction_engine_v3.py # V3 with drift
└── routes.py             # API endpoints
```
