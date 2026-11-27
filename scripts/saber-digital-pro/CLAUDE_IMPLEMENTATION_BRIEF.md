# SABER DIGITAL PRO — Premium conversion upgrade brief

## Context (read before changing anything)
This is an existing, generated, three-language static website. Do not replace it with a generic agency template or rebuild it as a framework app.

- Source of truth: `scripts/saber-digital-pro/content/{en,fr,ar}.json`
- Shared design system: `scripts/saber-digital-pro/css/site.css`
- Interactions: `scripts/saber-digital-pro/js/site.js`
- Generator: `scripts/saber-digital-pro/build.py`
- Acceptance suite: `scripts/saber-digital-pro/test.js`
- Generated output: `lp/saber-digital-pro/{index.html,fr/index.html,ar/index.html}`
- Existing README explains build and QA commands. Read it first.
- Keep the live route structure unchanged: EN at /lp/saber-digital-pro/, FR at /fr/, AR at /ar/.

The current implementation already has a dark charcoal/lime visual system, local fonts, RTL-aware CSS logical properties, hreflang/canonical/JSON-LD, no third-party runtime dependencies, responsive navigation, reduced-motion support, a multilingual contact message builder, and broad Playwright/axe acceptance tests. Preserve these strengths.

## Mission
Elevate the existing SABER DIGITAL PRO experience into a premium international digital studio website that earns trust and converts qualified businesses in the UAE, Saudi Arabia and international markets.

This is a refinement and strategic upgrade, not a greenfield rebrand. Keep the brand name and recognizable visual signature.

## Strategic positioning
Present SABER DIGITAL PRO as a focused digital partner combining:
1. SEO content and editorial strategy
2. Website content and conversion copy
3. Premium web design and landing page development
4. E-commerce experience optimization
5. Technical website audit and front-end improvements
6. AI website assistants and workflow automation

Do not imply a large agency team, offices, certifications, awards, clients, case-study results or years of experience unless explicitly evidenced in the repository and approved by the owner.

## Design direction
- Retain deep charcoal and signature lime, but use lime with restraint.
- Strengthen the editorial art direction: large, high-contrast typography, clearer hierarchy, deliberate whitespace, asymmetric but balanced grids, fine rules and precise micro-interactions.
- Make the hero feel distinctive and immediately communicate the buyer, problem and commercial outcome. Avoid vague claims such as guaranteed rankings or guaranteed conversion lifts.
- Replace repetitive generic card grids where a more editorial layout improves clarity.
- Avoid stock-photo clichés, AI-looking abstract blobs, excessive glassmorphism, unnecessary 3D, decorative motion that competes with the message, and oversized visual gimmicks.
- Ensure the hero has a compelling visual composition on mobile as well as desktop.
- Maintain excellent readability and touch targets at 320px and above.

## Required experience improvements

### 1. Hero and positioning
- Rewrite the value proposition around tangible business needs: being discovered, understood, trusted and contacted.
- Show the principal service groups without making six unrelated promises.
- Primary CTA: discuss a project. Secondary CTA: inspect capabilities / selected work.
- Explain the differentiator: native English, French and Arabic delivery, including genuine RTL design.
- Keep a short, honest proof statement: what a client can inspect on this site (service deliverables, demonstration work, process, direct contact).

### 2. Trust architecture — no fabricated proof
Create a section that demonstrates working standards rather than unsupported claims:
- Example deliverables (brief, page outline, SEO article structure, landing-page wireframe, content refresh checklist, audit priority list).
- Explicit labels for all demonstration work: “demonstration / illustrative concept, not a client engagement”.
- A transparent “what you receive” structure: scope, deliverables, review points, handover.
- Explain how content is researched, fact-checked and approved by the client's subject-matter expert where relevant.
- Never use fake client logos, fake quotes, fake ratings, invented project metrics or vague “trusted by” counters.

### 3. Portfolio / work samples
The current three “work” entries are explicitly demonstration concepts, not client case studies. Keep that disclosure prominent.
Upgrade them into tangible, inspectable sample experiences:
- Real-estate: a sample bilingual project landing-page composition and a short content outline.
- Healthcare: an example service-page hierarchy and patient FAQ structure; no medical claims or unapproved clinical advice.
- E-commerce: a sample category/product copy treatment and a checkout clarity checklist.
These are concept samples, not claimed client work. Make each sample visually legible and useful, not just abstract mock boxes. Add sample content/visuals only when assets can be generated or authored responsibly and locally.
Do not label concepts “case studies” unless unmistakably qualified as demonstrations.

### 4. Services
Keep the nine current service offers if they remain meaningful, but make them easier to scan and compare.
Group into:
- Content & SEO
- Website & E-commerce
- Optimization & AI
For every service show:
- The business problem addressed
- Deliverables
- Best-fit customer
- What the client must provide / dependencies where important
- A CTA that preselects the relevant service in the contact flow
Avoid duplicate or overlapping descriptions. Make sure sales priority is visible: SEO blog writing, content refresh, service/landing-page copy, and website audits should be immediately easy to find.

### 5. Process and scope
Make the four-step process concrete:
Discover → Plan → Produce → Review & Improve.
Show realistic artifacts and client approval points at each stage. No arbitrary delivery-time promises.

### 6. Contact conversion
The present form is client-side only: it prepares a message and then lets a visitor send it via WhatsApp/email or copy it. It does not submit to a backend. Preserve this transparency unless a real secure backend endpoint is separately designed and implemented.
Reduce friction:
- Consider a two-stage contact flow: initial required fields limited to name, business email, service and project summary; company and website can be optional/contextual.
- Keep the selected service from service CTAs.
- Make all errors localized, keyboard accessible and screen-reader friendly.
- Tell users exactly what happens after clicking “Prepare request”.
- Never display a success state that implies the business has received a message.
- Keep WhatsApp number +213697236128 and email saberdigitpro@gmail.com.
- WhatsApp must remain a direct user-initiated external send, not automatic.

### 7. Multilingual quality
- EN / FR / AR must all be complete and idiomatic, not literal translations.
- Preserve the same information architecture, capabilities, deliverables and disclaimers in all languages.
- Arabic must have full RTL behavior for layouts, forms, labels, navigation, direction-sensitive icons, focus states and responsive components.
- No stray English sentences in Arabic UI; brand names and standard terms (SEO, WhatsApp) may remain.
- Keep localized metadata, canonical, reciprocal hreflang, Open Graph and structured data accurate.
- No language selector may lose the user's current section.

### 8. Technical and SEO requirements
- Static, fast, semantic HTML. No unnecessary framework migration or third-party JS dependencies.
- Preserve local font files and existing font licensing.
- Optimize local assets; specify image dimensions, lazy-load below-fold images, and preload only critical fonts/assets.
- Ensure all links and buttons have meaningful actions.
- Preserve keyboard operation, visible focus, skip link, semantic heading order, form labels, alt text and reduced-motion support.
- Validate metadata lengths and language-specific JSON-LD.
- Avoid injecting untrusted strings into HTML; preserve escaping in the generator.
- No broken anchors, console errors, 404s, horizontal overflow or empty interactive controls.

## Implementation workflow
1. Inspect README, all three content JSON files, generator, CSS, JS, current rendered pages and existing tests.
2. Document the current implementation and identify concrete changes before editing.
3. Implement changes in source files only; do not hand-edit generated HTML.
4. Keep EN/FR/AR JSON schemas structurally identical. Add a schema-parity test if needed.
5. Build all three static pages using the documented build command.
6. Run the full existing Playwright acceptance suite, including axe if available.
7. Add tests for new trust/sample sections, contact semantics, language parity and mobile presentation.
8. Inspect at desktop, tablet and narrow mobile sizes; inspect Arabic separately.
9. Review git diff for accidental unrelated changes and generated-file consistency.
10. Report exact test results, files changed, and any checks that could not be run. Do not claim success for skipped tests.

## Acceptance criteria
- Site remains three-language static pages at existing routes.
- The experience visibly feels more premium and distinctive, not merely recolored.
- First screen communicates the value proposition, audience and next action clearly on mobile and desktop.
- Visitors can inspect tangible demonstration deliverables without mistaking them for real client case studies.
- Service hierarchy makes the most commercially relevant offers obvious.
- Contact UX is low-friction and honest about manual sending.
- Arabic RTL and localized copy are complete and coherent.
- Existing technical safeguards remain green; no fabricated credibility claims.
- All generated HTML is rebuilt from the source and matches source versions.

## Deliverable
A complete implementation in the existing repository structure, with all three language pages regenerated and tests documented. Do not stop at a hero mockup or produce a design-only concept.
