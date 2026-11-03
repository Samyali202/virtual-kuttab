// Ops admin sets a new password for any non-admin user (service role).
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
    const targetUserId = String(body.userId || "").trim();
    const password = String(body.password || "");
    if (!targetUserId || password.length < 8) {
      return json({ error: "invalid_input" }, 400);
    }
    if (targetUserId === user.id) {
      return json({ error: "cannot_reset_self" }, 400);
    }

    const { data: target } = await admin
      .from("profiles")
      .select("id,role,username,display_name")
      .eq("id", targetUserId)
      .maybeSingle();
    if (!target) return json({ error: "not_found" }, 404);
    if (target.role === "admin") {
      return json({ error: "cannot_reset_admin" }, 403);
    }

    const upd = await admin.auth.admin.updateUserById(targetUserId, {
      password,
    });
    if (upd.error) {
      return json({ error: "update_failed", message: upd.error.message }, 400);
    }

    await admin.from("admin_audit").insert({
      admin_id: user.id,
      action: "reset_password",
      target_user_id: targetUserId,
      meta: { username: target.username },
    });

    return json({
      ok: true,
      user: {
        id: target.id,
        username: target.username,
        displayName: target.display_name,
      },
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
