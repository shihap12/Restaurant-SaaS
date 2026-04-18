import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, User, ShoppingCart } from 'lucide-react';
import gsap from 'gsap';
import type { ChatMessage, Product } from '@/types';
import { aiApi } from '@/api';
import { useBranchStore, useCartStore } from '@/store';
import { v4 as uuid } from '@/store/uuid';
import toast from 'react-hot-toast';

const QUICK_REPLIES = [
  "What's popular today? 🔥",
  "I'm vegetarian 🌿",
  "Show me your offers 🏷️",
  "What's gluten-free? 🌾",
  "Recommend something light 🥗",
];

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { currentBranch } = useBranchStore();
  const { addItem } = useCartStore();

  // FAB entrance animation
  useEffect(() => {
    if (!btnRef.current) return;
    gsap.fromTo(btnRef.current,
      { scale: 0, opacity: 0, y: 20 },
      { scale: 1, opacity: 1, y: 0, duration: 0.5, delay: 1, ease: 'back.out(1.7)' }
    );
  }, []);

  // Chat open/close
  useEffect(() => {
    if (!chatRef.current) return;
    if (isOpen) {
      gsap.fromTo(chatRef.current,
        { scale: 0.85, opacity: 0, y: 20, transformOrigin: 'bottom right' },
        { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.4)' }
      );
      if (!initialized) {
        sendWelcome();
        setInitialized(true);
      }
      setTimeout(() => inputRef.current?.focus(), 400);
    } else {
      gsap.to(chatRef.current, {
        scale: 0.9,
        opacity: 0,
        y: 10,
        duration: 0.25,
        ease: 'power2.in',
      });
    }
  }, [isOpen]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendWelcome = () => {
    const welcome: ChatMessage = {
      id: uuid(),
      role: 'assistant',
      content: `Hi! 👋 I'm your AI waiter for **${currentBranch?.name || 'the restaurant'}**. I can help you find the perfect meal, check ingredients for allergies, or tell you about today's special offers. What are you in the mood for?`,
      timestamp: new Date(),
      quick_replies: QUICK_REPLIES,
    };
    setMessages([welcome]);
  };

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || isTyping) return;

    setInput('');

    const userMsg: ChatMessage = {
      id: uuid(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Convert history for API
    const historyForApi = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await aiApi.chat(
        currentBranch?.id || 1,
        messageText,
        historyForApi
      );

      const { reply, products, quick_replies } = res.data.data;

      const assistantMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
        suggested_products: products as Product[],
        quick_replies: quick_replies || [],
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: "I'm having a moment — please try again! 😅",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [input, messages, isTyping, currentBranch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          ref={chatRef}
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 h-[500px] flex flex-col rounded-2xl overflow-hidden shadow-modal"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0"
            style={{ background: 'var(--surface-3)' }}>
            <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                AI Waiter
              </p>
              <div className="flex items-center gap-1.5">
                <span className="status-dot live" />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Always here to help</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)}
              className="btn btn-ghost btn-icon">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onQuickReply={sendMessage}
                onAddToCart={(p) => {
                  addItem(p, 1);
                  toast.success(`${p.name} added to cart`, { icon: '🛒' });
                }}
              />
            ))}

            {isTyping && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl brand-gradient flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-none"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 p-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about the menu..."
                className="input text-sm flex-1 py-2.5"
                disabled={isTyping}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isTyping}
                className="btn btn-primary btn-icon flex-shrink-0 disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        ref={btnRef}
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-2xl brand-gradient shadow-glow flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95"
        aria-label="Open AI assistant"
      >
        {isOpen ? (
          <X size={22} className="text-white" />
        ) : (
          <MessageCircle size={22} className="text-white" />
        )}
        {!isOpen && !initialized && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-[var(--surface)] animate-pulse-soft" />
        )}
      </button>
    </>
  );
}

// ─── Message Bubble ───────────────────────────

function MessageBubble({
  message, onQuickReply, onAddToCart
}: {
  message: ChatMessage;
  onQuickReply: (text: string) => void;
  onAddToCart: (p: Product) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl brand-gradient flex items-center justify-center flex-shrink-0 self-end">
          <Bot size={14} className="text-white" />
        </div>
      )}
      {isUser && (
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 self-end"
          style={{ background: 'var(--surface-4)' }}>
          <User size={14} style={{ color: 'var(--text-secondary)' }} />
        </div>
      )}

      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'rounded-tr-none text-white'
              : 'rounded-tl-none'
          }`}
          style={isUser
            ? { background: 'var(--brand-500)' }
            : { background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-primary)' }
          }
        >
          {/* Parse simple markdown bold */}
          <MarkdownText text={message.content} />
        </div>

        {/* Suggested Products */}
        {message.suggested_products && message.suggested_products.length > 0 && (
          <div className="space-y-2 w-full">
            {message.suggested_products.slice(0, 3).map(p => (
              <div key={p.id}
                className="flex items-center gap-2 p-2.5 rounded-xl"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--surface-4)]">
                  {p.image
                    ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                    {p.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--brand-400)' }}>
                    ${p.price.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => onAddToCart(p)}
                  className="btn btn-primary btn-sm btn-icon flex-shrink-0"
                >
                  <ShoppingCart size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quick Replies */}
        {message.quick_replies && message.quick_replies.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.quick_replies.map((qr, i) => (
              <button
                key={i}
                onClick={() => onQuickReply(qr)}
                className="text-xs px-3 py-1.5 rounded-full border transition-all hover:border-[var(--brand-500)] hover:text-[var(--brand-400)]"
                style={{
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-3)',
                }}
              >
                {qr}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Typing Dots ─────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: 'var(--text-muted)',
            animation: `pulseSoft 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Markdown Text ───────────────────────────

function MarkdownText({ text }: { text: string }) {
  // Parse **bold** and *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
