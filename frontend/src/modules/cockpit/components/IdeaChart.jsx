/**
 * IdeaChart — Lightweight chart for Ideas tab (Graph Sync)
 * =========================================================
 * 
 * Shows candle background + IdeaChartOverlay on top.
 * When no real candle data available, generates mock candles
 * that match the idea's price range.
 * 
 * Props:
 * - idea: selected idea object
 * - activeVersionIndex: which version is currently active
 * - isReplaying: whether replay animation is active
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import styled from 'styled-components';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import IdeaChartOverlay from './IdeaChartOverlay';

const ChartWrapper = styled.div`
  position: relative;
  width: 100%;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
`;

const ChartContainer = styled.div`
  width: 100%;
  height: ${({ $height }) => $height || 320}px;
`;

const ChartModeBadge = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(59, 130, 246, 0.95);
  color: #ffffff;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  z-index: 20;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  pointer-events: none;
`;

const VersionBadge = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  z-index: 20;
  pointer-events: none;
  
  .pattern {
    text-transform: capitalize;
    color: #93c5fd;
  }
  
  .confidence {
    color: ${({ $confidence }) => 
      $confidence >= 0.7 ? '#4ade80' : 
      $confidence >= 0.5 ? '#fbbf24' : '#94a3b8'};
  }
`;

const ReplayIndicator = styled.div`
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: rgba(59, 130, 246, 0.95);
  color: #ffffff;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  z-index: 20;
  box-shadow: 0 2px 12px rgba(59, 130, 246, 0.4);
  pointer-events: none;
  
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ffffff;
    animation: pulse 0.6s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
`;

const PerformanceBadge = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(139, 92, 246, 0.95);
  color: #ffffff;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  z-index: 20;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
  pointer-events: none;
`;

// Build Win/Loss zones from completed ideas
function buildPerformanceZones(allIdeas, idea) {
  if (!allIdeas?.length) return [];
  
  const completed = allIdeas.filter(i => i.status === 'completed');
  if (completed.length === 0) return [];
  
  // Get all price levels and results
  const entries = [];
  for (const i of completed) {
    const lastV = i.versions?.[i.versions.length - 1];
    if (!lastV?.snapshot?.levels) continue;
    const { top, bottom } = lastV.snapshot.levels;
    const isWin = i.outcome === 'success_up' || i.outcome === 'success_down';
    entries.push({ top, bottom, mid: (top + bottom) / 2, isWin, idea: i });
  }
  
  if (entries.length === 0) return [];
  
  // Determine bucket size based on price range
  const allPrices = entries.flatMap(e => [e.top, e.bottom]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP;
  const bucketSize = range > 1000 ? 1000 : range > 100 ? 50 : range > 10 ? 5 : 1;
  
  // Build zone buckets
  const zones = {};
  for (const e of entries) {
    const bucket = Math.floor(e.mid / bucketSize) * bucketSize;
    if (!zones[bucket]) zones[bucket] = { wins: 0, losses: 0 };
    if (e.isWin) zones[bucket].wins++;
    else zones[bucket].losses++;
  }
  
  // Convert to array with stats, limit to 7 zones
  // Skip zones with less than 3 samples (minimum threshold)
  return Object.entries(zones)
    .map(([price, z]) => {
      const total = z.wins + z.losses;
      if (total < 3) return null; // minimum threshold = 3 samples
      return {
        priceFrom: parseFloat(price),
        priceTo: parseFloat(price) + bucketSize,
        winrate: z.wins / total,
        wins: z.wins,
        losses: z.losses,
        samples: total,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.samples - a.samples)
    .slice(0, 7); // max 7 zones
}

// Performance SVG Overlay
const PerformanceOverlay = ({ zones, allIdeas, width, height, chart, priceSeries }) => {
  if (!zones?.length) return null;
  
  const hasChart = chart && priceSeries;
  
  const toY = hasChart
    ? (price) => {
        try {
          const y = priceSeries.priceToCoordinate(price);
          return Number.isFinite(y) ? y : null;
        } catch { return null; }
      }
    : (price) => {
        const allPrices = zones.flatMap(z => [z.priceFrom, z.priceTo]);
        const minP = Math.min(...allPrices) * 0.96;
        const maxP = Math.max(...allPrices) * 1.04;
        return height - 40 - ((price - minP) / (maxP - minP)) * (height - 80);
      };
  
  const normalizeTime = (t) => t > 9999999999 ? Math.floor(t / 1000) : t;
  
  const toX = hasChart
    ? (time) => {
        try {
          const ts = chart.timeScale();
          const x = ts.timeToCoordinate(normalizeTime(time));
          return Number.isFinite(x) ? x : null;
        } catch { return null; }
      }
    : (time) => width / 2;
  
  // Result dots from completed ideas
  const resultDots = (allIdeas || [])
    .filter(i => i.status === 'completed' && i.versions?.length)
    .map(i => {
      const lastV = i.versions[i.versions.length - 1];
      const levels = lastV?.snapshot?.levels;
      if (!levels) return null;
      const isWin = i.outcome === 'success_up' || i.outcome === 'success_down';
      const price = isWin ? levels.top : levels.bottom;
      const time = lastV.timestamp;
      return { x: toX(time), y: toY(price), isWin, idea: i };
    })
    .filter(d => d && d.y != null);
  
  return (
    <svg
      data-testid="performance-overlay"
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 50,
      }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {/* Win/Loss Zones */}
      {zones.map((z, i) => {
        const y1 = toY(z.priceFrom);
        const y2 = toY(z.priceTo);
        if (y1 == null || y2 == null) return null;
        
        const isStrong = z.winrate > 0.65;
        const isWeak = z.winrate < 0.4;
        const color = isStrong ? 'rgba(34,197,94,0.06)' : isWeak ? 'rgba(239,68,68,0.06)' : 'transparent';
        
        if (!isStrong && !isWeak) return null;
        
        return (
          <g key={`zone-${i}`}>
            <rect
              x={0} y={Math.min(y1, y2)}
              width={width} height={Math.abs(y2 - y1)}
              fill={color}
            />
            {/* Label for strong zones */}
            {z.winrate > 0.6 && (
              <text
                x={width - 60} y={(y1 + y2) / 2 + 4}
                fill={isStrong ? '#16a34a' : '#dc2626'}
                fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif"
                opacity={0.6}
              >
                {Math.round(z.winrate * 100)}%
              </text>
            )}
          </g>
        );
      })}
      
      {/* Result Dots */}
      {resultDots.map((d, i) => (
        <g key={`dot-${i}`}>
          <circle
            cx={d.x ?? width / 2} cy={d.y} r={6}
            fill={d.isWin ? '#22c55e' : '#ef4444'}
            opacity={0.8}
            stroke="#ffffff" strokeWidth={1.5}
          />
        </g>
      ))}
    </svg>
  );
};

// Generate mock candles that fit the idea's price range
function generateMockCandles(idea) {
  if (!idea?.versions?.length) return [];
  
  // Gather all prices and times from versions
  const allLevels = idea.versions.map(v => v.snapshot?.levels).filter(Boolean);
  const allTimes = idea.versions.map(v => v.timestamp).filter(Boolean);
  
  if (allLevels.length === 0 || allTimes.length === 0) return [];
  
  const minPrice = Math.min(...allLevels.map(l => l.bottom || l.top || 0).filter(Boolean)) * 0.96;
  const maxPrice = Math.max(...allLevels.map(l => l.top || l.bottom || 0).filter(Boolean)) * 1.04;
  const priceRange = maxPrice - minPrice;
  
  const startTime = Math.min(...allTimes) - 86400 * 5; // 5 days before
  const endTime = Math.max(...allTimes) + 86400 * 5; // 5 days after
  
  // Generate 4H candles
  const interval = 14400; // 4 hours
  const candles = [];
  let prevClose = minPrice + priceRange * 0.4;
  
  // Simple random walk with mean reversion toward middle
  const midPrice = (minPrice + maxPrice) / 2;
  
  for (let t = startTime; t <= endTime; t += interval) {
    const volatility = priceRange * 0.012;
    const meanRevert = (midPrice - prevClose) * 0.02;
    const trend = Math.sin((t - startTime) / 86400 / 3) * volatility * 0.5;
    const noise = (Math.random() - 0.5) * volatility * 2;
    
    const change = meanRevert + trend + noise;
    const open = prevClose;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    
    candles.push({
      time: t,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
    });
    
    prevClose = close;
  }
  
  return candles;
}

const IdeaChart = ({ idea, activeVersionIndex, isReplaying = false, height = 320, chartMode = 'idea', allIdeas = [] }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);
  const [priceSeriesInstance, setPriceSeriesInstance] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  
  // Generate candles for this idea
  const candles = useMemo(() => generateMockCandles(idea), [idea?.idea_id]);
  
  // Active version info
  const activeVersion = idea?.versions?.[activeVersionIndex ?? (idea?.versions?.length - 1)];
  
  // Create/update chart
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;
    
    // Cleanup previous
    if (chartInstanceRef.current) {
      try { chartInstanceRef.current.remove(); } catch {}
      chartInstanceRef.current = null;
    }
    
    const rect = chartRef.current.getBoundingClientRect();
    const w = rect.width || 800;
    
    const chart = createChart(chartRef.current, {
      width: w,
      height,
      layout: {
        background: { type: 'solid', color: '#ffffff' },
        textColor: '#94a3b8',
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#f8fafc' },
        horzLines: { color: '#f8fafc' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#cbd5e1', style: 2, width: 1 },
        horzLine: { color: '#cbd5e1', style: 2, width: 1 },
      },
      rightPriceScale: {
        borderColor: '#f1f5f9',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: '#f1f5f9',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 20,
      },
    });
    
    chartInstanceRef.current = chart;
    setChartInstance(chart);
    setDimensions({ width: w, height });
    
    const priceSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#e2e8f0',
      downColor: '#cbd5e1',
      borderUpColor: '#cbd5e1',
      borderDownColor: '#94a3b8',
      wickUpColor: '#cbd5e1',
      wickDownColor: '#94a3b8',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    
    setPriceSeriesInstance(priceSeries);
    
    // Deduplicate and sort
    const seen = new Set();
    const mapped = candles
      .filter(c => c.time > 0)
      .sort((a, b) => a.time - b.time)
      .filter(c => {
        if (seen.has(c.time)) return false;
        seen.add(c.time);
        return true;
      });
    
    priceSeries.setData(mapped);
    chart.timeScale().fitContent();
    
    // Resize handler
    const handleResize = () => {
      if (chartRef.current && chart) {
        const newRect = chartRef.current.getBoundingClientRect();
        chart.applyOptions({ width: newRect.width });
        setDimensions({ width: newRect.width, height });
      }
    };
    
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartRef.current);
    
    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        try { chartInstanceRef.current.remove(); } catch {}
        chartInstanceRef.current = null;
      }
    };
  }, [candles, height]);
  
  // Performance zones (computed once)
  const performanceZones = useMemo(() => 
    chartMode === 'performance' ? buildPerformanceZones(allIdeas, idea) : [],
    [chartMode, allIdeas, idea]
  );
  
  if (!idea) return null;
  
  return (
    <ChartWrapper data-testid="idea-chart">
      <ChartContainer ref={chartRef} $height={height} />
      
      {/* IDEA MODE: Idea Overlay */}
      {chartMode === 'idea' && (
        <IdeaChartOverlay
          idea={idea}
          activeVersionIndex={activeVersionIndex}
          chart={chartInstance}
          priceSeries={priceSeriesInstance}
          width={dimensions.width}
          height={dimensions.height}
        />
      )}
      
      {/* PERFORMANCE MODE: Win/Loss Zones */}
      {chartMode === 'performance' && (
        <PerformanceOverlay
          zones={performanceZones}
          allIdeas={allIdeas}
          width={dimensions.width}
          height={dimensions.height}
          chart={chartInstance}
          priceSeries={priceSeriesInstance}
        />
      )}
      
      {/* Mode Badge */}
      {chartMode === 'idea' && (
        <ChartModeBadge data-testid="chart-mode-badge">
          IDEA MODE
        </ChartModeBadge>
      )}
      {chartMode === 'performance' && (
        <PerformanceBadge data-testid="performance-mode-badge">
          PERFORMANCE
        </PerformanceBadge>
      )}
      
      {/* Version Info */}
      {chartMode === 'idea' && activeVersion && (
        <VersionBadge
          $confidence={activeVersion.snapshot?.confidence}
          data-testid="chart-version-badge"
        >
          V{activeVersion.v} — 
          <span className="pattern">
            {activeVersion.snapshot?.pattern?.replace(/_/g, ' ')}
          </span>
          <span className="confidence">
            {Math.round((activeVersion.snapshot?.confidence || 0) * 100)}%
          </span>
        </VersionBadge>
      )}
      
      {/* Replay indicator */}
      {isReplaying && (
        <ReplayIndicator data-testid="replay-indicator">
          <span className="dot" />
          Replaying evolution...
        </ReplayIndicator>
      )}
    </ChartWrapper>
  );
};

export default IdeaChart;
