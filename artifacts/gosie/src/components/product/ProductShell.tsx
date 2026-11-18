import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Compass, LogOut, Settings2, Sparkles, Users } from "lucide-react";
import { GooseMark, Wordmark } from "@/components/gosie/Logo";
import type { ReactNode } from "react";

export function ProductShell({ children, active = "week", email, onSignOut }: {
  children: ReactNode;
  active?: "week" | "weekend" | "community" | "settings";
  email?: string;
  onSignOut?: () => void;
}) {
  const links = [
    { label: "Week Ahead", icon: Compass, key: "week" },
    { label: "Weekend Ahead", icon: Sparkles, key: "weekend" },
    { label: "Communities", icon: Users, key: "community" },
    { label: "My preferences", icon: Settings2, key: "settings" },
  ] as const;
  return <div className="product-shell">
    <aside className="product-rail">
      <Link to="/" className="product-brand" aria-label="Gosie home"><Wordmark tone="forest" /></Link>
      <p className="product-rail-label">YOUR SPACE</p>
      <nav aria-label="Your planning">
        {links.map(({ label, icon: Icon, key }) => <Link key={key} to="/app" search={{ view: key === "week" ? undefined : key } as never} aria-current={active === key ? "page" : undefined} className={`product-nav ${active === key ? "is-active" : ""}`}>
          <Icon size={18} strokeWidth={1.7} /><span>{label}</span>
        </Link>)}
      </nav>
      <div className="product-rail-bottom">
        <div className="product-user-mark" aria-hidden="true">{email?.slice(0, 1).toUpperCase() || "G"}</div>
        <div className="product-user-copy"><strong>{email || "Your Gosie"}</strong><span>Personal pilot</span></div>
        {onSignOut && <button className="icon-button" type="button" onClick={onSignOut} aria-label="Sign out"><LogOut size={17} /></button>}
      </div>
    </aside>
    <header className="product-mobile-head">
      <Link to="/" aria-label="Gosie home"><Wordmark tone="forest" /></Link>
      {onSignOut ? <button className="text-button" type="button" onClick={onSignOut}><LogOut size={17} /> Sign out</button> : <span className="mobile-avatar"><GooseMark /></span>}
    </header>
    <main className="product-main">{children}</main>
    <nav className="product-bottom-nav" aria-label="Planning sections">
      {links.map(({ label, icon: Icon, key }) => <Link key={key} to="/app" search={{ view: key === "week" ? undefined : key } as never} aria-current={active === key ? "page" : undefined} className={active === key ? "is-active" : ""}>
        <Icon size={19} /><span>{label === "My preferences" ? "Profile" : label === "Communities" ? "Community" : label.replace(" Ahead", "")}</span>
      </Link>)}
    </nav>
    <a className="product-back-home" href="/"><span>About Gosie</span><ArrowUpRight size={14} /></a>
  </div>;
}

export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="product-heading"><p className="product-eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <div className="product-subhead">{children}</div>}</div>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) {
  return <div className={`product-notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
