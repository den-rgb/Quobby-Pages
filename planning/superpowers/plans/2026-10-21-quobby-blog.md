# Quobby Website Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a discoverable static blog to the Quobby website and publish a feature-rich, sourced comparison of Quobby and Qurator with Quizlet, Anki, and Duolingo.

**Architecture:** Keep the website static and hand-authored in `docs/`. Add a blog index and one article that share the existing stylesheet and page shell, with a small amount of blog-specific CSS. Link to the new pages from the existing site and publish their URLs in the sitemap and `llms.txt`.

**Tech Stack:** Semantic HTML, existing CSS, XML sitemap, plain-text `llms.txt`, Schema.org JSON-LD.

**Spec:** `planning/superpowers/specs/2026-10-21-quobby-blog-design.md`

## Global Constraints

- The Quobby website is a static site served from `docs/` on GitHub Pages.
- Reuse the existing stylesheet, store links, brand colours, and responsive layout.
- The comparison will be feature-based, not a claim of better educational outcomes.
- Credit Quizlet's study modes and AI tools, Anki's configurable spaced-repetition workflow and sync, and Duolingo's structured language lessons and motivation features.
- Keep `docs/robots.txt` unchanged: it already permits site crawling and points crawlers to `docs/sitemap.xml`.
- Do not add a CMS, authoring dashboard, comments, RSS, analytics changes, or a multi-article editorial calendar.
- Do not claim Quobby has better learning outcomes than competitors without comparative evidence.
- Do not change the iOS or Android apps.
- Do not commit or push; the Quobby engineering guidance requires separate explicit approval for commits.

---

### Task 1: Build the blog index and feature comparison article

**Files:**
- Create: `docs/blog/index.html`
- Create: `docs/blog/quobby-vs-quizlet-anki-duolingo.html`
- Modify: `docs/assets/style.css`

**Interfaces:**
- Both pages load `../assets/style.css` and use root-relative links for site routes (`/`, `/blog/`, `/support.html`, `/privacy.html`, `/terms.html`, `/#download`).
- The article links to official competitor references and the Quobby and Qurator properties, plus the iOS and Android store pages.

- [x] Create `docs/blog/index.html` with canonical URL `https://www.quobby.com/blog/`, unique title and description metadata, a site header/footer, and a featured card linking to the first post.
- [x] Create the article with a short introduction, Quobby feature sections, a Qurator section, a responsive comparison table, a balanced conclusion, app-store calls to action, and a linked source list.
- [x] Add canonical, Open Graph, Twitter Card, and `Article` JSON-LD metadata to the article; give the index unique title, description, canonical, and Open Graph metadata.
- [x] Add focused CSS for the blog landing layout, reading measure, article typography, comparison table, and narrow-screen horizontal scrolling; preserve readable contrast and existing responsive navigation.

### Task 2: Connect the blog to existing site pages

**Files:**
- Modify: `docs/index.html`
- Modify: `docs/support.html`
- Modify: `docs/privacy.html`
- Modify: `docs/terms.html`

**Interfaces:**
- Navigation and footer use `/blog/` so links resolve consistently from root and nested routes.
- Homepage “From the blog” card links to `/blog/quobby-vs-quizlet-anki-duolingo.html`.

- [x] Add a Blog navigation link to each page's existing nav list without changing its other destinations or active states.
- [x] Add a Blog link to each page's footer links.
- [x] Add a homepage teaser card linking to the article and the blog index, matching the current card and section styles.

### Task 3: Update search and assistant discovery data

**Files:**
- Modify: `docs/sitemap.xml`
- Modify: `docs/llms.txt`
- Review only: `docs/robots.txt`

**Interfaces:**
- Sitemap contains `https://www.quobby.com/blog/` and `https://www.quobby.com/blog/quobby-vs-quizlet-anki-duolingo.html` with publication date `2026-10-21`.
- `llms.txt` describes the blog and links to both pages.
- Existing robots policy remains `Allow: /` and continues pointing to the sitemap.

- [x] Add both blog routes to the sitemap using the existing XML format and appropriate priorities/change frequencies.
- [x] Add a Blog section to `docs/llms.txt` with a concise index description and article link.
- [x] Confirm the existing robots policy already covers both public blog paths and needs no edit.

### Task 4: Review the finished site changes

**Files:**
- Review: all files created or modified in Tasks 1–3.

- [x] Run `git diff --check` to catch whitespace errors.
- [x] Parse the sitemap XML and each JSON-LD block in the new pages; confirm each new canonical page URL appears in the sitemap and `llms.txt`.
- [x] Review all internal links and image/CSS paths from root pages and `/blog/`; confirm the comparison source links are official product references and the table remains readable at mobile widths.
- [x] Review `docs/robots.txt` to confirm it still permits indexing and references the updated sitemap.

