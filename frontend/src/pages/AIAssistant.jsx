import { useState, useRef, useEffect } from 'react';
import { aiApi } from '../api';
import { useToast } from '../context/ToastContext';
import '../styles/aiassistant.css';

const suggestionChips = [
  { text: "Show today's sales", icon: "📈" },
  { text: "Show low stock", icon: "⚠️" },
  { text: "Best selling products", icon: "🏆" },
  { text: "Pending shipments", icon: "🚚" },
  { text: "Top customers", icon: "👥" },
  { text: "Expected stockout", icon: "🔮" },
  { text: "Profit analysis", icon: "📊" },
];

export default function AIAssistant() {
  const { toast } = useToast();
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: "Hello! I am **AO AI**, your ERP assistant. Ask me about today's sales, stock levels, shipments, best customers, or profitability.",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (textToSend) => {
    const query = (textToSend || inputValue).trim();
    if (!query) return;

    // Clear input if sending from input field
    if (!textToSend) {
      setInputValue('');
    }

    // Add user message
    const userMsg = {
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const { data } = await aiApi.chat({ message: query });
      
      const assistantMsg = {
        sender: 'assistant',
        text: data.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      toast('Failed to reach AI assistant service', 'error');
      
      const errMsg = {
        sender: 'assistant',
        text: "I'm sorry, I encountered an error connecting to the intelligence engine. Please make sure the backend is active.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
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
          tableHTML = '<table><thead>';
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
          tableHTML += '</tbody></table>';
          resultLines.push(tableHTML);
          tableHTML = '';
        }
        resultLines.push(line);
      }
    }
    if (inTable) {
      tableHTML += '</tbody></table>';
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
      if (trimmed.startsWith('<table') || trimmed.startsWith('<ul') || trimmed.startsWith('<h') || trimmed.startsWith('<li')) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    });

    return paragraphs.join('');
  };

  return (
    <div className="page ai-assistant-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">AO AI Chat Assistant</h1>
          <p className="page-subtitle">
            Query your ERP database conversationally for quick stats, alerts, and summaries.
          </p>
        </div>
      </div>

      <div className="chatbot-wrapper">
        <div className="chatbot-header">
          <div className="chatbot-avatar">🤖</div>
          <div className="chatbot-header-info">
            <h2>AO ERP Smart Agent</h2>
            <span>Online & Ready</span>
          </div>
        </div>

        <div className="chatbot-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`chat-bubble ${msg.sender}`}>
              <div className="bubble-avatar">
                {msg.sender === 'user' ? '👤' : '🤖'}
              </div>
              <div
                className="bubble-text"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
              />
            </div>
          ))}

          {isTyping && (
            <div className="chat-bubble assistant">
              <div className="bubble-avatar">🤖</div>
              <div className="bubble-text">
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="chatbot-suggestions">
          {suggestionChips.map((chip) => (
            <button
              key={chip.text}
              type="button"
              className="suggestion-chip"
              onClick={() => handleSend(chip.text)}
              disabled={isTyping}
            >
              <span>{chip.icon}</span>
              <span>{chip.text}</span>
            </button>
          ))}
        </div>

        {/* Message Input Bar */}
        <div className="chatbot-input-area">
          <input
            type="text"
            placeholder="Type your question here (e.g. 'Show low stock')..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            disabled={isTyping}
          />
          <button
            type="button"
            className="chatbot-send-btn"
            onClick={() => handleSend()}
            disabled={isTyping}
          >
            ➔
          </button>
        </div>
      </div>
    </div>
  );
}
