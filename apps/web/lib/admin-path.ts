/**
 * Admin console base path — intentionally not linked from student/parent UI.
 * Real access control is `profiles.role === "admin"` + RLS (`is_admin()`).
 */
export const ADMIN_BASE_PATH = "/vk-ops-console";

export function adminHref(sub = ""): string {
  const clean = sub.replace(/^\/+/, "");
  return clean ? `${ADMIN_BASE_PATH}/${clean}` : ADMIN_BASE_PATH;
}
