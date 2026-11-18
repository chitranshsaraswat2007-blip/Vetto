import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Sign in",
  description: "A clearer path from brand guidance to confident content reviews.",
};

const reviewSteps = [
  { number: "01", title: "Bring it in", text: "Images and documents arrive with their source and brand context attached." },
  { number: "02", title: "Read the signals", text: "Text, visuals, and active brand rules become clear, traceable findings." },
  { number: "03", title: "Make the call", text: "Creators, Managers, and assigned Supervisors each get the right next step." },
];

export default function LoginPage() {
  return (
    <main id="top" className="login-story">
      <a className="skip-link" href="#sign-in">Skip to sign in</a>
      <header className="login-nav">
        <BrandMark href="/login" className="w-fit" />
        <nav aria-label="Login page" className="flex items-center gap-2 sm:gap-5">
          <a href="#how-it-works" className="hidden text-xs font-medium text-ink-soft transition-colors hover:text-ink sm:inline">How it works</a>
          <Link href="#sign-in" className="login-nav-cta">Open workspace <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>

      <section className="login-hero" aria-labelledby="hero-title">
        <div className="login-hero-grid" aria-hidden="true" />
        <div className="login-hero-copy" data-scroll-reveal>
          <p className="login-overline"><span className="login-pulse" /> BRAND CONTENT INTELLIGENCE</p>
          <h1 id="hero-title">Make every<br /><em>creative</em> count.</h1>
          <p className="login-hero-description">Move from a bold first draft to a confident decision. VETTO keeps brand context, evidence, and the human review in one connected place.</p>
          <div className="login-hero-actions">
            <Link href="#how-it-works" className="login-button-primary">Explore the workflow <span aria-hidden="true">↓</span></Link>
            <span className="login-hero-caption">A sharper process for work that carries your name.</span>
          </div>
        </div>

        <div className="login-orbit-scene" aria-label="Illustration of brand content moving through analysis and review">
          <div className="login-orbit orbit-one" />
          <div className="login-orbit orbit-two" />
          <div className="login-sun-disc"><span>V</span></div>
          <div className="login-bean-shape"><i /></div>
          <div className="login-orbit-label orbit-label-top"><span>01 / EVIDENCE</span><b>Every signal has a source</b></div>
          <div className="login-orbit-label orbit-label-bottom"><span>02 / HUMAN REVIEW</span><b>People make the final call</b></div>
          <div className="login-orbit-dot orbit-dot-a" />
          <div className="login-orbit-dot orbit-dot-b" />
          <div className="login-scroll-stamp">SCROLL TO SEE<br />THE WHOLE PICTURE ↓</div>
        </div>
      </section>

      <section id="how-it-works" className="login-workflow" aria-labelledby="workflow-title">
        <div className="login-workflow-heading" data-scroll-reveal>
          <p className="login-overline">FROM FIRST LOOK TO FINAL CALL</p>
          <h2 id="workflow-title">One clear view.<br /><em>Fewer blind spots.</em></h2>
          <p>Good creative moves fast. The brand context and review trail should keep up.</p>
        </div>
        <div className="login-workflow-visual" data-scroll-reveal>
          <div className="login-visual-header"><span>CONTENT SIGNAL MAP</span><span className="live-mark">● LIVE WORKFLOW</span></div>
          <div className="signal-canvas">
            <div className="signal-file"><div className="signal-file-art"><span className="signal-art-sun"/><span className="signal-art-bean"/><span className="signal-art-word">AURELIA</span></div><span className="signal-file-label">CAMPAIGN / SUMMER 04</span></div>
            <div className="signal-line signal-line-a"><span /></div>
            <div className="signal-node signal-node-a"><span>01</span><b>Extract</b><small>Text + visual cues</small></div>
            <div className="signal-line signal-line-b"><span /></div>
            <div className="signal-node signal-node-b"><span>02</span><b>Compare</b><small>Rules + identity</small></div>
            <div className="signal-line signal-line-c"><span /></div>
            <div className="signal-node signal-node-c"><span>03</span><b>Review</b><small>Decision + history</small></div>
          </div>
          <div className="login-visual-footer"><span>TRACEABLE BY DESIGN</span><span>01 — 03</span></div>
        </div>
      </section>

      <section className="login-principles" aria-label="VETTO review principles">
        <div className="login-principles-head" data-scroll-reveal><span>THE VETTO METHOD</span><p>Clarity at each handoff, with the detail to back it up.</p></div>
        <div className="login-principle-grid">
          {reviewSteps.map((step) => (
            <article className="login-principle" key={step.number} data-scroll-reveal>
              <span className="principle-number">{step.number}</span>
              <div className="principle-mark" aria-hidden="true"><span>{step.number === "01" ? "↗" : step.number === "02" ? "◉" : "✓"}</span></div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="sign-in" className="login-entry" aria-labelledby="entry-title">
        <div className="login-entry-aside" data-scroll-reveal>
          <p className="login-overline">YOUR WORKSPACE STARTS HERE</p>
          <h2 id="entry-title">The next move<br /><em>is yours.</em></h2>
          <p>Choose your role, sign in, and pick up exactly where the work needs you.</p>
          <div className="entry-proof"><span>01</span><span>Brand memory</span><i /> <span>02</span><span>Human judgment</span></div>
          <aside className="mt-7 max-w-md rounded-xl border border-line bg-surface/70 p-4" aria-label="Judge demo login">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Demo use for judges</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-[11px] text-ink-muted">Admin email</dt>
                <dd className="font-medium text-ink">admin@vetto.test</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-muted">Password</dt>
                <dd className="break-all font-mono text-xs text-ink">fy2232b3rfhnf4u5h98fj4i5f3eewe5</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] leading-5 text-ink-muted">Shared demo account for evaluation only.</p>
          </aside>
          <BrandMark href="/login" className="mt-auto hidden w-fit opacity-75 sm:block" />
        </div>
        <div className="login-entry-panel" data-scroll-reveal>
          <LoginClient />
        </div>
      </section>

      <footer className="login-footer">
        <span className="login-footer-caption">BRAND CONTENT INTELLIGENCE · MADE FOR BETTER REVIEWS</span>
        <BrandMark href="/login" className="login-footer-logo" />
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
