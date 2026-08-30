import React, { useState, useEffect } from 'react';
import { LayoutDashboard, MessageSquare, FileText, Settings as SettingsIcon, AlertCircle, Sparkles } from 'lucide-react';

// Import child components
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import LeadershipBrief from './components/LeadershipBrief';
import Settings from './components/Settings';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState({
    is_demo_mode: true,
    monday_connected: false,
    deals_rows: 0,
    wo_rows: 0,
    gemini_api_key_configured: false,
    connection_error: null,
    dq_report: {}
  });
  const [notification, setNotification] = useState(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch connection status:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll status every 20 seconds to keep UI up to date with backend state
    const interval = setInterval(fetchStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className="app-container">
      {/* Global Notifications Alert Banner */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.5rem',
          borderRadius: '10px',
          backgroundColor: notification.type === 'danger' ? 'hsl(var(--danger) / 0.15)' : 'hsl(var(--success) / 0.15)',
          color: notification.type === 'danger' ? 'hsl(var(--danger))' : 'hsl(var(--success))',
          border: `1px solid ${notification.type === 'danger' ? 'hsl(var(--danger) / 0.3)' : 'hsl(var(--success) / 0.3)'}`,
          backdropFilter: 'blur(10px)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          animation: 'slideIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards',
          maxWidth: '400px',
          fontWeight: '500',
          fontSize: '0.9rem'
        }}>
          <AlertCircle size={18} />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Styled slideIn animation rule for notification */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* App Top Header Bar */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">M</div>
          <div>
            <h1 className="brand-title">Monday.com Business Intelligence Agent</h1>
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Candidate: Ram Lasya | Skylark Drones Technical Screening
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="nav-tabs">
          <button 
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>
          
          <button 
            className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={16} />
            <span>BI Chat Agent</span>
          </button>

          <button 
            className={`nav-tab ${activeTab === 'brief' ? 'active' : ''}`}
            onClick={() => setActiveTab('brief')}
          >
            <FileText size={16} />
            <span>Leadership Briefs</span>
          </button>

          <button 
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={16} />
            <span>Settings</span>
          </button>
        </nav>

        {/* Dynamic connection indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {status.monday_connected ? (
            <div className="status-badge live">
              <span className="status-dot"></span>
              <span>API Live</span>
            </div>
          ) : (
            <div className="status-badge demo">
              <span className="status-dot"></span>
              <span>Demo Mode</span>
            </div>
          )}
        </div>
      </header>

      {/* App Main View Body */}
      <main className="main-content">
        {activeTab === 'dashboard' && <Dashboard status={status} setActiveTab={setActiveTab} />}
        {activeTab === 'chat' && <ChatInterface status={status} setNotification={setNotification} />}
        {activeTab === 'brief' && <LeadershipBrief setNotification={setNotification} />}
        {activeTab === 'settings' && (
          <Settings 
            status={status} 
            fetchStatus={fetchStatus} 
            setNotification={setNotification} 
          />
        )}
      </main>
    </div>
  );
}
