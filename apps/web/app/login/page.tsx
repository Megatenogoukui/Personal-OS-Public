"use client";

import { LockKeyhole, Target } from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Enter the private access password for this deployment.");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = (await response.json()) as { message?: string };
    if (!response.ok) {
      setStatus(body.message || "Could not sign in.");
      setLoading(false);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.assign(next?.startsWith("/") ? next : "/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lift">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-white"><Target size={19} /></div>
          <div><div className="font-semibold">Personal OS</div><div className="text-xs text-muted">Private command center</div></div>
        </div>
        <div className="mt-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted"><LockKeyhole size={15} />Private access</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Welcome back.</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{status}</p>
        <form onSubmit={submit} className="mt-6">
          <label className="text-sm font-medium">Password<input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" /></label>
          <button disabled={loading} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Signing in..." : "Open dashboard"}</button>
        </form>
      </section>
    </main>
  );
}
