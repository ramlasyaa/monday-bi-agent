import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, AlertTriangle, Image as ImageIcon, Sparkles, HelpCircle } from 'lucide-react';

const QUICK_PROMPTS = [
  "How is our overall pipeline looking by sector?",
  "What is our win rate for Renewables vs Mining?",
  "Show a bar chart of the execution status of all active work orders.",
  "Which clients have the highest outstanding receivable values?",
  "What is the average closure probability of open deals?",
  "Analyze bottlenecks: Show work orders that are not started or paused."
];

export default function ChatInterface({ status, setNotification }) {
  const [messages, setMessages] = useState([
    {
      sender: 'agent',
      text: "Hello! I am your Monday.com Business Intelligence Agent. I can query your deals pipeline and work order execution trackers to answer business questions.\n\nAsk me about revenues, sector distributions, win rates, or project execution timelines. I can also plot charts dynamically!",
      caveats: "Demo Mode active unless customized in Settings.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const messageText = textToSend || input;
    if (!messageText.trim()) return;

    if (!textToSend) {
      setInput('');
    }

    // Add user message
    const userMsg = {
      sender: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to get response.');
      }

      // Add agent message
      const agentMsg = {
        sender: 'agent',
        text: data.answer,
        chartUrl: data.chart_url,
        caveats: data.caveats,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch (err) {
      setNotification({ type: 'danger', message: err.message });
      // Add error agent message
      setMessages(prev => [...prev, {
        sender: 'agent',
        text: `⚠️ **Error Processing Query:** ${err.message}\n\nPlease ensure your Gemini API Key is correctly configured in Settings.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-history">
        {messages.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.sender}`}>
            <div className="message-meta">
              <span>{msg.sender === 'user' ? 'Founder' : 'BI Agent'}</span>
              <span>{msg.timestamp}</span>
            </div>
            
            <div className="message-content">
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>

            {msg.chartUrl && (
              <div className="message-chart">
                <div style={{ padding: '0.4rem 0.8rem', borderBottom: '1px solid hsl(var(--border-color))', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'hsl(var(--text-secondary))' }}>
                  <ImageIcon size={12} />
                  <span>Generated Chart</span>
                </div>
                <img 
                  src={msg.chartUrl} 
                  alt="Dynamic Analytical Chart" 
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            )}

            {msg.caveats && (
              <div className="message-caveats">
                <AlertTriangle size={12} style={{ color: 'hsl(var(--warning))' }} />
                <span>{msg.caveats}</span>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="typing-indicator">
            <Sparkles size={12} className="animate-pulse" style={{ color: 'hsl(var(--primary))' }} />
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Prompts Panel */}
      <div className="quick-prompts">
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button 
            key={idx} 
            className="quick-prompt-btn" 
            onClick={() => handleSend(prompt)}
            disabled={loading}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input controls */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="chat-input-area">
        <input
          type="text"
          className="chat-input"
          placeholder="Ask a question about sales pipeline, revenue, work order timelines..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn" style={{ height: '52px', borderRadius: '12px' }} disabled={loading}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
