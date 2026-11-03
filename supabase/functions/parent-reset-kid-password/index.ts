// Parent resets a linked kid's password (service role).
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

    const body = await req.json();
    const childId = String(body.childId || "");
    const password = String(body.password || "");
    if (!childId || password.length < 8) {
      return json({ error: "invalid_input" }, 400);
    }

    const admin = createClient(supabaseUrl, service);
    const { data: link } = await admin
      .from("family_links")
      .select("id")
      .eq("parent_id", user.id)
      .eq("child_id", childId)
      .maybeSingle();
    if (!link) return json({ error: "not_your_child" }, 403);

    const { data: parentProfile } = await admin
      .from("profiles")
      .select("role,disabled")
      .eq("id", user.id)
      .maybeSingle();
    if (parentProfile?.role !== "parent") {
      return json({ error: "parent_only" }, 403);
    }
    if (parentProfile.disabled) {
      return json({ error: "disabled" }, 403);
    }

    const { data: rateOk } = await admin.rpc("consume_rate_limit", {
      p_bucket: `parent_reset:${user.id}`,
      p_max: 15,
      p_window_seconds: 3600,
    });
    if (rateOk === false) {
      return json({ error: "rate_limited" }, 429);
    }

    const upd = await admin.auth.admin.updateUserById(childId, { password });
    if (upd.error) {
      return json({ error: "update_failed", message: upd.error.message }, 400);
    }

    return json({ ok: true });
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
