import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, DollarSign, Activity, AlertCircle, 
  ShieldCheck, Database, RefreshCw, BarChart3, AlertTriangle 
} from 'lucide-react';

export default function Dashboard({ status, setActiveTab }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard-metrics');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '₹0';
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    } else if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} L`;
    }
    return `₹${val.toLocaleString()}`;
  };

  if (loading && !metrics) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: 'hsl(var(--primary))' }} />
        <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Compiling dashboard metrics...</span>
      </div>
    );
  }

  const fin = metrics?.financials || { total_value: 0, revenue_won: 0, lost_value: 0, open_value: 0, won_count: 0, dead_count: 0, open_count: 0 };
  const ops = metrics?.operations || { completed: 0, ongoing: 0, not_started: 0, paused: 0, other: 0 };
  const totalWo = metrics?.total_wo || 0;
  
  // Percentages for financial funnel
  const wonPct = fin.total_value > 0 ? (fin.revenue_won / fin.total_value) * 100 : 0;
  const openPct = fin.total_value > 0 ? (fin.open_value / fin.total_value) * 100 : 0;
  const deadPct = fin.total_value > 0 ? (fin.lost_value / fin.total_value) * 100 : 0;

  // Percentages for operations execution status
  const woCompletedPct = totalWo > 0 ? (ops.completed / totalWo) * 100 : 0;
  const woOngoingPct = totalWo > 0 ? (ops.ongoing / totalWo) * 100 : 0;
  const woPendingPct = totalWo > 0 ? ((ops.not_started + ops.paused + ops.other) / totalWo) * 100 : 0;

  // SVG Ring values for Data Integrity Gauge
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const healthPct = metrics?.health_index || 100;
  const strokeDashoffset = circumference - (healthPct / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 1. Welcome & Control strip */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', borderLeft: '4px solid hsl(var(--primary))' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Operations & Revenue Analytics Command Center
          </h2>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>
            Real-time operations summary. Access data from Monday.com dynamically or fall back to local cleaning rules.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={fetchMetrics} disabled={loading} style={{ height: '38px', padding: '0 1rem' }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Sync Stats</span>
          </button>
          <button className="btn" onClick={() => setActiveTab('chat')} style={{ height: '38px', padding: '0 1rem' }}>
            <BarChart3 size={14} />
            <span>Chat Analyst</span>
          </button>
        </div>
      </div>

      {/* 2. Top-level KPIs Summary row */}
      <div className="dashboard-grid">
        {/* Card 1: Pipeline Value */}
        <div className="glass-card metric-card" style={{ '--glow-color': 'hsl(var(--primary))' }}>
          <div>
            <div className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <TrendingUp size={14} style={{ color: 'hsl(var(--primary))' }} />
              Total Pipeline Value
            </div>
            <div className="metric-value" style={{ color: 'white' }}>{formatCurrency(fin.total_value)}</div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: '500' }}>
              Combined Value of Won, Lost, and Open Deals
            </div>
          </div>
        </div>

        {/* Card 2: Closed Won Revenue */}
        <div className="glass-card metric-card" style={{ '--glow-color': 'hsl(var(--success))' }}>
          <div>
            <div className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <DollarSign size={14} style={{ color: 'hsl(var(--success))' }} />
              Closed Revenue (Won)
            </div>
            <div className="metric-value" style={{ color: 'hsl(var(--success))' }}>{formatCurrency(fin.revenue_won)}</div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: '500' }}>
              {fin.won_count} deals completed • Win Rate: {((fin.won_count / (fin.won_count + fin.dead_count)) * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Card 3: Active Work Orders */}
        <div className="glass-card metric-card" style={{ '--glow-color': 'hsl(var(--secondary))' }}>
          <div>
            <div className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Activity size={14} style={{ color: 'hsl(var(--secondary))' }} />
              Work Order Throughput
            </div>
            <div className="metric-value">{metrics?.total_wo}</div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: '500' }}>
              {ops.completed} Completed • {ops.ongoing} Ongoing execution
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Analytical Graphical Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        
        {/* Deal Funnel Analysis Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Pipeline Conversion Funnel
          </h3>
          
          {/* Dynamic Stacked Bar Chart */}
          <div style={{ height: '36px', width: '100%', borderRadius: '8px', overflow: 'hidden', display: 'flex', backgroundColor: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-color))' }}>
            <div style={{ width: `${wonPct}%`, backgroundColor: 'hsl(var(--success))', transition: 'width 0.5s ease', title: 'Closed Won' }}></div>
            <div style={{ width: `${openPct}%`, backgroundColor: 'hsl(var(--primary))', transition: 'width 0.5s ease', title: 'Open Pipeline' }}></div>
            <div style={{ width: `${deadPct}%`, backgroundColor: 'hsl(var(--danger))', transition: 'width 0.5s ease', title: 'Closed Lost' }}></div>
          </div>

          {/* Legend and Values */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'hsl(var(--success))' }}></span>
                Won Revenue ({wonPct.toFixed(1)}%)
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'var(--font-display)' }}>{formatCurrency(fin.revenue_won)}</div>
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{fin.won_count} Deals</div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'hsl(var(--primary))' }}></span>
                Open Pipeline ({openPct.toFixed(1)}%)
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'var(--font-display)' }}>{formatCurrency(fin.open_value)}</div>
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{fin.open_count} Deals</div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'hsl(var(--danger))' }}></span>
                Lost Funnel ({deadPct.toFixed(1)}%)
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'var(--font-display)' }}>{formatCurrency(fin.lost_value)}</div>
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{fin.dead_count} Deals</div>
            </div>
          </div>
        </div>

        {/* Operational / Data health summary Card */}
        <div className="glass-card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Circular SVG Gauge for Data Integrity */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px' }}>
              <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="hsl(var(--border-color))"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="hsl(var(--primary))"
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: '700', fontFamily: 'var(--font-display)', color: 'hsl(var(--primary))' }}>{healthPct}%</span>
                <span style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 'bold' }}>Health Index</span>
              </div>
            </div>
          </div>

          {/* Operations indicators */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '220px' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck size={14} style={{ color: 'hsl(var(--primary))' }} />
                Data Resiliency Audit
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
                Resiliency index calculated based on missing identifiers, financial values, and date columns. The agent handles gaps transparently.
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: 'hsl(var(--text-secondary))' }}>
                  <span>Completed Work Orders</span>
                  <span>{ops.completed} / {totalWo}</span>
                </div>
                <div style={{ height: '6px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', backgroundColor: 'hsl(var(--success))', width: `${woCompletedPct}%` }}></div>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: 'hsl(var(--text-secondary))' }}>
                  <span>Ongoing Execution</span>
                  <span>{ops.ongoing} / {totalWo}</span>
                </div>
                <div style={{ height: '6px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', backgroundColor: 'hsl(var(--secondary))', width: `${woOngoingPct}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Sectors Leaderboard Section */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
          Sectoral Pipeline Share & Operations Leaderboard
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {metrics?.sectors?.map((sec) => {
            const totalDealsVal = fin.total_value || 1;
            const sharePct = (sec.deals_value / totalDealsVal) * 100;
            const completionPct = sec.wo_count > 0 ? (sec.wo_completed / sec.wo_count) * 100 : 0;
            
            return (
              <div key={sec.name} className="glass-card" style={{ padding: '1rem', backgroundColor: 'hsl(var(--bg-surface-elevated) / 0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700' }}>{sec.name}</h4>
                  <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', borderRadius: '4px', fontWeight: 'bold' }}>
                    {sec.deals_count} Deals
                  </span>
                </div>
                
                {/* Sector value */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Pipeline Value</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', fontFamily: 'var(--font-display)', color: 'white' }}>
                    {formatCurrency(sec.deals_value)}
                  </div>
                  {/* Share progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <div style={{ flex: 1, height: '4px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', backgroundColor: 'hsl(var(--primary))', width: `${sharePct}%` }}></div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-secondary))', fontWeight: 'bold' }}>{sharePct.toFixed(1)}% share</span>
                  </div>
                </div>

                {/* Execution bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.2rem' }}>
                    <span>Work Order Execution</span>
                    <span>{sec.wo_completed}/{sec.wo_count} Done</span>
                  </div>
                  <div style={{ height: '4px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', backgroundColor: 'hsl(var(--success))', width: `${completionPct}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Gaps alerts footer warning */}
      <div className="status-badge demo" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderRadius: '8px' }}>
        <AlertTriangle size={18} />
        <div style={{ fontSize: '0.8rem', textAlign: 'left' }}>
          <strong>Messy Data Notice:</strong> The pipeline sheet contains copy-pasted duplicate header rows and {status.dq_report?.deals?.missing_values?.['Masked Deal value']?.count} null rows.
          The backend automatically filters duplicates and standardizes inputs. Ask the BI chatbot for specific details or to correct data formatting.
        </div>
      </div>

    </div>
  );
}
