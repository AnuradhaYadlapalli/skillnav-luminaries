import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Flag, Sparkles, Target, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Progress dashboard · SkillNav" },
      {
        name: "description",
        content:
          "Track roadmap progress, milestones reached, skills developed and the next recommended action on your learning path.",
      },
      { property: "og:title", content: "Progress dashboard · SkillNav" },
      {
        property: "og:description",
        content: "See your learning progress, skills and next best action at a glance.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [paths, steps] = await Promise.all([
        supabase.from("learning_paths").select("*").order("created_at", { ascending: false }),
        supabase.from("path_steps").select("*").order("position"),
      ]);
      return { paths: paths.data ?? [], steps: steps.data ?? [] };
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading your progress…</p>;

  const paths = data?.paths ?? [];
  const steps = data?.steps ?? [];

  if (!paths.length) {
    return (
      <div className="panel max-w-xl space-y-4 p-8 text-center">
        <Sparkles className="mx-auto size-8 text-primary" />
        <h1 className="font-display text-2xl font-semibold">No learning path yet</h1>
        <p className="text-sm text-muted-foreground">
          Describe your goal in plain language and SkillNav will build a sequenced roadmap.
        </p>
        <Button asChild>
          <Link to="/new-path">Create my first path</Link>
        </Button>
      </div>
    );
  }

  const pathIds = new Set(paths.map((p) => p.id));
  const ownedSteps = steps.filter((s) => pathIds.has(s.path_id));
  const completed = ownedSteps.filter((s) => s.status === "completed");
  const skills = Array.from(new Set(completed.flatMap((s) => s.skills ?? [])));
  const milestones = ownedSteps.filter((s) => s.is_milestone);
  const milestonesDone = milestones.filter((s) => s.status === "completed").length;
  const nextStep = ownedSteps.find((s) => s.status !== "completed");
  const stepHours = (s: { est_hours: number | null; kind: string }) =>
    s.est_hours && s.est_hours > 0 ? s.est_hours : s.kind === "project" ? 6 : 3;
  const hoursDone = Math.round(completed.reduce((sum, s) => sum + stepHours(s), 0));
  const hoursTotal = Math.round(ownedSteps.reduce((sum, s) => sum + stepHours(s), 0));


  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Your progress</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {completed.length} of {ownedSteps.length} steps complete across {paths.length} path
            {paths.length > 1 ? "s" : ""}.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/new-path">
            <Sparkles className="size-4" /> New path
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Target} label="Steps completed" value={`${completed.length}/${ownedSteps.length}`} />
        <Stat icon={Flag} label="Milestones" value={`${milestonesDone}/${milestones.length}`} />
        <Stat icon={Trophy} label="Skills developed" value={String(skills.length)} />
        <Stat icon={Sparkles} label="Study hours logged" value={`${hoursDone}h / ${hoursTotal}h`} />
      </div>

      {nextStep && (
        <div className="panel space-y-3 p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Next recommended action
          </p>
          <h2 className="font-display text-xl font-semibold">{nextStep.title}</h2>
          <p className="text-sm text-muted-foreground">{nextStep.why ?? nextStep.description}</p>
          <Button asChild size="sm">
            <Link to="/paths/$pathId" params={{ pathId: nextStep.path_id }}>
              Open roadmap <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}

      {skills.length > 0 && (
        <div className="panel space-y-3 p-6">
          <h2 className="font-display text-lg font-semibold">Skills developed</h2>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Your roadmaps</h2>
        {paths.map((path) => {
          const pathSteps = ownedSteps.filter((s) => s.path_id === path.id);
          const done = pathSteps.filter((s) => s.status === "completed").length;
          const pct = pathSteps.length ? Math.round((done / pathSteps.length) * 100) : 0;
          return (
            <Link
              key={path.id}
              to="/paths/$pathId"
              params={{ pathId: path.id }}
              className="panel block space-y-3 p-6 transition-colors hover:border-primary/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-semibold">{pathDisplayTitle(path)}</h3>
                <span className="text-sm text-muted-foreground">{pct}%</span>
              </div>
              <p className="text-sm text-muted-foreground">{path.summary || path.goal}</p>
              <Progress value={pct} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function pathDisplayTitle(path: {
  title?: string | null;
  goal?: string | null;
  target_role?: string | null;
}) {
  const title = path.title?.trim();
  if (title && title.toLowerCase() !== "personalized learning path") return title;
  const role = path.target_role?.trim();
  if (role) return role;
  return path.goal?.trim() || "Untitled roadmap";
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="panel p-5">
      <Icon className="size-5 text-primary" />
      <p className="mt-3 font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
