import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { GooseMark, Wordmark } from "@/components/gosie/Logo";
import { Notice } from "@/components/product/ProductShell";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const register = useRegister();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const mutation = mode === "login" ? login : register;
  const error = mutation.error as (Error & { code?: string; status?: number }) | null;
  const message = submitError || (error ? (
    mode === "register" && (error.status === 403 || /closed|registration|pilot/i.test(`${error.message} ${error.code || ""}`))
      ? "Pilot registration is currently closed. Your details have not been added. Please check back when the pilot opens again."
      : error.message || "We couldn't complete that request. Please try again."
  ) : "");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      if (mode === "register") {
        await register.mutateAsync({ email: email.trim(), password, pilotConsent: consent });
        await login.mutateAsync({ email: email.trim(), password });
      } else await login.mutateAsync({ email: email.trim(), password });
      navigate({ to: "/app" });
    } catch (error) {
      if (mode === "register" && !(register.error)) {
        setSubmitError(error instanceof Error ? error.message : "Your account was created, but sign-in didn't complete. Please sign in.");
      }
    } finally { setSubmitting(false); }
  }
  return <main className="auth-page">
    <div className="auth-top"><a href="/" className="auth-back"><ArrowLeft size={16} /> Gosie home</a><Wordmark tone="forest" /></div>
    <div className="auth-layout">
      <section className="auth-story">
        <div className="auth-art"><div className="auth-sun" /><div className="auth-horizon" /><GooseMark /></div>
        <p className="product-eyebrow">A little help for everything ahead</p>
        <h1>Make space for<br /><em>what matters.</em></h1>
        <p>Your week, your weekend, and a gentler way to hold it all.</p>
      </section>
      <section className="auth-card">
        <p className="product-eyebrow">GOSIE PERSONAL PILOT</p>
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="auth-intro">{mode === "login" ? "Pick up where your week is taking you." : "A small pilot for your plans and priorities."}</p>
        <div className="auth-switch" role="group" aria-label="Account action">
          <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); login.reset(); register.reset(); }}>Sign in</button>
          <button type="button" className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); login.reset(); register.reset(); }}>Create account</button>
        </div>
        {message && <Notice tone="error">{message}</Notice>}
        {mutation.isSuccess && mode === "register" && <Notice tone="success">Your account is ready. Taking you to your space…</Notice>}
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="password">Password</label>
          <div className="password-control">
            <input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
          {mode === "register" && <div className="consent-box">
            <label className="consent-label"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /> <span>I agree to take part in the Gosie pilot and understand its data notice.</span></label>
            <p>Gosie stores your email, password hash, session, plans, preferences, and feedback for this private pilot. Recommendation listings are fictional, and no calendar or live source is connected. You can export profiles or delete your account in preferences. Pilot data will be deleted after the pilot ends; no end date has been set yet. Please do not add sensitive personal information. Invites remain closed until the privacy and release checks are approved.</p>
          </div>}
          <button type="submit" className="product-primary auth-submit" disabled={mutation.isPending || submitting || (mode === "register" && !consent)}>
            {mutation.isPending || submitting ? "One moment…" : mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={17} />
          </button>
          <p className="auth-footnote">{mode === "login" ? "New to the pilot? Create an account to begin." : "Already have a Gosie account? Sign in instead."}</p>
        </form>
      </section>
    </div>
    <p className="auth-legal">Gosie pilot · Your plans belong to you.</p>
  </main>;
}
