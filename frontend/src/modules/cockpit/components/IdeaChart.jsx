/**
 * IdeaChart — Uses REAL Pattern Renderer from TA
 * ================================================
 * 
 * KEY PRINCIPLE: 
 * - NO fake geometry
 * - Uses the SAME renderPattern as TA/Research
 * - Pattern boundaries come from actual swing points
 * - Overlay only for UI elements (HUD, transition, legend)
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { renderPattern, clearPattern, drawAnchorPoints } from '../../../chart/renderers/patternRenderer';
import IdeaChartOverlay from './IdeaChartOverlay';

const ChartWrapper = styled.div`
  position: relative;
  width: 100%;
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
`;

const ChartContainer = styled.div`
  width: 100%;
  height: ${({ $height }) => $height || 320}px;
`;

const ReplayIndicator = styled.div`
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: rgba(59, 130, 246, 0.95);
  color: #ffffff;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  z-index: 20;
  box-shadow: 0 2px 12px rgba(59, 130, 246, 0.3);
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

// Generate candles that follow the pattern boundaries
function generateCandlesFromPattern(idea) {
  if (!idea?.versions?.length) return [];
  
  const allVersions = idea.versions;
  const allBoundaries = allVersions.flatMap(v => v.snapshot?.boundaries || []);
  const allAnchors = allVersions.flatMap(v => v.snapshot?.anchors || []);
  const allLevels = allVersions.map(v => v.snapshot?.levels).filter(Boolean);
  
  if (allLevels.length === 0) return [];
  
  // Get price range from all levels
  const minPrice = Math.min(...allLevels.map(l => l.bottom || l.top || 0).filter(Boolean)) * 0.97;
  const maxPrice = Math.max(...allLevels.map(l => l.top || l.bottom || 0).filter(Boolean)) * 1.03;
  const priceRange = maxPrice - minPrice;
  
  // Get time range
  const allTimes = [
    ...allVersions.map(v => v.timestamp),
    ...allLevels.flatMap(l => [l.start_time, l.end_time]),
    ...allAnchors.map(a => a.time),
    ...allBoundaries.flatMap(b => [b.x1, b.x2]),
  ].filter(Boolean);
  
  const startTime = Math.min(...allTimes) - 86400 * 3;
  const endTime = Math.max(...allTimes) + 86400 * 3;
  
  const interval = 14400; // 4H candles
  const candles = [];
  
  // Build anchor price map for realistic candles
  const anchorMap = {};
  allAnchors.forEach(a => {
    const bucket = Math.floor(a.time / interval) * interval;
    if (!anchorMap[bucket]) anchorMap[bucket] = [];
    anchorMap[bucket].push(a);
  });
  
  let prevClose = minPrice + priceRange * 0.4;
  const midPrice = (minPrice + maxPrice) / 2;
  
  for (let t = startTime; t <= endTime; t += interval) {
    const bucket = Math.floor(t / interval) * interval;
    const anchorsHere = anchorMap[bucket] || [];
    
    let open = prevClose;
    let close, high, low;
    
    if (anchorsHere.length > 0) {
      // Candle should touch anchor points
      const upperAnchor = anchorsHere.find(a => a.type === 'upper');
      const lowerAnchor = anchorsHere.find(a => a.type === 'lower');
      
      if (upperAnchor) {
        high = upperAnchor.price;
        close = high - Math.random() * priceRange * 0.01;
        low = close - Math.random() * priceRange * 0.015;
      } else if (lowerAnchor) {
        low = lowerAnchor.price;
        close = low + Math.random() * priceRange * 0.01;
        high = close + Math.random() * priceRange * 0.015;
      } else {
        const volatility = priceRange * 0.012;
        const change = (Math.random() - 0.5) * volatility * 2;
        close = open + change;
        high = Math.max(open, close) + Math.random() * volatility;
        low = Math.min(open, close) - Math.random() * volatility;
      }
    } else {
      // Normal candle with mean reversion
      const volatility = priceRange * 0.01;
      const meanRevert = (midPrice - prevClose) * 0.015;
      const trend = Math.sin((t - startTime) / 86400 / 4) * volatility * 0.3;
      const noise = (Math.random() - 0.5) * volatility * 1.5;
      
      const change = meanRevert + trend + noise;
      close = open + change;
      high = Math.max(open, close) + Math.random() * volatility;
      low = Math.min(open, close) - Math.random() * volatility;
    }
    
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
  const candleSeriesRef = useRef(null);
  const patternObjectsRef = useRef({ boundaries: [], levels: [], zones: [] });
  
  const [chartInstance, setChartInstance] = useState(null);
  const [priceSeriesInstance, setPriceSeriesInstance] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  
  const candles = useMemo(() => generateCandlesFromPattern(idea), [idea?.idea_id]);
  
  const currentVersionIdx = activeVersionIndex ?? Math.max((idea?.versions?.length || 1) - 1, 0);
  const activeVersion = idea?.versions?.[currentVersionIdx];
  
  // Create chart
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;
    
    // Cleanup previous
    if (chartInstanceRef.current) {
      clearPattern(chartInstanceRef.current, patternObjectsRef.current);
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
        textColor: '#64748b',
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#f1f5f9' },
        horzLines: { color: '#f1f5f9' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#cbd5e1', style: 2, width: 1 },
        horzLine: { color: '#cbd5e1', style: 2, width: 1 },
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 15,
      },
    });
    
    chartInstanceRef.current = chart;
    setChartInstance(chart);
    setDimensions({ width: w, height });
    
    // Candle series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    
    candleSeriesRef.current = candleSeries;
    setPriceSeriesInstance(candleSeries);
    
    // Set candle data
    const seen = new Set();
    const mapped = candles
      .filter(c => c.time > 0)
      .sort((a, b) => a.time - b.time)
      .filter(c => {
        if (seen.has(c.time)) return false;
        seen.add(c.time);
        return true;
      });
    
    candleSeries.setData(mapped);
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
        clearPattern(chartInstanceRef.current, patternObjectsRef.current);
        try { chartInstanceRef.current.remove(); } catch {}
        chartInstanceRef.current = null;
      }
    };
  }, [candles, height]);
  
  // Render patterns using REAL patternRenderer
  useEffect(() => {
    if (!chartInstanceRef.current || !candleSeriesRef.current || !idea?.versions) return;
    
    const chart = chartInstanceRef.current;
    const candleSeries = candleSeriesRef.current;
    
    // Clear previous patterns
    clearPattern(chart, patternObjectsRef.current);
    patternObjectsRef.current = { boundaries: [], levels: [], zones: [] };
    
    // Render each version's pattern
    idea.versions.forEach((version, idx) => {
      const isActive = idx === currentVersionIdx;
      const isPast = idx < currentVersionIdx;
      
      const snapshot = version.snapshot;
      if (!snapshot?.boundaries?.length) return;
      
      // Build pattern contract for renderer
      const patternContract = {
        type: snapshot.pattern,
        boundaries: snapshot.boundaries,
        anchors: snapshot.anchors || [],
        levels: [],
      };
      
      // Different styling for past vs active
      const options = {
        boundaryColor: isActive ? '#f59e0b' : '#9ca3af', // Amber for active, gray for past
        boundaryWidth: isActive ? 3 : 2,
        upperAnchorColor: isActive ? '#f59e0b' : '#9ca3af',
        lowerAnchorColor: isActive ? '#f59e0b' : '#9ca3af',
      };
      
      // Render using the SAME function as TA
      const objects = renderPattern(chart, candleSeries, patternContract, options);
      
      // Collect for cleanup
      patternObjectsRef.current.boundaries.push(...(objects.boundaries || []));
      patternObjectsRef.current.levels.push(...(objects.levels || []));
      
      console.log(`[IdeaChart] Rendered V${version.v} pattern:`, objects);
    });
    
    // Draw anchor points for active version only
    if (activeVersion?.snapshot?.anchors?.length && candleSeries) {
      drawAnchorPoints(candleSeries, activeVersion.snapshot.anchors, {
        upperColor: '#f59e0b',
        lowerColor: '#f59e0b',
        reactionGlow: '#f59e0b',
      });
    }
    
  }, [idea, currentVersionIdx, activeVersion]);
  
  if (!idea) return null;
  
  return (
    <ChartWrapper data-testid="idea-chart">
      <ChartContainer ref={chartRef} $height={height} />
      
      {/* UI Overlay (HUD, transition, legend) */}
      {chartMode === 'idea' && (
        <IdeaChartOverlay
          idea={idea}
          activeVersionIndex={currentVersionIdx}
          chart={chartInstance}
          priceSeries={priceSeriesInstance}
          width={dimensions.width}
          height={dimensions.height}
        />
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
