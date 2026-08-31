import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { askAssistant } from "@/lib/learning.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI mentor · SkillNav" },
      {
        name: "description",
        content:
          "Ask the SkillNav AI mentor why a step was recommended, how to sequence prerequisites, or what to learn next.",
      },
      { property: "og:title", content: "AI mentor · SkillNav" },
      {
        property: "og:description",
        content: "A conversational mentor that explains your learning recommendations.",
      },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const queryClient = useQueryClient();
  const ask = useServerFn(askAssistant);
  const [message, setMessage] = useState("");
  const [pathId, setPathId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: paths } = useQuery({
    queryKey: ["paths", "list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("learning_paths")
        .select("id, title")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const selectedPath = paths?.find((p) => p.id === pathId) ?? null;

  useEffect(() => {
    document.title = selectedPath
      ? `${selectedPath.title} · AI mentor · SkillNav`
      : "AI mentor · SkillNav";
  }, [selectedPath]);

  const { data: messages } = useQuery({
    queryKey: ["chat", pathId ?? "global"],
    queryFn: async () => {
      const base = supabase.from("chat_messages").select("*").order("created_at");
      const { data } = pathId ? await base.eq("path_id", pathId) : await base.is("path_id", null);
      return data ?? [];
    },
  });

  const send = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await ask({ data: { message, pathId } });
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["chat", pathId ?? "global"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The mentor is unavailable.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="font-display text-3xl font-semibold">
          {selectedPath ? selectedPath.title : "AI mentor"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {selectedPath
            ? `Ask your mentor anything about “${selectedPath.title}” — prerequisites, skill gaps, or what to study next.`
            : "Ask about your roadmap, prerequisites, skill gaps or what to study next. Your mentor can see your generated roadmaps and your progress on each step."}
        </p>
      </div>

      {!!paths?.length && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Context</span>
          <Button
            size="sm"
            variant={pathId === null ? "default" : "outline"}
            onClick={() => setPathId(null)}
          >
            All my roadmaps
          </Button>
          {paths.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={pathId === p.id ? "default" : "outline"}
              onClick={() => setPathId(p.id)}
            >
              {p.title}
            </Button>
          ))}
        </div>
      )}

      <div className="panel min-h-[320px] space-y-5 p-6">
        {!messages?.length && (
          <p className="text-sm text-muted-foreground">
            Try: “Why do I need linear algebra before deep learning?”
          </p>
        )}
        {messages?.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary/15 px-4 py-3 text-sm">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-border/60 bg-secondary/30 px-5 py-4">
                <MentorAnswer content={m.content} />
              </div>
            </div>
          ),
        )}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4 animate-pulse text-primary" /> Thinking…
          </p>
        )}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          rows={2}
          value={message}
          placeholder="Ask your mentor anything…"
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button disabled={busy} onClick={send}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function MentorAnswer({ content }: { content: string }) {
  const lines = content.split("\n");
  const nextIndex = lines.findIndex((l) => /^\s*[*_-]*\s*next step/i.test(l));
  const body = (nextIndex >= 0 ? lines.slice(0, nextIndex) : lines).join("\n").trim();
  const next =
    nextIndex >= 0
      ? lines
          .slice(nextIndex)
          .join(" ")
          .replace(/^[\s*_-]*next step[:\s-]*/i, "")
          .replace(/[*_`]/g, "")
          .trim()
      : null;

  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="text-foreground/90">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          ul: ({ children }) => <ul className="space-y-2">{children}</ul>,
          ol: ({ children }) => <ol className="space-y-2">{children}</ol>,
          li: ({ children }) => (
            <li className="flex gap-2.5">
              <span className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0 flex-1 text-foreground/90">{children}</span>
            </li>
          ),
          h1: ({ children }) => (
            <h3 className="font-display text-base font-semibold">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="font-display text-base font-semibold">{children}</h3>
          ),
          h3: ({ children }) => (
            <h3 className="font-display text-base font-semibold">{children}</h3>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-background/60 px-1.5 py-0.5 text-xs">{children}</code>
          ),
        }}
      >
        {body}
      </ReactMarkdown>

      {next && (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            <span className="font-semibold text-foreground">Next step: </span>
            <span className="text-foreground/90">{next}</span>
          </p>
        </div>
      )}
    </div>
  );
}
