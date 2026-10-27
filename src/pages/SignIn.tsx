import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";
import { useDb } from "../context/DbContext";
import { useToast } from "../context/ToastContext";

export function SignIn() {
  const { session, loading, signIn } = useAuth();
  const { ready, error: dbError } = useDb();
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!loading && session) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      variant="signin"
      title="Welcome back"
      subtitle="Sign in to the counter"
      footer={
        <>
          Need an account?{" "}
          <Link to="/signup" className="font-medium text-primary-600 hover:text-primary-500">
            Create account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="input-field"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              className="input-field pr-10"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 px-3 text-gray-500"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {(error || dbError) && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error || dbError}
          </p>
        )}
        {!ready && !dbError && <p className="text-sm text-slate-500">Opening the ledger…</p>}
        <button className="btn-primary w-full py-3" type="submit" disabled={busy || !ready || Boolean(dbError)}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-slate-500">Or continue with</span>
        </div>
      </div>
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
        onClick={() => push("Google sign-in is not available in this local shop build.", "error")}
      >
        <img src="https://www.google.com/favicon.ico" alt="" className="h-4 w-4" />
        Continue with Google
      </button>
    </AuthShell>
  );
}
