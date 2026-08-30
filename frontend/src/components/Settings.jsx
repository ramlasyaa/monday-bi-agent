import React, { useState, useEffect } from 'react';
import { Database, Key, ShieldAlert, CheckCircle, RefreshCw, LogOut } from 'lucide-react';

export default function Settings({ status, fetchStatus, setNotification }) {
  const [apiToken, setApiToken] = useState('');
  const [dealsBoardId, setDealsBoardId] = useState('');
  const [workOrdersBoardId, setWorkOrdersBoardId] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(status);

  useEffect(() => {
    setLocalStatus(status);
  }, [status]);

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!apiToken || !dealsBoardId || !workOrdersBoardId) {
      setNotification({ type: 'danger', message: 'Please fill in all Monday.com configuration fields.' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_token: apiToken,
          deals_board_id: dealsBoardId,
          work_orders_board_id: workOrdersBoardId,
          gemini_api_key: geminiApiKey || null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Connection failed.');
      }

      setNotification({ type: 'success', message: data.message });
      fetchStatus();
      
      // Clear sensitive tokens from form input after successful connection
      setApiToken('');
    } catch (err) {
      setNotification({ type: 'danger', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/disconnect', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setNotification({ type: 'success', message: data.message });
        fetchStatus();
      }
    } catch (err) {
      setNotification({ type: 'danger', message: 'Failed to disconnect: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-container">
      <div className="glass-card">
        <h2 className="form-title">Integration & Connection Settings</h2>
        <p className="form-subtitle">
          Configure your Monday.com API credentials and Gemini API token. If left unconfigured, the agent falls back to local Excel files (Demo Mode).
        </p>

        {/* Status Indicator inside Card */}
        <div style={{ marginBottom: '2rem' }}>
          {localStatus.monday_connected ? (
            <div className="status-badge live" style={{ width: 'fit-content', padding: '0.6rem 1rem' }}>
              <CheckCircle size={16} />
              <span>Monday.com Connected (Live Mode: {localStatus.deals_rows} Deals, {localStatus.wo_rows} Work Orders)</span>
            </div>
          ) : (
            <div className="status-badge demo" style={{ width: 'fit-content', padding: '0.6rem 1rem' }}>
              <ShieldAlert size={16} />
              <span>Demo Mode Active (Using Local Excel Files: {localStatus.deals_rows} Deals, {localStatus.wo_rows} Work Orders)</span>
            </div>
          )}
          {localStatus.connection_error && (
            <div style={{ color: 'hsl(var(--danger))', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: '500' }}>
              Error: {localStatus.connection_error}
            </div>
          )}
        </div>

        <form onSubmit={handleConnect}>
          <div className="form-group">
            <label className="form-label">
              <Key size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Gemini API Key
            </label>
            <input
              type="password"
              className="form-input"
              placeholder={localStatus.gemini_api_key_configured ? "•••••••••••••••••••• (Configured)" : "Enter your Google Gemini API Key"}
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
            />
            <p className="form-help">Used to power the conversational understanding and analytics code generation.</p>
          </div>

          <div style={{ borderTop: '1px solid hsl(var(--border-color))', margin: '1.5rem 0' }}></div>

          <div className="form-group">
            <label className="form-label">
              <Database size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Monday.com API v2 Token
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter your Monday.com developer personal token"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
            />
            <p className="form-help">Requires read permission on the boards containing your imported Excel data.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Deals Board ID</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 1234567890"
              value={dealsBoardId}
              onChange={(e) => setDealsBoardId(e.target.value)}
            />
            <p className="form-help">The ID of the board containing the sales pipeline (Deal funnel Data).</p>
          </div>

          <div className="form-group">
            <label className="form-label">Work Orders Board ID</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 0987654321"
              value={workOrdersBoardId}
              onChange={(e) => setWorkOrdersBoardId(e.target.value)}
            />
            <p className="form-help">The ID of the board containing work order execution (Work_Order_Tracker Data).</p>
          </div>

          <div className="button-row">
            <button type="submit" className="btn" disabled={loading}>
              {loading ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              <span>Save & Connect API</span>
            </button>

            {!localStatus.is_demo_mode && (
              <button type="button" className="btn btn-secondary btn-danger" onClick={handleDisconnect} disabled={loading}>
                <LogOut size={16} />
                <span>Disconnect & Use Demo</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
