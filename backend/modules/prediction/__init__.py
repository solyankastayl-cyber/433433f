"""
Prediction Engine V2/V3

TA-first prediction system.
NO external dependencies on Exchange/Sentiment/Fractal as core.
Those are OPTIONAL modifiers only.

Architecture:
    TA Engine → Prediction Engine → Output

Core principle:
    Prediction = f(TA Engine output)
    
V2: Basic scenarios (bull/base/bear) with paths and bands
V3: Drift adaptation, self-correction, version tracking
"""

from .prediction_engine import PredictionEngine, build_prediction, get_prediction_engine
from .prediction_engine_v3 import PredictionEngineV3, get_prediction_engine_v3
from .types import (
    PredictionInput,
    PredictionOutput,
    Scenario,
    PathPoint,
    Direction,
    Confidence,
    PatternInput,
    StructureInput,
    IndicatorsInput,
)
from .ta_interpreter import (
    interpret_ta_output,
    build_input_from_raw,
)

__all__ = [
    # V2
    "PredictionEngine",
    "build_prediction",
    "get_prediction_engine",
    # V3
    "PredictionEngineV3",
    "get_prediction_engine_v3",
    # Types
    "PredictionInput",
    "PredictionOutput",
    "Scenario",
    "PathPoint",
    "Direction",
    "Confidence",
    "PatternInput",
    "StructureInput",
    "IndicatorsInput",
    # Interpreter
    "interpret_ta_output",
    "build_input_from_raw",
]
