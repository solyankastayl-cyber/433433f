/**
 * IdeasView.jsx — FULLY FUNCTIONAL Ideas Evolution Tracker
 * =========================================================
 * 
 * Real backend integration:
 * - Fetches ideas from /api/ta/ideas?full=true
 * - Delete via DELETE /api/ta/ideas/{id}
 * - "View in Chart" navigates to Research tab with correct symbol/timeframe
 * - Auto-seeds DB if empty (first load)
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
  Trash2,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useMarket } from '../../../store/marketStore';

// ============================================
// STYLED COMPONENTS
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
  
  &.spinning svg {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const IdeasList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

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
      case 'completed': return `background: rgba(34, 197, 94, 0.1); color: #16a34a;`;
      case 'invalidated': return `background: rgba(239, 68, 68, 0.1); color: #dc2626;`;
      default: return `background: rgba(59, 130, 246, 0.1); color: #2563eb;`;
    }
  }}
`;

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

const InterpretationRow = styled.div`
  margin-top: 12px;
  padding: 10px 14px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 13px;
  color: #475569;
  line-height: 1.5;
  border-left: 3px solid #3b82f6;
`;

const ValidationRow = styled.div`
  margin-top: 12px;
  padding: 10px 14px;
  background: ${({ $result }) => $result === 'correct' ? 'rgba(34,197,94,0.06)' : 
    $result === 'invalidated' ? 'rgba(239,68,68,0.06)' : '#f8fafc'};
  border-radius: 8px;
  border-left: 3px solid ${({ $result }) => $result === 'correct' ? '#16a34a' : 
    $result === 'invalidated' ? '#dc2626' : '#94a3b8'};
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #475569;
  
  .val-label {
    font-weight: 600;
    color: ${({ $result }) => $result === 'correct' ? '#16a34a' : 
      $result === 'invalidated' ? '#dc2626' : '#64748b'};
  }
  
  .val-price {
    font-weight: 600;
    color: #1e293b;
  }
  
  .val-pnl {
    font-weight: 700;
    color: ${({ $pnl }) => $pnl > 0 ? '#16a34a' : $pnl < 0 ? '#dc2626' : '#64748b'};
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
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

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

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
  
  svg { 
    width: 32px; height: 32px; color: #3b82f6; 
    animation: spin 1s linear infinite;
  }
  
  p { font-size: 14px; color: #64748b; margin-top: 12px; }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const ErrorBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #dc2626;
  
  svg { width: 16px; height: 16px; flex-shrink: 0; }
`;

// ============================================
// API
// ============================================
const API_URL = process.env.REACT_APP_BACKEND_URL || '';

async function fetchIdeasAPI() {
  const res = await fetch(`${API_URL}/api/ta/ideas?full=true`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.ideas || [];
}

async function deleteIdeaAPI(ideaId) {
  const res = await fetch(`${API_URL}/api/ta/ideas/${ideaId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  return await res.json();
}

async function seedIdeasAPI() {
  const res = await fetch(`${API_URL}/api/ta/ideas/seed`, { method: 'POST' });
  if (!res.ok) throw new Error(`Seed failed: ${res.status}`);
  return await res.json();
}

// ============================================
// HELPERS
// ============================================

const formatDate = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getStatusLabel = (status) => {
  if (status === 'completed') return 'Completed';
  if (status === 'invalidated') return 'Invalidated';
  return 'Active';
};

const getStatusIcon = (status) => {
  if (status === 'completed') return <CheckCircle2 />;
  if (status === 'invalidated') return <XCircle />;
  return <Zap />;
};

const formatPattern = (pattern) => {
  if (!pattern) return 'Unknown';
  return pattern.replace(/_/g, ' ');
};

// ============================================
// MAIN COMPONENT
// ============================================

const IdeasView = ({ onNavigateToChart }) => {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);
  const { setSymbol, setTimeframe } = useMarket();

  // Fetch ideas from real API
  const loadIdeas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let items = await fetchIdeasAPI();
      
      // Auto-seed if DB is empty (first time)
      if (items.length === 0) {
        await seedIdeasAPI();
        items = await fetchIdeasAPI();
      }
      
      setIdeas(items);
    } catch (err) {
      console.error('Failed to fetch ideas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadIdeas(); }, [loadIdeas]);

  // Delete idea
  const handleDelete = useCallback(async (ideaId) => {
    if (deletingId) return;
    setDeletingId(ideaId);
    try {
      await deleteIdeaAPI(ideaId);
      setIdeas(prev => prev.filter(i => i.idea_id !== ideaId));
    } catch (err) {
      console.error('Failed to delete idea:', err);
      setError(`Failed to delete: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }, [deletingId]);

  // Navigate to chart
  const handleViewInChart = useCallback((asset, timeframe) => {
    // Set market context to this idea's asset/timeframe
    setSymbol(asset);
    setTimeframe(timeframe.toLowerCase());
    // Switch to research tab
    if (onNavigateToChart) {
      onNavigateToChart(asset, timeframe);
    }
  }, [setSymbol, setTimeframe, onNavigateToChart]);

  // Filter ideas
  const filteredIdeas = useMemo(() => {
    return ideas.filter(idea => {
      if (filter === 'active') return idea.status === 'active';
      if (filter === 'completed') return idea.status === 'completed';
      if (filter === 'invalidated') return idea.status === 'invalidated';
      return true;
    });
  }, [ideas, filter]);

  // Stats
  const stats = useMemo(() => {
    const completed = ideas.filter(i => i.status === 'completed').length;
    const invalidated = ideas.filter(i => i.status === 'invalidated').length;
    const active = ideas.filter(i => i.status === 'active').length;
    return { completed, invalidated, active };
  }, [ideas]);

  if (loading) {
    return (
      <Container data-testid="ideas-view">
        <LoadingState>
          <Loader2 />
          <p>Loading ideas...</p>
        </LoadingState>
      </Container>
    );
  }

  return (
    <Container data-testid="ideas-view">
      <Header>
        <Title>
          <Bookmark size={22} />
          Saved Ideas
        </Title>
        
        <Controls>
          <FilterBtn 
            $active={filter === 'all'} 
            onClick={() => setFilter('all')}
            data-testid="filter-all"
          >
            All ({ideas.length})
          </FilterBtn>
          <FilterBtn 
            $active={filter === 'active'} 
            onClick={() => setFilter('active')}
            data-testid="filter-active"
          >
            <Zap size={12} /> Active ({stats.active})
          </FilterBtn>
          <FilterBtn 
            $active={filter === 'completed'} 
            onClick={() => setFilter('completed')}
            data-testid="filter-completed"
          >
            <CheckCircle2 size={12} /> Completed ({stats.completed})
          </FilterBtn>
          <FilterBtn 
            $active={filter === 'invalidated'} 
            onClick={() => setFilter('invalidated')}
            data-testid="filter-invalidated"
          >
            <XCircle size={12} /> Invalidated ({stats.invalidated})
          </FilterBtn>
          <RefreshBtn 
            onClick={loadIdeas} 
            disabled={loading}
            className={loading ? 'spinning' : ''}
            data-testid="refresh-btn"
          >
            <RefreshCw />
          </RefreshBtn>
        </Controls>
      </Header>

      {error && (
        <ErrorBanner data-testid="error-banner">
          <AlertCircle />
          {error}
        </ErrorBanner>
      )}

      {filteredIdeas.length === 0 ? (
        <EmptyState data-testid="empty-state">
          <Bookmark />
          <h4>No saved ideas</h4>
          <p>Save patterns from the Research tab to track their evolution over time</p>
        </EmptyState>
      ) : (
        <IdeasList data-testid="ideas-list">
          {filteredIdeas.map(idea => {
            const versions = idea.versions || [];
            const lastVersion = versions[versions.length - 1];
            const lastSnapshot = lastVersion?.setup_snapshot || {};
            const lastProb = lastSnapshot.probability || {};
            const lastLevels = lastSnapshot.levels || {};
            const validations = idea.validations || [];
            const lastValidation = validations[validations.length - 1];
            
            return (
              <IdeaCard key={idea.idea_id} data-testid={`idea-card-${idea.idea_id}`}>
                <IdeaHeader>
                  <AssetInfo>
                    <AssetBadge>
                      <span className="symbol">{idea.asset.replace('USDT', '')}</span>
                      <span className="timeframe">{idea.timeframe}</span>
                    </AssetBadge>
                  </AssetInfo>
                  
                  <StatusBadge $status={idea.status} data-testid={`status-${idea.idea_id}`}>
                    {getStatusIcon(idea.status)}
                    {getStatusLabel(idea.status)}
                  </StatusBadge>
                </IdeaHeader>
                
                {/* Evolution Timeline */}
                <EvolutionTimeline data-testid={`timeline-${idea.idea_id}`}>
                  {versions.map((version, idx) => {
                    const isActive = idx === versions.length - 1;
                    const isFirst = idx === 0;
                    const isLast = idx === versions.length - 1;
                    const isSingle = versions.length === 1;
                    const position = isSingle ? 'single' : isFirst ? 'first' : isLast ? 'last' : 'middle';
                    const snap = version.setup_snapshot || {};
                    const conf = snap.confidence || version.confidence || 0;
                    
                    return (
                      <React.Fragment key={version.version}>
                        <VersionBlock 
                          $active={isActive} 
                          $position={position === 'single' ? 'first' : position}
                          style={isSingle ? { borderRadius: '12px' } : {}}
                        >
                          <VersionLabel $active={isActive}>
                            {isActive && versions.length > 1 ? 'Current' : `V${version.version}`}
                          </VersionLabel>
                          <PatternName>
                            {formatPattern(snap.pattern)}
                          </PatternName>
                          <PatternMeta $confidence={conf}>
                            <span className="confidence">
                              {Math.round(conf * 100)}%
                            </span>
                            {' '}confidence{version.technical_bias ? ` \u2022 ${version.technical_bias}` : ''}
                          </PatternMeta>
                          <VersionDate>
                            {version.price_at_creation > 0 && `$${version.price_at_creation.toLocaleString()} \u2022 `}{formatDate(version.timestamp)}
                          </VersionDate>
                        </VersionBlock>
                        
                        {idx < versions.length - 1 && (
                          <TransitionArrow>
                            <ArrowRight />
                          </TransitionArrow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </EvolutionTimeline>
                
                {/* Interpretation from latest version */}
                {lastSnapshot.interpretation && (
                  <InterpretationRow data-testid={`interpretation-${idea.idea_id}`}>
                    {lastSnapshot.interpretation}
                  </InterpretationRow>
                )}
                
                {/* Validation result */}
                {lastValidation && (
                  <ValidationRow 
                    $result={lastValidation.result} 
                    $pnl={lastValidation.price_change_pct}
                    data-testid={`validation-${idea.idea_id}`}
                  >
                    <span className="val-label">
                      {lastValidation.result === 'correct' ? 'Correct' : 
                       lastValidation.result === 'invalidated' ? 'Invalidated' : lastValidation.result}
                    </span>
                    <span className="val-price">
                      Price: ${lastValidation.price_at_validation?.toLocaleString()}
                    </span>
                    <span className="val-pnl">
                      {lastValidation.price_change_pct > 0 ? '+' : ''}{lastValidation.price_change_pct?.toFixed(1)}%
                    </span>
                    {lastValidation.notes && <span>{lastValidation.notes}</span>}
                  </ValidationRow>
                )}
                
                {/* Details */}
                <DetailsRow>
                  <DetailBlock>
                    <div className="label">Breakout Prob</div>
                    <div className={`value ${(lastProb.up || 0) > 0.6 ? 'positive' : 'neutral'}`}>
                      {Math.round((lastProb.up || 0) * 100)}%
                    </div>
                  </DetailBlock>
                  
                  <DetailBlock>
                    <div className="label">Breakdown Prob</div>
                    <div className={`value ${(lastProb.down || 0) > 0.6 ? 'negative' : 'neutral'}`}>
                      {Math.round((lastProb.down || 0) * 100)}%
                    </div>
                  </DetailBlock>
                  
                  <DetailBlock>
                    <div className="label">Key Levels</div>
                    <div className="value">
                      {lastLevels.top?.toLocaleString() || '—'} / {lastLevels.bottom?.toLocaleString() || '—'}
                    </div>
                  </DetailBlock>
                  
                  <DetailBlock>
                    <div className="label">Accuracy</div>
                    <div className={`value ${
                      idea.accuracy_score > 0.5 ? 'positive' : 
                      idea.accuracy_score === 0 ? 'negative' : 'neutral'
                    }`}>
                      {idea.accuracy_score != null 
                        ? `${Math.round(idea.accuracy_score * 100)}%` 
                        : '—'}
                    </div>
                  </DetailBlock>
                </DetailsRow>
                
                <IdeaActions>
                  <ActionBtn 
                    onClick={() => handleViewInChart(idea.asset, idea.timeframe)}
                    data-testid={`view-chart-${idea.idea_id}`}
                  >
                    <ExternalLink /> View in Chart
                  </ActionBtn>
                  <ActionBtn 
                    className="danger"
                    onClick={() => handleDelete(idea.idea_id)}
                    disabled={deletingId === idea.idea_id}
                    data-testid={`delete-${idea.idea_id}`}
                  >
                    {deletingId === idea.idea_id ? <Loader2 /> : <Trash2 />}
                    {deletingId === idea.idea_id ? 'Deleting...' : 'Remove'}
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
