import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Quote, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";

const QUOTES = [
  "The expert in anything was once a beginner.",
  "Small steps every day add up to big results.",
  "Don't watch the clock; do what it does. Keep going.",
  "Learning never exhausts the mind. — Leonardo da Vinci",
  "It always seems impossible until it's done. — Nelson Mandela",
  "You don't have to be great to start, but you have to start to be great.",
  "Progress, not perfection.",
  "Your future self is built by what you study today.",
  "Consistency beats intensity. Show up again tomorrow.",
  "Every skill you learn compounds into the next one.",
];

export function quoteForToday(): string {
  const day = Math.floor(Date.now() / 86_400_000);
  return QUOTES[day % QUOTES.length] ?? QUOTES[0]!;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [seenAt, setSeenAt] = useState<number>(() => Date.now());

  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [paths, steps, profile] = await Promise.all([
        supabase.from("learning_paths").select("id,title"),
        supabase.from("path_steps").select("path_id,status,completed_at"),
        supabase.from("profiles").select("display_name").eq("id", user!.id).single(),
      ]);
      return {
        paths: paths.data ?? [],
        steps: steps.data ?? [],
        displayName: profile.data?.display_name ?? null,
      };
    },
  });

  const paths = data?.paths ?? [];
  const steps = data?.steps ?? [];
  const completed = steps.filter((s) => s.status === "completed");
  const pct = steps.length ? Math.round((completed.length / steps.length) * 100) : 0;

  const firstName = useMemo(() => {
    const raw =
      data?.displayName ??
      (user?.user_metadata?.["full_name"] as string | undefined) ??
      user?.email ??
      "learner";
    return String(raw).split(" ")[0]!;
  }, [data?.displayName, user]);

  const recent = useMemo(
    () =>
      completed
        .filter((s) => s.completed_at && new Date(s.completed_at).getTime() > seenAt - 86_400_000)
        .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    [completed, seenAt],
  );

  const hasFresh = recent.some(
    (s) => s.completed_at && new Date(s.completed_at).getTime() > seenAt,
  );

  const nextStepNote =
    steps.length === 0
      ? `Hey ${firstName}, create your first learning path to get started.`
      : pct === 100
        ? `You did it, ${firstName}! All steps complete — amazing work! 🎉`
        : `You're ${pct}% of the way there, ${firstName}. Keep the momentum going!`;

  return (
    <Popover onOpenChange={(open) => open && setSeenAt(Date.now())}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          {hasFresh && (
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Quote className="size-3.5 text-primary" /> Daily motivation
          </p>
          <p className="text-sm italic">“{quoteForToday()}”</p>
        </div>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="size-3.5 text-primary" /> Progress status
          </p>
          <div className="flex items-center justify-between text-sm">
            <span>
              {completed.length}/{steps.length} steps completed
            </span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <Progress value={pct} />
          <p className="text-xs text-muted-foreground">{nextStepNote}</p>
        </div>

        {paths.length > 0 && (
          <div className="space-y-2 border-t border-border/60 pt-3">
            {paths.slice(0, 3).map((path) => {
              const ps = steps.filter((s) => s.path_id === path.id);
              const pd = ps.filter((s) => s.status === "completed").length;
              const pp = ps.length ? Math.round((pd / ps.length) * 100) : 0;
              return (
                <Link
                  key={path.id}
                  to="/paths/$pathId"
                  params={{ pathId: path.id }}
                  className="block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-secondary/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{path.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{pp}%</span>
                  </div>
                  <Progress value={pp} className="mt-1 h-1.5" />
                </Link>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
