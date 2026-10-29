import { Link } from "react-router-dom";
import { LoginForm } from "../features/auth/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
      <Link to="/" className="mb-8 text-lg font-bold">
        FadeLoop
      </Link>
      <section
        aria-labelledby="login-title"
        className="rounded-md border border-border bg-card p-6 md:p-8"
      >
        <h1 id="login-title" className="text-balance text-2xl font-bold">
          Welcome back
        </h1>
        <p className="mb-8 mt-3 text-pretty text-muted-foreground">
          Sign in to your owner workspace.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
