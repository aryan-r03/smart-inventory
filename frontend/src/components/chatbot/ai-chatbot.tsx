"use client";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MessageCircle, X, Send, Sparkles, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function AIChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your LabTrack AI assistant. Ask me anything about your inventory — stock levels, expiry dates, consumption trends, or what to reorder.",
      timestamp: new Date(),
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const { data: suggestions } = useQuery({
    queryKey: ["chat-suggestions"],
    queryFn: () => api.get("/api/ai/suggestions").then((r) => r.data.suggestions),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const chatMutation = useMutation({
    mutationFn: (userMessage: string) =>
      api.post("/api/ai/chat", {
        message: userMessage,
        history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      }),
    onSuccess: (res, userMessage) => {
      const assistantMsg: Message = {
        role: "assistant",
        content: res.data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that. Please try again.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = (text?: string) => {
    const message = text ?? input.trim();
    if (!message || chatMutation.isPending) return;

    const userMsg: Message = { role: "user", content: message, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    chatMutation.mutate(message);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full shadow-lg transition-all duration-300",
          "flex items-center justify-center",
          open
            ? "bg-muted text-foreground rotate-0 scale-90"
            : "bg-gradient-to-br from-blue-500 to-violet-600 text-white hover:scale-110 hover:shadow-xl"
        )}
        style={{ width: 52, height: 52 }}
        title="AI Inventory Assistant"
      >
        {open ? <X size={20} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-50 w-[360px] bg-card border border-border rounded-2xl shadow-2xl",
          "flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right",
          open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{ maxHeight: "520px" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-violet-600 text-white flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles size={15} />
          </div>
          <div>
            <p className="font-medium text-sm leading-tight">LabTrack AI</p>
            <p className="text-[11px] text-white/70">Powered by Claude</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-white/70">Live data</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2 animate-fade-up",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Avatar */}
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground text-xs font-bold"
                  : "bg-gradient-to-br from-blue-500 to-violet-600 text-white"
              )}>
                {msg.role === "user"
                  ? (user?.full_name?.charAt(0) ?? "U")
                  : <Bot size={13} />
                }
              </div>

              {/* Bubble */}
              <div className={cn(
                "max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-muted text-foreground rounded-tl-sm"
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className={cn(
                  "text-[10px] mt-1 opacity-60",
                  msg.role === "user" ? "text-right" : "text-left"
                )}>
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                <Bot size={13} className="text-white" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && suggestions && (
          <div className="px-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
            {suggestions.slice(0, 3).map((s: string) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary text-muted-foreground border border-border transition-colors text-left"
              >
                {s.length > 42 ? s.slice(0, 42) + "…" : s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex items-center gap-2 p-3 border-t border-border flex-shrink-0">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask about your inventory…"
            disabled={chatMutation.isPending}
            className="flex-1 px-3 py-2 rounded-xl bg-muted border-0 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || chatMutation.isPending}
            className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            {chatMutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Send size={14} />
            }
          </button>
        </div>
      </div>
    </>
  );
}
