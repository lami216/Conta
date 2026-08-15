import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production entry points use Node, PM2, and MongoDB", async () => {
  const [pkg, ecosystem, deployment] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../ecosystem.config.cjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/deploy.sh", import.meta.url), "utf8"),
  ]);
  assert.equal(JSON.parse(pkg).scripts.start, "node scripts/start.mjs");
  assert.match(ecosystem, /name: "Conta"/);
  assert.match(deployment, /NEXT_DIST_DIR=.next-candidate npm run build/);
  assert.match(deployment, /pm2 reload ecosystem\.config\.cjs/);
});

test("example environment binds the application to loopback", async () => {
  const env = await readFile(new URL("../.env.production.example", import.meta.url), "utf8");
  assert.match(env, /^MONGODB_URI=/m);
  assert.match(env, /^HOSTNAME=127\.0\.0\.1$/m);
});
