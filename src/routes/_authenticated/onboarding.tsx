import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Learner profile · SkillNav" },
      {
        name: "description",
        content:
          "Capture your interests, experience level, weekly study time and completed courses so SkillNav can personalize your roadmap.",
      },
      { property: "og:title", content: "Learner profile · SkillNav" },
      {
        property: "og:description",
        content: "Tell SkillNav about your skills and goals to personalize your learning path.",
      },
    ],
  }),
  component: OnboardingPage,
});

const levels = ["beginner", "intermediate", "advanced"];
const formats = ["video", "reading", "project", "interactive", "assessment"];

function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [level, setLevel] = useState("beginner");
  const [interests, setInterests] = useState("");
  const [careerGoal, setCareerGoal] = useState("");
  const [weeklyHours, setWeeklyHours] = useState(6);
  const [preferred, setPreferred] = useState<string[]>(["video", "project"]);
  const [completed, setCompleted] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDisplayName(data.display_name ?? "");
        setLevel(data.experience_level ?? "beginner");
        setInterests((data.interests ?? []).join(", "));
        setCareerGoal(data.career_goal ?? "");
        setWeeklyHours(data.weekly_hours ?? 6);
        setPreferred(data.preferred_formats?.length ? data.preferred_formats : ["video", "project"]);
        setCompleted((data.completed_courses ?? []).join(", "));
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: displayName || null,
      experience_level: level,
      interests: splitList(interests),
      career_goal: careerGoal || null,
      weekly_hours: Number(weeklyHours) || 6,
      preferred_formats: preferred,
      completed_courses: splitList(completed),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved.");
    navigate({ to: "/new-path" });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Your learner profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The more SkillNav knows, the sharper your roadmap and skill-gap analysis.
        </p>
      </div>

      <div className="panel space-y-5 p-6">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Experience level</Label>
          <div className="flex flex-wrap gap-2">
            {levels.map((l) => (
              <Button
                key={l}
                type="button"
                variant={level === l ? "default" : "outline"}
                size="sm"
                onClick={() => setLevel(l)}
              >
                {l}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Interests (comma separated)</Label>
          <Input
            placeholder="machine learning, web development, data viz"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Career goal</Label>
          <Input
            placeholder="Become an ML engineer at a product company"
            value={careerGoal}
            onChange={(e) => setCareerGoal(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Weekly study hours</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(Number(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label>Preferred formats</Label>
          <div className="flex flex-wrap gap-2">
            {formats.map((f) => (
              <Button
                key={f}
                type="button"
                size="sm"
                variant={preferred.includes(f) ? "default" : "outline"}
                onClick={() =>
                  setPreferred((prev) =>
                    prev.includes(f) ? prev.filter((p) => p !== f) : [...prev, f],
                  )
                }
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Completed courses / known skills</Label>
          <Textarea
            rows={3}
            placeholder="Python basics, SQL for analysts, Intro to statistics"
            value={completed}
            onChange={(e) => setCompleted(e.target.value)}
          />
        </div>

        <Button disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </div>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 20);
}
