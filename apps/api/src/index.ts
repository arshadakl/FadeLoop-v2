import {
  isConfiguredEnvironment,
  type WorkerEnvironment,
} from "@fadeloop/worker-common/environment";
import { healthResponse, unavailable } from "@fadeloop/worker-common/http";

export default {
  fetch(request: Request, env: WorkerEnvironment): Response {
    if (!isConfiguredEnvironment(env)) return unavailable();
    if (
      request.method === "GET" &&
      new URL(request.url).pathname === "/api/health"
    )
      return healthResponse("api");
    return unavailable();
  },
} satisfies ExportedHandler<WorkerEnvironment>;
