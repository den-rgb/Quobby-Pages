import {
  Download,
  GitFork,
  Layers,
  LayoutDashboard,
  Play,
  Search,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    icon: Workflow,
    title: 'Visual Flow Editor',
    description:
      'Build tutorials with a drag-and-drop node editor. Create content steps, add branching logic, and preview the learner experience in real time.',
    color: 'rgba(255, 149, 0, 0.12)',
  },
  {
    icon: Play,
    title: 'Learn by Doing',
    description:
      'Learners follow interactive walkthroughs with comprehension checks, not walls of text. Tutorials adapt with branching logic.',
    color: 'rgba(139, 0, 81, 0.15)',
  },
  {
    icon: Users,
    title: 'Community-Driven',
    description:
      'Anyone can create and publish tutorials. Rate, review, and fork existing tutorials to make them even better.',
    color: 'rgba(184, 255, 107, 0.12)',
  },
  {
    icon: Layers,
    title: 'Any Topic',
    description:
      'Board games, cooking, software, music, DIY — create tutorials for anything. Each category has tools tailored to its needs.',
    color: 'rgba(90, 200, 250, 0.12)',
  },
  {
    icon: Search,
    title: 'Rich Media',
    description:
      'Upload images and videos to each step. Embed diagrams, board layouts, and interactive elements to teach visually.',
    color: 'rgba(255, 214, 10, 0.12)',
  },
  {
    icon: GitFork,
    title: 'Fork & Improve',
    description:
      'See a tutorial that could be better? Fork it, improve it, and publish your version. The best tutorials rise to the top.',
    color: 'rgba(88, 86, 214, 0.12)',
  },
];

const steps = [
  {
    icon: Search,
    title: '1. Pick a Category',
    description: 'Choose from board games, cooking, software, music, and more.',
  },
  {
    icon: LayoutDashboard,
    title: '2. Build the Tutorial',
    description: 'Use the visual editor to create steps, add media, and set up logic.',
  },
  {
    icon: Sparkles,
    title: '3. Publish',
    description: 'Preview your tutorial and publish it for the community.',
  },
];

export default function Home() {
  return (
    <>
      <section className="px-6 pt-24 pb-20 text-center relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(139,0,81,0.08),transparent_70%)] pointer-events-none -z-10" />
        <div className="max-w-[1100px] mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent-glow border border-accent/20 rounded-full text-sm text-accent font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Community-powered tutorials
          </div>
          <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-extrabold text-foreground leading-[1.15] tracking-tight mb-5">
            Teach anything.
            <br />
            <span className="bg-gradient-to-r from-accent to-green bg-clip-text text-transparent">
              Learn by doing.
            </span>
          </h1>
          <p className="text-[clamp(1.05rem,2vw,1.25rem)] text-foreground-muted max-w-[560px] mx-auto mb-10 leading-relaxed">
            Qurator lets the community create interactive tutorials for
            anything — board games, cooking, software, and more. Learn
            through guided, step-by-step walkthroughs.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              href="/tutorials"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-accent text-black font-semibold rounded-[14px] transition-all hover:bg-accent-light hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(139,0,81,0.3)]"
            >
              <Play className="w-5 h-5" />
              Browse Tutorials
            </Link>
            <Link
              href="/create"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-white/[0.06] text-foreground font-semibold rounded-[14px] border border-border transition-all hover:bg-white/10 hover:-translate-y-0.5"
            >
              <Workflow className="w-5 h-5" />
              Create a Tutorial
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-20" id="features">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold text-foreground tracking-tight mb-3">
              Everything you need to teach &amp; learn
            </h2>
            <p className="text-lg text-foreground-muted max-w-[500px] mx-auto">
              A complete platform for creating and following interactive
              tutorials.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-8 bg-card border border-border rounded-2xl transition-all hover:bg-card-hover hover:border-accent/10 hover:-translate-y-1"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: f.color }}
                >
                  <f.icon className="w-6 h-6 text-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-foreground-muted leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold text-foreground tracking-tight mb-3">
              Create a tutorial in minutes
            </h2>
            <p className="text-lg text-foreground-muted max-w-[500px] mx-auto">
              No coding required. Just drag, drop, and teach.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.title} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent-glow border border-accent/20 flex items-center justify-center mx-auto mb-4">
                  <s.icon className="w-7 h-7 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-foreground-muted leading-relaxed">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="max-w-[1100px] mx-auto text-center p-12 md:p-16 bg-gradient-to-br from-green/[0.06] to-accent/[0.04] border border-green/[0.12] rounded-3xl relative overflow-hidden">
          <div className="absolute -top-1/2 right-[-20%] w-[400px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(184,255,107,0.04),transparent_70%)] pointer-events-none" />
          <img
            src="https://www.quobby.com/assets/app-icon.png"
            alt="Quobby"
            className="w-[72px] h-[72px] rounded-2xl mx-auto mb-5 shadow-[0_8px_30px_rgba(184,255,107,0.15)] relative"
          />
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green/10 border border-green/15 rounded-full text-[0.7rem] font-semibold uppercase tracking-wider text-green mb-3 relative">
            Your all-in-one study companion
          </span>
          <h2 className="text-[clamp(1.25rem,3vw,1.75rem)] font-bold text-foreground mb-2 relative">
            Study smarter with Quobby
          </h2>
          <p className="text-foreground-muted mb-4 max-w-[500px] mx-auto relative">
            Flashcards with spaced repetition, Smart vocabulary generation, document scanning, habit tracking, and group study sessions. Free on iOS.
          </p>
          <p className="text-sm font-medium text-green mb-5 relative">
            Browse and follow Qurator tutorials directly in the app
          </p>
          <a
            href="https://www.quobby.com"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-green text-black font-semibold rounded-[14px] transition-all hover:bg-[#d0ff96] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(184,255,107,0.2)] relative"
          >
            <Download className="w-5 h-5" />
            Get Quobby Free
          </a>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="max-w-[1100px] mx-auto text-center p-16 bg-gradient-to-br from-accent/[0.08] to-accent/[0.08] border border-accent/[0.12] rounded-3xl relative overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_center,rgba(139,0,81,0.05),transparent_60%)] pointer-events-none" />
          <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold text-foreground mb-3 relative">
            Ready to teach something?
          </h2>
          <p className="text-lg text-foreground-muted mb-8 relative">
            Join the community and help everyone learn faster.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-accent text-black font-semibold rounded-[14px] transition-all hover:bg-accent-light hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(139,0,81,0.3)] relative"
          >
            <Sparkles className="w-5 h-5" />
            Get Started Free
          </Link>
        </div>
      </section>
    </>
  );
}
