// Access-key login for Run It Back. Keys are hand-minted and distributed
// out-of-band; there is no self-service signup.
import { useState } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [key, setKey] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const dest = location.state?.from?.pathname || "/run-it-back";

  // Already logged in? Skip the form.
  if (user) return <Navigate to={dest} replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(key.trim());
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold text-white mb-1">Run It Back</h1>
      <p className="text-gray-400 mb-6 text-sm">
        Enter your access key to manage your decks and play. Keys are
        invite-only — ask the site admin if you need one.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Access key</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="srg_…"
            autoFocus
            className="w-full rounded border border-gray-700 bg-srgGray px-3 py-2 text-gray-100 font-mono"
          />
        </div>
        {error && (
          <div className="rounded border border-rose-600 bg-rose-950/60 p-2 text-sm text-rose-200">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || !key.trim()}
          className="rounded bg-srgPurple px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-gray-400">
        No key?{" "}
        <Link to="/run-it-back/public" className="text-srgPurple hover:underline">
          Browse public games
        </Link>{" "}
        — no login needed.
      </p>
    </div>
  );
}
