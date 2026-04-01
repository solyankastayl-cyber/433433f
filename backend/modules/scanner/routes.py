"""
Scanner API Routes

REST API for scanner operations.
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from datetime import datetime

from .asset_registry import get_asset_registry
from .job_queue import get_job_queue
from .scan_planner import get_scan_planner
from .prediction_scan_worker import get_prediction_scan_worker
from .scheduler import get_scanner_scheduler


router = APIRouter(prefix="/api/scanner", tags=["scanner"])


@router.get("/health")
async def health():
    """Health check for scanner service."""
    return {
        "status": "ok",
        "service": "scanner",
        "timestamp": datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════
# ASSET REGISTRY
# ══════════════════════════════════════════════════════════════

@router.get("/assets")
async def get_assets(limit: int = 50):
    """Get active assets from registry."""
    registry = get_asset_registry()
    assets = registry.get_active_assets(limit=limit)
    
    return {
        "count": len(assets),
        "assets": [a.to_dict() for a in assets],
    }


@router.post("/assets/seed")
async def seed_assets():
    """Seed default top 50 crypto assets."""
    registry = get_asset_registry()
    count = registry.seed_default_assets()
    
    return {
        "status": "seeded",
        "count": count,
    }


@router.get("/assets/stats")
async def get_asset_stats():
    """Get asset registry statistics."""
    registry = get_asset_registry()
    return registry.get_stats()


# ══════════════════════════════════════════════════════════════
# JOB QUEUE
# ══════════════════════════════════════════════════════════════

@router.get("/queue/stats")
async def get_queue_stats():
    """Get job queue statistics."""
    queue = get_job_queue()
    return queue.get_queue_stats()


@router.get("/queue/pending")
async def get_pending_jobs(limit: int = 20):
    """Get pending jobs in queue."""
    queue = get_job_queue()
    jobs = queue.get_pending_jobs(limit=limit)
    
    return {
        "count": len(jobs),
        "jobs": [j.to_dict() for j in jobs],
    }


@router.post("/queue/cleanup")
async def cleanup_queue():
    """Clean up stale and old jobs."""
    queue = get_job_queue()
    
    stale_cleared = queue.clear_stale_jobs()
    old_deleted = queue.cleanup_old_jobs()
    
    return {
        "stale_jobs_cleared": stale_cleared,
        "old_jobs_deleted": old_deleted,
    }


# ══════════════════════════════════════════════════════════════
# SCAN PLANNER
# ══════════════════════════════════════════════════════════════

@router.post("/scan/universe")
async def scan_universe(
    limit: int = Query(50, description="Number of assets to scan"),
    timeframes: List[str] = Query(["4H", "1D"], description="Timeframes"),
):
    """Enqueue scan jobs for asset universe."""
    planner = get_scan_planner()
    result = planner.enqueue_universe_scan(limit=limit, timeframes=timeframes)
    
    return result


@router.post("/scan/asset/{symbol}")
async def scan_asset(
    symbol: str,
    timeframes: List[str] = Query(["4H", "1D"], description="Timeframes"),
):
    """Enqueue scan jobs for single asset."""
    planner = get_scan_planner()
    result = planner.enqueue_single_asset(symbol.upper(), timeframes=timeframes)
    
    return result


# ══════════════════════════════════════════════════════════════
# PREDICTIONS (SNAPSHOTS)
# ══════════════════════════════════════════════════════════════

@router.get("/predictions/latest")
async def get_latest_predictions(
    symbol: Optional[str] = None,
    timeframe: Optional[str] = None,
    limit: int = 50,
):
    """Get latest prediction snapshots."""
    worker = get_prediction_scan_worker()
    
    if symbol:
        # Get specific asset
        pred = worker.get_latest_prediction(symbol.upper(), timeframe or "1D")
        if pred:
            return {"predictions": [pred]}
        return {"predictions": []}
    
    # Get batch
    predictions = worker.get_latest_predictions_batch(limit=limit)
    
    return {
        "count": len(predictions),
        "predictions": predictions,
    }


@router.get("/predictions/top")
async def get_top_predictions(limit: int = 20):
    """Get top ranked publishable predictions."""
    worker = get_prediction_scan_worker()
    predictions = worker.get_top_predictions(limit=limit)
    
    return {
        "count": len(predictions),
        "predictions": predictions,
    }


# ══════════════════════════════════════════════════════════════
# DEBUG / SINGLE ASSET SCAN
# ══════════════════════════════════════════════════════════════

@router.get("/debug/{symbol}")
async def debug_single_asset(
    symbol: str,
    timeframe: str = "4H",
):
    """
    Debug: run real TA + Prediction for a single asset.
    
    Returns full pipeline output for manual verification.
    Shows: candle count, pattern, structure, indicators, prediction.
    """
    from .ta_to_prediction_adapter import build_real_ta, build_real_prediction
    
    # Run TA
    ta_payload = build_real_ta(symbol.upper(), timeframe.upper())
    
    # Run Prediction
    prediction = build_real_prediction(ta_payload)
    
    # Enrich with score
    from .ranking import enrich_prediction_with_score
    enriched = enrich_prediction_with_score(prediction)
    
    return {
        "symbol": symbol.upper(),
        "timeframe": timeframe.upper(),
        "ta_summary": {
            "price": ta_payload.get("price"),
            "pattern": ta_payload.get("pattern"),
            "structure": ta_payload.get("structure"),
            "indicators": ta_payload.get("indicators"),
            "ta_source": ta_payload.get("_ta_source"),
            "ta_regime": ta_payload.get("_ta_layers_regime"),
            "error": ta_payload.get("_error"),
        },
        "prediction": enriched,
    }


# ══════════════════════════════════════════════════════════════
# SCHEDULER
# ══════════════════════════════════════════════════════════════

@router.get("/status")
async def get_scanner_status():
    """Get scanner scheduler status."""
    scheduler = get_scanner_scheduler()
    return scheduler.get_status()


@router.post("/tick")
async def trigger_tick(asset_limit: int = 50):
    """
    Manually trigger scheduler tick.
    
    Uses REAL TA Engine + Prediction Engine.
    """
    from .ta_to_prediction_adapter import build_real_ta, build_real_prediction
    
    scheduler = get_scanner_scheduler()
    result = scheduler.tick(
        build_ta_fn=build_real_ta,
        build_prediction_fn=build_real_prediction,
        asset_limit=asset_limit,
    )
    
    return result


@router.post("/full-scan")
async def trigger_full_scan(
    asset_limit: int = 50,
    timeframes: List[str] = Query(["4H", "1D"], description="Timeframes"),
):
    """
    Trigger a full scan of the universe.
    
    Uses REAL TA Engine + Prediction Engine.
    """
    from .ta_to_prediction_adapter import build_real_ta, build_real_prediction
    
    scheduler = get_scanner_scheduler()
    result = scheduler.run_full_scan(
        build_ta_fn=build_real_ta,
        build_prediction_fn=build_real_prediction,
        asset_limit=asset_limit,
        timeframes=timeframes,
    )
    
    return result


def register_routes(app):
    """Register scanner routes with FastAPI app."""
    app.include_router(router)
