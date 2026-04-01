"""
Binance Market Data Provider (sync)

Uses Binance US public API (no auth required).
Native 4h and 1d support — no aggregation hacks.

Rate limit: ~1200 req/min (public).
We add 100ms delay between requests.
"""

import time
import threading
from typing import List, Dict, Any, Optional

import httpx

from .provider import MarketDataProvider


# Binance kline intervals
_TF_MAP = {
    "4H": "4h",
    "1D": "1d",
    "1H": "1h",
}

# Cache: key = "BTCUSDT:4H" → (timestamp, candles)
_cache: Dict[str, tuple] = {}
_cache_lock = threading.Lock()
_CACHE_TTL = 300  # 5 minutes


def _normalize_symbol(symbol: str) -> str:
    """
    Normalize symbol to Binance format: BTCUSDT.
    
    Accepts: BTC, btc, BTCUSDT, btcusdt, BTC-USD
    """
    s = symbol.upper().replace("-USD", "").replace("-USDT", "")
    if not s.endswith("USDT"):
        s = s + "USDT"
    return s


class BinanceProvider(MarketDataProvider):
    """
    Sync Binance US data provider.
    
    - Uses public API (no keys)
    - Native 4h, 1d timeframes
    - Thread-safe cache (5 min TTL)
    - Rate-limited (100ms between requests)
    """
    
    BASE_URL = "https://api.binance.us/api/v3"
    
    def __init__(self):
        self._last_request_time = 0.0
        self._rate_limit_ms = 100  # ms between requests
    
    def get_provider_name(self) -> str:
        return "binance_us"
    
    def supports_symbol(self, symbol: str) -> bool:
        return symbol.upper().endswith("USDT")
    
    def supports_timeframe(self, timeframe: str) -> bool:
        return timeframe.upper() in _TF_MAP
    
    def get_candles(
        self,
        symbol: str,
        timeframe: str,
        limit: int = 200,
    ) -> List[Dict[str, Any]]:
        """
        Fetch candles from Binance US.
        
        Uses cache to avoid hammering API during batch scans.
        Accepts: BTC, BTCUSDT, btcusdt → normalized to BTCUSDT
        """
        tf_upper = timeframe.upper()
        sym_upper = _normalize_symbol(symbol)
        
        # Check cache first
        cache_key = f"{sym_upper}:{tf_upper}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached[-limit:] if len(cached) > limit else cached
        
        # Map timeframe
        interval = _TF_MAP.get(tf_upper)
        if not interval:
            raise ValueError(f"Unsupported timeframe: {timeframe}. Supported: {list(_TF_MAP.keys())}")
        
        # Rate limit
        self._rate_limit()
        
        # Fetch
        candles = self._fetch(sym_upper, interval, limit)
        
        # Cache result
        self._set_cached(cache_key, candles)
        
        return candles
    
    def _fetch(
        self,
        symbol: str,
        interval: str,
        limit: int,
    ) -> List[Dict[str, Any]]:
        """Raw HTTP fetch from Binance US."""
        url = f"{self.BASE_URL}/klines"
        params = {
            "symbol": symbol,
            "interval": interval,
            "limit": min(limit, 1000),
        }
        
        try:
            resp = httpx.get(url, params=params, timeout=15)
            
            if resp.status_code != 200:
                print(f"[BinanceProvider] HTTP {resp.status_code} for {symbol}:{interval}")
                return []
            
            raw = resp.json()
            if not isinstance(raw, list):
                print(f"[BinanceProvider] Unexpected response for {symbol}: {str(raw)[:200]}")
                return []
            
            # Convert Binance kline format to unified candle format
            candles = []
            for k in raw:
                candles.append({
                    "time": int(k[0]) // 1000,  # ms → seconds
                    "open": float(k[1]),
                    "high": float(k[2]),
                    "low": float(k[3]),
                    "close": float(k[4]),
                    "volume": float(k[5]),
                })
            
            # Sort by time ascending (Binance already returns ascending, but be safe)
            candles.sort(key=lambda c: c["time"])
            
            return candles
        
        except httpx.TimeoutException:
            print(f"[BinanceProvider] Timeout for {symbol}:{interval}")
            return []
        except Exception as e:
            print(f"[BinanceProvider] Error for {symbol}:{interval}: {e}")
            return []
    
    def _rate_limit(self):
        """Simple rate limiter — 100ms between requests."""
        now = time.time()
        elapsed_ms = (now - self._last_request_time) * 1000
        if elapsed_ms < self._rate_limit_ms:
            time.sleep((self._rate_limit_ms - elapsed_ms) / 1000)
        self._last_request_time = time.time()
    
    def _get_cached(self, key: str) -> Optional[List[Dict]]:
        """Get from cache if fresh."""
        with _cache_lock:
            if key in _cache:
                ts, data = _cache[key]
                if time.time() - ts < _CACHE_TTL:
                    return data
                else:
                    del _cache[key]
        return None
    
    def _set_cached(self, key: str, data: List[Dict]):
        """Store in cache."""
        with _cache_lock:
            _cache[key] = (time.time(), data)


# Singleton
_provider: Optional[BinanceProvider] = None


def get_market_data_provider() -> BinanceProvider:
    """Get singleton market data provider."""
    global _provider
    if _provider is None:
        _provider = BinanceProvider()
    return _provider
