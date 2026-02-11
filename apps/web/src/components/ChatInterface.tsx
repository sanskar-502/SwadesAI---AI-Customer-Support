import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "ai/react";
import type {
  TextUIPart,
  ToolInvocation,
  ToolInvocationUIPart,
  UIMessage,
} from "@ai-sdk/ui-utils";
import { hc } from "hono/client";
import type { AppType } from "../../../backend/src/index";
import { Loader, MessageSquare, Send } from "lucide-react";

const client = hc<AppType>("http://localhost:3000");

type ConversationSummary = {
  id: string;
  lastMessage: string;
  updatedAt: string;
};

const TOOL_LABELS: Record<string, string> = {
  getOrderDetails: "Checking order database...",
  checkDeliveryStatus: "Checking delivery status...",
  getInvoiceDetails: "Searching invoices...",
  checkRefundStatus: "Checking refund status...",
  searchProducts: "Searching product FAQs...",
  searchConversationHistory: "Searching conversation history...",
};

const SUGGESTIONS = [
  "Where is my order ORD-1002?",
  "Show invoice INV-2002",
  "Do you have FAQs about returns?",
];

type LegacyToolCarrier = {
  toolInvocations?: ToolInvocation[];
};

const isTextPart = (part: UIMessage["parts"][number]): part is TextUIPart =>
  part.type === "text";

const isToolInvocationPart = (
  part: UIMessage["parts"][number]
): part is ToolInvocationUIPart => part.type === "tool-invocation";

function getMessageText(message: UIMessage) {
  if (message.content) return message.content;
  const textParts = message.parts.filter(isTextPart);
  if (textParts.length === 0) return "";
  return textParts.map((part) => part.text).join("");
}

function getToolInvocations(message: UIMessage): ToolInvocation[] {
  const legacy = (message as LegacyToolCarrier).toolInvocations ?? [];
  const fromParts = message.parts
    .filter(isToolInvocationPart)
    .map((part) => part.toolInvocation);
  return [...legacy, ...fromParts];
}

function getActiveToolInvocation(messages: UIMessage[]): ToolInvocation | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "assistant") continue;

    const invocations = getToolInvocations(message);
    const active = invocations.find(
      (invocation) =>
        invocation.state === "call" || invocation.state === "partial-call"
    );
    if (active) {
      return active;
    }
  }

  return null;
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deriveTitleFromMessage(content: string) {
  if (!content) return "Conversation";
  const trimmed = content.trim();
  if (!trimmed) return "Conversation";
  const words = trimmed.split(/\s+/).slice(0, 6);
  const base = words.join(" ");
  return base.length < trimmed.length ? `${base}...` : base;
}

const ChatInterface = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    status,
    setInput,
  } = useChat({
    api: "http://localhost:3000/api/chat",
    streamProtocol: "text",
    onResponse: async (res) => {
      if (res.ok) return;
      let message = `Request failed (${res.status}).`;
      try {
        const data = (await res.clone().json()) as {
          error?: string;
          retryAfterSeconds?: number | null;
        };
        if (data?.error) {
          message = data.error;
        }
        if (data?.retryAfterSeconds) {
          message += ` Try again in ${Math.ceil(data.retryAfterSeconds)}s.`;
        }
      } catch {
        // ignore JSON parse errors
      }
      setChatError(message);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setChatError(message);
    },
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = messagesEndRef.current;
    if (!target) return;
    const behavior = status === "streaming" ? "auto" : "smooth";
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior });
    });
  }, [messages, status]);

  useEffect(() => {
    let isMounted = true;

    const fetchConversations = async () => {
      try {
        const res = await client.api.chat.conversations.$get();
        if (!res.ok) {
          throw new Error("Failed to fetch conversations");
        }
        const data = (await res.json()) as ConversationSummary[];
        if (!isMounted) return;
        setConversations(data);
        setActiveConversationId((current) => current ?? data[0]?.id ?? null);
      } catch (error) {
        console.error(error);
      }
    };

    fetchConversations();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeToolInvocation = useMemo(
    () => getActiveToolInvocation(messages),
    [messages]
  );

  const reasoningLabel =
    activeToolInvocation &&
    (TOOL_LABELS[activeToolInvocation.toolName] ??
      "Agent is using tools...");

  const lastMessage = messages[messages.length - 1];
  const lastMessageText = lastMessage ? getMessageText(lastMessage) : "";
  const agentIsTyping =
    (status === "submitted" || status === "streaming") &&
    (!lastMessage ||
      lastMessage.role === "user" ||
      (lastMessage.role === "assistant" && lastMessageText.length === 0));

  const showIntro = messages.length === 0;
  const composerClass = `flex flex-col ${
    messages.length > 0 ? "justify-end" : "justify-center"
  }`;
  const handleFormSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
    setChatError(null);
    handleSubmit(event);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6">
        <aside
          className={`fixed inset-y-6 left-4 z-30 flex w-72 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-slate-100 shadow-xl transition-transform duration-300 md:static md:translate-x-0 ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-[110%] md:translate-x-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                  Threads
                </p>
                <p className="text-sm font-semibold">Conversations</p>
              </div>
            </div>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-500">
              {conversations.length}
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {conversations.length === 0 ? (
              <p className="text-xs text-gray-500">
                No past conversations yet.
              </p>
            ) : (
              conversations.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                const title = deriveTitleFromMessage(conversation.lastMessage);

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setActiveConversationId(conversation.id)}
                    className={`w-full rounded-2xl px-3 py-3 text-left text-xs transition ${
                      isActive
                        ? "bg-blue-600 text-white shadow-[0_12px_24px_-16px_rgba(37,99,235,0.8)]"
                        : "bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{title}</span>
                      <span className="text-[10px] opacity-70">
                        {formatTimestamp(conversation.updatedAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] opacity-70">
                      {conversation.lastMessage || "No messages yet."}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm md:hidden"
            aria-label="Close sidebar"
          />
        )}

        <div className="flex flex-1 flex-col gap-4">
          <header className="flex items-center justify-between rounded-3xl border border-gray-200 bg-slate-50 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-700 md:hidden"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                  Support Desk
                </p>
                <h1 className="text-lg font-semibold">AI Customer Support</h1>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <span className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Live
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                Gemini Router
              </span>
            </div>
          </header>

          <div className="flex min-h-[70vh] flex-1 flex-col overflow-hidden rounded-[32px] border border-gray-200 bg-slate-50 shadow-xl">
            {messages.length > 0 && (
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
                  {messages.map((message) => {
                    if (message.role === "system") return null;
                    const isUser = message.role === "user";
                    const content = getMessageText(message);

                    return (
                      <div
                        key={message.id}
                        className={`flex w-full ${
                          isUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!isUser && (
                          <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            isUser
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_10px_30px_-20px_rgba(59,130,246,0.7)]"
                              : "bg-slate-50 text-slate-800 shadow-sm border border-slate-200"
                          }`}
                        >
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {content}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {agentIsTyping && !reasoningLabel && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader className="h-3 w-3 animate-spin" />
                      <span>Agent is typing...</span>
                    </div>
                  )}

                  {reasoningLabel && (
                    <div className="flex items-center gap-2 text-xs text-amber-800">
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 font-medium">
                        {reasoningLabel}
                      </span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}

            <div className={composerClass}>
              {showIntro && (
                <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 text-center animate-[fadeInUp_0.5s_ease]">
                  <h2 className="text-3xl font-bold text-gray-800">
                    What's on your mind today?
                  </h2>
                  <p className="text-sm text-gray-500">
                    Ask about order status, invoices, or product FAQs. We'll
                    route your request instantly.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setInput(suggestion)}
                        className="rounded-full border border-gray-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-600"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form
                onSubmit={handleFormSubmit}
                className={`mx-auto w-full max-w-3xl px-4 ${
                  messages.length > 0 ? "mb-6" : "mt-6"
                }`}
              >
                {chatError && (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 shadow-sm">
                    {chatError}
                  </div>
                )}
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-slate-50 px-4 py-4 shadow-xl">
                  <input
                    className="flex-1 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                    placeholder="Ask anything"
                    value={input}
                    onChange={handleInputChange}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
