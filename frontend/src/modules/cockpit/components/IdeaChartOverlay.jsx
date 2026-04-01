/**
 * IdeaChartOverlay.jsx — Renders idea versions on chart (SVG)
 * =============================================================
 * 
 * Shows:
 * - Active version (bright, full opacity)
 * - Ghost versions (faded, dashed — older versions)
 * - Result markers (green/red dots at breakout/invalidation point)
 * - Transition animation between versions (CSS)
 * 
 * IMPORTANT: Overlay is SYNCED with chart movement!
 * Uses useEffect to subscribe to timeScale changes.
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';

// ============================================
// STYLES — Light Theme
// ============================================
const STYLES = {
  ghost: {
    stroke: '#94a3b8',
    opacity: 0.18,
    strokeWidth: 1.5,
    strokeDasharray: '8 5',
  },
  active: {
    stroke: '#3b82f6',
    opacity: 1,
    strokeWidth: 2.5,
    strokeDasharray: 'none',
  },
  result: {
    correct: { fill: '#22c55e', stroke: '#16a34a' },
    wrong: { fill: '#ef4444', stroke: '#dc2626' },
    neutral: { fill: '#94a3b8', stroke: '#64748b' },
  },
  colors: {
    resistance: '#ef4444',
    support: '#22c55e',
    triangle: '#f59e0b',
    label: '#3b82f6',
  }
};

// ============================================
// MAIN COMPONENT
// ============================================
const IdeaChartOverlay = ({ 
  idea,
  activeVersionIndex,
  chart,
  priceSeries,
  width = 800,
  height = 320,
}) => {
  const versions = idea?.versions || [];
  const currentIdx = activeVersionIndex ?? Math.max(versions.length - 1, 0);
  
  // Force re-render on chart movement
  const [, forceUpdate] = useState(0);
  
  // Subscribe to chart changes for SYNCED overlay
  useEffect(() => {
    if (!chart) return;
    
    const handleTimeScaleChange = () => {
      forceUpdate(n => n + 1);
    };
    
    // Subscribe to time scale changes (pan, zoom)
    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleTimeRangeChange(handleTimeScaleChange);
    timeScale.subscribeVisibleLogicalRangeChange(handleTimeScaleChange);
    
    // Subscribe to price scale changes
    const priceScale = chart.priceScale('right');
    if (priceScale && priceScale.subscribeVisiblePriceRangeChange) {
      priceScale.subscribeVisiblePriceRangeChange(handleTimeScaleChange);
    }
    
    return () => {
      try {
        timeScale.unsubscribeVisibleTimeRangeChange(handleTimeScaleChange);
        timeScale.unsubscribeVisibleLogicalRangeChange(handleTimeScaleChange);
        if (priceScale && priceScale.unsubscribeVisiblePriceRangeChange) {
          priceScale.unsubscribeVisiblePriceRangeChange(handleTimeScaleChange);
        }
      } catch {}
    };
  }, [chart]);
  
  // Coordinate system
  const hasChart = chart && priceSeries;
  
  const normalizeTime = (t) => {
    if (!t) return null;
    return t > 9999999999 ? Math.floor(t / 1000) : t;
  };
  
  // Build coordinate mappers — now recalculates on each render (chart movement)
  const toX = useCallback((time) => {
    if (hasChart) {
      try {
        const ts = chart.timeScale();
        const normalized = normalizeTime(time);
        if (!normalized) return null;
        const x = ts.timeToCoordinate(normalized);
        return Number.isFinite(x) ? x : null;
      } catch { return null; }
    }
    
    if (versions.length === 0) return width / 2;
    
    // Fallback: linear mapping
    const allTimes = versions.flatMap(v => 
      [v.timestamp, v.snapshot?.levels?.start_time, v.snapshot?.levels?.end_time].filter(Boolean)
    );
    const minT = Math.min(...allTimes) - 86400 * 2;
    const maxT = Math.max(...allTimes) + 86400 * 2;
    const normalized = normalizeTime(time);
    if (!normalized) return width / 2;
    return 40 + ((normalized - minT) / (maxT - minT + 1)) * (width - 80);
  }, [hasChart, chart, versions, width]);
  
  const toY = useCallback((price) => {
    if (hasChart) {
      try {
        if (price == null) return null;
        const y = priceSeries.priceToCoordinate(price);
        return Number.isFinite(y) ? y : null;
      } catch { return null; }
    }
    
    if (versions.length === 0) return height / 2;
    
    // Fallback
    const allPrices = versions.flatMap(v => [
      v.snapshot?.levels?.top, v.snapshot?.levels?.bottom
    ].filter(Boolean));
    const minP = Math.min(...allPrices) * 0.96;
    const maxP = Math.max(...allPrices) * 1.04;
    if (price == null) return height / 2;
    return height - 40 - ((price - minP) / (maxP - minP)) * (height - 80);
  }, [hasChart, priceSeries, versions, height]);
  
  if (versions.length === 0) return null;
  
  // ============================================
  // RENDER VERSION
  // ============================================
  const renderVersion = (version, idx, isActive) => {
    const snapshot = version.snapshot;
    if (!snapshot?.levels) return null;
    
    const style = isActive ? STYLES.active : STYLES.ghost;
    const levels = snapshot.levels;
    const elements = [];
    const key = `v-${idx}`;
    
    // Time range
    const startTime = levels.start_time || version.timestamp;
    const endTime = levels.end_time || (version.timestamp + 86400 * 7);
    
    const x1 = toX(startTime);
    const x2 = toX(endTime);
    const yTop = toY(levels.top);
    const yBottom = toY(levels.bottom);
    
    // Skip if coordinates are out of view
    if (x1 == null || x2 == null || yTop == null || yBottom == null) return null;
    
    const patternName = snapshot.pattern || '';
    const isTriangle = patternName.includes('triangle') || patternName.includes('wedge');
    const isRange = patternName.includes('rectangle') || patternName.includes('range') || patternName.includes('head');
    
    // Fill area
    const fillOpacity = isActive ? 0.08 : 0.03;
    const fillColor = isActive ? '#3b82f6' : '#94a3b8';
    
    if (isTriangle) {
      // Triangle/wedge — converging trendlines
      const apexX = x2;
      const midY = (yTop + yBottom) / 2;
      
      // Fill polygon
      elements.push(
        <polygon
          key={`${key}-fill`}
          points={`${x1},${yTop} ${apexX},${midY} ${x1},${yBottom}`}
          fill={fillColor}
          opacity={fillOpacity}
        />
      );
      
      // Upper trendline
      elements.push(
        <line key={`${key}-upper`}
          x1={x1} y1={yTop} x2={apexX} y2={midY}
          stroke={isActive ? STYLES.colors.triangle : style.stroke}
          strokeWidth={style.strokeWidth}
          strokeDasharray={style.strokeDasharray}
          opacity={style.opacity}
        />
      );
      
      // Lower trendline
      elements.push(
        <line key={`${key}-lower`}
          x1={x1} y1={yBottom} x2={apexX} y2={midY}
          stroke={isActive ? STYLES.colors.triangle : style.stroke}
          strokeWidth={style.strokeWidth}
          strokeDasharray={style.strokeDasharray}
          opacity={style.opacity}
        />
      );
    } else {
      // Range box (rectangle, head_and_shoulders, etc.)
      const rectX = Math.min(x1, x2);
      const rectY = Math.min(yTop, yBottom);
      const rectW = Math.abs(x2 - x1);
      const rectH = Math.abs(yBottom - yTop);
      
      // Fill box
      elements.push(
        <rect key={`${key}-fill`}
          x={rectX} y={rectY} width={rectW} height={rectH}
          fill={fillColor} opacity={fillOpacity}
          rx={2}
        />
      );
      
      // Resistance line
      elements.push(
        <line key={`${key}-res`}
          x1={x1} y1={yTop} x2={x2} y2={yTop}
          stroke={isActive ? STYLES.colors.resistance : style.stroke}
          strokeWidth={style.strokeWidth}
          strokeDasharray={style.strokeDasharray}
          opacity={style.opacity}
        />
      );
      
      // Support line
      elements.push(
        <line key={`${key}-sup`}
          x1={x1} y1={yBottom} x2={x2} y2={yBottom}
          stroke={isActive ? STYLES.colors.support : style.stroke}
          strokeWidth={style.strokeWidth}
          strokeDasharray={style.strokeDasharray}
          opacity={style.opacity}
        />
      );
    }
    
    // Labels (active version only)
    if (isActive) {
      // Resistance label
      elements.push(
        <text key={`${key}-res-lbl`}
          x={x2 + 8} y={yTop + 4}
          fill={STYLES.colors.resistance}
          fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif"
        >
          R {levels.top?.toLocaleString()}
        </text>
      );
      
      // Support label
      elements.push(
        <text key={`${key}-sup-lbl`}
          x={x2 + 8} y={yBottom + 4}
          fill={STYLES.colors.support}
          fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif"
        >
          S {levels.bottom?.toLocaleString()}
        </text>
      );
    }
    
    // Version badge
    const badgeFill = isActive ? 'rgba(59, 130, 246, 0.12)' : 'rgba(148, 163, 184, 0.08)';
    const badgeStroke = isActive ? '#3b82f6' : '#94a3b8';
    const badgeText = isActive ? '#3b82f6' : '#64748b';
    
    elements.push(
      <g key={`${key}-badge`} opacity={style.opacity}>
        <rect
          x={x1 + 6} y={yTop - 24}
          width={52} height={18} rx={4}
          fill={badgeFill} stroke={badgeStroke} strokeWidth={0.8}
        />
        <text
          x={x1 + 12} y={yTop - 11}
          fill={badgeText} fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif"
        >
          V{version.v}
        </text>
      </g>
    );
    
    return elements;
  };
  
  // ============================================
  // RENDER RESULT MARKER
  // ============================================
  const renderResultMarker = () => {
    if (idea.status !== 'completed') return null;
    
    const lastVersion = versions[versions.length - 1];
    const levels = lastVersion.snapshot?.levels;
    if (!levels) return null;
    
    const resultPrice = idea.outcome === 'success_up' 
      ? levels.top * 1.015
      : idea.outcome === 'success_down' 
        ? levels.bottom * 0.985
        : (levels.top + levels.bottom) / 2;
    
    const resultTime = (levels.end_time || lastVersion.timestamp) + 86400 * 2;
    
    const x = toX(resultTime);
    const y = toY(resultPrice);
    
    // Skip if out of view
    if (x == null || y == null) return null;
    
    const isCorrect = idea.outcome === 'success_up' || idea.outcome === 'success_down';
    const isWrong = idea.outcome === 'invalidated';
    
    const resultType = isCorrect ? 'correct' : isWrong ? 'wrong' : 'neutral';
    const colors = STYLES.result[resultType];
    
    return (
      <g key="result-marker">
        {/* Vertical event line */}
        <line
          x1={x} y1={0} x2={x} y2={height}
          stroke={colors.fill} strokeWidth={1}
          strokeDasharray="4 4" opacity={0.25}
        />
        
        {/* Glow circle */}
        <circle cx={x} cy={y} r={20}
          fill={colors.fill} opacity={0.08}
        />
        
        {/* Main circle */}
        <circle cx={x} cy={y} r={14}
          fill={colors.fill} opacity={0.9}
          stroke={colors.stroke} strokeWidth={2}
        />
        
        {/* Symbol */}
        <text
          x={x} y={y + 5} textAnchor="middle"
          fill="white" fontSize="13" fontWeight="bold"
          fontFamily="Inter, sans-serif"
        >
          {isCorrect ? '\u2714' : isWrong ? '\u2716' : '\u2022'}
        </text>
        
        {/* Label */}
        <text
          x={x} y={y + 32} textAnchor="middle"
          fill={colors.fill} fontSize="10" fontWeight="600"
          fontFamily="Inter, sans-serif"
        >
          {idea.outcome === 'success_up' ? 'Breakout UP' :
           idea.outcome === 'success_down' ? 'Breakdown' :
           idea.outcome === 'invalidated' ? 'Invalidated' : 'Neutral'}
        </text>
      </g>
    );
  };
  
  // ============================================
  // RENDER CONFIDENCE EVOLUTION LINE
  // ============================================
  const renderConfidenceLine = () => {
    if (versions.length < 2) return null;
    
    const points = versions.map((v, i) => {
      const prob = v.snapshot?.probability?.up || v.snapshot?.confidence || 0.5;
      const x = toX(v.timestamp);
      // Map probability to Y: use a narrow band at top of chart
      const bandTop = height * 0.08;
      const bandBottom = height * 0.22;
      const y = bandTop + (1 - prob) * (bandBottom - bandTop);
      return { x, y, prob, v: v.v };
    }).filter(p => p.x != null);
    
    if (points.length < 2) return null;
    
    // Build SVG path
    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
    
    const isImproving = points.length >= 2 && 
      points[points.length - 1].prob > points[0].prob;
    
    return (
      <g key="confidence-line" data-testid="confidence-line">
        {/* Line - opacity ≤ 0.7, strokeWidth = 2 */}
        <path
          d={pathD}
          stroke="#3b82f6"
          strokeWidth={2}
          fill="none"
          opacity={0.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Dots + labels */}
        {points.map((p, i) => (
          <g key={`conf-dot-${i}`}>
            {/* Subtle glow */}
            <circle cx={p.x} cy={p.y} r={6}
              fill="#3b82f6" opacity={0.1}
            />
            {/* Dot */}
            <circle cx={p.x} cy={p.y} r={3.5}
              fill="#3b82f6" stroke="#ffffff" strokeWidth={1.5}
            />
            {/* Label */}
            <text
              x={p.x} y={p.y - 8}
              textAnchor="middle" fill="#3b82f6"
              fontSize="9" fontWeight="700" fontFamily="Inter, sans-serif"
              opacity={0.85}
            >
              {Math.round(p.prob * 100)}%
            </text>
          </g>
        ))}
        
        {/* Trend arrow - only at end */}
        {points.length >= 2 && (
          <text
            x={points[points.length - 1].x + 12}
            y={points[points.length - 1].y + 4}
            fill={isImproving ? '#22c55e' : '#ef4444'}
            fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif"
            opacity={0.8}
          >
            {isImproving ? '↑' : '↓'}
          </text>
        )}
      </g>
    );
  };
  
  // ============================================
  // MAIN RENDER — NO viewBox, pixel-perfect coordinates
  // ============================================
  return (
    <svg
      data-testid="idea-chart-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 55,
      }}
    >
      {/* Ghost versions (older) */}
      {versions.map((v, i) => (
        i !== currentIdx && (
          <g key={`ghost-${i}`}>
            {renderVersion(v, i, false)}
          </g>
        )
      ))}
      
      {/* Active version */}
      <g key="active-version">
        {renderVersion(versions[currentIdx], currentIdx, true)}
      </g>
      
      {/* Confidence evolution line */}
      {renderConfidenceLine()}
      
      {/* Result marker */}
      {renderResultMarker()}
    </svg>
  );
};

export default IdeaChartOverlay;
