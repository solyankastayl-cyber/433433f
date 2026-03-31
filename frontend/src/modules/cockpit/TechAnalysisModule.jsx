import React, { useState, useEffect, useCallback } from 'react';
import { 
  Brain, BarChart2, Bookmark, Bell, Activity
} from 'lucide-react';
import styled from 'styled-components';
import CockpitAPI from './services/api';
import { MarketProvider, useMarket } from '../../store/marketStore';
import setupService from '../../services/setupService';

// ============================================
// STYLED COMPONENTS - Sentiment-like Header
// ============================================

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 64px);
  background: #f5f7fa;
`;

// Module Header (like Sentiment)
const ModuleHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #ffffff;
  border-bottom: 1px solid #eef1f5;
`;

const ModuleTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  .icon {
    width: 32px;
    height: 32px;
    color: #05A584;
  }
  
  .text {
    display: flex;
    flex-direction: column;
    
    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }
    
    .description {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 2px;
    }
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const NotificationBtn = styled.button`
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
  position: relative;
  
  &:hover {
    background: #f8fafc;
    color: #0f172a;
    border-color: #cbd5e1;
  }
  
  svg {
    width: 18px;
    height: 18px;
  }
  
  .badge {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: #ef4444;
    color: white;
    font-size: 10px;
    font-weight: 600;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

// Tab Navigation (like Sentiment - horizontal tabs)
const TabsNav = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TabButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
  background: ${({ $active }) => $active ? '#0f172a' : 'transparent'};
  color: ${({ $active }) => $active ? '#ffffff' : '#64748b'};
  
  &:hover {
    background: ${({ $active }) => $active ? '#0f172a' : '#f1f5f9'};
    color: ${({ $active }) => $active ? '#ffffff' : '#0f172a'};
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const MainContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0;
`;

// Toast notification
const Toast = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 20px;
  background: #0f172a;
  color: #fff;
  border-radius: 8px;
  font-size: 13px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
`;

// ============================================
// MAIN TABS — 7 Analysis Modes (Primary Navigation)
// ============================================
// Graph is ALWAYS visible — only panel below changes

const MAIN_TABS = [
  { id: 'research', label: 'Research', icon: BarChart2, description: 'Overview & decision' },
  { id: 'structure', label: 'Structure', icon: Activity, description: 'Market geometry' },
  { id: 'signals', label: 'Signals', icon: Activity, description: 'Indicators & brain' },
  { id: 'execution', label: 'Execution', icon: Activity, description: 'Trade action' },
  { id: 'deep', label: 'Deep', icon: Brain, description: 'Raw details' },
  // Separator
  { id: 'hypotheses', label: 'Hypotheses', icon: Brain, description: 'Test ideas' },
  { id: 'ideas', label: 'Ideas', icon: Bookmark, description: 'Saved ideas' }
];

// ============================================
// MAIN COMPONENT (INNER - uses MarketProvider context)
// ============================================

const TechAnalysisInner = () => {
  const [activeTab, setActiveTab] = useState('research');
  const { symbol, timeframe } = useMarket();
  
  // Save Idea state
  const [savingIdea, setSavingIdea] = useState(false);
  const [savedIdea, setSavedIdea] = useState(null);
  const [ideaToast, setIdeaToast] = useState(null);

  // Handle Save Idea
  const handleSaveIdea = useCallback(async () => {
    if (savingIdea) return;
    
    try {
      setSavingIdea(true);
      const result = await setupService.createIdea(symbol, timeframe || '4H');
      
      if (result.ok) {
        setSavedIdea(result.idea);
        setIdeaToast(`Idea saved: ${result.idea.idea_id}`);
        setTimeout(() => setIdeaToast(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save idea:', err);
      setIdeaToast('Failed to save idea');
      setTimeout(() => setIdeaToast(null), 3000);
    } finally {
      setSavingIdea(false);
    }
  }, [symbol, timeframe, savingIdea]);

  // Split tabs into main analysis modes and other
  const analysisTabs = MAIN_TABS.slice(0, 5); // research, structure, signals, execution, deep
  const otherTabs = MAIN_TABS.slice(5); // hypotheses, ideas

  return (
    <PageContainer data-testid="tech-analysis-module">
      {/* Module Header - Sentiment Style */}
      <ModuleHeader data-testid="module-header">
        <ModuleTitle>
          <Activity className="icon" />
          <div className="text">
            <h1>Tech Analysis</h1>
            <span className="description">Pattern recognition & market structure analysis</span>
          </div>
          <NotificationBtn data-testid="notification-btn">
            <Bell />
          </NotificationBtn>
        </ModuleTitle>
        
        {/* Main Tabs in header — Analysis Modes + Hypotheses + Ideas */}
        <TabsNav data-testid="tabs-nav">
          {/* Analysis Mode Tabs */}
          {analysisTabs.map(tab => (
            <TabButton
              key={tab.id}
              $active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              title={tab.description}
            >
              <tab.icon />
              {tab.label}
            </TabButton>
          ))}
          
          {/* Separator */}
          <div style={{ 
            width: '1px', 
            height: '20px', 
            background: '#e2e8f0', 
            margin: '0 8px' 
          }} />
          
          {/* Hypotheses + Ideas */}
          {otherTabs.map(tab => (
            <TabButton
              key={tab.id}
              $active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              title={tab.description}
            >
              <tab.icon />
              {tab.label}
            </TabButton>
          ))}
        </TabsNav>
      </ModuleHeader>
      
      {/* Main Content — Graph + Dynamic Panel */}
      <MainContent data-testid="main-content">
        {/* For analysis tabs (research/structure/signals/execution/deep) — use unified layout */}
        {['research', 'structure', 'signals', 'execution', 'deep'].includes(activeTab) && (
          <ResearchView activeMode={activeTab} />
        )}
        
        {/* Hypotheses and Ideas — separate views */}
        {activeTab === 'hypotheses' && <HypothesesView />}
        {activeTab === 'ideas' && <IdeasView />}
      </MainContent>
      
      {/* Toast notification */}
      {ideaToast && <Toast>{ideaToast}</Toast>}
    </PageContainer>
  );
};

// ============================================
// MAIN COMPONENT (WRAPPED WITH PROVIDER)
// ============================================

const TechAnalysisModule = () => {
  return (
    <MarketProvider>
      <TechAnalysisInner />
    </MarketProvider>
  );
};

// ============================================
// VIEW COMPONENTS
// ============================================

// Import views - Light theme with tables and full UI
import ResearchView from './views/ResearchViewNew';
import HypothesesView from './views/HypothesesView';
import IdeasView from './views/IdeasView';

export default TechAnalysisModule;
