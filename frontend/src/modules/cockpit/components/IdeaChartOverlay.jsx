/**
 * IdeaChartOverlay.jsx — SEMANTIC STORYTELLING Overlay
 * =====================================================
 * 
 * GOAL: User understands the graph in 2 seconds
 * 
 * Structure:
 * 1. V1 (past idea) — gray dashed, light zone
 * 2. TRANSITION — central element, "V1 → V2"
 * 3. V2 (current idea) — ONE solid color
 * 4. PROJECTION — separate dashed line
 * 5. RESULT — win/loss marker
 * 6. MINI LEGEND — explains what is what
 * 
 * KEY FIX: Triangle = ONE COLOR (not red/green confusion)
 */

import React, { useEffect, useRef, useCallback } from 'react';

// ============================================
// SEMANTIC COLOR SYSTEM
// ============================================
const COLORS = {
  // V1 (past) — everything gray
  v1: {
    pattern: '#94a3b8',
    zone: 'rgba(148, 163, 184, 0.08)',
    opacity: 0.25,
  },
  
  // V2 (active) — ONE color for the whole pattern
  v2: {
    pattern: '#f59e0b',      // Amber — single color for triangle/rectangle
    zone: 'rgba(245, 158, 11, 0.06)',
    opacity: 1,
  },
  
  // Projection — different from pattern
  projection: '#8b5cf6',     // Purple — clearly different
  
  // Transition
  transition: '#3b82f6',     // Blue
  
  // Result
  win: '#22c55e',
  loss: '#ef4444',
  
  // UI
  text: '#334155',
  textMuted: '#64748b',
  hudBg: 'rgba(15, 23, 42, 0.9)',
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
  // RENDER FUNCTION
  // ============================================
  const render = useCallback(() => {
    if (!canvasRef.current || !chart || !priceSeries || versions.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.parentElement?.getBoundingClientRect();
    const w = rect?.width || width;
    const h = rect?.height || height;
    
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    
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
    
    // ========================================
    // LAYER 1: V1 ZONE (Gray background)
    // ========================================
    if (versions.length > 1) {
      const v1 = versions[0];
      const v2 = versions[1];
      const levels = v1.snapshot?.levels;
      if (levels) {
        const zoneStart = toX(levels.start_time || v1.timestamp - 86400 * 2);
        const zoneEnd = toX(v2.timestamp);
        
        if (zoneStart != null && zoneEnd != null) {
          // Full-height gray zone for V1 period
          drawRect(zoneStart, 0, zoneEnd - zoneStart, h, {
            fill: COLORS.v1.zone,
            opacity: 1,
          });
        }
      }
    }
    
    // ========================================
    // LAYER 2: V1 PATTERN (Gray dashed)
    // ========================================
    versions.forEach((v, idx) => {
      if (idx >= currentIdx) return; // Only draw past versions
      
      const snapshot = v.snapshot;
      if (!snapshot?.levels) return;
      
      const levels = snapshot.levels;
      const startTime = levels.start_time || v.timestamp;
      const endTime = levels.end_time || (v.timestamp + 86400 * 7);
      
      const x1 = toX(startTime);
      const x2 = toX(endTime);
      const yTop = toY(levels.top);
      const yBottom = toY(levels.bottom);
      
      if (x1 == null || x2 == null || yTop == null || yBottom == null) return;
      
      const patternName = snapshot.pattern || '';
      const isTriangle = patternName.includes('triangle') || patternName.includes('wedge');
      
      // V1 style: gray, dashed, low opacity
      const color = COLORS.v1.pattern;
      const opacity = COLORS.v1.opacity;
      const dashed = [8, 5];
      
      if (isTriangle) {
        const apexX = x2;
        const midY = (yTop + yBottom) / 2;
        
        // Both lines SAME COLOR (gray)
        drawLine(x1, yTop, apexX, midY, { color, width: 2, opacity, dashed });
        drawLine(x1, yBottom, apexX, midY, { color, width: 2, opacity, dashed });
      } else {
        // Rectangle: both lines SAME COLOR (gray)
        drawLine(x1, yTop, x2, yTop, { color, width: 2, opacity, dashed });
        drawLine(x1, yBottom, x2, yBottom, { color, width: 2, opacity, dashed });
      }
      
      // V1 label
      drawText(`V${v.v} ${patternName.replace(/_/g, ' ')}`, x1 + 4, yTop - 12, {
        color: COLORS.v1.pattern,
        font: '10px Inter, sans-serif',
        opacity: 0.5,
      });
    });
    
    // ========================================
    // LAYER 3: TRANSITION LINE (Center of UX)
    // ========================================
    if (versions.length > 1 && currentIdx > 0) {
      const prevVersion = versions[currentIdx - 1];
      const currVersion = versions[currentIdx];
      const transitionTime = currVersion.timestamp;
      
      const x = toX(transitionTime);
      if (x != null) {
        // Prominent vertical line
        ctx.save();
        ctx.strokeStyle = COLORS.transition;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 6]);
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, 30);
        ctx.lineTo(x, h - 30);
        ctx.stroke();
        ctx.restore();
        
        // MAIN TRANSITION BADGE (center of attention)
        const prevPattern = prevVersion.snapshot?.pattern?.replace(/_/g, ' ') || '';
        const currPattern = currVersion.snapshot?.pattern?.replace(/_/g, ' ') || '';
        const transitionLabel = `${prevPattern} → ${currPattern}`;
        
        ctx.save();
        ctx.font = 'bold 11px Inter, sans-serif';
        const labelWidth = ctx.measureText(transitionLabel).width + 20;
        const labelHeight = 24;
        const labelX = x - labelWidth / 2;
        const labelY = 40;
        
        // Badge background
        ctx.fillStyle = COLORS.transition;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 6);
        ctx.fill();
        
        // Badge text
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(transitionLabel, x, labelY + labelHeight / 2);
        ctx.restore();
        
        // Date label
        const date = new Date(transitionTime * 1000);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        drawText(dateStr, x, labelY + labelHeight + 12, {
          color: COLORS.transition,
          font: '10px Inter, sans-serif',
          align: 'center',
          opacity: 0.8,
        });
      }
    }
    
    // ========================================
    // LAYER 4: V2 PATTERN (ONE SOLID COLOR)
    // ========================================
    const activeVersion = versions[currentIdx];
    if (activeVersion?.snapshot?.levels) {
      const snapshot = activeVersion.snapshot;
      const levels = snapshot.levels;
      const startTime = levels.start_time || activeVersion.timestamp;
      const endTime = levels.end_time || (activeVersion.timestamp + 86400 * 7);
      
      const x1 = toX(startTime);
      const x2 = toX(endTime);
      const yTop = toY(levels.top);
      const yBottom = toY(levels.bottom);
      
      if (x1 != null && x2 != null && yTop != null && yBottom != null) {
        const patternName = snapshot.pattern || '';
        const isTriangle = patternName.includes('triangle') || patternName.includes('wedge');
        
        // V2 style: ONE COLOR (amber), solid
        const color = COLORS.v2.pattern;
        
        if (isTriangle) {
          const apexX = x2;
          const midY = (yTop + yBottom) / 2;
          
          // Fill zone
          ctx.save();
          ctx.globalAlpha = 0.06;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(x1, yTop);
          ctx.lineTo(apexX, midY);
          ctx.lineTo(x1, yBottom);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          
          // BOTH lines SAME COLOR (amber) — NOT red/green!
          drawLine(x1, yTop, apexX, midY, { color, width: 2.5, opacity: 1 });
          drawLine(x1, yBottom, apexX, midY, { color, width: 2.5, opacity: 1 });
        } else {
          // Rectangle: BOTH lines SAME COLOR
          drawRect(Math.min(x1, x2), Math.min(yTop, yBottom), 
                   Math.abs(x2 - x1), Math.abs(yBottom - yTop),
                   { fill: color, opacity: 0.06 });
          
          drawLine(x1, yTop, x2, yTop, { color, width: 2.5, opacity: 1 });
          drawLine(x1, yBottom, x2, yBottom, { color, width: 2.5, opacity: 1 });
        }
        
        // Price labels
        drawText(`${levels.top?.toLocaleString()}`, x2 + 8, yTop, {
          color,
          font: 'bold 10px Inter, sans-serif',
        });
        drawText(`${levels.bottom?.toLocaleString()}`, x2 + 8, yBottom, {
          color,
          font: 'bold 10px Inter, sans-serif',
        });
      }
    }
    
    // ========================================
    // LAYER 5: PROJECTION (Separate dashed line)
    // ========================================
    if (activeVersion?.snapshot?.levels) {
      const levels = activeVersion.snapshot.levels;
      const bias = activeVersion.snapshot.bias || 'bullish';
      const endTime = levels.end_time || (activeVersion.timestamp + 86400 * 7);
      
      const breakoutPrice = bias === 'bullish' ? levels.top : levels.bottom;
      const targetPrice = bias === 'bullish' 
        ? levels.top * 1.05  
        : levels.bottom * 0.95;
      
      const projectionEndTime = endTime + 86400 * 4;
      
      const x1 = toX(endTime);
      const y1 = toY(breakoutPrice);
      const x2 = toX(projectionEndTime);
      const y2 = toY(targetPrice);
      
      if (x1 != null && y1 != null && x2 != null && y2 != null) {
        // Dashed projection line (PURPLE — different from pattern)
        drawLine(x1, y1, x2, y2, {
          color: COLORS.projection,
          width: 2,
          dashed: [8, 4],
          opacity: 0.8,
        });
        
        // Arrow head
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 10;
        ctx.save();
        ctx.fillStyle = COLORS.projection;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - arrowSize * Math.cos(angle - Math.PI / 6), y2 - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - arrowSize * Math.cos(angle + Math.PI / 6), y2 - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        
        // Label
        drawText('expected', x2 + 6, y2, {
          color: COLORS.projection,
          font: 'italic 9px Inter, sans-serif',
          opacity: 0.8,
        });
      }
    }
    
    // ========================================
    // LAYER 6: RESULT MARKER
    // ========================================
    if (idea.status === 'completed' && activeVersion?.snapshot?.levels) {
      const levels = activeVersion.snapshot.levels;
      const isWin = idea.outcome === 'success_up' || idea.outcome === 'success_down';
      
      const resultPrice = idea.outcome === 'success_up' 
        ? levels.top * 1.02
        : idea.outcome === 'success_down' 
          ? levels.bottom * 0.98
          : (levels.top + levels.bottom) / 2;
      
      const resultTime = (levels.end_time || activeVersion.timestamp) + 86400;
      
      const x = toX(resultTime);
      const y = toY(resultPrice);
      
      if (x != null && y != null) {
        const color = isWin ? COLORS.win : COLORS.loss;
        
        // Glow
        drawCircle(x, y, 18, { fill: color, opacity: 0.1 });
        drawCircle(x, y, 12, { fill: color, opacity: 0.2 });
        
        // Main circle
        drawCircle(x, y, 8, { 
          fill: color, 
          stroke: '#fff',
          strokeWidth: 2,
        });
        
        // Label
        drawText(isWin ? 'WIN' : 'LOSS', x, y + 20, {
          color,
          font: 'bold 10px Inter, sans-serif',
          align: 'center',
        });
      }
    }
    
    // ========================================
    // LAYER 7: COMPACT HUD
    // ========================================
    if (activeVersion) {
      const hudX = 12;
      const hudY = 12;
      const hudW = 105;
      const hudH = 52;
      
      ctx.save();
      ctx.fillStyle = COLORS.hudBg;
      ctx.beginPath();
      ctx.roundRect(hudX, hudY, hudW, hudH, 8);
      ctx.fill();
      ctx.restore();
      
      // Symbol & TF
      drawText(`${idea.asset?.replace('USDT', '')} · ${idea.timeframe}`, hudX + 10, hudY + 14, {
        color: '#fff',
        font: 'bold 11px Inter, sans-serif',
      });
      
      // Version & Pattern
      const pattern = activeVersion.snapshot?.pattern?.replace(/_/g, ' ') || '';
      drawText(`V${activeVersion.v} ${pattern}`, hudX + 10, hudY + 28, {
        color: 'rgba(255,255,255,0.75)',
        font: '9px Inter, sans-serif',
      });
      
      // Confidence + Status
      const conf = Math.round((activeVersion.snapshot?.confidence || 0) * 100);
      const status = idea.status === 'completed' 
        ? (idea.outcome === 'success_up' || idea.outcome === 'success_down' ? 'WIN' : 'LOSS')
        : 'ACTIVE';
      const statusColor = status === 'WIN' ? COLORS.win : status === 'LOSS' ? COLORS.loss : '#60a5fa';
      
      drawText(`${conf}%`, hudX + 10, hudY + 42, {
        color: '#fff',
        font: 'bold 11px Inter, sans-serif',
      });
      
      drawText(status, hudX + 48, hudY + 42, {
        color: statusColor,
        font: 'bold 9px Inter, sans-serif',
      });
    }
    
    // ========================================
    // LAYER 8: MINI LEGEND (Bottom-right)
    // ========================================
    const legendX = w - 140;
    const legendY = h - 70;
    
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.roundRect(legendX, legendY, 130, 60, 6);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    
    // Legend items
    const legendItems = [
      { color: COLORS.v1.pattern, dashed: true, label: 'Previous idea', y: 12 },
      { color: COLORS.v2.pattern, dashed: false, label: 'Active pattern', y: 28 },
      { color: COLORS.projection, dashed: true, label: 'Expected move', y: 44 },
    ];
    
    legendItems.forEach(item => {
      const lineX = legendX + 10;
      const lineY = legendY + item.y;
      
      ctx.save();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = item.dashed ? 0.5 : 1;
      if (item.dashed) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(lineX, lineY);
      ctx.lineTo(lineX + 20, lineY);
      ctx.stroke();
      ctx.restore();
      
      drawText(item.label, lineX + 28, lineY, {
        color: COLORS.textMuted,
        font: '9px Inter, sans-serif',
      });
    });
    
  }, [chart, priceSeries, idea, versions, currentIdx, width, height, toX, toY]);
  
  // ============================================
  // SUBSCRIBE TO CHART EVENTS
  // ============================================
  useEffect(() => {
    if (!chart || !priceSeries) return;
    
    const scheduleRender = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(render);
    };
    
    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleTimeRangeChange(scheduleRender);
    timeScale.subscribeVisibleLogicalRangeChange(scheduleRender);
    chart.subscribeCrosshairMove(scheduleRender);
    
    scheduleRender();
    
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
  
  useEffect(() => { render(); }, [idea, currentIdx, render]);
  
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
