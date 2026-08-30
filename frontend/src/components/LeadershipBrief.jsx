import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  FileText, RefreshCw, Printer, FileCheck2, 
  Presentation, LayoutGrid, ChevronLeft, ChevronRight 
} from 'lucide-react';

const SECTORS = ["All", "Renewables", "Mining", "Railways", "Powerline", "Construction", "Others"];
const QUARTERS = ["All", "Q1", "Q2", "Q3", "Q4"];
const YEARS = ["2024", "2025", "2026"];

export default function LeadershipBrief({ setNotification }) {
  const [sector, setSector] = useState('All');
  const [quarter, setQuarter] = useState('All');
  const [year, setYear] = useState('2025');
  
  const [reportMarkdown, setReportMarkdown] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Presentation slide state
  const [viewMode, setViewMode] = useState('document'); // 'document' | 'deck'
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/leadership-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quarter,
          year,
          sector
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to generate brief.');
      }

      setReportMarkdown(data.report_markdown);
      setMetrics(data.metrics);
      setCurrentSlide(0); // Reset to slide 1
      setNotification({ type: 'success', message: 'Executive brief compiled successfully!' });
    } catch (err) {
      setNotification({ type: 'danger', message: err.message });
      setReportMarkdown(`⚠️ **Error Generating Executive Update:** ${err.message}\n\nPlease check your settings and ensure your Gemini API Key is configured.`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val) => {
    if (!val && val !== 0) return 'N/A';
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr (Masked)`;
    } else if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} L (Masked)`;
    }
    return `₹${val.toLocaleString()} (Masked)`;
  };

  // Split markdown by Level 2 headings (##) to extract slides
  const getSlides = () => {
    if (!reportMarkdown) return [];
    const sections = reportMarkdown.split(/\n##\s+/);
    const slides = [];

    // Executive summary slide
    if (sections[0].trim()) {
      slides.push(sections[0].trim());
    }

    for (let i = 1; i < sections.length; i++) {
      slides.push("## " + sections[i].trim());
    }

    return slides;
  };

  const slides = getSlides();

  return (
    <div className="brief-report-container">
      {/* Configuration Header Card */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div className="leadership-header">
          <div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} style={{ color: 'hsl(var(--primary))' }} />
              Executive Leadership Hub
            </h2>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>
              Compile customized metrics and strategic insights into a clean, printable status report for board meetings and leadership updates.
            </p>
          </div>
          
          <div className="brief-controls">
            <div className="select-wrapper">
              <span className="select-label">Sector</span>
              <select className="brief-select" value={sector} onChange={(e) => setSector(e.target.value)}>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="select-wrapper">
              <span className="select-label">Quarter</span>
              <select className="brief-select" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
                {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>

            <div className="select-wrapper">
              <span className="select-label">Year</span>
              <select className="brief-select" value={year} onChange={(e) => setYear(e.target.value)}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="select-wrapper" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={handleGenerate} disabled={loading} style={{ height: '36px', padding: '0 1rem', fontSize: '0.85rem' }}>
                {loading ? <RefreshCw className="animate-spin" size={14} /> : <FileCheck2 size={14} />}
                <span>Compile Brief</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Key metrics highlights if available */}
        {metrics && (
          <div className="brief-meta-grid">
            <div className="brief-meta-item">
              <div className="brief-meta-label">Quarter Revenue Closed</div>
              <div className="brief-meta-value" style={{ color: 'hsl(var(--success))' }}>
                {formatCurrency(metrics.financials.revenue_closed_in_quarter)}
              </div>
            </div>

            <div className="brief-meta-item">
              <div className="brief-meta-label">Closed Deal Win Rate</div>
              <div className="brief-meta-value">
                {metrics.financials.win_rate_percentage}%
              </div>
            </div>

            <div className="brief-meta-item">
              <div className="brief-meta-label">Work Order Completion</div>
              <div className="brief-meta-value" style={{ color: 'hsl(var(--secondary))' }}>
                {metrics.operations.completion_rate_percentage}%
              </div>
            </div>

            <div className="brief-meta-item">
              <div className="brief-meta-label">Outstanding Receivables</div>
              <div className="brief-meta-value" style={{ color: 'hsl(var(--warning))' }}>
                {formatCurrency(metrics.operations.total_amount_receivable)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rendered Briefing Area */}
      {reportMarkdown && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Controls to switch layout and print */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            {/* Mode Selector */}
            <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'hsl(var(--bg-surface-elevated) / 0.5)', padding: '0.25rem', borderRadius: '8px', border: '1px solid hsl(var(--border-color))' }}>
              <button 
                className={`nav-tab ${viewMode === 'document' ? 'active' : ''}`}
                onClick={() => setViewMode('document')}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: 'auto' }}
              >
                <LayoutGrid size={14} style={{ marginRight: '4px' }} />
                Document View
              </button>
              <button 
                className={`nav-tab ${viewMode === 'deck' ? 'active' : ''}`}
                onClick={() => { setViewMode('deck'); setCurrentSlide(0); }}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: 'auto' }}
              >
                <Presentation size={14} style={{ marginRight: '4px' }} />
                Board Presentation Slides
              </button>
            </div>

            {viewMode === 'document' && (
              <button className="btn btn-secondary" onClick={handlePrint} style={{ height: '36px', fontSize: '0.85rem' }}>
                <Printer size={14} />
                <span>Print / Save as PDF</span>
              </button>
            )}
          </div>

          {/* View mode 1: Full Document */}
          {viewMode === 'document' && (
            <div className="report-body">
              <div className="report-content">
                <ReactMarkdown>{reportMarkdown}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* View mode 2: Interactive Slideshow */}
          {viewMode === 'deck' && slides.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '850px', margin: '0 auto' }}>
              <div className="glass-card" style={{ 
                minHeight: '420px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between', 
                padding: '3rem', 
                borderLeft: '6px solid hsl(var(--primary))',
                backgroundColor: 'hsl(var(--bg-surface))',
                boxShadow: '0 12px 40px rgba(90, 100, 110, 0.06)'
              }}>
                {/* Content */}
                <div className="report-content" style={{ fontSize: '1.05rem', flex: 1 }}>
                  <ReactMarkdown>{slides[currentSlide]}</ReactMarkdown>
                </div>

                {/* Footer Controls */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginTop: '2.5rem', 
                  borderTop: '1px solid hsl(var(--border-color))', 
                  paddingTop: '1.25rem' 
                }}>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                    SLIDE {currentSlide + 1} OF {slides.length}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                      disabled={currentSlide === 0}
                      style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', height: 'auto' }}
                    >
                      <ChevronLeft size={16} />
                      <span>Prev</span>
                    </button>
                    <button 
                      className="btn" 
                      onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}
                      disabled={currentSlide === slides.length - 1}
                      style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', height: 'auto' }}
                    >
                      <span>Next</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {!reportMarkdown && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', borderStyle: 'dashed', color: 'hsl(var(--text-muted))' }}>
          <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '0.25rem' }}>No Brief Generated Yet</h3>
          <p style={{ fontSize: '0.85rem' }}>Select your sector/time parameters above and click "Compile Brief" to synthesize the update.</p>
        </div>
      )}
    </div>
  );
}
