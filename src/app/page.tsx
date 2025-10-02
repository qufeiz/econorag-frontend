"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import Auth from "@/components/auth";
import type { User } from "@supabase/supabase-js";

interface Attachment {
  type: string;
  source: string;
  title?: string;
  series_id?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load messages from session storage
  useEffect(() => {
    const saved = sessionStorage.getItem('chat-messages');
    if (saved) setMessages(JSON.parse(saved));
  }, []);

  // Save messages to session storage
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('chat-messages', JSON.stringify(messages));
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": session?.access_token ? `Bearer ${session.access_token}` : ""
        },
        body: JSON.stringify({
          text: input,
          conversation: messages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
        attachments: data.attachments,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error connecting to backend" }]);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Show auth component if not logged in
  if (!user) {
    return <Auth />;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 h-screen flex flex-col">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>RAG Chat</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-muted-foreground">Start a conversation...</p>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-xs lg:max-w-md p-3 rounded-lg space-y-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:underline [&_strong]:font-bold">
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                  {msg.attachments?.map((attachment, attachmentIndex) => (
                    attachment.type === "image" ? (
                      <figure key={attachmentIndex} className="flex flex-col gap-2">
                        <img
                          src={attachment.source}
                          alt={attachment.title ?? "Attachment"}
                          className="rounded-md border border-muted-foreground/20"
                        />
                        <figcaption className="text-xs text-muted-foreground">
                          {attachment.title ?? "FRED Series"}
                          {attachment.series_id ? ` • ${attachment.series_id}` : ""}
                        </figcaption>
                      </figure>
                    ) : null
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted p-3 rounded-lg">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask about economic data..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
