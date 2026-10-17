'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Loader2, Lightbulb, Bot, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase/client';

interface ChatMessage {
  question: string;
  answer: string;
  evidence: { excerpt: string; source: string }[];
}

interface PaperChatbotProps {
  paperId: string;
}

export function PaperChatbot({ paperId }: PaperChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const askQuestion = async (q: string) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setQuestion('');

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${supabaseUrl}/functions/v1/paper-chatbot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({
          paperId,
          question: q,
          history: messages.map((m) => ({ question: m.question, answer: m.answer })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Failed to get answer' }));
        throw new Error(errData.error || 'Failed to get answer');
      }

      const data = await response.json();
      setMessages((prev) => [...prev, {
        question: q,
        answer: data.answer,
        evidence: data.evidence || [],
      }]);
      if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
        setSuggestedQuestions(data.suggestedQuestions);
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        question: q,
        answer: 'Sorry, I could not process your question right now. Please try again.',
        evidence: [],
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (!question.trim()) return;
    askQuestion(question.trim());
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="h-5 w-5 text-accent" /> Paper Assistant
        </CardTitle>
        <CardDescription>
          Ask questions about this paper — the assistant uses the paper's metadata, abstract, and any uploaded text to answer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chat history */}
          {messages.length > 0 && (
            <div ref={scrollRef} className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
              {messages.map((msg, i) => (
                <div key={i} className="space-y-2">
                  {/* Question */}
                  <div className="flex items-start gap-2 justify-end">
                    <div className="rounded-lg bg-accent/10 px-3 py-2 max-w-[80%]">
                      <p className="text-sm font-medium">{msg.question}</p>
                    </div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20">
                      <User className="h-3.5 w-3.5 text-accent" />
                    </div>
                  </div>
                  {/* Answer */}
                  <div className="flex items-start gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="rounded-lg border bg-card px-3 py-2 max-w-[80%] space-y-2">
                      <p className="text-sm leading-relaxed">{msg.answer}</p>
                      {msg.evidence.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-border/40">
                          <p className="text-xs font-medium text-muted-foreground">Sources:</p>
                          {msg.evidence.map((ev, j) => (
                            <div key={j} className="rounded border border-border/60 bg-muted/30 p-2">
                              <Badge variant="outline" className="mb-1 text-xs">{ev.source}</Badge>
                              <p className="text-xs italic text-muted-foreground">&quot;{ev.excerpt}&quot;</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-start gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="rounded-lg border bg-card px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Suggested questions */}
          {messages.length === 0 && suggestedQuestions.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lightbulb className="h-3 w-3" /> Try asking:
              </p>
              <div className="flex flex-wrap gap-2">
                {['What is this paper about?', 'Who are the authors?', 'What research concepts does this cover?'].map((q) => (
                  <Button
                    key={q}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => askQuestion(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && suggestedQuestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => askQuestion(q)}
                  disabled={loading}
                >
                  {q}
                </Button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Ask a question about this paper..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={loading}
            />
            <Button onClick={handleSend} disabled={loading || !question.trim()} size="icon">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
