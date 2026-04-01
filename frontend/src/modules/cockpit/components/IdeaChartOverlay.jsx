/**
 * IdeaChartOverlay.jsx — UI-ONLY Overlay (no pattern drawing!)
 * =============================================================
 * 
 * Patterns are drawn by renderPattern from patternRenderer.js
 * This overlay ONLY handles:
 * - HUD (symbol, version, confidence)
 * - Transition badge (V1→V2)
 * - Mini legend
 * - Result marker (WIN/LOSS)
 * 
 * NO fake geometry!
 */

import React, { useEffect, useRef, useCallback } from 'react';

const COLORS = {
  transition: '#3b82f6',
  win: '#22c55e',
  loss: '#ef4444',
  text: '#334155',
  textMuted: '#64748b',
  hudBg: 'rgba(15, 23, 42, 0.92)',
  pattern: '#f59e0b',
  patternGhost: '#9ca3af',
};

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
    // HELPERS
    // ========================================
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
    // 1. TRANSITION LINE & BADGE (if multi-version)
    // ========================================
    if (versions.length > 1 && currentIdx > 0) {
      const prevVersion = versions[currentIdx - 1];
      const currVersion = versions[currentIdx];
      const transitionTime = currVersion.timestamp;
      
      const x = toX(transitionTime);
      if (x != null) {
        // Vertical dashed line
        ctx.save();
        ctx.strokeStyle = COLORS.transition;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 5]);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, 40);
        ctx.lineTo(x, h - 20);
        ctx.stroke();
        ctx.restore();
        
        // Transition badge
        const prevPattern = prevVersion.snapshot?.pattern?.replace(/_/g, ' ') || '';
        const currPattern = currVersion.snapshot?.pattern?.replace(/_/g, ' ') || '';
        const label = `${prevPattern} → ${currPattern}`;
        
        ctx.save();
        ctx.font = 'bold 10px Inter, sans-serif';
        const labelWidth = ctx.measureText(label).width + 16;
        const labelHeight = 20;
        const labelX = x - labelWidth / 2;
        const labelY = 45;
        
        ctx.fillStyle = COLORS.transition;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 4);
        ctx.fill();
        
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, labelY + labelHeight / 2);
        ctx.restore();
      }
    }
    
    // ========================================
    // 2. RESULT MARKER (WIN/LOSS)
    // ========================================
    const activeVersion = versions[currentIdx];
    if (idea.status === 'completed' && activeVersion?.snapshot?.levels) {
      const levels = activeVersion.snapshot.levels;
      const isWin = idea.outcome === 'success_up' || idea.outcome === 'success_down';
      
      const resultPrice = idea.outcome === 'success_up' 
        ? levels.top * 1.015
        : idea.outcome === 'success_down' 
          ? levels.bottom * 0.985
          : (levels.top + levels.bottom) / 2;
      
      const resultTime = (levels.end_time || activeVersion.timestamp) + 86400;
      
      const x = toX(resultTime);
      const y = toY(resultPrice);
      
      if (x != null && y != null) {
        const color = isWin ? COLORS.win : COLORS.loss;
        
        // Glow
        drawCircle(x, y, 16, { fill: color, opacity: 0.12 });
        drawCircle(x, y, 10, { fill: color, opacity: 0.2 });
        
        // Main
        drawCircle(x, y, 7, { fill: color, stroke: '#fff', strokeWidth: 2 });
        
        // Label
        drawText(isWin ? 'WIN' : 'LOSS', x, y + 18, {
          color,
          font: 'bold 9px Inter, sans-serif',
          align: 'center',
        });
      }
    }
    
    // ========================================
    // 3. COMPACT HUD
    // ========================================
    if (activeVersion) {
      const hudX = 10;
      const hudY = 10;
      const hudW = 100;
      const hudH = 48;
      
      ctx.save();
      ctx.fillStyle = COLORS.hudBg;
      ctx.beginPath();
      ctx.roundRect(hudX, hudY, hudW, hudH, 6);
      ctx.fill();
      ctx.restore();
      
      drawText(`${idea.asset?.replace('USDT', '')} · ${idea.timeframe}`, hudX + 8, hudY + 14, {
        color: '#fff',
        font: 'bold 10px Inter, sans-serif',
      });
      
      const pattern = activeVersion.snapshot?.pattern?.replace(/_/g, ' ') || '';
      drawText(`V${activeVersion.v} ${pattern}`, hudX + 8, hudY + 28, {
        color: 'rgba(255,255,255,0.7)',
        font: '9px Inter, sans-serif',
      });
      
      const conf = Math.round((activeVersion.snapshot?.confidence || 0) * 100);
      const status = idea.status === 'completed' 
        ? (idea.outcome === 'success_up' || idea.outcome === 'success_down' ? 'WIN' : 'LOSS')
        : 'LIVE';
      const statusColor = status === 'WIN' ? COLORS.win : status === 'LOSS' ? COLORS.loss : '#60a5fa';
      
      drawText(`${conf}%`, hudX + 8, hudY + 40, {
        color: '#fff',
        font: 'bold 10px Inter, sans-serif',
      });
      
      drawText(status, hudX + 45, hudY + 40, {
        color: statusColor,
        font: 'bold 9px Inter, sans-serif',
      });
    }
    
    // ========================================
    // 4. MINI LEGEND
    // ========================================
    const legendX = w - 130;
    const legendY = h - 55;
    
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.roundRect(legendX, legendY, 120, 45, 5);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    
    // Legend items
    const items = [
      { color: COLORS.patternGhost, dashed: true, label: 'Previous', y: 12 },
      { color: COLORS.pattern, dashed: false, label: 'Active pattern', y: 28 },
    ];
    
    items.forEach(item => {
      const lx = legendX + 8;
      const ly = legendY + item.y;
      
      ctx.save();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = item.dashed ? 0.5 : 1;
      if (item.dashed) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 18, ly);
      ctx.stroke();
      ctx.restore();
      
      drawText(item.label, lx + 24, ly, {
        color: COLORS.textMuted,
        font: '9px Inter, sans-serif',
      });
    });
    
  }, [chart, priceSeries, idea, versions, currentIdx, width, height, toX, toY]);
  
  // Subscribe to chart events
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
