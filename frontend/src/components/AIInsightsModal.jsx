import { useState, useEffect } from 'react';
import { Sparkles, Brain, Copy, Check, X, FileText } from 'lucide-react';

const LOADING_PHASES = [
  "Analyzing database records...",
  "Formatting secure context payload...",
  "Consulting Google Gemini 2.5 Flash...",
  "Synthesizing actionable ERP insights...",
  "Finalizing recommendations..."
];

export default function AIInsightsModal({ isOpen, onClose, title, insightsText, loading, onRetry }) {
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLoadingPhaseIndex(0);
      return;
    }
    
    const interval = setInterval(() => {
      setLoadingPhaseIndex((prev) => (prev < LOADING_PHASES.length - 1 ? prev + 1 : prev));
    }, 2000);

    return () => clearInterval(interval);
  }, [loading]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!insightsText) return;
    navigator.clipboard.writeText(insightsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Safe markdown to HTML parser
  const renderMarkdown = (text) => {
    if (!text) return '';
    
    const lines = text.split('\n');
    let inTable = false;
    let tableHTML = '';
    let resultLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHTML = '<div class="table-container"><table><thead>';
          const cols = line.split('|').slice(1, -1).map(c => c.trim());
          tableHTML += '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
          if (i + 1 < lines.length && lines[i + 1].includes('---')) {
            i++;
          }
        } else {
          const cols = line.split('|').slice(1, -1).map(c => c.trim());
          tableHTML += '<tr>' + cols.map(c => `<td>${c}</td>`).join('') + '</tr>';
        }
      } else {
        if (inTable) {
          inTable = false;
          tableHTML += '</tbody></table></div>';
          resultLines.push(tableHTML);
          tableHTML = '';
        }
        resultLines.push(line);
      }
    }
    if (inTable) {
      tableHTML += '</tbody></table></div>';
      resultLines.push(tableHTML);
    }

    let html = resultLines.join('\n');
    
    // Convert headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Convert bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert bullet points
    let inList = false;
    const listLines = html.split('\n');
    const finalLines = [];
    for (let line of listLines) {
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        if (!inList) {
          inList = true;
          finalLines.push('<ul>');
        }
        finalLines.push(`<li>${line.trim().substring(2)}</li>`);
      } else {
        if (inList) {
          inList = false;
          finalLines.push('</ul>');
        }
        finalLines.push(line);
      }
    }
    if (inList) {
      finalLines.push('</ul>');
    }
    html = finalLines.join('\n');

    // Paragraph conversion
    const blocks = html.split('\n\n');
    const paragraphs = blocks.map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<table') || trimmed.startsWith('<div class="table-container"') || trimmed.startsWith('<ul') || trimmed.startsWith('<h') || trimmed.startsWith('<li')) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    });

    return paragraphs.join('');
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div 
        className="modal ai-insights-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '850px',
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(90, 45, 12, 0.15)',
          background: 'var(--bg-card)'
        }}
      >
        {/* Header */}
        <div 
          className="modal-header ai-modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, #5a2d0c, #3a1a05)',
            color: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Brain size={22} className="ai-pulse-icon" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.3px' }}>
                {title}
              </h3>
              <span style={{ fontSize: '0.75rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Sparkles size={12} /> Powered by Gemini 2.5 Flash
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-icon" 
            onClick={onClose}
            style={{ 
              background: 'rgba(255,255,255,0.1)', 
              border: 'none', 
              color: '#ffffff', 
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div 
          className="modal-body ai-modal-body"
          style={{
            padding: '2rem 1.5rem',
            overflowY: 'auto',
            flex: 1,
            backgroundColor: 'var(--bg-page)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: loading ? 'center' : 'flex-start',
            alignItems: loading ? 'center' : 'stretch',
            minHeight: '250px'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.25rem', padding: '2rem 0' }}>
              <div className="ai-loader-container" style={{ position: 'relative' }}>
                <div 
                  className="ai-spin-border" 
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    border: '3px solid rgba(90, 45, 12, 0.1)',
                    borderTopColor: '#5a2d0c',
                    animation: 'spin 1s linear infinite'
                  }}
                />
                <Brain 
                  size={24} 
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#5a2d0c'
                  }}
                  className="ai-glow-pulse"
                />
              </div>
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Generating AI Analysis
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  {LOADING_PHASES[loadingPhaseIndex]}
                </p>
              </div>
            </div>
          ) : insightsText ? (
            <div 
              className="ai-markdown-output"
              style={{
                fontSize: '0.925rem',
                lineHeight: 1.6,
                color: 'var(--text-primary)'
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(insightsText) }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <p>No analysis generated or failed to query the API.</p>
              {onRetry && (
                <button type="button" className="btn btn-primary" onClick={onRetry}>
                  Retry Analysis
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div 
            className="modal-footer" 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)'
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Verify critical data against the ERP ledger.
            </span>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleCopy}
                disabled={!insightsText}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {copied ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
                {copied ? 'Copied!' : 'Copy Summary'}
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={onClose}
                style={{ backgroundColor: '#5a2d0c', borderColor: '#5a2d0c', color: '#ffffff', fontWeight: 600, fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
