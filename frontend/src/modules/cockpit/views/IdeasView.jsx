/**
 * IdeasView v2 — Graph-First Ideas Mode
 * ======================================
 * 
 * New Architecture:
 * - NO left column
 * - Horizontal Idea Selector Strip at top
 * - Full-width Graph (center)
 * - Single Bottom Insight Panel (6 sections)
 * 
 * Key UX:
 * - Auto-select first idea
 * - Graph Sync: clicking idea → chart instantly shows it
 * - Replay: V1 → V2 → V3 animation
 * - Evolution (pattern → pattern)
 * - Result badges
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { 
  Bookmark, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Target,
  Loader2,
  Flame,
  Play,
  Square,
  Zap,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Filter,
  BarChart3
} from 'lucide-react';
import IdeaChart from '../components/IdeaChart';
import { useMarket } from '../../../store/marketStore';

// ============================================
// ANIMATIONS
// ============================================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

// ============================================
// NEW LAYOUT — GRAPH-FIRST
// ============================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  min-height: calc(100vh - 140px);
  background: #0B0F14;
`;

// Idea Selector Strip (replaces left column)
const SelectorStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: #0B0F14;
  border-bottom: 1px solid #1e293b;
  overflow-x: auto;
  
  &::-webkit-scrollbar { height: 4px; }
  &::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
  
  @media (max-width: 768px) {
    padding: 10px 12px;
    gap: 8px;
  }
`;

const StripControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 12px;
  border-right: 1px solid #1e293b;
  flex-shrink: 0;
`;

const FilterBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid ${({ $active }) => $active ? '#3b82f6' : '#334155'};
  background: ${({ $active }) => $active ? 'rgba(59, 130, 246, 0.15)' : 'transparent'};
  color: ${({ $active }) => $active ? '#60a5fa' : '#94a3b8'};
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  
  svg { width: 12px; height: 12px; }
  
  &:hover {
    border-color: #3b82f6;
    color: #60a5fa;
  }
`;

const RefreshBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
  
  svg { width: 14px; height: 14px; }
  
  &:hover { border-color: #3b82f6; color: #60a5fa; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

// Idea Card (Horizontal Chip)
const IdeaChip = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 220px;
  max-width: 260px;
  padding: 10px 14px;
  background: ${({ $active }) => $active ? 'rgba(59, 130, 246, 0.12)' : '#111827'};
  border: 1px solid ${({ $active }) => $active ? '#3b82f6' : '#1e293b'};
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  animation: ${fadeIn} 0.3s ease;
  
  ${({ $active }) => $active && css`
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  `}
  
  &:hover {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.08);
    transform: translateY(-2px);
  }
`;

const ChipHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`;

const ChipAsset = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  
  .symbol { 
    font-size: 14px; 
    font-weight: 700; 
    color: #f1f5f9; 
  }
  .timeframe {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 5px;
    background: rgba(148, 163, 184, 0.15);
    border-radius: 4px;
    color: #94a3b8;
  }
`;

const ResultBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 5px;
  font-size: 9px;
  font-weight: 600;
  
  svg { width: 10px; height: 10px; }
  
  ${({ $type }) => {
    switch ($type) {
      case 'correct': return `background: rgba(34, 197, 94, 0.15); color: #4ade80;`;
      case 'wrong': return `background: rgba(239, 68, 68, 0.15); color: #f87171;`;
      case 'active': return `background: rgba(59, 130, 246, 0.15); color: #60a5fa;`;
      default: return `background: rgba(148, 163, 184, 0.15); color: #94a3b8;`;
    }
  }}
`;

const ChipEvolution = styled.div`
  font-size: 12px;
  color: #cbd5e1;
  margin-bottom: 4px;
  
  .ghost { color: #475569; text-decoration: line-through; }
  .arrow { color: #3b82f6; margin: 0 4px; }
  .current { text-transform: capitalize; font-weight: 500; }
`;

const ChipMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: #64748b;
  
  .prob {
    display: flex;
    align-items: center;
    gap: 3px;
    &.up { color: #4ade80; }
    &.down { color: #f87171; }
    svg { width: 10px; height: 10px; }
  }
  
  .score {
    font-weight: 600;
    &.positive { color: #4ade80; }
    &.negative { color: #f87171; }
  }
`;

// Graph Section (Full Width)
const GraphSection = styled.div`
  position: relative;
  width: 100%;
  padding: 16px 20px;
  background: #0B0F14;
  animation: ${fadeIn} 0.3s ease;
  
  @media (max-width: 768px) {
    padding: 12px;
  }
`;

const GraphCard = styled.div`
  position: relative;
  background: #111827;
  border-radius: 16px;
  border: 1px solid #1e293b;
  overflow: hidden;
  min-height: 480px;
  
  @media (max-width: 768px) {
    min-height: 360px;
  }
`;

// Bottom Insight Panel (Full Width)
const InsightPanel = styled.div`
  background: #111827;
  border-top: 1px solid #1e293b;
  padding: 20px 24px;
  animation: ${fadeIn} 0.4s ease;
  
  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const InsightHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const InsightTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  .symbol { 
    font-size: 20px; 
    font-weight: 700; 
    color: #f1f5f9; 
  }
  .timeframe {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    background: rgba(148, 163, 184, 0.12);
    border-radius: 6px;
    color: #94a3b8;
  }
`;

const InsightActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ActionBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid ${({ $primary }) => $primary ? '#3b82f6' : '#334155'};
  background: ${({ $primary }) => $primary ? 'rgba(59, 130, 246, 0.15)' : 'transparent'};
  color: ${({ $primary }) => $primary ? '#60a5fa' : '#94a3b8'};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  
  svg { width: 14px; height: 14px; }
  
  &:hover:not(:disabled) {
    border-color: #3b82f6;
    color: #60a5fa;
    background: rgba(59, 130, 246, 0.1);
  }
  
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

// 6 Section Grid
const InsightGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  
  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const InsightBlock = styled.div`
  padding: 16px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 12px;
  border: 1px solid #1e293b;
  
  .label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #64748b;
    margin-bottom: 10px;
  }
`;

// Evolution Block
const EvolutionContent = styled.div`
  .main {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    
    .pattern { 
      font-size: 16px; 
      font-weight: 600; 
      color: #f1f5f9;
      text-transform: capitalize;
    }
    .arrow { color: #3b82f6; svg { width: 16px; height: 16px; } }
  }
  
  .dates { font-size: 11px; color: #64748b; }
`;

// Probability Block
const ProbContent = styled.div`
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid rgba(30, 41, 59, 0.5);
    &:last-child { border-bottom: none; }
  }
  
  .label { font-size: 12px; color: #94a3b8; }
  
  .value {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    
    &.up { color: #4ade80; }
    &.down { color: #f87171; }
    
    svg { width: 14px; height: 14px; }
    
    .change {
      font-size: 10px;
      padding: 2px 5px;
      border-radius: 4px;
      &.positive { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
      &.negative { background: rgba(239, 68, 68, 0.15); color: #f87171; }
    }
  }
`;

// Levels Block
const LevelsContent = styled.div`
  .level {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid rgba(30, 41, 59, 0.5);
    &:last-child { border-bottom: none; }
    
    .label { 
      font-size: 11px; 
      font-weight: 500;
      &.breakout { color: #4ade80; }
      &.invalidation { color: #f87171; }
      &.target { color: #60a5fa; }
    }
    .price { 
      font-size: 16px; 
      font-weight: 700; 
      color: #f1f5f9;
    }
  }
`;

// What Next Block
const WhatNextContent = styled.div`
  .text {
    font-size: 14px;
    color: #60a5fa;
    font-weight: 500;
    line-height: 1.5;
    
    svg { 
      width: 14px; 
      height: 14px; 
      display: inline; 
      margin-right: 6px;
      vertical-align: middle;
    }
  }
`;

// Score Block
const ScoreContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  .info {
    .result { 
      font-size: 14px; 
      font-weight: 600; 
      color: ${({ $positive }) => $positive ? '#4ade80' : $positive === false ? '#f87171' : '#94a3b8'};
      margin-bottom: 4px;
    }
    .impact { font-size: 11px; color: #64748b; }
  }
  
  .score {
    font-size: 28px;
    font-weight: 700;
    color: ${({ $positive }) => $positive ? '#4ade80' : $positive === false ? '#f87171' : '#94a3b8'};
  }
`;

// Timeline Block
const TimelineContent = styled.div`
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  
  .versions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
`;

const VersionBtn = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid ${({ $active }) => $active ? '#3b82f6' : '#334155'};
  background: ${({ $active }) => $active ? 'rgba(59, 130, 246, 0.15)' : 'transparent'};
  color: ${({ $active }) => $active ? '#60a5fa' : '#94a3b8'};
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 65px;
  
  .version { margin-bottom: 2px; }
  .date { font-size: 9px; font-weight: 400; opacity: 0.7; }
  
  &:hover { border-color: #3b82f6; color: #60a5fa; }
`;

// Empty States
const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;
  
  svg { width: 56px; height: 56px; color: #334155; margin-bottom: 16px; }
  h4 { font-size: 16px; font-weight: 600; color: #f1f5f9; margin: 0 0 6px 0; }
  p { font-size: 13px; color: #64748b; margin: 0; }
`;

const LoadingOverlay = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  
  svg { animation: spin 1s linear infinite; color: #3b82f6; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

// Chart Mode Toggle (on graph)
const ChartModeToggle = styled.div`
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  gap: 4px;
  z-index: 25;
`;

const ModeBtn = styled.button`
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid ${({ $active, $color }) => $active ? ($color || '#3b82f6') : '#334155'};
  background: ${({ $active, $color }) => $active ? `${$color || '#3b82f6'}20` : 'rgba(17, 24, 39, 0.9)'};
  color: ${({ $active, $color }) => $active ? ($color || '#60a5fa') : '#94a3b8'};
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: all 0.15s;
  
  &:hover {
    border-color: ${({ $color }) => $color || '#3b82f6'};
    color: ${({ $color }) => $color || '#60a5fa'};
  }
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
    const setupSnapshot = v.setup_snapshot || v.snapshot || {};
    const pattern = setupSnapshot.pattern || 
      setupSnapshot.top_setup?.setup_type || 'unknown';
    const confidence = v.confidence || setupSnapshot.confidence || 0.5;
    const probability = setupSnapshot.probability || { up: confidence, down: 1 - confidence };
    const levels = setupSnapshot.levels || {};
    const interpretation = v.ai_explanation || setupSnapshot.interpretation || '';
    const lifecycle = setupSnapshot.lifecycle || 'unknown';
    
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
      },
    };
  });
  
  let outcome = raw.outcome || null;
  let status = raw.status || 'active';
  let score = raw.score ?? 0;
  
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
  
  if (raw.result?.status === 'correct') { score = 1; status = 'completed'; }
  if (raw.result?.status === 'wrong') { score = -1; status = 'completed'; }
  if (raw.result?.outcome) { outcome = raw.result.outcome; }
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
  const [chartMode, setChartMode] = useState('idea');
  
  // Replay state
  const [isReplaying, setIsReplaying] = useState(false);
  const replayIntervalRef = useRef(null);

  // Fetch ideas
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

  // Select idea handler
  const handleSelectIdea = useCallback((idea) => {
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
    
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
      setIsReplaying(false);
      setActiveVersionIndex(selectedIdea.versions.length - 1);
      return;
    }
    
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

  useEffect(() => {
    return () => {
      if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    };
  }, []);

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
      {/* IDEA SELECTOR STRIP (replaces left column) */}
      <SelectorStrip data-testid="idea-selector-strip">
        <StripControls>
          <FilterBtn 
            $active={filter === 'all'} 
            onClick={() => setFilter('all')}
            data-testid="filter-all"
          >
            All
          </FilterBtn>
          <FilterBtn 
            $active={filter === 'active'} 
            onClick={() => setFilter('active')}
            data-testid="filter-active"
          >
            <Zap /> Active
          </FilterBtn>
          <FilterBtn 
            $active={filter === 'correct'} 
            onClick={() => setFilter('correct')}
            data-testid="filter-correct"
          >
            <CheckCircle2 /> Win
          </FilterBtn>
          <FilterBtn 
            $active={filter === 'wrong'} 
            onClick={() => setFilter('wrong')}
            data-testid="filter-wrong"
          >
            <XCircle /> Loss
          </FilterBtn>
          <RefreshBtn onClick={fetchIdeas} disabled={loading} data-testid="refresh-ideas-btn">
            <RefreshCw />
          </RefreshBtn>
        </StripControls>
        
        {/* Idea Chips */}
        {loading ? (
          <LoadingOverlay><Loader2 size={20} /></LoadingOverlay>
        ) : filteredIdeas.length === 0 ? (
          <span style={{ color: '#64748b', fontSize: 12 }}>No ideas found</span>
        ) : (
          filteredIdeas.map(idea => {
            const v1 = idea.versions[0];
            const v2 = idea.versions[idea.versions.length - 1];
            const hasEvolution = idea.versions.length > 1;
            const resultType = getResultType(idea.status, idea.outcome);
            
            return (
              <IdeaChip
                key={idea.idea_id}
                $active={selectedIdea?.idea_id === idea.idea_id}
                onClick={() => handleSelectIdea(idea)}
                data-testid={`idea-chip-${idea.idea_id}`}
              >
                <ChipHeader>
                  <ChipAsset>
                    <span className="symbol">{idea.asset.replace('USDT', '')}</span>
                    <span className="timeframe">{idea.timeframe}</span>
                  </ChipAsset>
                  <ResultBadge $type={resultType}>
                    {resultType === 'correct' && <CheckCircle2 />}
                    {resultType === 'wrong' && <XCircle />}
                    {resultType === 'active' && <Zap />}
                    {getResultLabel(idea.status, idea.outcome)}
                  </ResultBadge>
                </ChipHeader>
                
                <ChipEvolution>
                  <span className={hasEvolution ? 'ghost' : 'current'}>
                    {v1.snapshot.pattern.replace(/_/g, ' ')}
                  </span>
                  {hasEvolution && (
                    <>
                      <span className="arrow">→</span>
                      <span className="current">{v2.snapshot.pattern.replace(/_/g, ' ')}</span>
                    </>
                  )}
                </ChipEvolution>
                
                <ChipMeta>
                  <span className={`prob ${v2.snapshot.probability.up > 0.5 ? 'up' : 'down'}`}>
                    {v2.snapshot.probability.up > 0.5 ? <ArrowUp /> : <ArrowDown />}
                    {Math.round(v2.snapshot.probability.up * 100)}%
                  </span>
                  <Clock size={10} />
                  <span>{formatTimeAgo(v1.timestamp)}</span>
                  {idea.score !== 0 && (
                    <span className={`score ${idea.score > 0 ? 'positive' : 'negative'}`}>
                      {idea.score > 0 ? '+1' : '-1'}
                    </span>
                  )}
                </ChipMeta>
              </IdeaChip>
            );
          })
        )}
      </SelectorStrip>

      {/* GRAPH SECTION (Full Width) */}
      <GraphSection data-testid="graph-section">
        {selectedIdea ? (
          <GraphCard>
            <IdeaChart
              idea={selectedIdea}
              activeVersionIndex={activeVersionIndex}
              isReplaying={isReplaying}
              height={480}
              chartMode={chartMode}
              allIdeas={ideas}
            />
            
            {/* Chart Mode Toggle */}
            <ChartModeToggle>
              <ModeBtn
                $active={chartMode === 'idea'}
                $color="#3b82f6"
                onClick={() => setChartMode('idea')}
                data-testid="chart-mode-idea-btn"
              >
                Idea
              </ModeBtn>
              <ModeBtn
                $active={chartMode === 'performance'}
                $color="#8b5cf6"
                onClick={() => setChartMode('performance')}
                data-testid="chart-mode-performance-btn"
              >
                Performance
              </ModeBtn>
            </ChartModeToggle>
          </GraphCard>
        ) : (
          <GraphCard>
            <EmptyState>
              <Sparkles />
              <h4>Select an Idea</h4>
              <p>Choose an idea from the strip above to view analysis</p>
            </EmptyState>
          </GraphCard>
        )}
      </GraphSection>

      {/* BOTTOM INSIGHT PANEL (6 Sections) */}
      {selectedIdea && activeVersion && (
        <InsightPanel data-testid="insight-panel">
          <InsightHeader>
            <InsightTitle>
              <ResultBadge $type={getResultType(selectedIdea.status, selectedIdea.outcome)} style={{ padding: '4px 10px', fontSize: 11 }}>
                {getResultLabel(selectedIdea.status, selectedIdea.outcome)}
              </ResultBadge>
              <span className="symbol">{selectedIdea.asset.replace('USDT', '')}</span>
              <span className="timeframe">{selectedIdea.timeframe}</span>
            </InsightTitle>
            
            <InsightActions>
              {selectedIdea.versions.length > 1 && (
                <ActionBtn
                  onClick={handleReplay}
                  data-testid="replay-btn"
                  $primary={isReplaying}
                >
                  {isReplaying ? <><Square size={12} /> Stop</> : <><Play size={12} /> Replay</>}
                </ActionBtn>
              )}
            </InsightActions>
          </InsightHeader>
          
          <InsightGrid>
            {/* 1. Evolution */}
            <InsightBlock data-testid="evolution-block">
              <div className="label">Evolution</div>
              <EvolutionContent>
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
              </EvolutionContent>
            </InsightBlock>
            
            {/* 2. Probability */}
            <InsightBlock data-testid="probability-block">
              <div className="label">Probability</div>
              <ProbContent>
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
                  <span className="value" style={{ color: '#f1f5f9' }}>
                    {Math.round(activeVersion.snapshot.confidence * 100)}%
                  </span>
                </div>
              </ProbContent>
            </InsightBlock>
            
            {/* 3. Key Levels */}
            <InsightBlock data-testid="levels-block">
              <div className="label">Key Levels</div>
              <LevelsContent>
                <div className="level">
                  <span className="label breakout">Breakout</span>
                  <span className="price">{formatPrice(activeVersion.snapshot.levels?.top)}</span>
                </div>
                <div className="level">
                  <span className="label invalidation">Invalidation</span>
                  <span className="price">{formatPrice(activeVersion.snapshot.levels?.bottom)}</span>
                </div>
              </LevelsContent>
            </InsightBlock>
            
            {/* 4. What Next */}
            <InsightBlock data-testid="what-next-block">
              <div className="label">What Next</div>
              <WhatNextContent>
                <div className="text">
                  <Target />
                  {buildWhatNext(activeVersion.snapshot.levels, activeVersion.snapshot.lifecycle, selectedIdea.outcome)}
                </div>
              </WhatNextContent>
            </InsightBlock>
            
            {/* 5. Score */}
            <InsightBlock data-testid="score-block">
              <div className="label">Result</div>
              <ScoreContent $positive={selectedIdea.score > 0 ? true : selectedIdea.score < 0 ? false : null}>
                <div className="info">
                  <div className="result">
                    {selectedIdea.score > 0 ? 'Correct' : selectedIdea.score < 0 ? 'Wrong' : 'Pending'}
                  </div>
                  <div className="impact">Accuracy impact</div>
                </div>
                <div className="score">
                  {selectedIdea.score > 0 ? '+1' : selectedIdea.score < 0 ? '-1' : '—'}
                </div>
              </ScoreContent>
            </InsightBlock>
            
            {/* 6. Version Timeline */}
            <InsightBlock data-testid="timeline-block">
              <div className="label">Version Timeline</div>
              <TimelineContent>
                <div className="header">
                  {selectedIdea.versions.length > 1 && (
                    <ActionBtn
                      onClick={handleReplay}
                      data-testid="timeline-replay-btn"
                      style={{ padding: '4px 10px', fontSize: 10 }}
                    >
                      {isReplaying ? <><Square size={10} /> Stop</> : <><Play size={10} /> Replay</>}
                    </ActionBtn>
                  )}
                </div>
                <div className="versions">
                  {selectedIdea.versions.map((v, i) => (
                    <VersionBtn
                      key={v.v}
                      $active={activeVersionIndex === i}
                      onClick={() => {
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
                </div>
              </TimelineContent>
            </InsightBlock>
          </InsightGrid>
        </InsightPanel>
      )}
    </Container>
  );
};

export default IdeasView;
