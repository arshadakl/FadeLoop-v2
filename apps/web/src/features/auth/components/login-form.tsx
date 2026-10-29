import { type LoginInput, loginInputSchema } from "@fadeloop/contracts/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { APIError } from "../../../api/client";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useOwner } from "../hooks/use-owner";

function loginError(error: unknown): string {
  if (error instanceof APIError && error.status === 401)
    return "Unable to sign in with those credentials.";
  if (error instanceof APIError && error.status === 429)
    return "Too many attempts. Please wait before trying again.";
  return "Sign-in is unavailable. Check the owner authentication setup and try again.";
}

export function LoginForm() {
  const { login } = useOwner();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: "", password: "" },
  });
  async function onSubmit(input: LoginInput) {
    try {
      await login.mutateAsync(input);
      reset();
      navigate("/");
    } catch {
      /* The mutation error is rendered next to the form. */
    }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="email">Email</label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="password">Password</label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>
      {login.isError && (
        <p role="alert" className="text-sm text-destructive">
          {loginError(login.error)}
        </p>
      )}
      <Button type="submit" disabled={login.isPending} className="w-full">
        {login.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
