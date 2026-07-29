import assert from "node:assert/strict";
import test from "node:test";

test("ships the profile and admin routes", async () => {
  const page = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  );
  const admin = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  );
  assert.match(page, /ProfileClient/);
  assert.match(admin, /verifyAdminSession/);
  assert.match(admin, /ADMIN_COOKIE_NAME/);
  assert.match(admin, /AdminPanel/);
});
