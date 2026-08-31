import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, ExternalLink, Flag, Lightbulb, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adaptPath } from "@/lib/learning.functions";
import { quoteForToday } from "@/components/NotificationsBell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/paths/$pathId")({
  head: () => ({
    meta: [
      { title: "Learning roadmap · SkillNav" },
      {
        name: "description",
        content:
          "Follow your sequenced roadmap of courses, projects and assessments, see why each step was recommended, and adapt it with feedback.",
      },
      { property: "og:title", content: "Learning roadmap · SkillNav" },
      {
        property: "og:description",
        content: "Milestones, prerequisites and AI explanations for every step of your path.",
      },
    ],
  }),
  component: PathDetailPage,
});

function PathDetailPage() {
  const { pathId } = Route.useParams();
  const queryClient = useQueryClient();
  const adapt = useServerFn(adaptPath);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["path", pathId],
    queryFn: async () => {
      const [path, steps] = await Promise.all([
        supabase.from("learning_paths").select("*").eq("id", pathId).maybeSingle(),
        supabase.from("path_steps").select("*").eq("path_id", pathId).order("position"),
      ]);
      return { path: path.data, steps: steps.data ?? [] };
    },
  });

  const pathTitle = data?.path?.title;
  useEffect(() => {
    if (pathTitle) document.title = `${pathTitle} · SkillNav`;
  }, [pathTitle]);

  const toggle = async (id: string, status: string) => {
    const next = status === "completed" ? "pending" : "completed";
    const { error } = await supabase
      .from("path_steps")
      .update({
        status: next,
        completed_at: next === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (next === "completed") {
      toast.success("Step completed — great work! 🎉", {
        description: quoteForToday(),
      });
    }
    queryClient.invalidateQueries({ queryKey: ["path", pathId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const sendFeedback = async () => {
    if (feedback.trim().length < 3) {
      toast.error("Tell SkillNav what to change.");
      return;
    }
    setBusy(true);
    try {
      await adapt({ data: { pathId, feedback } });
      setFeedback("");
      toast.success("Roadmap adapted to your feedback.");
      queryClient.invalidateQueries({ queryKey: ["path", pathId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not adapt the path.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Loading roadmap…</p>;
  if (!data?.path) return <p className="text-muted-foreground">Path not found.</p>;

  const { path, steps } = data;
  const done = steps.filter((s) => s.status === "completed").length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="panel space-y-4 p-6">
        <h1 className="font-display text-3xl font-semibold">{path.title}</h1>
        <p className="text-sm text-muted-foreground">{path.summary}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {path.target_role && <Badge variant="secondary">{path.target_role}</Badge>}
          {path.estimated_weeks && <Badge variant="secondary">{path.estimated_weeks} weeks</Badge>}
          <Badge variant="secondary">
            {done}/{steps.length} steps
          </Badge>
        </div>
        <Progress value={pct} />
        {path.rationale && (
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-4 text-sm">
            <p className="mb-2 flex items-center gap-2 font-medium">
              <Lightbulb className="size-4 text-primary" /> Why this path
            </p>
            <p className="whitespace-pre-line text-muted-foreground">{path.rationale}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => {
          const complete = step.status === "completed";
          return (
            <div key={step.id} className="panel space-y-3 p-6">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => toggle(step.id, step.status)}
                  aria-label={complete ? "Mark incomplete" : "Mark complete"}
                  className="mt-1 text-primary"
                >
                  {complete ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <Circle className="size-5 text-muted-foreground" />
                  )}
                </button>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Step {index + 1}</span>
                    <Badge variant="outline">{step.kind}</Badge>
                    {step.is_milestone && (
                      <Badge>
                        <Flag className="size-3" /> Milestone
                      </Badge>
                    )}
                    {step.est_hours && (
                      <span className="text-xs text-muted-foreground">{step.est_hours}h</span>
                    )}
                  </div>
                  <h2
                    className={`font-display text-lg font-semibold ${complete ? "line-through opacity-60" : ""}`}
                  >
                    {step.title}
                  </h2>
                  {step.provider && (
                    <p className="text-xs text-muted-foreground">via {step.provider}</p>
                  )}
                  {step.description && <p className="text-sm">{step.description}</p>}
                  {step.why && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Why: </span>
                      {step.why}
                    </p>
                  )}
                  {step.prerequisites?.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Prerequisites: {step.prerequisites.join(", ")}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(step.skills ?? []).map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                  {step.resource_url && (
                    <a
                      href={step.resource_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Open resource <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">Adapt this path</h2>
        <p className="text-sm text-muted-foreground">
          Tell SkillNav what's too easy, too slow, or off-target — completed steps are kept and the
          rest is replanned.
        </p>
        <Textarea
          rows={3}
          value={feedback}
          placeholder="The SQL section is too basic and I'd like more hands-on projects."
          onChange={(e) => setFeedback(e.target.value)}
        />
        <Button disabled={busy} onClick={sendFeedback}>
          <RefreshCw className="size-4" />
          {busy ? "Replanning…" : "Adapt roadmap"}
        </Button>
      </div>
    </div>
  );
}
