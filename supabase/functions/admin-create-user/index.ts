// Ops admin creates a student or parent account (service role).
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
    if (userErr || !user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, service);
    const { data: actor } = await admin
      .from("profiles")
      .select("id,role,disabled")
      .eq("id", user.id)
      .maybeSingle();
    if (!actor || actor.role !== "admin" || actor.disabled) {
      return json({ error: "admin_only" }, 403);
    }

    const body = await req.json();
    const displayName = String(body.displayName || "").trim();
    const username = String(body.username || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const phone = String(body.phoneE164 || body.phone || "").trim() || null;
    const roleRaw = String(body.role || "learner").trim().toLowerCase();
    const role = roleRaw === "parent" ? "parent" : "learner";
    const locale = String(body.locale || "ar").trim() || "ar";
    const age =
      body.age == null || body.age === "" ? null : Number(body.age);

    if (
      !displayName ||
      !email ||
      !/^[a-z0-9_]{3,24}$/.test(username) ||
      password.length < 8
    ) {
      return json({ error: "invalid_input" }, 400);
    }

    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (taken) return json({ error: "username_taken" }, 409);

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        username,
        role,
        phone_e164: phone || "",
        age: age == null || Number.isNaN(age) ? "" : String(age),
        locale,
        created_by_admin: user.id,
      },
    });
    if (created.error || !created.data.user) {
      return json(
        { error: "create_failed", message: created.error?.message },
        400,
      );
    }

    const newId = created.data.user.id;
    await admin.from("profiles").upsert({
      id: newId,
      display_name: displayName,
      username,
      role,
      phone_e164: phone,
      age: age != null && !Number.isNaN(age) ? age : null,
      locale,
      disabled: false,
    });

    await admin.from("admin_audit").insert({
      admin_id: user.id,
      action: "create_user",
      target_user_id: newId,
      meta: { role, username, email },
    });

    return json({
      ok: true,
      user: { id: newId, username, displayName, email, role },
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
