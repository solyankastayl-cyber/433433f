/**
 * IdeaChartOverlay.jsx — EVOLUTION-FOCUSED Overlay
 * ==================================================
 * 
 * This overlay tells a STORY, not just draws lines:
 * 
 * 1. TIME SEPARATION — V1 (past) vs V2 (current)
 * 2. VERSION BOUNDARIES — Vertical lines marking transitions
 * 3. PATTERN EVOLUTION — Ghost (old) → Active (new)
 * 4. PREDICTION vs REALITY — Expected path (dashed) vs actual
 * 5. CONNECTION — Links between versions
 * 6. RESULT — Win/Loss markers
 * 7. CONFIDENCE EVOLUTION — Trend line
 * 
 * The graph answers 3 questions:
 * - What did we think before?
 * - What do we think now?
 * - How did it play out?
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';

// ============================================
// COLOR PALETTE
// ============================================
const COLORS = {
  // Version states
  ghost: { stroke: '#94a3b8', fill: 'rgba(148, 163, 184, 0.06)' },
  active: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.08)' },
  
  // Pattern colors
  triangle: '#f59e0b',
  rectangle: '#3b82f6',
  resistance: '#ef4444',
  support: '#22c55e',
  
  // Results
  win: '#22c55e',
  loss: '#ef4444',
  
  // Prediction
  expected: '#8b5cf6',
  
  // UI
  versionLine: 'rgba(59, 130, 246, 0.5)',
  connection: 'rgba(148, 163, 184, 0.3)',
  confidence: '#3b82f6',
  text: '#334155',
  textMuted: '#64748b',
};

// ============================================
// MAIN COMPONENT (Canvas-based for performance)
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
  const [, forceUpdate] = useState(0);
  
  const versions = idea?.versions || [];
  const currentIdx = activeVersionIndex ?? Math.max(versions.length - 1, 0);
  
  // Subscribe to chart changes
  useEffect(() => {
    if (!chart) return;
    
    const handleChange = () => forceUpdate(n => n + 1);
    
    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleTimeRangeChange(handleChange);
    timeScale.subscribeVisibleLogicalRangeChange(handleChange);
    
    return () => {
      try {
        timeScale.unsubscribeVisibleTimeRangeChange(handleChange);
        timeScale.unsubscribeVisibleLogicalRangeChange(handleChange);
      } catch {}
    };
  }, [chart]);
  
  // Coordinate converters
  const normalizeTime = (t) => t > 9999999999 ? Math.floor(t / 1000) : t;
  
  const toX = useCallback((time) => {
    if (!chart || !time) return null;
    try {
      const x = chart.timeScale().timeToCoordinate(normalizeTime(time));
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
  // RENDER ENGINE
  // ============================================
  useEffect(() => {
    if (!canvasRef.current || !chart || !priceSeries || versions.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = width;
    canvas.height = height;
    
    // Clear
    ctx.clearRect(0, 0, width, height);
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
      const w = metrics.width + padding.x * 2;
      const h = 18;
      
      // Background
      ctx.globalAlpha = opts.bgOpacity ?? 0.9;
      ctx.fillStyle = opts.bg || 'rgba(59, 130, 246, 0.15)';
      ctx.beginPath();
      ctx.roundRect(x, y - h/2, w, h, 4);
      ctx.fill();
      
      // Border
      if (opts.border) {
        ctx.strokeStyle = opts.border;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      // Text
      ctx.globalAlpha = 1;
      ctx.fillStyle = opts.color || COLORS.active.stroke;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + padding.x, y);
      ctx.restore();
    };
    
    // ========================================
    // 1. VERSION BOUNDARY LINES
    // ========================================
    versions.forEach((v, idx) => {
      if (idx === 0) return; // No boundary before first version
      
      const x = toX(v.timestamp);
      if (x == null) return;
      
      // Vertical dashed line
      ctx.save();
      ctx.strokeStyle = COLORS.versionLine;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, 30);
      ctx.lineTo(x, height - 30);
      ctx.stroke();
      ctx.restore();
      
      // Version badge at top
      drawBadge(`V${v.v}`, x + 6, 20, {
        bg: 'rgba(59, 130, 246, 0.12)',
        border: COLORS.active.stroke,
        color: COLORS.active.stroke,
      });
    });
    
    // ========================================
    // 2. PATTERNS (Ghost → Active)
    // ========================================
    versions.forEach((v, idx) => {
      const snapshot = v.snapshot;
      if (!snapshot?.levels) return;
      
      const isActive = idx === currentIdx;
      const isPast = idx < currentIdx;
      const levels = snapshot.levels;
      
      // Time range
      const startTime = levels.start_time || v.timestamp;
      const endTime = levels.end_time || (v.timestamp + 86400 * 7);
      
      const x1 = toX(startTime);
      const x2 = toX(endTime);
      const yTop = toY(levels.top);
      const yBottom = toY(levels.bottom);
      
      if (x1 == null || x2 == null || yTop == null || yBottom == null) return;
      
      const patternName = snapshot.pattern || '';
      const isTriangle = patternName.includes('triangle') || patternName.includes('wedge');
      
      // Style based on version state — Ghost patterns more visible
      const opacity = isActive ? 1 : isPast ? 0.35 : 0.5;
      const lineWidth = isActive ? 2.5 : 2;
      const dashed = !isActive ? [8, 5] : null;
      const fillOpacity = isActive ? 0.08 : 0.05;
      
      const patternColor = isTriangle ? COLORS.triangle : COLORS.rectangle;
      const actualColor = isActive ? patternColor : COLORS.ghost.stroke;
      
      if (isTriangle) {
        // Triangle pattern
        const apexX = x2;
        const midY = (yTop + yBottom) / 2;
        
        // Fill
        drawPolygon([
          { x: x1, y: yTop },
          { x: apexX, y: midY },
          { x: x1, y: yBottom },
        ], { fill: actualColor, opacity: fillOpacity });
        
        // Upper trendline
        drawLine(x1, yTop, apexX, midY, {
          color: actualColor,
          width: lineWidth,
          opacity,
          dashed,
        });
        
        // Lower trendline
        drawLine(x1, yBottom, apexX, midY, {
          color: actualColor,
          width: lineWidth,
          opacity,
          dashed,
        });
      } else {
        // Rectangle pattern
        const rectX = Math.min(x1, x2);
        const rectY = Math.min(yTop, yBottom);
        const rectW = Math.abs(x2 - x1);
        const rectH = Math.abs(yBottom - yTop);
        
        // Fill
        ctx.save();
        ctx.globalAlpha = fillOpacity;
        ctx.fillStyle = actualColor;
        ctx.fillRect(rectX, rectY, rectW, rectH);
        ctx.restore();
        
        // Resistance line
        drawLine(x1, yTop, x2, yTop, {
          color: isActive ? COLORS.resistance : actualColor,
          width: lineWidth,
          opacity,
          dashed,
        });
        
        // Support line
        drawLine(x1, yBottom, x2, yBottom, {
          color: isActive ? COLORS.support : actualColor,
          width: lineWidth,
          opacity,
          dashed,
        });
      }
      
      // Version badge on pattern — show for ALL versions
      const badgeLabel = isPast 
        ? `V${v.v} (${patternName.replace(/_/g, ' ')})`
        : `V${v.v}`;
      
      drawBadge(badgeLabel, x1 + 4, yTop - 14, {
        bg: isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.12)',
        border: isActive ? COLORS.active.stroke : COLORS.ghost.stroke,
        color: isActive ? COLORS.active.stroke : COLORS.ghost.stroke,
        bgOpacity: isPast ? 0.6 : 0.9,
      });
      
      // Price labels (active only)
      if (isActive) {
        drawText(`R ${levels.top?.toLocaleString()}`, x2 + 10, yTop, {
          color: COLORS.resistance,
          font: 'bold 10px Inter, sans-serif',
        });
        drawText(`S ${levels.bottom?.toLocaleString()}`, x2 + 10, yBottom, {
          color: COLORS.support,
          font: 'bold 10px Inter, sans-serif',
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
      
      // Connect end of previous pattern to start of current
      const prevEndTime = prevLevels.end_time || (prev.timestamp + 86400 * 7);
      const currStartTime = currLevels.start_time || curr.timestamp;
      
      const prevMidPrice = (prevLevels.top + prevLevels.bottom) / 2;
      const currMidPrice = (currLevels.top + currLevels.bottom) / 2;
      
      const x1 = toX(prevEndTime);
      const y1 = toY(prevMidPrice);
      const x2 = toX(currStartTime);
      const y2 = toY(currMidPrice);
      
      // Draw connection line (subtle)
      drawLine(x1, y1, x2, y2, {
        color: COLORS.connection,
        width: 1.5,
        dashed: [4, 4],
        opacity: 0.4,
      });
      
      // Draw connection dots
      drawCircle(x1, y1, 4, { fill: COLORS.ghost.stroke, opacity: 0.3 });
      drawCircle(x2, y2, 4, { fill: COLORS.active.stroke, opacity: 0.5 });
    }
    
    // ========================================
    // 4. EXPECTED PATH (Prediction)
    // ========================================
    const activeVersion = versions[currentIdx];
    if (activeVersion?.snapshot?.levels) {
      const levels = activeVersion.snapshot.levels;
      const bias = activeVersion.snapshot.bias || 'bullish';
      const endTime = levels.end_time || (activeVersion.timestamp + 86400 * 7);
      
      // Expected breakout direction
      const startPrice = bias === 'bullish' ? levels.top : levels.bottom;
      const targetPrice = bias === 'bullish' 
        ? levels.top * 1.05  // 5% upside target
        : levels.bottom * 0.95; // 5% downside target
      
      const x1 = toX(endTime);
      const y1 = toY(startPrice);
      const x2 = x1 + 80; // Projection into future
      const y2 = toY(targetPrice);
      
      if (x1 != null && y1 != null && y2 != null) {
        // Arrow showing expected direction
        drawLine(x1, y1, x2, y2, {
          color: COLORS.expected,
          width: 2,
          dashed: [6, 4],
          opacity: 0.7,
        });
        
        // Arrow head
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 8;
        ctx.save();
        ctx.fillStyle = COLORS.expected;
        ctx.globalAlpha = 0.7;
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
        drawText('EXPECTED', x2 + 6, y2, {
          color: COLORS.expected,
          font: 'bold 9px Inter, sans-serif',
          opacity: 0.8,
        });
      }
    }
    
    // ========================================
    // 5. RESULT MARKER
    // ========================================
    if (idea.status === 'completed') {
      const lastVersion = versions[versions.length - 1];
      const levels = lastVersion.snapshot?.levels;
      if (levels) {
        const isWin = idea.outcome === 'success_up' || idea.outcome === 'success_down';
        const resultPrice = idea.outcome === 'success_up' 
          ? levels.top * 1.02
          : idea.outcome === 'success_down' 
            ? levels.bottom * 0.98
            : (levels.top + levels.bottom) / 2;
        
        const resultTime = (levels.end_time || lastVersion.timestamp) + 86400 * 2;
        
        const x = toX(resultTime);
        const y = toY(resultPrice);
        
        if (x != null && y != null) {
          const color = isWin ? COLORS.win : COLORS.loss;
          
          // Glow effect
          drawCircle(x, y, 24, { fill: color, opacity: 0.08 });
          drawCircle(x, y, 16, { fill: color, opacity: 0.15 });
          
          // Main circle
          drawCircle(x, y, 12, { 
            fill: color, 
            opacity: 0.95,
            stroke: '#fff',
            strokeWidth: 2,
          });
          
          // Symbol
          drawText(isWin ? '✓' : '✗', x, y, {
            color: '#fff',
            font: 'bold 14px Inter, sans-serif',
            align: 'center',
          });
          
          // Label
          drawText(
            isWin ? 'CORRECT' : 'WRONG',
            x, y + 26,
            {
              color,
              font: 'bold 10px Inter, sans-serif',
              align: 'center',
            }
          );
        }
      }
    }
    
    // ========================================
    // 6. CONFIDENCE EVOLUTION (Timeline)
    // ========================================
    if (versions.length >= 2) {
      const points = versions.map(v => {
        const prob = v.snapshot?.probability?.up || v.snapshot?.confidence || 0.5;
        const x = toX(v.timestamp);
        // Position in top area of chart
        const bandTop = 50;
        const bandBottom = 90;
        const y = bandTop + (1 - prob) * (bandBottom - bandTop);
        return { x, y, prob, v: v.v };
      }).filter(p => p.x != null);
      
      if (points.length >= 2) {
        // Draw line
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
        points.forEach((p, i) => {
          // Dot
          drawCircle(p.x, p.y, 5, {
            fill: '#fff',
            stroke: COLORS.confidence,
            strokeWidth: 2,
          });
          
          // Percentage label
          drawText(`${Math.round(p.prob * 100)}%`, p.x, p.y - 12, {
            color: COLORS.confidence,
            font: 'bold 10px Inter, sans-serif',
            align: 'center',
          });
        });
        
        // Trend arrow
        const first = points[0];
        const last = points[points.length - 1];
        const isImproving = last.prob > first.prob;
        drawText(
          isImproving ? '↑' : '↓',
          last.x + 14, last.y,
          {
            color: isImproving ? COLORS.win : COLORS.loss,
            font: 'bold 14px Inter, sans-serif',
          }
        );
      }
    }
    
    // ========================================
    // 7. IDEA HUD (Top-Left)
    // ========================================
    const hudX = 12;
    const hudY = 12;
    const hudPadding = 12;
    
    // Background
    ctx.save();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.95)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, 140, 70, 10);
    ctx.fill();
    ctx.restore();
    
    // Content
    const activeV = versions[currentIdx];
    if (activeV) {
      // Symbol & TF
      drawText(`${idea.asset?.replace('USDT', '')} · ${idea.timeframe}`, hudX + hudPadding, hudY + 18, {
        color: '#fff',
        font: 'bold 12px Inter, sans-serif',
      });
      
      // Version & Pattern
      const pattern = activeV.snapshot?.pattern?.replace(/_/g, ' ') || 'Unknown';
      drawText(`V${activeV.v} — ${pattern.charAt(0).toUpperCase() + pattern.slice(1)}`, hudX + hudPadding, hudY + 36, {
        color: 'rgba(255,255,255,0.9)',
        font: '11px Inter, sans-serif',
      });
      
      // Confidence
      const conf = Math.round((activeV.snapshot?.confidence || 0) * 100);
      const confChange = versions.length > 1 
        ? conf - Math.round((versions[0].snapshot?.confidence || 0) * 100)
        : 0;
      drawText(
        `${conf}%${confChange !== 0 ? (confChange > 0 ? ' ↑' : ' ↓') : ''}`,
        hudX + hudPadding, hudY + 54,
        {
          color: confChange >= 0 ? '#86efac' : '#fca5a5',
          font: 'bold 13px Inter, sans-serif',
        }
      );
      
      // Status
      const status = idea.status === 'completed' 
        ? (idea.outcome === 'success_up' || idea.outcome === 'success_down' ? 'WIN' : 'LOSS')
        : 'ACTIVE';
      drawText(status, hudX + 100, hudY + 54, {
        color: status === 'WIN' ? '#86efac' : status === 'LOSS' ? '#fca5a5' : '#93c5fd',
        font: 'bold 10px Inter, sans-serif',
      });
    }
    
  }, [chart, priceSeries, idea, versions, currentIdx, width, height, toX, toY]);
  
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
