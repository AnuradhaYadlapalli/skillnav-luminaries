import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass as SkillNavIcon, GitBranch, MessageSquareText, Target, LineChart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkillNav — AI Personalized Learning Path Recommender" },
      {
        name: "description",
        content:
          "Describe your goal in plain language and SkillNav builds a sequenced roadmap of courses, projects and assessments tailored to your skill level, interests and study time.",
      },
      { property: "og:title", content: "SkillNav — AI Personalized Learning Path Recommender" },
      {
        property: "og:description",
        content:
          "AI learning mentor that profiles your skills, finds your gaps and generates an explained, adaptive learning roadmap.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: MessageSquareText,
    title: "Say it in your own words",
    body: "“I'm a final-year student who knows Python and wants an ML engineering job in 6 months.” That's the whole input.",
  },
  {
    icon: Target,
    title: "Skill-gap analysis",
    body: "SkillNav profiles your level, interests, completed courses and weekly hours, then names the exact gaps between you and your goal.",
  },
  {
    icon: GitBranch,
    title: "Sequenced roadmap",
    body: "Courses, hands-on projects, readings and assessments ordered by prerequisite, with milestones you can actually hit.",
  },
  {
    icon: Sparkles,
    title: "Every step explained",
    body: "Ask “why this course before that one?” and the mentor answers using your own profile and roadmap.",
  },
  {
    icon: LineChart,
    title: "Progress & skills dashboard",
    body: "Track completion, hours invested, skills developed and the single next action to take today.",
  },
  {
    icon: SkillNavIcon,
    title: "Adapts to feedback",
    body: "Too theoretical? Moving too slowly? The roadmap rewrites what's left without repeating what you finished.",
  },
];

function Landing() {
  const { session, loading } = useAuth();

  return (
    <div className="min-h-screen hero-surface">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <SkillNavIcon className="size-6 text-primary" />
          <span className="font-display text-lg font-semibold">SkillNav</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={session ? "/dashboard" : "/auth"}>
            {loading ? "…" : session ? "Open dashboard" : "Sign in"}
          </Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="pt-14 pb-20 md:pt-24">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs tracking-wide text-muted-foreground uppercase">
            <span className="size-1.5 rounded-full bg-primary" />
            AI-powered learning path recommender
          </p>
          <h1 className="max-w-3xl text-4xl leading-[1.05] font-semibold md:text-6xl">
            Thousands of courses. <br />
            <span className="accent-gradient-text">One path that's yours.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Recommendation feeds hand you a pile of courses. SkillNav hands you an order — a roadmap
            of courses, projects and assessments built from your skill level, interests, history and
            goal, with a mentor that explains every choice.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={session ? "/new-path" : "/auth"}>Build my learning path</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={session ? "/assistant" : "/auth"}>Talk to the mentor</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="panel p-6">
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-4 text-base font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="panel mt-16 p-8 md:p-12">
          <h2 className="text-2xl font-semibold md:text-3xl">How it works</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-4">
            {[
              ["Profile", "Level, interests, completed courses, weekly hours, formats you like."],
              ["Goal", "Describe the outcome you want in natural language."],
              ["Roadmap", "AI sequences resources with prerequisites and milestones."],
              ["Adapt", "Mark progress, give feedback, watch the plan rewrite itself."],
            ].map(([title, body], i) => (
              <li key={title}>
                <div className="font-display text-3xl text-primary">0{i + 1}</div>
                <h3 className="mt-2 text-base font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        SkillNav · personalized learning paths
      </footer>
    </div>
  );
}
