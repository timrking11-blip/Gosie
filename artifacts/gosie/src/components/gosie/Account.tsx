import { useEffect, useState } from "react";
import { api, describeError, type Me, type Profile } from "@/lib/api";

const field = "w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm text-ink";
const button = "inline-flex items-center justify-center rounded-full bg-forest px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-ink disabled:opacity-60";

// Working (non-demo) functionality: real accounts and saved profiles. Renders nothing unless the API answers.
export function Account() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await api.isAvailable();
      if (cancelled) return;
      setAvailable(ok);
      if (!ok) return;
      try {
        const m = await api.me();
        if (!cancelled) setMe(m);
      } catch {
        /* not signed in */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;
  return (
    <section id="account" aria-labelledby="account-title" className="scroll-mt-16 bg-sage/30">
      <div className="mx-auto max-w-3xl px-5 py-20">
        <p className="text-xs uppercase tracking-widest text-forest">Early access · working feature</p>
        <h2 id="account-title" className="mt-3 font-serif text-3xl text-ink">Your Gosie</h2>
        <p className="mt-3 text-sm text-ink/70">Create an account to save your own planning profiles. This is real, saved data (unlike the illustrative previews above). No calendar is connected.</p>
        {me ? <Profiles me={me} onSignOut={() => setMe(null)} /> : <SignIn onSignedIn={setMe} />}
      </div>
    </section>
  );
}

function SignIn({ onSignedIn }: { onSignedIn: (m: Me) => void }) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register") await api.register(email, password);
      await api.login(email, password);
      onSignedIn(await api.me());
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 max-w-sm space-y-4" aria-label={mode === "signin" ? "Sign in" : "Create account"}>
      <label className="block text-sm text-ink">Email
        <input className={field} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block text-sm text-ink">Password
        <input className={field} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-4">
        <button type="submit" className={button} disabled={busy}>{mode === "signin" ? "Sign in" : "Create account"}</button>
        <button type="button" className="text-sm text-forest underline" onClick={() => { setMode(mode === "signin" ? "register" : "signin"); setError(""); }}>
          {mode === "signin" ? "Need an account?" : "Have an account?"}
        </button>
      </div>
    </form>
  );
}

function Profiles({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [demos, setDemos] = useState<Profile[]>([]);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setProfiles(await api.listProfiles());
    } catch (e) {
      setError(describeError(e));
    }
  }
  useEffect(() => {
    void refresh();
    api.demoProfiles().then(setDemos).catch(() => setDemos([]));
  }, []);

  async function addFrom(d: Profile) {
    setError("");
    try {
      await api.createProfile(me.csrf_token, `${d.title.split(" — ")[0]}'s plan`, d.config);
      await refresh();
    } catch (e) {
      setError(describeError(e));
    }
  }
  async function remove(p: Profile) {
    setError("");
    try {
      await api.deleteProfile(me.csrf_token, p.id);
      await refresh();
    } catch (e) {
      setError(describeError(e));
    }
  }
  async function signOut() {
    try {
      await api.logout(me.csrf_token);
    } finally {
      onSignOut();
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink">Signed in as <strong>{me.email}</strong></p>
        <button type="button" className="text-sm text-forest underline" onClick={signOut}>Sign out</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <h3 className="mt-8 font-serif text-xl text-ink">Your saved profiles</h3>
      {profiles === null ? (
        <p className="mt-2 text-sm text-ink/70">Loading…</p>
      ) : profiles.length === 0 ? (
        <p className="mt-2 text-sm text-ink/70">No profiles yet. Start from a template below.</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 py-3 text-sm text-ink">
              <span>{p.title}</span>
              <button type="button" className="text-forest underline" onClick={() => remove(p)} aria-label={`Delete ${p.title}`}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      {demos.length > 0 && (
        <>
          <h3 className="mt-8 font-serif text-xl text-ink">Start from a template</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {demos.map((d) => (
              <button key={d.id} type="button" className={button} onClick={() => addFrom(d)}>{d.title}</button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink/60">Templates are fictional examples. Editing preferences is coming next.</p>
        </>
      )}
    </div>
  );
}
