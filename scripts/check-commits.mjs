import { execFileSync, spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const range = args[0];
if (!range)
  throw new Error("Pass a commit range, for example origin/main..HEAD.");
const commits = execFileSync("git", ["rev-list", range], {
  encoding: "utf8",
}).trim();
for (const sha of commits.split("\n").filter(Boolean)) {
  const message = execFileSync("git", ["show", "-s", "--format=%B", sha], {
    encoding: "utf8",
  });
  const result = spawnSync(
    process.execPath,
    ["node_modules/@commitlint/cli/cli.js"],
    {
      input: message,
      stdio: ["pipe", "inherit", "inherit"],
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
