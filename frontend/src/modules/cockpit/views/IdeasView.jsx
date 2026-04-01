/**
 * IdeasView.jsx — TEXT-ONLY Ideas Evolution Tracker
 * ==================================================
 * 
 * NO CHART! Just text-based tracking:
 * - Pattern A → Pattern B evolution
 * - When pattern changed
 * - Result (WIN/LOSS/ACTIVE)
 * 
 * Simple, clean, works.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { 
  Bookmark, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ArrowRight,
  Zap,
  Filter,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { useMarket } from '../../../store/marketStore';

// ============================================
// STYLED COMPONENTS — Clean, Text-Focused
// ============================================

const Container = styled.div`
  padding: 20px 24px;
  min-height: calc(100vh - 140px);
  background: #f8fafc;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  
  svg { color: #3b82f6; }
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const FilterBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid ${({ $active }) => $active ? '#3b82f6' : '#e2e8f0'};
  background: ${({ $active }) => $active ? 'rgba(59, 130, 246, 0.08)' : '#ffffff'};
  color: ${({ $active }) => $active ? '#3b82f6' : '#64748b'};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  
  svg { width: 14px; height: 14px; }
  
  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
  }
`;

const RefreshBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
  
  svg { width: 16px; height: 16px; }
  
  &:hover { border-color: #3b82f6; color: #3b82f6; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

// Ideas List
const IdeasList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

// Single Idea Card — TEXT FOCUSED
const IdeaCard = styled.div`
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  padding: 20px 24px;
  transition: all 0.2s;
  
  &:hover {
    border-color: #cbd5e1;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  }
`;

const IdeaHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const AssetInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const AssetBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  
  .symbol {
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
  }
  
  .timeframe {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    background: #f1f5f9;
    border-radius: 6px;
    color: #64748b;
  }
`;

const StatusBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  
  svg { width: 14px; height: 14px; }
  
  ${({ $status }) => {
    switch ($status) {
      case 'win': return `background: rgba(34, 197, 94, 0.1); color: #16a34a;`;
      case 'loss': return `background: rgba(239, 68, 68, 0.1); color: #dc2626;`;
      default: return `background: rgba(59, 130, 246, 0.1); color: #2563eb;`;
    }
  }}
`;

// Evolution Timeline — THE MAIN VISUAL
const EvolutionTimeline = styled.div`
  display: flex;
  align-items: stretch;
  gap: 0;
  margin: 20px 0;
`;

const VersionBlock = styled.div`
  flex: 1;
  padding: 16px 20px;
  background: ${({ $active }) => $active ? 'rgba(59, 130, 246, 0.06)' : '#f8fafc'};
  border: 1px solid ${({ $active }) => $active ? '#3b82f6' : '#e2e8f0'};
  border-radius: ${({ $position }) => 
    $position === 'first' ? '12px 0 0 12px' : 
    $position === 'last' ? '0 12px 12px 0' : '0'};
  position: relative;
  
  ${({ $position }) => $position !== 'first' && `
    margin-left: -1px;
  `}
`;

const VersionLabel = styled.div`
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${({ $active }) => $active ? '#3b82f6' : '#94a3b8'};
  margin-bottom: 8px;
`;

const PatternName = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  text-transform: capitalize;
  margin-bottom: 6px;
`;

const PatternMeta = styled.div`
  font-size: 12px;
  color: #64748b;
  
  .confidence {
    font-weight: 600;
    color: ${({ $confidence }) => 
      $confidence >= 0.7 ? '#16a34a' : 
      $confidence >= 0.5 ? '#d97706' : '#64748b'};
  }
`;

const VersionDate = styled.div`
  font-size: 11px;
  color: #94a3b8;
  margin-top: 8px;
`;

const TransitionArrow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  flex-shrink: 0;
  background: linear-gradient(90deg, #f8fafc 0%, #ffffff 50%, #f8fafc 100%);
  
  svg {
    width: 20px;
    height: 20px;
    color: #3b82f6;
  }
`;

// Details Row
const DetailsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const DetailBlock = styled.div`
  .label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
    margin-bottom: 4px;
  }
  
  .value {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
    
    &.positive { color: #16a34a; }
    &.negative { color: #dc2626; }
    &.neutral { color: #64748b; }
  }
`;

const IdeaActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
`;

const ActionBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  
  svg { width: 12px; height: 12px; }
  
  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
  }
  
  &.danger:hover {
    border-color: #ef4444;
    color: #ef4444;
  }
`;

// Empty State
const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  
  svg { width: 48px; height: 48px; color: #cbd5e1; margin-bottom: 16px; }
  h4 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 0 0 8px 0; }
  p { font-size: 13px; color: #64748b; margin: 0; max-width: 300px; }
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
        timestamp: Date.now() / 1000 - 86400 * 12,
        snapshot: {
          pattern: 'rectangle',
          lifecycle: 'forming',
          confidence: 0.62,
          bias: 'bullish',
          probability: { up: 0.62, down: 0.28 },
          levels: { top: 70500, bottom: 67500 },
        }
      },
      {
        v: 2,
        timestamp: Date.now() / 1000 - 86400 * 4,
        snapshot: {
          pattern: 'triangle',
          lifecycle: 'compression',
          confidence: 0.78,
          bias: 'bullish',
          probability: { up: 0.78, down: 0.18 },
          levels: { top: 71000, bottom: 68000 },
        }
      }
    ],
    created_at: new Date(Date.now() - 86400 * 12 * 1000).toISOString(),
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
          pattern: 'ascending triangle',
          lifecycle: 'confirmed',
          confidence: 0.72,
          bias: 'bullish',
          probability: { up: 0.72, down: 0.24 },
          levels: { top: 3850, bottom: 3420 },
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
          pattern: 'head and shoulders',
          lifecycle: 'forming',
          confidence: 0.55,
          bias: 'bearish',
          probability: { up: 0.35, down: 0.58 },
          levels: { top: 185, bottom: 142 },
        }
      },
      {
        v: 2,
        timestamp: Date.now() / 1000 - 86400 * 6,
        snapshot: {
          pattern: 'double top',
          lifecycle: 'confirmed',
          confidence: 0.48,
          bias: 'bearish',
          probability: { up: 0.38, down: 0.55 },
          levels: { top: 180, bottom: 155 },
        }
      }
    ],
    created_at: new Date(Date.now() - 86400 * 10 * 1000).toISOString(),
  },
];

// ============================================
// HELPERS
// ============================================

const formatDate = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatTimeAgo = (timestamp) => {
  const seconds = Math.floor((Date.now() / 1000) - timestamp);
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours}h ago`;
  return 'now';
};

const getStatus = (idea) => {
  if (idea.status === 'active') return 'active';
  if (idea.outcome === 'success_up' || idea.outcome === 'success_down') return 'win';
  return 'loss';
};

const getStatusLabel = (idea) => {
  const status = getStatus(idea);
  if (status === 'win') return 'Correct';
  if (status === 'loss') return 'Wrong';
  return 'Active';
};

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ============================================
// MAIN COMPONENT
// ============================================

const IdeasView = () => {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  // Fetch ideas
  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/ta/ideas?full=true`);
      if (res.ok) {
        const data = await res.json();
        const rawItems = data.ideas || data.items || [];
        if (rawItems.length > 0) {
          setIdeas(rawItems);
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

  // Filter ideas
  const filteredIdeas = useMemo(() => {
    return ideas.filter(idea => {
      if (filter === 'active') return idea.status === 'active';
      if (filter === 'win') return idea.outcome === 'success_up' || idea.outcome === 'success_down';
      if (filter === 'loss') return idea.outcome === 'invalidated';
      return true;
    });
  }, [ideas, filter]);

  // Stats
  const stats = useMemo(() => {
    const wins = ideas.filter(i => i.outcome === 'success_up' || i.outcome === 'success_down').length;
    const losses = ideas.filter(i => i.outcome === 'invalidated').length;
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return { wins, losses, winRate, active: ideas.filter(i => i.status === 'active').length };
  }, [ideas]);

  return (
    <Container data-testid="ideas-view">
      <Header>
        <Title>
          <Bookmark size={22} />
          Saved Ideas
        </Title>
        
        <Controls>
          <FilterBtn $active={filter === 'all'} onClick={() => setFilter('all')}>
            All ({ideas.length})
          </FilterBtn>
          <FilterBtn $active={filter === 'active'} onClick={() => setFilter('active')}>
            <Zap size={12} /> Active ({stats.active})
          </FilterBtn>
          <FilterBtn $active={filter === 'win'} onClick={() => setFilter('win')}>
            <CheckCircle2 size={12} /> Win ({stats.wins})
          </FilterBtn>
          <FilterBtn $active={filter === 'loss'} onClick={() => setFilter('loss')}>
            <XCircle size={12} /> Loss ({stats.losses})
          </FilterBtn>
          <RefreshBtn onClick={fetchIdeas} disabled={loading}>
            <RefreshCw />
          </RefreshBtn>
        </Controls>
      </Header>

      {filteredIdeas.length === 0 ? (
        <EmptyState>
          <Bookmark />
          <h4>No saved ideas</h4>
          <p>Save patterns from the analysis tabs to track their evolution over time</p>
        </EmptyState>
      ) : (
        <IdeasList>
          {filteredIdeas.map(idea => {
            const status = getStatus(idea);
            const firstVersion = idea.versions[0];
            const lastVersion = idea.versions[idea.versions.length - 1];
            const hasEvolution = idea.versions.length > 1;
            
            return (
              <IdeaCard key={idea.idea_id} data-testid={`idea-card-${idea.idea_id}`}>
                <IdeaHeader>
                  <AssetInfo>
                    <AssetBadge>
                      <span className="symbol">{idea.asset.replace('USDT', '')}</span>
                      <span className="timeframe">{idea.timeframe}</span>
                    </AssetBadge>
                  </AssetInfo>
                  
                  <StatusBadge $status={status}>
                    {status === 'win' && <CheckCircle2 />}
                    {status === 'loss' && <XCircle />}
                    {status === 'active' && <Zap />}
                    {getStatusLabel(idea)}
                  </StatusBadge>
                </IdeaHeader>
                
                {/* Evolution Timeline — THE MAIN VISUAL */}
                <EvolutionTimeline>
                  {idea.versions.map((version, idx) => {
                    const isActive = idx === idea.versions.length - 1;
                    const isFirst = idx === 0;
                    const isLast = idx === idea.versions.length - 1;
                    const position = isFirst && isLast ? 'single' : isFirst ? 'first' : isLast ? 'last' : 'middle';
                    
                    return (
                      <React.Fragment key={version.v}>
                        <VersionBlock 
                          $active={isActive} 
                          $position={position === 'single' ? 'first' : position}
                          style={position === 'single' ? { borderRadius: '12px' } : {}}
                        >
                          <VersionLabel $active={isActive}>
                            {isActive ? 'Current' : `V${version.v}`}
                          </VersionLabel>
                          <PatternName>
                            {version.snapshot.pattern}
                          </PatternName>
                          <PatternMeta $confidence={version.snapshot.confidence}>
                            <span className="confidence">
                              {Math.round(version.snapshot.confidence * 100)}%
                            </span>
                            {' '}confidence • {version.snapshot.bias}
                          </PatternMeta>
                          <VersionDate>
                            {formatDate(version.timestamp)}
                          </VersionDate>
                        </VersionBlock>
                        
                        {idx < idea.versions.length - 1 && (
                          <TransitionArrow>
                            <ArrowRight />
                          </TransitionArrow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </EvolutionTimeline>
                
                {/* Details */}
                <DetailsRow>
                  <DetailBlock>
                    <div className="label">Breakout Prob</div>
                    <div className={`value ${lastVersion.snapshot.probability.up > 0.6 ? 'positive' : 'neutral'}`}>
                      {Math.round(lastVersion.snapshot.probability.up * 100)}%
                    </div>
                  </DetailBlock>
                  
                  <DetailBlock>
                    <div className="label">Breakdown Prob</div>
                    <div className={`value ${lastVersion.snapshot.probability.down > 0.6 ? 'negative' : 'neutral'}`}>
                      {Math.round(lastVersion.snapshot.probability.down * 100)}%
                    </div>
                  </DetailBlock>
                  
                  <DetailBlock>
                    <div className="label">Key Levels</div>
                    <div className="value">
                      {lastVersion.snapshot.levels.top?.toLocaleString()} / {lastVersion.snapshot.levels.bottom?.toLocaleString()}
                    </div>
                  </DetailBlock>
                  
                  <DetailBlock>
                    <div className="label">Score</div>
                    <div className={`value ${idea.score > 0 ? 'positive' : idea.score < 0 ? 'negative' : 'neutral'}`}>
                      {idea.score > 0 ? `+${idea.score}` : idea.score < 0 ? idea.score : '—'}
                    </div>
                  </DetailBlock>
                </DetailsRow>
                
                <IdeaActions>
                  <ActionBtn>
                    <ExternalLink /> View in Chart
                  </ActionBtn>
                  <ActionBtn className="danger">
                    <Trash2 /> Remove
                  </ActionBtn>
                </IdeaActions>
              </IdeaCard>
            );
          })}
        </IdeasList>
      )}
    </Container>
  );
};

export default IdeasView;
