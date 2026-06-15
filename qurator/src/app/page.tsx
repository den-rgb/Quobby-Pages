import {
  ChevronDown,
  Download,
  Film,
  Gamepad2,
  GitFork,
  HelpCircle,
  Layers,
  LayoutDashboard,
  Link2,
  Play,
  Scissors,
  Search,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { getPublishedCatalog, type PublishedCatalog } from '@/lib/seo';

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
      'Board games, cooking, software, music, DIY - create tutorials for anything. Each category has tools tailored to its needs.',
    color: 'rgba(90, 200, 250, 0.12)',
  },
  {
    icon: Film,
    title: 'Smart Video',
    description:
      'Upload video files up to 1 GB, or paste a YouTube, Vimeo, or direct video link. The built-in processor compresses oversized uploads. Premium users can split long videos into segments, each automatically becoming its own tutorial step.',
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
    description: 'Use the visual editor to create steps, add images, videos, or video links, and set up logic. Long videos are automatically split and compressed.',
  },
  {
    icon: Sparkles,
    title: '3. Publish',
    description: 'Preview your tutorial and publish it for the community.',
  },
];

const faqs = [
  {
    question: 'What is Qurator and how does it work?',
    answer:
      'Qurator is a free, community-driven platform for creating and following interactive, step-by-step tutorials on any topic. You build tutorials with a visual drag-and-drop flow editor that supports branching logic, comprehension quizzes, video, images, code blocks, and board game visualisations. Learners follow guided walkthroughs rather than reading static text.',
  },
  {
    question: 'Is Qurator free to use?',
    answer:
      'Yes. Creating and following tutorials is completely free. A Premium subscription adds advanced features like video splitting, analytics, and higher upload limits, but the core experience costs nothing.',
  },
  {
    question: 'What topics can I create tutorials for?',
    answer:
      'Anything. Qurator supports categories including Board Games, Cooking, DIY & Crafts, Software, Music, Sports, and Science. Each category has tools tailored to its needs - for example, board game tutorials get a built-in hex and grid board designer.',
  },
  {
    question: 'Can I embed Qurator tutorials on my website or blog?',
    answer:
      'Yes. Every published tutorial has an embed code you can copy and paste into any website. Tutorials are embedded as responsive iframes, or you can use the auto-resizing JavaScript embed script for a seamless fit.',
  },
  {
    question: 'How does branching logic work in tutorials?',
    answer:
      'The visual flow editor lets you connect steps with conditional branches. Learners can choose different paths based on their answers, skill level, or preferences - making each tutorial a personalised experience instead of a linear walkthrough.',
  },
  {
    question: 'Can I create cooking or recipe tutorials on Qurator?',
    answer:
      'Absolutely! Qurator is great for cooking and recipe tutorials. You can add step-by-step instructions, embed cooking videos or YouTube links, include ingredient checklists, and use branching logic for recipe variations (e.g. "vegetarian version" vs "with meat"). The visual editor makes it easy to create guides that anyone can follow along with in the kitchen.',
  },
  {
    question: 'What board game tutorials are available on Qurator?',
    answer:
      'Qurator has interactive how-to-play tutorials for many popular board games. Each tutorial includes setup instructions, rules explanations with branching paths, strategy tips, custom board visualisations, and comprehension quizzes. New tutorials are added by the community regularly.',
  },
  {
    question: 'What is Quobby and how does it relate to Qurator?',
    answer:
      'Quobby is a free mobile study companion app featuring flashcards with spaced repetition, document scanning, handwritten notes, habit tracking, a focus timer, and group study sessions. Qurator is built by the same team and is integrated into the Quobby app - users can browse and follow Qurator tutorials directly from their phone.',
  },
];

const popularGames = [
  { name: 'Catan', emoji: '🏝️', tutorialId: '00000000-0000-4000-a000-000000000001' },
  { name: 'Wingspan', emoji: '🐦', tutorialId: '00000000-0000-4000-a000-000000000002' },
  { name: 'Ark Nova', emoji: '🦁', tutorialId: 'eeb1167f-3163-4095-98e3-caf6b226d494' },
  { name: 'Azul', emoji: '🎨', tutorialId: '78b43f56-5109-48d8-aded-b90fe15af1d4' },
  { name: 'Ticket to Ride', emoji: '🚂', tutorialId: '41ac2e6a-a1ac-4441-b134-677e5e1199ee' },
  { name: '7 Wonders', emoji: '🏛️', tutorialId: '8208b7d8-5aa4-439e-bec1-75d7839d87d0' },
  { name: 'Pandemic', emoji: '🦠', tutorialId: 'abe98a8e-2fe2-47d8-afbe-3c9b96c460f5' },
  { name: 'Sky Team', emoji: '✈️', tutorialId: '296c606b-62ac-4078-9096-ce3c81129738' },
  { name: 'Codenames', emoji: '🕵️', tutorialId: '00000000-0000-4000-a000-000000000003' },
  { name: 'Gaia Project', emoji: '🪐', tutorialId: '7ecd7090-4084-4a6a-8da2-e09ccc263cc8' },
];

function withCatalogFaqs(catalog: PublishedCatalog) {
  const gameNames = catalog.games.slice(0, 15).map((g) => g.title);
  const recipeNames = catalog.recipes.slice(0, 8).map((r) => r.title);
  return faqs.map((f) => {
    if (f.question === 'What board game tutorials are available on Qurator?' && gameNames.length > 0) {
      return {
        ...f,
        answer: `Qurator has interactive how-to-play tutorials for ${gameNames.join(', ')}, and more. Each tutorial includes setup instructions, rules explanations with branching paths, strategy tips, custom board visualisations, and comprehension quizzes. New tutorials are added by the community regularly.`,
      };
    }
    if (f.question === 'Can I create cooking or recipe tutorials on Qurator?' && recipeNames.length > 0) {
      return {
        ...f,
        answer: `${f.answer} Published recipe tutorials include ${recipeNames.join(', ')}.`,
      };
    }
    return f;
  });
}

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://qurator.quobby.com',
    },
  ],
};

export default async function Home() {
  const catalog = await getPublishedCatalog();
  const pageFaqs = withCatalogFaqs(catalog);
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pageFaqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };

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
            anything - board games, cooking, software, and more. Learn
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
        <div className="max-w-[700px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold text-foreground tracking-tight mb-3">
              Everything you need to teach &amp; learn
            </h2>
            <p className="text-lg text-foreground-muted max-w-[500px] mx-auto">
              A complete platform for creating and following interactive
              tutorials.
            </p>
          </div>
          <div className="space-y-3">
            {features.map((f) => (
              <details
                key={f.title}
                className="group bg-card border border-border rounded-2xl transition-all hover:bg-card-hover hover:border-accent/10 overflow-hidden"
              >
                <summary className="flex items-center gap-4 px-6 py-5 list-none [&::-webkit-details-marker]:hidden">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: f.color }}
                  >
                    <f.icon className="w-5 h-5 text-foreground" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground flex-1">
                    {f.title}
                  </h3>
                  <svg
                    className="w-5 h-5 text-foreground-faint transition-transform duration-200 group-open:rotate-180 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-5 pt-0 ml-14">
                  <p className="text-sm text-foreground-muted leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="max-w-[1100px] mx-auto">
          <div className="p-8 md:p-12 bg-gradient-to-br from-yellow-500/[0.04] to-accent/[0.04] border border-yellow-500/[0.1] rounded-3xl relative overflow-hidden">
            <div className="absolute -top-1/2 right-[-20%] w-[400px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(255,214,10,0.04),transparent_70%)] pointer-events-none" />
            <div className="flex flex-col md:flex-row items-center gap-8 relative">
              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/15 rounded-full text-[0.7rem] font-semibold uppercase tracking-wider text-yellow-400 mb-4">
                  Built-in video processor
                </div>
                <h2 className="text-[clamp(1.25rem,3vw,1.75rem)] font-bold text-foreground mb-3">
                  Drop a video or paste a link
                </h2>
                <p className="text-foreground-muted leading-relaxed mb-5 max-w-lg">
                  Upload a video file or paste a YouTube, Vimeo, or direct MP4 link. The in-browser processor compresses uploads to fit, or splits them at timestamps you choose - each segment becomes a linked tutorial step automatically.
                </p>
                <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                  <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                    <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                      <Film className="w-3.5 h-3.5 text-yellow-400" />
                    </div>
                    Videos up to 1 GB
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                    <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Scissors className="w-3.5 h-3.5 text-accent" />
                    </div>
                    Timeline-based splitting
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Link2 className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    YouTube &amp; video links
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                    <div className="w-7 h-7 rounded-lg bg-green/10 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-green" />
                    </div>
                    Auto-linked steps
                  </div>
                </div>
              </div>
              <div className="w-full md:w-[280px] shrink-0">
                <div className="bg-[#16162a] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-foreground-muted">
                    <Film className="w-3.5 h-3.5 text-accent" />
                    <span className="font-medium text-foreground">Process Video</span>
                  </div>
                  <div className="flex gap-1 bg-white/10 rounded-lg p-0.5">
                    <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium text-foreground-muted">
                      Compress
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-accent/20 rounded-md text-[10px] font-medium text-accent">
                      Split &amp; Distribute
                    </div>
                  </div>
                  <div className="relative h-6 bg-white/10 rounded-md overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-[35%] bg-accent/15" />
                    <div className="absolute inset-y-0 left-[35%] w-[40%] bg-green/15" />
                    <div className="absolute inset-y-0 left-[75%] right-0 bg-accent/15" />
                    <div className="absolute inset-y-0 w-px bg-red-400" style={{ left: '35%' }} />
                    <div className="absolute inset-y-0 w-px bg-red-400" style={{ left: '75%' }} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.04] rounded text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <span className="text-foreground-muted">0:00 - 2:45</span>
                      <span className="text-foreground-faint ml-auto">→ Current step</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.04] rounded text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-green" />
                      <span className="text-foreground-muted">2:45 - 5:30</span>
                      <span className="text-foreground-faint ml-auto">→ New step</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.04] rounded text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <span className="text-foreground-muted">5:30 - 8:12</span>
                      <span className="text-foreground-faint ml-auto">→ New step</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-green text-black font-semibold rounded-[14px] transition-all hover:bg-[#d0ff96] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(184,255,107,0.2)] relative"
          >
            <Download className="w-5 h-5" />
            Get Quobby Free
          </a>
        </div>
      </section>

      <section className="px-6 py-20" id="popular-tutorials">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent-glow border border-accent/20 rounded-full text-sm text-accent font-medium mb-6">
              <Gamepad2 className="w-4 h-4" />
              Popular board game tutorials
            </div>
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold text-foreground tracking-tight mb-3">
              Learn how to play popular board games
            </h2>
            <p className="text-lg text-foreground-muted max-w-[560px] mx-auto">
              Free interactive tutorials with setup guides, rules explanations, strategy tips, and quizzes for the world&apos;s most popular board games.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {popularGames.map((g) => (
              <Link
                key={g.name}
                href={`/tutorials/${g.tutorialId}`}
                className="group p-4 bg-card border border-border rounded-2xl transition-all hover:bg-card-hover hover:border-accent/10 hover:-translate-y-0.5 text-center"
              >
                <span className="text-2xl mb-2 block">{g.emoji}</span>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-accent-light transition-colors">
                  {g.name}
                </h3>
                <p className="text-[11px] text-foreground-faint mt-1">
                  How to play
                </p>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              href="/tutorials"
              className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent-light transition-colors font-medium"
            >
              Browse all tutorials
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-20" id="faq">
        <div className="max-w-[700px] mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/[0.04] border border-border rounded-full text-sm text-foreground-muted font-medium mb-6">
              <HelpCircle className="w-4 h-4" />
              Frequently asked questions
            </div>
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold text-foreground tracking-tight mb-3">
              Common questions about Qurator
            </h2>
            <p className="text-lg text-foreground-muted max-w-[500px] mx-auto">
              Everything you need to know about creating and following interactive tutorials.
            </p>
          </div>
          <div className="space-y-3">
            {pageFaqs.map((f) => (
              <details
                key={f.question}
                className="group bg-card border border-border rounded-2xl transition-all hover:bg-card-hover hover:border-accent/10 overflow-hidden"
              >
                <summary className="flex items-center gap-4 px-6 py-5 list-none [&::-webkit-details-marker]:hidden cursor-pointer">
                  <h3 className="text-base font-semibold text-foreground flex-1 text-left">
                    {f.question}
                  </h3>
                  <ChevronDown className="w-5 h-5 text-foreground-faint transition-transform duration-200 group-open:rotate-180 shrink-0" />
                </summary>
                <div className="px-6 pb-5 pt-0">
                  <p className="text-sm text-foreground-muted leading-relaxed">
                    {f.answer}
                  </p>
                </div>
              </details>
            ))}
          </div>
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </>
  );
}
