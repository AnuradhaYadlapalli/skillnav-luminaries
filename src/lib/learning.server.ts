import { streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { getGatewayModel } from "./ai-gateway.server";

export type LearnerProfile = {
  display_name?: string | null;
  experience_level?: string | null;
  interests?: string[] | null;
  career_goal?: string | null;
  weekly_hours?: number | null;
  preferred_formats?: string[] | null;
  completed_courses?: string[] | null;
};

const strArray = z
  .union([z.array(z.union([z.string(), z.number()])), z.string()])
  .transform((v) => (Array.isArray(v) ? v.map(String) : v.split(/[,\n]/)))
  .transform((v) => v.map((s) => s.trim()).filter(Boolean))
  .catch([] as string[]);

export const stepSchema = z.object({
  title: z.string().catch(""),
  kind: z.string().catch("course"),
  provider: z.string().catch(""),
  description: z.string().catch(""),
  why: z.string().catch(""),
  skills: strArray,
  est_hours: z.coerce.number().catch(4),
  prerequisites: strArray,
  is_milestone: z.coerce.boolean().catch(false),
  resource_url: z.string().catch(""),
});

export const planSchema = z.object({
  title: z.string().catch(""),
  target_role: z.string().catch(""),
  estimated_weeks: z.coerce.number().catch(8),
  summary: z.string().catch(""),
  rationale: z.string().catch(""),
  skill_gaps: strArray,
  steps: z.array(stepSchema).catch([] as never[]),
});

export type Plan = z.infer<typeof planSchema>;
export type PlanStep = z.infer<typeof stepSchema>;


export function describeLearner(profile: LearnerProfile | null): string {
  if (!profile) return "No profile data captured yet.";
  const lines = [
    `Name: ${profile.display_name ?? "learner"}`,
    `Self-reported experience level: ${profile.experience_level ?? "unknown"}`,
    `Interests: ${(profile.interests ?? []).join(", ") || "not specified"}`,
    `Career goal: ${profile.career_goal ?? "not specified"}`,
    `Study time available: ${profile.weekly_hours ?? "?"} hours per week`,
    `Preferred learning formats: ${(profile.preferred_formats ?? []).join(", ") || "any"}`,
    `Already completed: ${(profile.completed_courses ?? []).join(", ") || "nothing recorded"}`,
  ];
  return lines.join("\n");
}

const PLANNER_SYSTEM = `You are an expert curriculum architect for an online learning platform.
You build sequenced, realistic learning roadmaps.

Rules:
- title: a short, specific roadmap name derived from the learner's goal (e.g. "ML Engineer in 6 Months", "Full-Stack with Cloud Deployment"). Max 70 characters. Never use the generic phrase "Personalized learning path".
- Infer the learner's current skill level and name the concrete skill gaps between where they are and their goal.
- Produce 8 to 14 ordered steps. Order strictly by dependency: foundations first, then applied work.
- Mix kinds: use exactly one of "course", "project", "assessment" or "reading" for each step's kind.
- Every 3rd or 4th step should be a hands-on project or an assessment, and those should be marked as milestones.
- Skip or compress topics the learner has already completed, and say so in the rationale.
- "why" must explain, in 1-2 sentences, why THIS learner needs THIS step now, referencing their goal, level, or history.
- est_hours must fit the learner's weekly hours; keep the total realistic for estimated_weeks.
- provider: a real, well-known platform or resource type (e.g. Coursera, freeCodeCamp, Kaggle, official docs, self-directed build).
- resource_url: a plausible public landing page for that provider, or an empty string if unsure. Never invent fake deep links.
- Keep every text field concise. Titles under 80 characters.`;

function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  const candidate = text.slice(start);
  // Try progressively shorter suffixes to survive truncated output.
  for (let end = candidate.length; end > 0; end = candidate.lastIndexOf("}", end - 1)) {
    const slice = candidate.slice(0, end);
    try {
      return JSON.parse(slice);
    } catch {
      // try adding closers for truncated arrays/objects
      for (const tail of ["}", "]}", "}]}", "\"}]}"]) {
        try {
          return JSON.parse(slice + tail);
        } catch {
          /* keep trying */
        }
      }
    }
    if (end <= 1) break;
  }
  return null;
}

// Salvage individual step objects from partial/truncated model output.
function salvageSteps(text: string): unknown[] {
  const out: unknown[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    for (let j = i; j < text.length; j++) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") {
        depth--;
        if (depth === 0) {
          const slice = text.slice(i, j + 1);
          if (/"title"\s*:/.test(slice)) {
            try {
              out.push(JSON.parse(slice));
            } catch {
              /* ignore */
            }
          }
          i = j;
          break;
        }
      }
    }
  }
  return out;
}

async function generateStructured<S extends z.ZodTypeAny>(args: {
  system: string;
  prompt: string;
  schema: S;
  isAcceptable?: (value: z.output<S>) => boolean;
}): Promise<z.output<S>> {
  const ok = (v: z.output<S>) => (args.isAcceptable ? args.isAcceptable(v) : true);
  let lastError: unknown;
  let lastText: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = streamText({
      model: getGatewayModel(),
      system: args.system,
      prompt:
        attempt === 0
          ? args.prompt
          : `${args.prompt}\n\nIMPORTANT: return ONE complete JSON object that matches the schema exactly, including a non-empty "steps" array where every step has a non-empty "title". No markdown, no commentary, no trailing text.`,
      output: Output.object({ schema: args.schema }),
    });
    try {
      const value = (await result.output) as z.output<S>;
      if (ok(value)) return value;
      lastText = await Promise.resolve(result.text).catch(() => undefined);
      lastError = new Error("Model output was incomplete.");
    } catch (error) {
      lastError = error;
      const text = NoObjectGeneratedError.isInstance(error) ? error.text : undefined;
      if (text) lastText = text;
      if (text) {
        const raw = extractJson(text);
        if (raw) {
          const parsed = args.schema.safeParse(raw);
          if (parsed.success && ok(parsed.data as z.output<S>)) return parsed.data as z.output<S>;
        }
      }
    }
    // Final fallback: rebuild a plan from whatever step objects we can salvage.
    if (lastText) {
      const salvaged = salvageSteps(lastText)
        .map((s) => stepSchema.safeParse(s))
        .filter((r) => r.success)
        .map((r) => (r as { data: PlanStep }).data)
        .filter((s) => s.title.trim().length > 0);
      if (salvaged.length >= 4) {
        const parsed = args.schema.safeParse({ steps: salvaged });
        if (parsed.success && ok(parsed.data as z.output<S>)) return parsed.data as z.output<S>;
      }
    }
  }
  throw lastError ?? new Error("The planner could not produce a roadmap. Please try again.");
}


function sanitizePlan(plan: Plan): Plan {
  const steps = plan.steps.filter((s) => s.title.trim().length > 0);
  if (steps.length === 0) {
    throw new Error("The planner returned no usable steps. Please try again.");
  }
  return { ...plan, steps };
}

function planHasSteps(plan: Plan): boolean {
  return plan.steps.some((s) => s.title.trim().length > 0);
}


export async function generatePlan(input: {
  goal: string;
  profile: LearnerProfile | null;
  history?: string;
}): Promise<Plan> {
  const plan = await generateStructured({
    system: PLANNER_SYSTEM,
    schema: planSchema,
    isAcceptable: planHasSteps,
    prompt: `LEARNER PROFILE
${describeLearner(input.profile)}

${input.history ? `EARLIER CONVERSATION WITH THE LEARNER\n${input.history}\n` : ""}
LEARNER'S GOAL (their own words)
"""${input.goal}"""

Design the personalized learning roadmap.`,
  });
  return sanitizePlan(plan);
}


export async function refineSteps(input: {
  goal: string;
  profile: LearnerProfile | null;
  feedback: string;
  completed: string[];
  pending: string[];
}): Promise<PlanStep[]> {
  const plan = await generateStructured({
    system: PLANNER_SYSTEM,
    schema: planSchema,
    isAcceptable: planHasSteps,
    prompt: `LEARNER PROFILE
${describeLearner(input.profile)}

ORIGINAL GOAL: """${input.goal}"""

STEPS THE LEARNER HAS ALREADY COMPLETED (do not repeat these):
${input.completed.join("\n") || "none yet"}

REMAINING STEPS IN THE CURRENT ROADMAP:
${input.pending.join("\n") || "none"}

LEARNER FEEDBACK ON THE ROADMAP:
"""${input.feedback}"""

Rewrite ONLY the remaining part of the roadmap so it honours the feedback while still reaching the goal.
Return 5 to 12 steps covering what is left. Keep the same output format.`,
  });
  return sanitizePlan(plan).steps;
}

export type ChatTurn = { role: string; content: string };

export async function answerLearner(input: {
  question: string;
  profile: LearnerProfile | null;
  pathContext: string;
  history: ChatTurn[];
}): Promise<string> {
  const result = streamText({
    model: getGatewayModel(),
    system: `You are SkillNav, a warm and precise AI learning mentor inside a personalized learning-path app.
You know the learner's profile and their active roadmap. You explain WHY recommendations were made,
justify sequencing and prerequisites, suggest what to do next, and answer study questions.

ANSWER STYLE (always follow):
- Start with one short bold takeaway line (max 15 words).
- Then give 3-5 markdown bullet points. One idea per bullet, max ~20 words each.
- Bold the key term at the start of each bullet, e.g. "- **Linear algebra:** ...".
- Use plain, simple English. No jargon unless you define it in the same bullet.
- End with a single line starting with "Next step:" naming one concrete action.
- Never write long paragraphs or walls of text. Keep the whole reply under 150 words.
- Use a numbered list only when describing an order or sequence of actions.
If the learner asks for a brand-new roadmap, tell them to describe the goal on the "New path" screen.

Never invent progress data that is not in the context below.

LEARNER PROFILE
${describeLearner(input.profile)}

ACTIVE ROADMAP CONTEXT
${input.pathContext || "The learner has no active roadmap yet."}`,
    messages: [
      ...input.history.map((turn) => ({
        role: turn.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: turn.content,
      })),
      { role: "user" as const, content: input.question },
    ],
  });
  return await result.text;
}
