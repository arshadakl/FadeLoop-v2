import {
  checkMetaConfiguration,
  resolveMetaEnvironment,
} from "../packages/worker-common/src/meta/config.ts";

const issues = checkMetaConfiguration(resolveMetaEnvironment(process.env));
if (issues.length) {
  console.error("Meta configuration is incomplete:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.info(
    "Local configuration shape is valid. No Meta calls were made; credentials, API version support, permissions, and subscriptions are NOT verified.",
  );
}
