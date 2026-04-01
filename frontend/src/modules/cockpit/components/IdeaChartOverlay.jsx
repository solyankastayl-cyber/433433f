/**
 * IdeaChartOverlay.jsx — COORDINATE-BOUND Evolution Overlay
 * ==========================================================
 * 
 * CRITICAL FIX: All overlay elements are now BOUND to chart coordinates.
 * When candles move (pan/zoom), overlay moves WITH them.
 * 
 * Architecture:
 * 1. Subscribe to ALL chart events (time scale, price scale, resize)
 * 2. Use chart.timeScale().timeToCoordinate() for X
 * 3. Use priceSeries.priceToCoordinate() for Y
 * 4. Re-render on EVERY change (debounced)
 * 5. Version segments with proper start/end times
 */

import React, { useEffect, useRef, useCallback } from 'react';

// ============================================
// COLOR PALETTE
// ============================================
const COLORS = {
  ghost: { stroke: '#94a3b8', fill: 'rgba(148, 163, 184, 0.06)' },
  active: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.08)' },
  triangle: '#f59e0b',
  rectangle: '#3b82f6',
  resistance: '#ef4444',
  support: '#22c55e',
  win: '#22c55e',
  loss: '#ef4444',
  expected: '#8b5cf6',
  versionLine: 'rgba(59, 130, 246, 0.5)',
  connection: 'rgba(148, 163, 184, 0.4)',
  confidence: '#3b82f6',
  text: '#334155',
  textMuted: '#64748b',
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
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  
  const versions = idea?.versions || [];
  const currentIdx = activeVersionIndex ?? Math.max(versions.length - 1, 0);
  
  // ============================================
  // COORDINATE CONVERTERS (called fresh each render)
  // ============================================
  const normalizeTime = (t) => {
    if (!t) return null;
    return t > 9999999999 ? Math.floor(t / 1000) : t;
  };
  
  const toX = useCallback((time) => {
    if (!chart || !time) return null;
    try {
      const ts = chart.timeScale();
      const normalized = normalizeTime(time);
      if (!normalized) return null;
      const x = ts.timeToCoordinate(normalized);
      return Number.isFinite(x) ? x : null;
    } catch { return null; }
  }, [chart]);
  
  const toY = useCallback((price) => {
    if (!priceSeries || price == null) return null;
    try {
      const y = priceSeries.priceToCoordinate(price);
      return Number.isFinite(y) ? y : null;
    } catch { return null; }
  }, [priceSeries]);
  
  // ============================================
  // RENDER FUNCTION (called on every change)
  // ============================================
  const render = useCallback(() => {
    if (!canvasRef.current || !chart || !priceSeries || versions.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get actual container size
    const rect = canvas.parentElement?.getBoundingClientRect();
    const w = rect?.width || width;
    const h = rect?.height || height;
    
    // Set canvas size (important for proper rendering)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    
    // Clear
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    
    // ========================================
    // HELPER FUNCTIONS
    // ========================================
    const drawLine = (x1, y1, x2, y2, opts = {}) => {
      if (x1 == null || y1 == null || x2 == null || y2 == null) return;
      ctx.save();
      ctx.globalAlpha = opts.opacity ?? 1;
      ctx.strokeStyle = opts.color || '#000';
      ctx.lineWidth = opts.width || 2;
      if (opts.dashed) ctx.setLineDash(opts.dashed);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    };
    
    const drawRect = (x, y, width, height, opts = {}) => {
      if (x == null || y == null) return;
      ctx.save();
      ctx.globalAlpha = opts.opacity ?? 0.1;
      ctx.fillStyle = opts.fill || '#000';
      ctx.fillRect(x, y, width, height);
      ctx.restore();
    };
    
    const drawPolygon = (points, opts = {}) => {
      if (points.length < 3 || points.some(p => p.x == null || p.y == null)) return;
      ctx.save();
      ctx.globalAlpha = opts.opacity ?? 0.1;
      ctx.fillStyle = opts.fill || '#000';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    
    const drawCircle = (x, y, r, opts = {}) => {
      if (x == null || y == null) return;
      ctx.save();
      ctx.globalAlpha = opts.opacity ?? 1;
      ctx.fillStyle = opts.fill || '#000';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (opts.stroke) {
        ctx.strokeStyle = opts.stroke;
        ctx.lineWidth = opts.strokeWidth || 2;
        ctx.stroke();
      }
      ctx.restore();
    };
    
    const drawText = (text, x, y, opts = {}) => {
      if (x == null || y == null) return;
      ctx.save();
      ctx.globalAlpha = opts.opacity ?? 1;
      ctx.fillStyle = opts.color || COLORS.text;
      ctx.font = opts.font || '11px Inter, sans-serif';
      ctx.textAlign = opts.align || 'left';
      ctx.textBaseline = opts.baseline || 'middle';
      ctx.fillText(text, x, y);
      ctx.restore();
    };
    
    const drawBadge = (text, x, y, opts = {}) => {
      if (x == null || y == null) return;
      ctx.save();
      const padding = { x: 8, y: 4 };
      ctx.font = opts.font || 'bold 10px Inter, sans-serif';
      const metrics = ctx.measureText(text);
      const bw = metrics.width + padding.x * 2;
      const bh = 18;
      
      ctx.globalAlpha = opts.bgOpacity ?? 0.9;
      ctx.fillStyle = opts.bg || 'rgba(59, 130, 246, 0.15)';
      ctx.beginPath();
      ctx.roundRect(x, y - bh/2, bw, bh, 4);
      ctx.fill();
      
      if (opts.border) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = opts.border;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
      ctx.fillStyle = opts.color || COLORS.active.stroke;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + padding.x, y);
      ctx.restore();
    };
    
    // ========================================
    // 1. VERSION BOUNDARY LINES (Vertical separators)
    // ========================================
    versions.forEach((v, idx) => {
      if (idx === 0) return;
      
      // Use version timestamp as transition point
      const transitionTime = v.timestamp;
      const x = toX(transitionTime);
      if (x == null) return;
      
      // Vertical dashed line spanning full height
      ctx.save();
      ctx.strokeStyle = COLORS.versionLine;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.restore();
      
      // Badge at transition point
      drawBadge(`V${v.v} START`, x + 8, 24, {
        bg: 'rgba(59, 130, 246, 0.15)',
        border: COLORS.active.stroke,
        color: COLORS.active.stroke,
      });
    });
    
    // ========================================
    // 2. PATTERN OVERLAYS (Ghost + Active)
    // ========================================
    versions.forEach((v, idx) => {
      const snapshot = v.snapshot;
      if (!snapshot?.levels) return;
      
      const isActive = idx === currentIdx;
      const isPast = idx < currentIdx;
      const levels = snapshot.levels;
      
      // TIME SEGMENT for this version
      const startTime = levels.start_time || v.timestamp;
      const endTime = levels.end_time || (v.timestamp + 86400 * 7);
      
      // Convert to chart coordinates
      const x1 = toX(startTime);
      const x2 = toX(endTime);
      const yTop = toY(levels.top);
      const yBottom = toY(levels.bottom);
      
      // Skip if ANY coordinate is out of view
      if (x1 == null || x2 == null || yTop == null || yBottom == null) return;
      
      const patternName = snapshot.pattern || '';
      const isTriangle = patternName.includes('triangle') || patternName.includes('wedge');
      
      // Style based on version state
      const opacity = isActive ? 1 : isPast ? 0.4 : 0.5;
      const lineWidth = isActive ? 2.5 : 2;
      const dashed = !isActive ? [8, 5] : null;
      const fillOpacity = isActive ? 0.1 : 0.06;
      
      const patternColor = isTriangle ? COLORS.triangle : COLORS.rectangle;
      const actualColor = isActive ? patternColor : COLORS.ghost.stroke;
      
      if (isTriangle) {
        // TRIANGLE: converging trendlines
        const apexX = x2;
        const midY = (yTop + yBottom) / 2;
        
        // Fill triangle area
        drawPolygon([
          { x: x1, y: yTop },
          { x: apexX, y: midY },
          { x: x1, y: yBottom },
        ], { fill: actualColor, opacity: fillOpacity });
        
        // Upper trendline (Resistance)
        drawLine(x1, yTop, apexX, midY, {
          color: isActive ? COLORS.resistance : actualColor,
          width: lineWidth,
          opacity,
          dashed,
        });
        
        // Lower trendline (Support)
        drawLine(x1, yBottom, apexX, midY, {
          color: isActive ? COLORS.support : actualColor,
          width: lineWidth,
          opacity,
          dashed,
        });
      } else {
        // RECTANGLE: horizontal support/resistance
        const rectX = Math.min(x1, x2);
        const rectY = Math.min(yTop, yBottom);
        const rectW = Math.abs(x2 - x1);
        const rectH = Math.abs(yBottom - yTop);
        
        // Fill rectangle area
        drawRect(rectX, rectY, rectW, rectH, { fill: actualColor, opacity: fillOpacity });
        
        // Resistance line (top)
        drawLine(x1, yTop, x2, yTop, {
          color: isActive ? COLORS.resistance : actualColor,
          width: lineWidth,
          opacity,
          dashed,
        });
        
        // Support line (bottom)
        drawLine(x1, yBottom, x2, yBottom, {
          color: isActive ? COLORS.support : actualColor,
          width: lineWidth,
          opacity,
          dashed,
        });
      }
      
      // VERSION BADGE on pattern
      const badgeLabel = isPast 
        ? `V${v.v} ${patternName.replace(/_/g, ' ')}`
        : `V${v.v}`;
      
      drawBadge(badgeLabel, x1 + 4, yTop - 16, {
        bg: isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.15)',
        border: isActive ? COLORS.active.stroke : COLORS.ghost.stroke,
        color: isActive ? COLORS.active.stroke : COLORS.ghost.stroke,
        bgOpacity: isPast ? 0.7 : 0.9,
      });
      
      // PRICE LABELS (active only)
      if (isActive) {
        drawText(`R ${levels.top?.toLocaleString()}`, x2 + 10, yTop, {
          color: COLORS.resistance,
          font: 'bold 11px Inter, sans-serif',
        });
        drawText(`S ${levels.bottom?.toLocaleString()}`, x2 + 10, yBottom, {
          color: COLORS.support,
          font: 'bold 11px Inter, sans-serif',
        });
      }
    });
    
    // ========================================
    // 3. CONNECTION BETWEEN VERSIONS
    // ========================================
    for (let i = 1; i < versions.length; i++) {
      const prev = versions[i - 1];
      const curr = versions[i];
      
      const prevLevels = prev.snapshot?.levels;
      const currLevels = curr.snapshot?.levels;
      if (!prevLevels || !currLevels) continue;
      
      // Connect END of prev pattern to START of current pattern
      const prevEndTime = prevLevels.end_time || (prev.timestamp + 86400 * 7);
      const currStartTime = currLevels.start_time || curr.timestamp;
      
      const prevMidPrice = (prevLevels.top + prevLevels.bottom) / 2;
      const currMidPrice = (currLevels.top + currLevels.bottom) / 2;
      
      const x1 = toX(prevEndTime);
      const y1 = toY(prevMidPrice);
      const x2 = toX(currStartTime);
      const y2 = toY(currMidPrice);
      
      // Draw connection curve
      if (x1 != null && y1 != null && x2 != null && y2 != null) {
        ctx.save();
        ctx.strokeStyle = COLORS.connection;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        // Bezier curve for smooth connection
        const cpX = (x1 + x2) / 2;
        ctx.quadraticCurveTo(cpX, y1, x2, y2);
        ctx.stroke();
        ctx.restore();
        
        // Connection dots
        drawCircle(x1, y1, 4, { fill: COLORS.ghost.stroke, opacity: 0.5 });
        drawCircle(x2, y2, 5, { fill: COLORS.active.stroke, opacity: 0.7 });
      }
    }
    
    // ========================================
    // 4. EXPECTED PATH (Prediction arrow)
    // ========================================
    const activeVersion = versions[currentIdx];
    if (activeVersion?.snapshot?.levels) {
      const levels = activeVersion.snapshot.levels;
      const bias = activeVersion.snapshot.bias || 'bullish';
      const endTime = levels.end_time || (activeVersion.timestamp + 86400 * 7);
      
      // Project from pattern endpoint
      const startPrice = bias === 'bullish' ? levels.top : levels.bottom;
      const targetPrice = bias === 'bullish' 
        ? levels.top * 1.04  
        : levels.bottom * 0.96;
      
      // TIME-BOUND projection (not decorative!)
      const projectionTime = endTime + 86400 * 3; // 3 days projection
      
      const x1 = toX(endTime);
      const y1 = toY(startPrice);
      const x2 = toX(projectionTime);
      const y2 = toY(targetPrice);
      
      if (x1 != null && y1 != null && x2 != null && y2 != null) {
        // Dashed prediction line
        ctx.save();
        ctx.strokeStyle = COLORS.expected;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
        
        // Arrow head
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 10;
        ctx.save();
        ctx.fillStyle = COLORS.expected;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
          x2 - arrowSize * Math.cos(angle - Math.PI / 6),
          y2 - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          x2 - arrowSize * Math.cos(angle + Math.PI / 6),
          y2 - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        
        // Label
        drawText('EXPECTED', x2 + 8, y2, {
          color: COLORS.expected,
          font: 'bold 10px Inter, sans-serif',
          opacity: 0.9,
        });
      }
    }
    
    // ========================================
    // 5. RESULT MARKER (Win/Loss at resolution point)
    // ========================================
    if (idea.status === 'completed') {
      const lastVersion = versions[versions.length - 1];
      const levels = lastVersion.snapshot?.levels;
      if (levels) {
        const isWin = idea.outcome === 'success_up' || idea.outcome === 'success_down';
        
        // ACTUAL RESOLUTION POINT (price and time)
        const resolutionPrice = idea.outcome === 'success_up' 
          ? levels.top * 1.01
          : idea.outcome === 'success_down' 
            ? levels.bottom * 0.99
            : (levels.top + levels.bottom) / 2;
        
        // Resolution time = end of pattern + buffer
        const resolutionTime = (levels.end_time || lastVersion.timestamp) + 86400;
        
        const x = toX(resolutionTime);
        const y = toY(resolutionPrice);
        
        if (x != null && y != null) {
          const color = isWin ? COLORS.win : COLORS.loss;
          
          // Event line (vertical at resolution time)
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
          ctx.restore();
          
          // Glow
          drawCircle(x, y, 20, { fill: color, opacity: 0.1 });
          drawCircle(x, y, 14, { fill: color, opacity: 0.2 });
          
          // Main marker
          drawCircle(x, y, 10, { 
            fill: color, 
            opacity: 0.95,
            stroke: '#fff',
            strokeWidth: 2,
          });
          
          // Symbol
          drawText(isWin ? '✓' : '✗', x, y, {
            color: '#fff',
            font: 'bold 12px Inter, sans-serif',
            align: 'center',
          });
          
          // Label
          drawText(
            isWin ? 'WIN' : 'LOSS',
            x, y + 24,
            {
              color,
              font: 'bold 11px Inter, sans-serif',
              align: 'center',
            }
          );
        }
      }
    }
    
    // ========================================
    // 6. CONFIDENCE EVOLUTION LINE
    // ========================================
    if (versions.length >= 2) {
      const points = versions.map(v => {
        const prob = v.snapshot?.probability?.up || v.snapshot?.confidence || 0.5;
        const x = toX(v.timestamp);
        
        // Map confidence to Y coordinate in top band
        // Use CHART coordinates for vertical positioning too
        const topY = toY(versions[0].snapshot?.levels?.top * 1.02);
        const y = topY ? topY - 30 + (1 - prob) * 40 : null;
        
        return { x, y, prob, v: v.v };
      }).filter(p => p.x != null && p.y != null);
      
      if (points.length >= 2) {
        // Draw connecting line
        ctx.save();
        ctx.strokeStyle = COLORS.confidence;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
        
        // Draw dots and labels
        points.forEach((p) => {
          drawCircle(p.x, p.y, 5, {
            fill: '#fff',
            stroke: COLORS.confidence,
            strokeWidth: 2,
          });
          
          drawText(`${Math.round(p.prob * 100)}%`, p.x, p.y - 14, {
            color: COLORS.confidence,
            font: 'bold 10px Inter, sans-serif',
            align: 'center',
          });
        });
        
        // Trend indicator
        const first = points[0];
        const last = points[points.length - 1];
        const isImproving = last.prob > first.prob;
        drawText(
          isImproving ? '↑' : '↓',
          last.x + 16, last.y,
          {
            color: isImproving ? COLORS.win : COLORS.loss,
            font: 'bold 14px Inter, sans-serif',
          }
        );
      }
    }
    
    // ========================================
    // 7. COMPACT HUD (Top-Left)
    // ========================================
    const activeV = versions[currentIdx];
    if (activeV) {
      const hudX = 12;
      const hudY = 12;
      const hudW = 120;
      const hudH = 60;
      
      // Background
      ctx.save();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.92)';
      ctx.beginPath();
      ctx.roundRect(hudX, hudY, hudW, hudH, 8);
      ctx.fill();
      ctx.restore();
      
      // Symbol & TF
      drawText(`${idea.asset?.replace('USDT', '')} · ${idea.timeframe}`, hudX + 10, hudY + 16, {
        color: '#fff',
        font: 'bold 11px Inter, sans-serif',
      });
      
      // Version & Pattern
      const pattern = activeV.snapshot?.pattern?.replace(/_/g, ' ') || 'Unknown';
      drawText(`V${activeV.v} ${pattern}`, hudX + 10, hudY + 32, {
        color: 'rgba(255,255,255,0.85)',
        font: '10px Inter, sans-serif',
      });
      
      // Status
      const conf = Math.round((activeV.snapshot?.confidence || 0) * 100);
      const status = idea.status === 'completed' 
        ? (idea.outcome === 'success_up' || idea.outcome === 'success_down' ? 'WIN' : 'LOSS')
        : 'ACTIVE';
      const statusColor = status === 'WIN' ? '#86efac' : status === 'LOSS' ? '#fca5a5' : '#93c5fd';
      
      drawText(`${conf}%`, hudX + 10, hudY + 48, {
        color: '#fff',
        font: 'bold 12px Inter, sans-serif',
      });
      
      drawText(status, hudX + 50, hudY + 48, {
        color: statusColor,
        font: 'bold 10px Inter, sans-serif',
      });
    }
    
  }, [chart, priceSeries, idea, versions, currentIdx, width, height, toX, toY]);
  
  // ============================================
  // SUBSCRIBE TO ALL CHART EVENTS
  // ============================================
  useEffect(() => {
    if (!chart || !priceSeries) return;
    
    // Debounced render for performance
    const scheduleRender = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(render);
    };
    
    // Subscribe to time scale changes (pan, zoom)
    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleTimeRangeChange(scheduleRender);
    timeScale.subscribeVisibleLogicalRangeChange(scheduleRender);
    
    // Subscribe to crosshair (provides smooth updates during drag)
    chart.subscribeCrosshairMove(scheduleRender);
    
    // Initial render
    scheduleRender();
    
    // Resize observer for container size changes
    const container = canvasRef.current?.parentElement;
    let resizeObserver;
    if (container) {
      resizeObserver = new ResizeObserver(scheduleRender);
      resizeObserver.observe(container);
    }
    
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        timeScale.unsubscribeVisibleTimeRangeChange(scheduleRender);
        timeScale.unsubscribeVisibleLogicalRangeChange(scheduleRender);
        chart.unsubscribeCrosshairMove(scheduleRender);
      } catch {}
      resizeObserver?.disconnect();
    };
  }, [chart, priceSeries, render]);
  
  // Re-render when idea or version changes
  useEffect(() => {
    render();
  }, [idea, currentIdx, render]);
  
  if (!idea || versions.length === 0) return null;
  
  return (
    <canvas
      ref={canvasRef}
      data-testid="idea-chart-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 55,
      }}
    />
  );
};

export default IdeaChartOverlay;
