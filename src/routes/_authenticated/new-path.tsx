import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { createPathFromGoal } from "@/lib/learning.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/new-path")({
  head: () => ({
    meta: [
      { title: "Describe your goal · SkillNav" },
      {
        name: "description",
        content:
          "Describe your learning goal in natural language and SkillNav generates a sequenced roadmap of courses, projects and assessments.",
      },
      { property: "og:title", content: "Describe your goal · SkillNav" },
      {
        property: "og:description",
        content: "Turn a goal in plain English into a milestone-based learning roadmap.",
      },
    ],
  }),
  component: NewPathPage,
});

const examples = [
  "I know Python basics and want to become an ML engineer in 6 months.",
  "Help me move from frontend developer to full-stack with cloud deployment skills.",
  "I want to learn data analytics for product decisions, 5 hours a week.",
];

function NewPathPage() {
  const navigate = useNavigate();
  const generate = useServerFn(createPathFromGoal);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (goal.trim().length < 5) {
      toast.error("Tell me a bit more about your goal.");
      return;
    }
    setBusy(true);
    try {
      const result = await generate({ data: { goal } });
      toast.success(`Created “${result.title}”`);
      navigate({ to: "/paths/$pathId", params: { pathId: result.pathId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate a path.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">What do you want to achieve?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe your goal, timeline and current level. SkillNav analyzes skill gaps and builds a
          sequenced roadmap with prerequisites and milestones.
        </p>
      </div>

      <div className="panel space-y-4 p-6">
        <Textarea
          rows={6}
          value={goal}
          placeholder="e.g. I'm a CS student comfortable with Python. I want to build and deploy LLM apps within 4 months, ~8 hours a week."
          onChange={(e) => setGoal(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <Button key={example} variant="outline" size="sm" onClick={() => setGoal(example)}>
              {example.slice(0, 42)}…
            </Button>
          ))}
        </div>
        <Button disabled={busy} onClick={submit}>
          <Sparkles className="size-4" />
          {busy ? "Designing your roadmap…" : "Generate learning path"}
        </Button>
      </div>
    </div>
  );
}
