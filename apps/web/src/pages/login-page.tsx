import { Link, Navigate } from "react-router-dom";
import { LoginForm } from "../features/auth/components/login-form";
import { useOwner } from "../features/auth/hooks/use-owner";

export default function LoginPage() {
  const { session } = useOwner();

  if (session.data) {
    return <Navigate to="/campaigns" replace />;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12 font-sans">
      <Link to="/" className="mb-8 text-lg font-bold text-foreground">
        FadeLoop
      </Link>
      <section
        aria-labelledby="login-title"
        className="rounded border border-border bg-card p-6 md:p-8 shadow-xs"
      >
        <h1
          id="login-title"
          className="text-balance text-2xl font-bold text-foreground"
        >
          Welcome back
        </h1>
        <p className="mb-8 mt-3 text-pretty text-muted-foreground text-sm">
          Sign in to your owner workspace.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
