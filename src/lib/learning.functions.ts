import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  generatePlan,
  refineSteps,
  answerLearner,
  type LearnerProfile,
} from "./learning.server";

export const createPathFromGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ goal: z.string().min(5) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const { data: recent } = await supabase
      .from("chat_messages")
      .select("role, content")
      .is("path_id", null)
      .order("created_at", { ascending: false })
      .limit(10);

    const history = (recent ?? [])
      .reverse()
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const plan = await generatePlan({
      goal: data.goal,
      profile: profile as LearnerProfile | null,
      history,
    });

    const pathTitle = plan.title.trim() || data.goal;
    const { data: path, error } = await supabase
      .from("learning_paths")
      .insert({
        user_id: userId,
        title: pathTitle,
        goal: data.goal,
        summary: plan.summary,
        rationale: `${plan.rationale}\n\nSkill gaps identified: ${plan.skill_gaps.join(", ")}`,
        target_role: plan.target_role,
        estimated_weeks: Math.max(1, Math.round(plan.estimated_weeks)),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const rows = plan.steps.slice(0, 16).map((step, index) => ({
      path_id: path.id,
      user_id: userId,
      position: index,
      kind: ["course", "project", "assessment", "reading"].includes(step.kind)
        ? step.kind
        : "course",
      title: step.title.slice(0, 160),
      provider: step.provider,
      description: step.description,
      why: step.why,
      skills: step.skills.slice(0, 8),
      est_hours: Math.max(1, Math.round(step.est_hours)),
      prerequisites: step.prerequisites.slice(0, 6),
      is_milestone: step.is_milestone,
      resource_url: step.resource_url || null,
    }));

    const { error: stepError } = await supabase.from("path_steps").insert(rows);
    if (stepError) throw new Error(stepError.message);

    return { pathId: path.id as string, title: path.title as string };
  });

export const adaptPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ pathId: z.string().uuid(), feedback: z.string().min(3) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: path } = await supabase
      .from("learning_paths")
      .select("*")
      .eq("id", data.pathId)
      .maybeSingle();
    if (!path) throw new Error("Path not found");

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const { data: steps } = await supabase
      .from("path_steps")
      .select("*")
      .eq("path_id", data.pathId)
      .order("position");

    const all = steps ?? [];
    const completed = all.filter((s) => s.status === "completed");
    const pending = all.filter((s) => s.status !== "completed");

    const newSteps = await refineSteps({
      goal: path.goal,
      profile: profile as LearnerProfile | null,
      feedback: data.feedback,
      completed: completed.map((s) => `${s.title} (${s.kind})`),
      pending: pending.map((s) => `${s.title} (${s.kind})`),
    });

    if (pending.length) {
      await supabase
        .from("path_steps")
        .delete()
        .in(
          "id",
          pending.map((s) => s.id),
        );
    }

    const offset = completed.length;
    const rows = newSteps.slice(0, 14).map((step, index) => ({
      path_id: data.pathId,
      user_id: userId,
      position: offset + index,
      kind: ["course", "project", "assessment", "reading"].includes(step.kind)
        ? step.kind
        : "course",
      title: step.title.slice(0, 160),
      provider: step.provider,
      description: step.description,
      why: step.why,
      skills: step.skills.slice(0, 8),
      est_hours: Math.max(1, Math.round(step.est_hours)),
      prerequisites: step.prerequisites.slice(0, 6),
      is_milestone: step.is_milestone,
      resource_url: step.resource_url || null,
    }));

    const { error } = await supabase.from("path_steps").insert(rows);
    if (error) throw new Error(error.message);

    await supabase
      .from("learning_paths")
      .update({ rationale: `${path.rationale ?? ""}\n\nAdapted after feedback: ${data.feedback}` })
      .eq("id", data.pathId);

    return { updated: rows.length };
  });

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ message: z.string().min(1), pathId: z.string().uuid().nullable().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pathId = data.pathId ?? null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const buildPathContext = async (id: string) => {
      const { data: path } = await supabase
        .from("learning_paths")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      const { data: steps } = await supabase
        .from("path_steps")
        .select("*")
        .eq("path_id", id)
        .order("position");
      if (!path) return "";
      const done = (steps ?? []).filter((s) => s.status === "completed").length;
      return [
        `Roadmap: ${path.title} (goal: ${path.goal}; target role: ${path.target_role ?? "n/a"}; ${path.estimated_weeks ?? "?"} weeks)`,
        `Progress: ${done}/${(steps ?? []).length} steps completed.`,
        `Why this roadmap: ${path.rationale ?? ""}`,
        "Steps:",
        ...(steps ?? []).map(
          (s) =>
            `${s.position + 1}. [${s.status}] ${s.title} — ${s.kind}, ${s.est_hours ?? "?"}h, skills: ${(s.skills ?? []).join(", ")}. Why: ${s.why ?? ""}`,
        ),
      ].join("\n");
    };

    let pathContext = "";
    if (pathId) {
      pathContext = await buildPathContext(pathId);
    } else {
      // No specific path: give the mentor context on the learner's recent roadmaps
      const { data: recentPaths } = await supabase
        .from("learning_paths")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3);
      const contexts = await Promise.all((recentPaths ?? []).map((p) => buildPathContext(p.id)));
      pathContext = contexts.filter(Boolean).join("\n\n");
    }


    const historyQuery = supabase
      .from("chat_messages")
      .select("role, content")
      .order("created_at", { ascending: false })
      .limit(16);
    const { data: recent } = pathId
      ? await historyQuery.eq("path_id", pathId)
      : await historyQuery.is("path_id", null);

    const history = (recent ?? []).reverse();

    const reply = await answerLearner({
      question: data.message,
      profile: profile as LearnerProfile | null,
      pathContext,
      history,
    });

    await supabase.from("chat_messages").insert([
      { user_id: userId, path_id: pathId, role: "user", content: data.message },
      { user_id: userId, path_id: pathId, role: "assistant", content: reply },
    ]);

    return { reply };
  });
