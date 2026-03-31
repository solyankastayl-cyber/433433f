/**
 * IdeasView — Idea Timeline System (GRAPH SYNC + REPLAY)
 * ========================================================
 * 
 * Trading Journal 2.0 - "Ощущается ценность"
 * 
 * Key UX:
 * - Auto-select first idea
 * - Graph Sync: clicking idea → chart instantly shows it
 * - Replay: V1 → V2 → V3 animation
 * - Evolution (pattern → pattern)
 * - Result badges (✔ Correct / ✖ Wrong)
 * - Live accuracy with last result & streak
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { 
  Bookmark, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Target,
  Eye,
  Loader2,
  Flame,
  Play,
  Pause,
  Square,
  Zap,
  Award,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Sparkles,
  BarChart3
} from 'lucide-react';
import IdeaChart from '../components/IdeaChart';
import { useMarket } from '../../../store/marketStore';

// ============================================
// STYLED COMPONENTS (Light Theme)
// ============================================

const Container = styled.div`
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 16px;
  padding: 16px;
  min-height: calc(100vh - 120px);
  height: auto;
  
  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

// Minimum height to show 3 idea cards (~150px each + gaps + header)
const MIN_IDEAS_HEIGHT = 580;

const LeftPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: ${MIN_IDEAS_HEIGHT}px;
  
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
`;

const RightPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: ${MIN_IDEAS_HEIGHT}px;
  
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
    
    svg { width: 15px; height: 15px; color: #3b82f6; }
  }
`;

const CardContent = styled.div`
  padding: 14px 16px;
  /* Show minimum 3 full cards (~150px each), scroll the rest */
  min-height: 520px;
  max-height: 520px;
  overflow-y: auto;
  
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
`;

// ============================================
// ACCURACY SCORE (Compact)
// ============================================

const AccuracyCard = styled(Card)`
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  flex-shrink: 0;
`;

const AccuracyMain = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const AccuracyLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  .value {
    font-size: 28px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1;
    
    span { font-size: 18px; color: #94a3b8; }
  }
  
  .trend {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 11px;
    font-weight: 500;
    
    &.improving { color: #16a34a; }
    &.declining { color: #dc2626; }
    &.stable { color: #64748b; }
    
    svg { width: 12px; height: 12px; }
  }
`;

const AccuracyRight = styled.div`
  text-align: right;
  
  .streak {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    background: ${({ $hasStreak }) => $hasStreak ? '#fef3c7' : '#f1f5f9'};
    color: ${({ $hasStreak }) => $hasStreak ? '#d97706' : '#64748b'};
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
    
    svg { width: 13px; height: 13px; }
  }
  
  .last-result {
    margin-top: 8px;
    font-size: 11px;
    color: #64748b;
    
    .result {
      font-weight: 600;
      &.correct { color: #16a34a; }
      &.wrong { color: #dc2626; }
    }
  }
`;

const AccuracyStats = styled.div`
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  
  svg { width: 13px; height: 13px; }
  .label { color: #64748b; }
  .value { font-weight: 600; color: #0f172a; }
  
  &.win svg { color: #16a34a; }
  &.loss svg { color: #dc2626; }
  &.total svg { color: #3b82f6; }
`;

const EmptyAccuracy = styled.div`
  text-align: center;
  padding: 16px;
  
  .title { font-size: 13px; font-weight: 500; color: #64748b; margin-bottom: 4px; }
  .subtitle { font-size: 11px; color: #94a3b8; }
`;

// ============================================
// FILTER TABS
// ============================================

const FilterTabs = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 10px;
`;

const FilterTab = styled.button`
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid ${({ $active }) => $active ? '#3b82f6' : '#e2e8f0'};
  background: ${({ $active }) => $active ? '#eff6ff' : '#ffffff'};
  color: ${({ $active }) => $active ? '#3b82f6' : '#64748b'};
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  
  &:hover { border-color: #3b82f6; color: #3b82f6; }
`;

// ============================================
// IDEA CARD
// ============================================

const IdeaCardStyled = styled.div`
  padding: 12px 14px;
  background: ${({ $active }) => $active ? '#f0f9ff' : '#ffffff'};
  border: 1px solid ${({ $active }) => $active ? '#3b82f6' : '#e2e8f0'};
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: 8px;
  
  &:hover {
    border-color: #3b82f6;
    background: #f8fafc;
    transform: translateY(-1px);
  }
`;

const IdeaHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const IdeaAsset = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  
  .symbol { font-size: 14px; font-weight: 700; color: #0f172a; }
  .timeframe {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    background: #f1f5f9;
    border-radius: 4px;
    color: #64748b;
  }
`;

const ResultBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  
  svg { width: 11px; height: 11px; }
  
  ${({ $type }) => {
    switch ($type) {
      case 'correct': return `background: #dcfce7; color: #16a34a;`;
      case 'wrong': return `background: #fee2e2; color: #dc2626;`;
      case 'active': return `background: #dbeafe; color: #2563eb;`;
      default: return `background: #f1f5f9; color: #64748b;`;
    }
  }}
`;

const EvolutionBlock = styled.div`
  .evolution {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    margin-bottom: 4px;
    
    .pattern { text-transform: capitalize; color: #0f172a; font-weight: 500; }
    .ghost { color: #94a3b8; text-decoration: line-through; }
    .arrow { color: #3b82f6; svg { width: 13px; height: 13px; } }
  }
  
  .probability {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #64748b;
    
    .change {
      display: flex;
      align-items: center;
      gap: 2px;
      font-weight: 600;
      &.up { color: #16a34a; }
      &.down { color: #dc2626; }
      svg { width: 10px; height: 10px; }
    }
  }
`;

const IdeaMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
  font-size: 10px;
  color: #94a3b8;
  
  .item { display: flex; align-items: center; gap: 4px; svg { width: 11px; height: 11px; } }
  .score {
    font-weight: 600;
    &.positive { color: #16a34a; }
    &.negative { color: #dc2626; }
  }
`;

// ============================================
// DETAIL PANEL
// ============================================

const DetailPanel = styled(Card)`
  display: flex;
  flex-direction: column;
`;

const DetailHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #f1f5f9;
`;

const DetailTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  
  .symbol { font-size: 18px; font-weight: 700; color: #0f172a; }
  .timeframe {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    background: #f1f5f9;
    border-radius: 6px;
    color: #64748b;
  }
`;

const DetailActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ActionBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid ${({ $primary }) => $primary ? '#3b82f6' : '#e2e8f0'};
  background: ${({ $primary }) => $primary ? '#3b82f6' : '#ffffff'};
  color: ${({ $primary }) => $primary ? '#ffffff' : '#64748b'};
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  
  svg { width: 13px; height: 13px; }
  
  &:hover:not(:disabled) {
    border-color: #3b82f6;
    color: ${({ $primary }) => $primary ? '#ffffff' : '#3b82f6'};
    background: ${({ $primary }) => $primary ? '#2563eb' : '#f8fafc'};
  }
  
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const DetailContent = styled.div`
  padding: 14px 18px;
  max-height: none;
  overflow-y: visible;
  
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
`;

// Info Blocks
const InfoSection = styled.div`
  margin-bottom: 16px;
  
  .section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
    margin-bottom: 8px;
  }
`;

const EvolutionCard = styled.div`
  padding: 12px 14px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  
  .main {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    
    .pattern { font-size: 15px; font-weight: 600; color: #0f172a; text-transform: capitalize; }
    .arrow { color: #3b82f6; svg { width: 14px; height: 14px; } }
  }
  
  .dates { font-size: 11px; color: #64748b; }
`;

const InterpretationCard = styled.div`
  padding: 12px 14px;
  background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%);
  border-radius: 10px;
  border: 1px solid #dcfce7;
  
  .text { font-size: 13px; color: #0f172a; line-height: 1.5; }
`;

const ProbabilityCard = styled.div`
  padding: 12px 14px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    &:last-child { margin-bottom: 0; }
  }
  
  .label { font-size: 12px; color: #64748b; }
  
  .value {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    font-weight: 600;
    &.up { color: #16a34a; }
    &.down { color: #dc2626; }
    
    .change {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      &.positive { background: #dcfce7; color: #16a34a; }
      &.negative { background: #fee2e2; color: #dc2626; }
    }
    
    svg { width: 13px; height: 13px; }
  }
`;

const LevelsCard = styled.div`
  padding: 12px 14px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  
  .level {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    &:last-child { margin-bottom: 0; }
    
    .label { font-size: 11px; &.breakout { color: #16a34a; } &.invalidation { color: #dc2626; } }
    .price { font-size: 16px; font-weight: 700; color: #0f172a; }
  }
`;

const WhatNextCard = styled.div`
  padding: 12px 14px;
  background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
  border-radius: 10px;
  border: 1px solid #dbeafe;
  
  .text {
    font-size: 13px;
    color: #2563eb;
    font-weight: 500;
    svg { width: 13px; height: 13px; display: inline; margin-right: 5px; }
  }
`;

const ScoreCard = styled.div`
  padding: 12px 14px;
  background: ${({ $positive }) => $positive ? '#f0fdf4' : $positive === false ? '#fef2f2' : '#f8fafc'};
  border-radius: 10px;
  border: 1px solid ${({ $positive }) => $positive ? '#dcfce7' : $positive === false ? '#fee2e2' : '#e2e8f0'};
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  .label { font-size: 11px; color: #64748b; }
  .score {
    font-size: 16px;
    font-weight: 700;
    color: ${({ $positive }) => $positive ? '#16a34a' : $positive === false ? '#dc2626' : '#64748b'};
  }
`;

// Timeline
const TimelineCard = styled.div`
  padding: 12px 14px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    
    .label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
    }
  }
`;

const VersionButtons = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const VersionBtn = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid ${({ $active }) => $active ? '#3b82f6' : '#e2e8f0'};
  background: ${({ $active }) => $active ? '#3b82f6' : '#ffffff'};
  color: ${({ $active }) => $active ? '#ffffff' : '#64748b'};
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 60px;
  
  .version { margin-bottom: 2px; }
  .date { font-size: 9px; font-weight: 400; opacity: 0.8; }
  
  &:hover { border-color: #3b82f6; }
`;

// Empty States
const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  text-align: center;
  
  svg { width: 48px; height: 48px; color: #cbd5e1; margin-bottom: 14px; }
  h4 { font-size: 14px; font-weight: 600; color: #0f172a; margin: 0 0 4px 0; }
  p { font-size: 12px; color: #94a3b8; margin: 0; }
`;

const LoadingOverlay = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
  
  svg { animation: spin 1s linear infinite; color: #3b82f6; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

// Replay controls
const ReplayControls = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

// ============================================
// MOCK DATA
// ============================================
const MOCK_IDEAS = [
  {
    idea_id: 'idea-001',
    asset: 'BTCUSDT',
    timeframe: '4H',
    status: 'completed',
    outcome: 'success_up',
    score: 1,
    versions: [
      {
        v: 1,
        timestamp: Date.now() / 1000 - 86400 * 7,
        snapshot: {
          pattern: 'rectangle',
          lifecycle: 'forming',
          confidence: 0.62,
          bias: 'bullish',
          probability: { up: 0.62, down: 0.28 },
          levels: { 
            top: 72171, 
            bottom: 64821,
            start_time: Date.now() / 1000 - 86400 * 9,
            end_time: Date.now() / 1000 - 86400 * 5,
          },
          interpretation: 'Market consolidating in tight range',
        }
      },
      {
        v: 2,
        timestamp: Date.now() / 1000 - 86400 * 2,
        snapshot: {
          pattern: 'triangle',
          lifecycle: 'compression',
          confidence: 0.78,
          bias: 'bullish',
          probability: { up: 0.78, down: 0.18 },
          levels: { 
            top: 73500, 
            bottom: 68200,
            start_time: Date.now() / 1000 - 86400 * 5,
            end_time: Date.now() / 1000 - 86400 * 1,
          },
          interpretation: 'Market was consolidating → breakout confirmed',
        }
      }
    ],
    created_at: new Date(Date.now() - 86400 * 7 * 1000).toISOString(),
  },
  {
    idea_id: 'idea-002',
    asset: 'ETHUSDT',
    timeframe: '1D',
    status: 'active',
    outcome: null,
    score: 0,
    versions: [
      {
        v: 1,
        timestamp: Date.now() / 1000 - 86400 * 3,
        snapshot: {
          pattern: 'ascending_triangle',
          lifecycle: 'confirmed',
          confidence: 0.72,
          bias: 'bullish',
          probability: { up: 0.72, down: 0.24 },
          levels: { 
            top: 3850, 
            bottom: 3420,
            start_time: Date.now() / 1000 - 86400 * 6,
            end_time: Date.now() / 1000 - 86400 * 1,
          },
          interpretation: 'Strong accumulation pattern forming',
        }
      }
    ],
    created_at: new Date(Date.now() - 86400 * 3 * 1000).toISOString(),
  },
  {
    idea_id: 'idea-003',
    asset: 'SOLUSDT',
    timeframe: '4H',
    status: 'completed',
    outcome: 'invalidated',
    score: -1,
    versions: [
      {
        v: 1,
        timestamp: Date.now() / 1000 - 86400 * 10,
        snapshot: {
          pattern: 'head_and_shoulders',
          lifecycle: 'forming',
          confidence: 0.55,
          bias: 'bearish',
          probability: { up: 0.35, down: 0.58 },
          levels: { 
            top: 185, 
            bottom: 142,
            start_time: Date.now() / 1000 - 86400 * 13,
            end_time: Date.now() / 1000 - 86400 * 8,
          },
          interpretation: 'Distribution pattern detected',
        }
      }
    ],
    created_at: new Date(Date.now() - 86400 * 10 * 1000).toISOString(),
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatTimeAgo = (timestamp) => {
  const seconds = Math.floor((Date.now() / 1000) - timestamp);
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours}h ago`;
  return 'now';
};

const formatDate = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatPrice = (price) => {
  if (!price) return '-';
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const getResultType = (status, outcome) => {
  if (status === 'active') return 'active';
  if (outcome === 'success_up' || outcome === 'success_down') return 'correct';
  if (outcome === 'invalidated') return 'wrong';
  return 'neutral';
};

const getResultLabel = (status, outcome) => {
  if (status === 'active') return 'Active';
  if (outcome === 'success_up') return 'Breakout UP';
  if (outcome === 'success_down') return 'Breakdown';
  if (outcome === 'invalidated') return 'Wrong';
  return 'Neutral';
};

const buildInterpretation = (v1, v2, outcome) => {
  if (!v2) return v1?.snapshot?.interpretation || 'Analysis in progress...';
  if (outcome === 'success_up') return 'Market was consolidating → breakout confirmed';
  if (outcome === 'success_down') return 'Market failed structure → breakdown confirmed';
  if (outcome === 'invalidated') return 'Pattern invalidated → structure broken';
  return v2.snapshot?.interpretation || `${v1.snapshot.pattern} → ${v2.snapshot.pattern}`;
};

const buildWhatNext = (levels, lifecycle, outcome) => {
  if (outcome === 'success_up') return `Watch continuation above ${formatPrice(levels?.top)}`;
  if (outcome === 'success_down') return `Watch continuation below ${formatPrice(levels?.bottom)}`;
  if (lifecycle === 'forming') return `Wait for breakout confirmation`;
  return `Key level: ${formatPrice(levels?.top)}`;
};

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Normalize backend idea to frontend format
function normalizeIdea(raw) {
  const versions = (raw.versions || []).map((v, i) => {
    // Handle both backend format (setup_snapshot) and frontend format (snapshot)
    const setupSnapshot = v.setup_snapshot || v.snapshot || {};
    
    // Extract pattern info from setup_snapshot (may be nested)
    const pattern = setupSnapshot.pattern || 
      setupSnapshot.top_setup?.setup_type || 'unknown';
    const confidence = v.confidence || setupSnapshot.confidence || 0.5;
    const probability = setupSnapshot.probability || { up: confidence, down: 1 - confidence };
    const levels = setupSnapshot.levels || {};
    const interpretation = v.ai_explanation || setupSnapshot.interpretation || '';
    const lifecycle = setupSnapshot.lifecycle || 'unknown';
    const context = setupSnapshot.context || {};
    
    return {
      v: v.version || v.v || i + 1,
      timestamp: typeof v.timestamp === 'string' 
        ? new Date(v.timestamp).getTime() / 1000 
        : v.timestamp,
      snapshot: {
        pattern,
        lifecycle,
        confidence,
        bias: v.technical_bias || setupSnapshot.bias || 'neutral',
        probability,
        levels,
        interpretation,
        context,
      },
    };
  });
  
  // Determine outcome from validations or result
  let outcome = raw.outcome || null;
  let status = raw.status || 'active';
  let score = raw.score ?? 0;
  
  // Handle backend validation format
  if (raw.validations?.length) {
    const lastVal = raw.validations[raw.validations.length - 1];
    if (lastVal.result === 'correct' || lastVal.result === 'partially_correct') {
      outcome = outcome || 'success_up';
      score = 1;
      status = 'completed';
    }
    if (lastVal.result === 'invalidated') {
      outcome = outcome || 'invalidated';
      score = -1;
      status = 'completed';
    }
  }
  
  // Handle result field
  if (raw.result?.status === 'correct') { score = 1; status = 'completed'; }
  if (raw.result?.status === 'wrong') { score = -1; status = 'completed'; }
  if (raw.result?.outcome) { outcome = raw.result.outcome; }
  
  // Handle invalidated status
  if (status === 'invalidated') { status = 'completed'; outcome = outcome || 'invalidated'; score = -1; }
  
  return {
    idea_id: raw.idea_id || raw._id || String(Math.random()),
    asset: raw.asset || raw.symbol || 'UNKNOWN',
    timeframe: raw.timeframe || '4H',
    status,
    outcome,
    score,
    versions,
    created_at: raw.created_at || new Date().toISOString(),
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

const IdeasView = () => {
  const { symbol } = useMarket();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const [filter, setFilter] = useState('all');
  const [chartMode, setChartMode] = useState('idea'); // idea | performance
  
  // Replay state
  const [isReplaying, setIsReplaying] = useState(false);
  const replayIntervalRef = useRef(null);

  // Fetch ideas — try API first, fallback to MOCK
  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/ta/ideas?full=true`);
      if (res.ok) {
        const data = await res.json();
        const rawItems = data.ideas || data.items || [];
        if (rawItems.length > 0) {
          const items = rawItems.map(normalizeIdea);
          setIdeas(items);
          setLoading(false);
          return;
        }
      }
      // Fallback to mock
      setIdeas(MOCK_IDEAS);
    } catch (err) {
      console.error('Failed to fetch ideas:', err);
      setIdeas(MOCK_IDEAS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  // Auto-select first idea
  useEffect(() => {
    if (!selectedIdea && ideas.length > 0) {
      setSelectedIdea(ideas[0]);
      setActiveVersionIndex(ideas[0].versions.length - 1);
    }
  }, [ideas, selectedIdea]);

  // Select idea handler — instant chart sync
  const handleSelectIdea = useCallback((idea) => {
    // Stop any running replay
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }
    setIsReplaying(false);
    setSelectedIdea(idea);
    setActiveVersionIndex(idea.versions.length - 1);
  }, []);

  // Replay handler
  const handleReplay = useCallback(() => {
    if (!selectedIdea || selectedIdea.versions.length < 2) return;
    
    // Stop existing replay
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
      setIsReplaying(false);
      setActiveVersionIndex(selectedIdea.versions.length - 1);
      return;
    }
    
    // Start replay from V1
    setIsReplaying(true);
    setActiveVersionIndex(0);
    let idx = 0;
    
    replayIntervalRef.current = setInterval(() => {
      idx++;
      if (idx >= selectedIdea.versions.length) {
        clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
        setIsReplaying(false);
        return;
      }
      setActiveVersionIndex(idx);
    }, 800);
  }, [selectedIdea]);

  // Cleanup replay on unmount
  useEffect(() => {
    return () => {
      if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    };
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const wins = ideas.filter(i => i.outcome === 'success_up' || i.outcome === 'success_down').length;
    const losses = ideas.filter(i => i.outcome === 'invalidated').length;
    const total = ideas.length;
    const decided = wins + losses;
    const accuracy = decided > 0 ? Math.round(wins / decided * 100) : 0;
    
    let streak = 0;
    const sorted = [...ideas]
      .filter(i => i.status === 'completed')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    for (const idea of sorted) {
      if (idea.outcome === 'success_up' || idea.outcome === 'success_down') streak++;
      else break;
    }
    
    const lastCompleted = sorted[0];
    const lastResult = lastCompleted ? getResultType(lastCompleted.status, lastCompleted.outcome) : null;
    const trend = accuracy > 50 ? 'improving' : accuracy < 50 ? 'declining' : 'stable';
    
    return { wins, losses, total, accuracy, streak, lastResult, trend };
  }, [ideas]);

  // Filter ideas
  const filteredIdeas = useMemo(() => {
    return ideas.filter(idea => {
      if (filter === 'active') return idea.status === 'active';
      if (filter === 'completed') return idea.status === 'completed';
      if (filter === 'correct') return idea.outcome === 'success_up' || idea.outcome === 'success_down';
      if (filter === 'wrong') return idea.outcome === 'invalidated';
      return true;
    });
  }, [ideas, filter]);

  // Active version data
  const activeVersion = selectedIdea?.versions?.[activeVersionIndex];
  const firstVersion = selectedIdea?.versions?.[0];

  return (
    <Container data-testid="ideas-view">
      {/* LEFT PANEL */}
      <LeftPanel>
        {/* ACCURACY SCORE */}
        <AccuracyCard data-testid="accuracy-card">
          <CardContent style={{ padding: '12px 16px' }}>
            {stats.total === 0 ? (
              <EmptyAccuracy>
                <div className="title">No data yet</div>
              </EmptyAccuracy>
            ) : (
              <AccuracyMain>
                <AccuracyLeft>
                  <div className="value" data-testid="accuracy-value">
                    {stats.accuracy}<span>%</span>
                  </div>
                  <AccuracyStats style={{ margin: 0, padding: 0, border: 'none' }}>
                    <StatItem className="win"><CheckCircle2 /><span className="label">W:</span><span className="value">{stats.wins}</span></StatItem>
                    <StatItem className="loss"><XCircle /><span className="label">L:</span><span className="value">{stats.losses}</span></StatItem>
                    <StatItem className="total"><Bookmark /><span className="label">All:</span><span className="value">{stats.total}</span></StatItem>
                  </AccuracyStats>
                </AccuracyLeft>
                <AccuracyRight $hasStreak={stats.streak >= 3}>
                  <div className="streak">
                    <Flame /> {stats.streak} streak
                  </div>
                  {stats.lastResult && (
                    <div className="last-result">
                      Last: <span className={`result ${stats.lastResult}`}>
                        {stats.lastResult === 'correct' ? 'Correct' : 'Wrong'}
                      </span>
                    </div>
                  )}
                </AccuracyRight>
              </AccuracyMain>
            )}
          </CardContent>
        </AccuracyCard>

        {/* IDEAS FEED */}
        <Card style={{ flex: 1 }} data-testid="ideas-feed">
          <CardHeader>
            <h3><Bookmark /> Ideas</h3>
            <ActionBtn onClick={fetchIdeas} disabled={loading} data-testid="refresh-ideas-btn">
              <RefreshCw size={13} />
            </ActionBtn>
          </CardHeader>
          <CardContent>
            <FilterTabs data-testid="filter-tabs">
              {['all', 'active', 'completed', 'correct', 'wrong'].map(f => (
                <FilterTab key={f} $active={filter === f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </FilterTab>
              ))}
            </FilterTabs>

            {loading ? (
              <LoadingOverlay><Loader2 size={24} /></LoadingOverlay>
            ) : filteredIdeas.length === 0 ? (
              <EmptyState>
                <Bookmark />
                <h4>No ideas found</h4>
                <p>Try a different filter</p>
              </EmptyState>
            ) : (
              filteredIdeas.map(idea => {
                const v1 = idea.versions[0];
                const v2 = idea.versions[idea.versions.length - 1];
                const hasEvolution = idea.versions.length > 1;
                const resultType = getResultType(idea.status, idea.outcome);
                const probChange = hasEvolution ? v2.snapshot.probability.up - v1.snapshot.probability.up : 0;
                
                return (
                  <IdeaCardStyled
                    key={idea.idea_id}
                    $active={selectedIdea?.idea_id === idea.idea_id}
                    onClick={() => handleSelectIdea(idea)}
                    data-testid={`idea-card-${idea.idea_id}`}
                  >
                    <IdeaHeader>
                      <IdeaAsset>
                        <span className="symbol">{idea.asset.replace('USDT', '')}</span>
                        <span className="timeframe">{idea.timeframe}</span>
                      </IdeaAsset>
                      <ResultBadge $type={resultType} data-testid={`result-badge-${idea.idea_id}`}>
                        {resultType === 'correct' && <CheckCircle2 />}
                        {resultType === 'wrong' && <XCircle />}
                        {resultType === 'active' && <Zap />}
                        {getResultLabel(idea.status, idea.outcome)}
                      </ResultBadge>
                    </IdeaHeader>
                    
                    <EvolutionBlock>
                      <div className="evolution">
                        <span className={hasEvolution ? 'ghost' : 'pattern'}>
                          {v1.snapshot.pattern.replace(/_/g, ' ')}
                        </span>
                        {hasEvolution && (
                          <>
                            <span className="arrow"><ArrowRight /></span>
                            <span className="pattern">{v2.snapshot.pattern.replace(/_/g, ' ')}</span>
                          </>
                        )}
                      </div>
                      <div className="probability">
                        {Math.round(v1.snapshot.probability.up * 100)}%
                        {hasEvolution && (
                          <>
                            {' → '}
                            <span className={`change ${probChange > 0 ? 'up' : 'down'}`}>
                              {probChange > 0 ? <ArrowUp /> : <ArrowDown />}
                              {Math.round(v2.snapshot.probability.up * 100)}%
                            </span>
                          </>
                        )}
                      </div>
                    </EvolutionBlock>
                    
                    <IdeaMeta>
                      <div className="item">
                        <Clock />
                        {formatTimeAgo(v1.timestamp)}
                        {hasEvolution && ` → ${formatTimeAgo(v2.timestamp)}`}
                      </div>
                      {idea.score !== 0 && (
                        <div className="item">
                          <span className={`score ${idea.score > 0 ? 'positive' : 'negative'}`}>
                            {idea.score > 0 ? '+1' : '-1'}
                          </span>
                        </div>
                      )}
                    </IdeaMeta>
                  </IdeaCardStyled>
                );
              })
            )}
          </CardContent>
        </Card>
      </LeftPanel>

      {/* RIGHT PANEL — CHART + DETAIL */}
      <RightPanel>
        {/* CHART AREA */}
        {selectedIdea && (
          <div style={{ position: 'relative' }}>
            <IdeaChart
              idea={selectedIdea}
              activeVersionIndex={activeVersionIndex}
              isReplaying={isReplaying}
              height={400}
              chartMode={chartMode}
              allIdeas={ideas}
            />
            {/* Chart Mode Toggle */}
            <div style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              display: 'flex',
              gap: 4,
              zIndex: 25,
            }}>
              <button
                data-testid="chart-mode-idea-btn"
                onClick={() => setChartMode('idea')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: `1px solid ${chartMode === 'idea' ? '#3b82f6' : '#e2e8f0'}`,
                  background: chartMode === 'idea' ? '#3b82f6' : 'rgba(255,255,255,0.9)',
                  color: chartMode === 'idea' ? '#ffffff' : '#64748b',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                }}
              >
                Idea
              </button>
              <button
                data-testid="chart-mode-performance-btn"
                onClick={() => setChartMode('performance')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: `1px solid ${chartMode === 'performance' ? '#8b5cf6' : '#e2e8f0'}`,
                  background: chartMode === 'performance' ? '#8b5cf6' : 'rgba(255,255,255,0.9)',
                  color: chartMode === 'performance' ? '#ffffff' : '#64748b',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  Performance
                </span>
              </button>
            </div>
          </div>
        )}
        
        {/* DETAIL PANEL */}
        <DetailPanel data-testid="detail-panel">
          {selectedIdea && activeVersion ? (
            <>
              <DetailHeader>
                <DetailTitle>
                  <span className="symbol">{selectedIdea.asset.replace('USDT', '')}</span>
                  <span className="timeframe">{selectedIdea.timeframe}</span>
                  <ResultBadge $type={getResultType(selectedIdea.status, selectedIdea.outcome)} data-testid="detail-result-badge">
                    {getResultLabel(selectedIdea.status, selectedIdea.outcome)}
                  </ResultBadge>
                </DetailTitle>
                <DetailActions>
                  {selectedIdea.versions.length > 1 && (
                    <ActionBtn
                      onClick={handleReplay}
                      data-testid="replay-btn"
                      disabled={selectedIdea.versions.length < 2}
                    >
                      {isReplaying ? <><Square size={12} /> Stop</> : <><Play size={12} /> Replay</>}
                    </ActionBtn>
                  )}
                </DetailActions>
              </DetailHeader>
              
              <DetailContent>
                {/* EVOLUTION */}
                <InfoSection>
                  <div className="section-label">Evolution</div>
                  <EvolutionCard data-testid="evolution-card">
                    <div className="main">
                      <span className="pattern">{firstVersion.snapshot.pattern.replace(/_/g, ' ')}</span>
                      {selectedIdea.versions.length > 1 && (
                        <>
                          <span className="arrow"><ArrowRight /></span>
                          <span className="pattern">{activeVersion.snapshot.pattern.replace(/_/g, ' ')}</span>
                        </>
                      )}
                    </div>
                    <div className="dates">
                      {formatDate(firstVersion.timestamp)}
                      {selectedIdea.versions.length > 1 && ` → ${formatDate(activeVersion.timestamp)}`}
                    </div>
                  </EvolutionCard>
                </InfoSection>
                
                {/* INTERPRETATION */}
                <InfoSection>
                  <div className="section-label">Core Insight</div>
                  <InterpretationCard data-testid="interpretation-card">
                    <div className="text">
                      {buildInterpretation(firstVersion, selectedIdea.versions.length > 1 ? activeVersion : null, selectedIdea.outcome)}
                    </div>
                  </InterpretationCard>
                </InfoSection>
                
                {/* PROBABILITY */}
                <InfoSection>
                  <div className="section-label">Probability</div>
                  <ProbabilityCard data-testid="probability-card">
                    <div className="row">
                      <span className="label">AI Breakout</span>
                      <span className="value up">
                        <TrendingUp />
                        {Math.round(activeVersion.snapshot.probability.up * 100)}%
                        {selectedIdea.versions.length > 1 && (
                          <span className={`change ${activeVersion.snapshot.probability.up > firstVersion.snapshot.probability.up ? 'positive' : 'negative'}`}>
                            {activeVersion.snapshot.probability.up > firstVersion.snapshot.probability.up ? '+' : ''}
                            {Math.round((activeVersion.snapshot.probability.up - firstVersion.snapshot.probability.up) * 100)}%
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="row">
                      <span className="label">AI Breakdown</span>
                      <span className="value down">
                        <TrendingDown />
                        {Math.round(activeVersion.snapshot.probability.down * 100)}%
                      </span>
                    </div>
                    <div className="row">
                      <span className="label">Confidence</span>
                      <span className="value">
                        {Math.round(activeVersion.snapshot.confidence * 100)}%
                      </span>
                    </div>
                  </ProbabilityCard>
                </InfoSection>
                
                {/* LEVELS */}
                <InfoSection>
                  <div className="section-label">Key Levels</div>
                  <LevelsCard data-testid="levels-card">
                    <div className="level">
                      <span className="label breakout">Breakout</span>
                      <span className="price">{formatPrice(activeVersion.snapshot.levels?.top)}</span>
                    </div>
                    <div className="level">
                      <span className="label invalidation">Invalidation</span>
                      <span className="price">{formatPrice(activeVersion.snapshot.levels?.bottom)}</span>
                    </div>
                  </LevelsCard>
                </InfoSection>
                
                {/* WHAT NEXT */}
                <InfoSection>
                  <div className="section-label">What Next</div>
                  <WhatNextCard data-testid="what-next-card">
                    <div className="text">
                      <Target />
                      {buildWhatNext(activeVersion.snapshot.levels, activeVersion.snapshot.lifecycle, selectedIdea.outcome)}
                    </div>
                  </WhatNextCard>
                </InfoSection>
                
                {/* SCORE */}
                {selectedIdea.score !== 0 && (
                  <InfoSection>
                    <div className="section-label">Score</div>
                    <ScoreCard $positive={selectedIdea.score > 0} data-testid="score-card">
                      <span className="label">Accuracy impact</span>
                      <span className="score">{selectedIdea.score > 0 ? '+1' : '-1'}</span>
                    </ScoreCard>
                  </InfoSection>
                )}
                
                {/* VERSION TIMELINE */}
                <InfoSection>
                  <TimelineCard data-testid="timeline-card">
                    <div className="header">
                      <span className="label">Version Timeline</span>
                      {selectedIdea.versions.length > 1 && (
                        <ReplayControls>
                          <ActionBtn
                            onClick={handleReplay}
                            data-testid="timeline-replay-btn"
                          >
                            {isReplaying ? <><Square size={11} /> Stop</> : <><Play size={11} /> Replay</>}
                          </ActionBtn>
                        </ReplayControls>
                      )}
                    </div>
                    <VersionButtons>
                      {selectedIdea.versions.map((v, i) => (
                        <VersionBtn
                          key={v.v}
                          $active={activeVersionIndex === i}
                          onClick={() => {
                            // Stop replay if clicking manually
                            if (replayIntervalRef.current) {
                              clearInterval(replayIntervalRef.current);
                              replayIntervalRef.current = null;
                              setIsReplaying(false);
                            }
                            setActiveVersionIndex(i);
                          }}
                          data-testid={`version-btn-v${v.v}`}
                        >
                          <span className="version">V{v.v}</span>
                          <span className="date">{formatDate(v.timestamp)}</span>
                        </VersionBtn>
                      ))}
                    </VersionButtons>
                  </TimelineCard>
                </InfoSection>
              </DetailContent>
            </>
          ) : (
            <EmptyState style={{ flex: 1, justifyContent: 'center' }}>
              <Sparkles />
              <h4>Track your ideas</h4>
              <p>See how your predictions evolve over time</p>
            </EmptyState>
          )}
        </DetailPanel>
      </RightPanel>
    </Container>
  );
};

export default IdeasView;
