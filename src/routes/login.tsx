import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import { Button, PriorityBadge, TextField } from "@/components/ui";

const BOTS = ["SEO Lead", "Technical Auditor", "On-Page", "Content Writer", "Off-Page", "AI Search", "Local SEO"];

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "That email and password don't match. Check both, or ask an admin to reset your password." : error.message);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <Showcase />

      <div className="flex flex-col justify-center bg-surface px-6 py-12 sm:px-12">
        <form onSubmit={submit} className="mx-auto w-full max-w-sm">
          <p className="text-[13px] font-medium text-denim">AheadTech360</p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.02em]">Sign in to the control center</h1>
          <p className="mt-2 mb-7 text-ink-2">Review what the bots drafted, unblock them, and keep every client's accounts in one place.</p>
          <div className="flex flex-col gap-4">
            <TextField label="Work email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            {error ? (
              <p role="alert" className="rounded-md bg-p1-soft px-3 py-2 text-p1">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="primary" busy={busy} className="h-10">
              Sign in
            </Button>
          </div>
          <p className="mt-6 text-[13px] text-ink-2">Accounts are created by an admin. Ask yours for access or a password reset.</p>
        </form>
      </div>
    </div>
  );
}

/** Left panel: denim twill with the review queue the team works in. Decorative, hidden from screen readers. */
function Showcase() {
  return (
    <div aria-hidden className="twill relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
      <div className="relative z-10 px-12 pt-12">
        <p className="max-w-[18ch] text-[40px] leading-[1.05] font-semibold tracking-[-0.025em] text-white">
          Seven bots do the SEO work. Your team signs off.
        </p>
      </div>

      <div className="relative z-10 mx-12 my-10 h-[312px]">
        {/* Back cards */}
        <div className="absolute inset-x-12 top-0 rotate-[-1.5deg] rounded-lg bg-[#dfe3f1] px-5 pt-3.5 pb-10 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.6)]">
          <div className="flex items-center gap-2">
            <PriorityBadge p="p1" />
            <span className="text-[13px] text-ink-2">Local SEO</span>
          </div>
          <p className="mt-1.5 font-medium text-ink">Google Business Profile needs a verification code</p>
        </div>
        <div className="absolute inset-x-6 top-[74px] rotate-[1deg] rounded-lg bg-[#eef0f7] px-5 pt-3.5 pb-10 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.6)]">
          <div className="flex items-center gap-2">
            <PriorityBadge p="p3" />
            <span className="text-[13px] text-ink-2">Off-Page</span>
          </div>
          <p className="mt-1.5 font-medium text-ink">Pitch ready for a home and style editor</p>
        </div>
        {/* Front card: a draft, set like a proof */}
        <div className="absolute inset-x-0 top-[148px] rounded-lg bg-white px-6 py-5 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.7)]">
          <div className="flex items-center gap-2">
            <PriorityBadge p="p2" />
            <span className="text-[13px] text-ink-2">Content Writer, blog post</span>
          </div>
          <p className="mt-3 font-[family-name:var(--font-proof)] text-[22px] leading-tight text-ink">How to wash linen so it gets softer every time</p>
          <p className="mt-2 max-w-[52ch] font-[family-name:var(--font-proof)] text-[15px] leading-relaxed text-ink-2">
            Linen softens with every wash, as long as you treat it right. Use a gentle cycle and leave out the fabric softener…
          </p>
          <span className="stamp absolute top-4 right-5 rounded-md border-2 border-ok px-2.5 py-0.5 text-[13px] font-semibold text-ok">Approved</span>
        </div>
      </div>

      <ul className="relative z-10 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/15 px-12 py-5 text-[13px] text-white/70">
        {BOTS.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

export function ServerUnreachable() {
  const { meError, retryMe } = useSession();
  const api = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8080/api/v1";
  const status = meError instanceof ApiError ? meError.status : null;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <Showcase />
      <div className="flex flex-col justify-center bg-surface px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">
            {status ? "The server had a problem loading your account" : "Can't reach the Atelier server"}
          </h1>
          <p className="mt-3 text-ink-2">
            {status ? (
              <>The server answered with an error ({status}). Check the backend terminal for details, then try again.</>
            ) : (
              <>
                You're signed in, but the backend at <code className="rounded bg-sunken px-1 text-[13px]">{api}</code> isn't answering. Start it with{" "}
                <code className="rounded bg-sunken px-1 text-[13px]">cargo run -p seo-server</code> in atelier-backend, then try again.
              </>
            )}
          </p>
          <div className="mt-6 flex gap-2">
            <Button variant="primary" onClick={retryMe}>
              Try again
            </Button>
            <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotOnTeam() {
  const { me } = useSession();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <Showcase />
      <div className="flex flex-col justify-center bg-surface px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">You're signed in, but not on the team yet</h1>
          <p className="mt-3 text-ink-2">
            Ask an admin to add <span className="font-medium text-ink">{me?.email}</span> in Settings, under Team. Then reload this page.
          </p>
          <Button className="mt-6" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
