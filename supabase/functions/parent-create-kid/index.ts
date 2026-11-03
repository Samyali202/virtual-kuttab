// Parent creates a kid account + family_links row (service role).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: "unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, service);
    const { data: parentProfile } = await admin
      .from("profiles")
      .select("id,role")
      .eq("id", user.id)
      .maybeSingle();
    if (!parentProfile || parentProfile.role !== "parent") {
      return json({ error: "parent_only" }, 403);
    }
    if ((parentProfile as { disabled?: boolean }).disabled) {
      return json({ error: "disabled" }, 403);
    }

    const body = await req.json();
    const { data: rateOk } = await admin.rpc("consume_rate_limit", {
      p_bucket: `parent_create:${user.id}`,
      p_max: 20,
      p_window_seconds: 3600,
    });
    if (rateOk === false) {
      return json({ error: "rate_limited" }, 429);
    }
    const displayName = String(body.displayName || "").trim();
    const username = String(body.username || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const age =
      body.age == null || body.age === ""
        ? null
        : Number(body.age);
    const emailRaw = String(body.email || "").trim().toLowerCase();

    if (!displayName || !/^[a-z0-9_]{3,24}$/.test(username) || password.length < 8) {
      return json({ error: "invalid_input" }, 400);
    }

    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (taken) return json({ error: "username_taken" }, 409);

    const email =
      emailRaw ||
      `${username}.kid.${user.id.replace(/-/g, "").slice(0, 10)}@vk-kids.local`;

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        username,
        role: "learner",
        age: age == null || Number.isNaN(age) ? "" : String(age),
        created_by_parent: user.id,
      },
    });
    if (created.error || !created.data.user) {
      return json(
        { error: "create_failed", message: created.error?.message },
        400,
      );
    }

    const childId = created.data.user.id;

    // Ensure learner role + fields (trigger may have run)
    await admin.from("profiles").upsert({
      id: childId,
      display_name: displayName,
      username,
      role: "learner",
      age: age != null && !Number.isNaN(age) ? age : null,
      locale: "ar",
    });

    const { error: linkErr } = await admin.from("family_links").insert({
      parent_id: user.id,
      child_id: childId,
    });
    if (linkErr) {
      return json({ error: "link_failed", message: linkErr.message }, 500);
    }

    return json({
      ok: true,
      child: { id: childId, username, displayName, email },
    });
  } catch (e) {
    return json({ error: "server", message: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
