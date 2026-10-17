'use client';

import Link from 'next/link';
import { ArrowRight, Search, FileText, GitCompare, Network, Library, Bell, Shield, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Logo className="h-9 w-9 text-accent" />
            <span className="text-lg font-bold tracking-tight">ResearchFlow</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How it works</Link>
            <Link href="#privacy" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero-pattern">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Find, analyze, and organize
              <span className="block text-accent">research papers in one place</span>
            </h1>
            <p className="mt-6 text-balance text-lg text-muted-foreground sm:text-xl">
              Search across millions of scholarly works, upload PDFs for structured
              extraction, compare studies side-by-side, and build your literature review
              — all in a single academic workspace.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Start researching <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>

          {/* Search preview */}
          <div className="mx-auto mt-16 max-w-2xl">
            <div className="rounded-xl border bg-card p-2 shadow-lg">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
                <Search className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Try: &quot;transformer architectures for language understanding&quot;
                </span>
              </div>
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Search across OpenAlex, arXiv, Crossref, and a local database — over 250 million scholarly works
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the full research workflow
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From your first literature search to a structured review matrix —
              the tools you need at each stage of your project.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Search, title: 'Paper Discovery', desc: 'Search scholarly databases with keyword-based relevance ranking. Filter by year, publication type, and open access status.' },
              { icon: FileText, title: 'PDF Analysis', desc: 'Upload PDFs and extract text in your browser. Get structured summaries of methodology, findings, and limitations.' },
              { icon: GitCompare, title: 'Side-by-Side Comparison', desc: 'Compare two to four papers across key dimensions. Export to CSV for your literature review.' },
              { icon: Network, title: 'Citation Explorer', desc: 'Browse citation networks and discover related papers through an interactive graph view.' },
              { icon: Library, title: 'Literature Review Matrix', desc: 'Build a structured matrix of papers across research fields. Sort, search, take notes, and export.' },
              { icon: Bell, title: 'Topic Alerts', desc: 'Save research topics and check for newly published papers matching your interests.' },
            ].map((f) => (
              <Card key={f.title} className="group relative overflow-hidden border-border/60 transition-all hover:shadow-md">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-border/60 bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From research question to literature review in four steps.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-4">
            {[
              { step: '01', icon: Search, title: 'Search', desc: 'Enter a research topic or question. ResearchFlow queries OpenAlex and ranks results by keyword relevance.' },
              { step: '02', icon: BookOpen, title: 'Analyze', desc: 'Save papers, upload PDFs, and get structured summaries with evidence-backed answers to your questions.' },
              { step: '03', icon: GitCompare, title: 'Compare', desc: 'Select papers for side-by-side comparison. Identify research gaps and export your findings.' },
              { step: '04', icon: Library, title: 'Organize', desc: 'Build reading lists, take notes, and create your literature review matrix for your thesis.' },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-bold text-muted-foreground">{s.step}</span>
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 text-success">
              <Shield className="h-6 w-6" />
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight">Grounded in real data, private by design</h2>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Every search result, citation link, and analysis output is grounded in real
              metadata from scholarly sources. Your uploaded PDFs are stored privately in
              your account and isolated from other users.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                'No fabricated citation counts',
                'Private PDF storage with RLS',
                'Transparent ranking explanations',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3">
                  <Shield className="h-4 w-4 text-success shrink-0" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 bg-primary py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground">
            Start your literature review today
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/70">
            Free to use. No API keys required. Built for academic research projects.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Create an account <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="ghost" className="w-full text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2.5">
              <Logo className="h-8 w-8 text-accent" />
              <span className="font-bold">ResearchFlow</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
              <Link href="#how-it-works" className="hover:text-foreground transition-colors">How it works</Link>
              <Link href="#privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Academic Research Tool
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
