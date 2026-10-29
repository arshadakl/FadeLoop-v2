export interface WorkerEnvironment {
  APP_ENV: string;
}

export function isConfiguredEnvironment(env: WorkerEnvironment): boolean {
  return (
    env.APP_ENV === "local" ||
    env.APP_ENV === "test" ||
    env.APP_ENV === "production"
  );
}
