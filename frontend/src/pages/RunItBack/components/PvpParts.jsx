// Small shared bits for the PvP screens: a page shell (title + back link) and the
// labelled form controls the create/join forms use. Kept tiny and local so each
// PvP page stays a thin render.
import { Link } from "react-router-dom";

export function Shell({ title, children }) {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <Link to="/run-it-back/pvp" className="text-sm text-gray-400 hover:text-srgPurple">
          ← Two-player games
        </Link>
      </div>
      {children}
    </div>
  );
}

export function ErrorBanner({ children }) {
  if (!children) return null;
  return (
    <div className="rounded border border-rose-600 bg-rose-950/60 p-2 text-sm text-rose-200">
      {children}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-400">{label}</span>
      {children}
    </label>
  );
}

export function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-gray-100"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
