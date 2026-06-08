import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const assetVersion = "20260608-source-ready-player";
const mediaManifest = JSON.parse(await readFile("data/lux-media-manifest.json", "utf8"));

const nav = [
  ["Home", "/index.html"],
  ["Music", "/music.html"],
  ["Film", "/film.html"],
  ["Events", "/events.html"],
  ["Codex", "/codex.html"],
  ["About", "/about.html"],
  ["Join", "/join.html"],
];

const eventCards = [
  {
    title: "Listening Room",
    type: "Private performance",
    date: "Invitation only",
    href: "/events/listening-room.html",
    body: "An intimate room for new work, first witnesses, and post-release reflection.",
  },
  {
    title: "Codex Salon",
    type: "Cultural gathering",
    date: "Seasonal",
    href: "/events/codex-salon.html",
    body: "A small-format evening for principles, story, sound, and alignment.",
  },
  {
    title: "Destination Week",
    type: "Commissioned event",
    date: "By request",
    href: "/events/destination-week.html",
    body: "A fully designed cultural environment for partners, patrons, and artists.",
  },
];

const releaseCards = [
  ["SPMVP", "Current release", "A first doorway into the Lux Veritas sound world, built for listening, watching, and return visits."],
  ["Live Sessions", "Performance", "Intimate rooms, filmed moments, and selected appearances that carry the atmosphere into the body."],
  ["Artist Worlds", "Ongoing development", "Long-arc collaborations shaped with patience, restraint, and a clear sense of identity."],
];

const codexEntries = [
  ["Outer", "Signal Before Scale", "Public principle for selective release cadence and fan trust."],
  ["Outer", "Rooms Before Reach", "The work is built as an atmosphere first, then released to the public with care."],
];

function asset(path) {
  const depth = path.split("/").length - 1;
  return `${"../".repeat(depth)}assets/luxveritas-threshold.png`;
}

function pagePath(path) {
  const depth = path.split("/").length - 1;
  return `${"../".repeat(depth)}`;
}

function link(current, href, label) {
  const active = current === href || (current === "/index.html" && href === "/index.html");
  return `<a ${active ? 'class="active"' : ""} href="${href}">${label}</a>`;
}

function shell({ path, title, description, eyebrow = "Lux Veritas", body, heroClass = "", noindex = false }) {
  const root = pagePath(path);
  const navLinks = nav.map(([label, href]) => link(path, href, label)).join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${description}" />
    ${noindex ? '<meta name="robots" content="noindex, nofollow" />' : ""}
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${asset(path)}" />
    <title>${title}</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%23070909'/%3E%3Cpath d='M18 48V16h6v27h18v5H18Zm21-32h7L34 48h-6l11-32Z' fill='%23c8a86a'/%3E%3C/svg%3E" />
    <link rel="stylesheet" href="${root}styles.css?v=${assetVersion}" />
  </head>
  <body data-page="${path}">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header" data-header>
      <a class="brand" href="/index.html" aria-label="Lux Veritas home">
        <span class="brand-mark">LV</span>
        <span>Lux Veritas</span>
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" data-nav-toggle>
        <span></span><span></span>
      </button>
      <nav id="primary-nav" class="primary-nav" data-nav>${navLinks}</nav>
      <button class="header-action" type="button" data-open-form="request">Request Access</button>
    </header>
    <main id="main" class="${heroClass}">
      ${body}
    </main>
    ${footer()}
    ${formDialog()}
    <script src="${root}app.js?v=${assetVersion}"></script>
  </body>
</html>`;
}

function footer() {
  return `<footer class="site-footer">
  <div>
    <strong>Lux Veritas</strong>
    <p>Truth, In Right Order</p>
  </div>
  <nav aria-label="Footer">
    <a href="/works/index.html">Works</a>
    <a href="/store.html">Store</a>
    <a href="/membership.html">Membership</a>
    <a href="/submissions.html">Submissions</a>
    <a href="/press.html">Press</a>
    <a href="/contact.html">Contact</a>
    <a href="/legal/privacy.html">Privacy</a>
    <a href="/legal/terms.html">Terms</a>
  </nav>
</footer>`;
}

function formDialog() {
  return `<dialog class="form-dialog" data-dialog>
  <form action="mailto:info@luxveritas.media" method="post" enctype="text/plain" class="dialog-shell">
    <button class="dialog-close" type="button" aria-label="Close" data-close-dialog>×</button>
    <p class="kicker" data-form-kicker>Request Access</p>
    <h2 data-form-title>Screened Access</h2>
    <p data-form-copy>Tell us who you are and what door you are approaching.</p>
    <div class="form-status" data-form-status hidden></div>
    <label><span>Name</span><input name="name" autocomplete="name" required /></label>
    <label><span>Email</span><input name="email" type="email" autocomplete="email" required /></label>
    <label><span>Phone <em>optional</em></span><input name="phone" type="tel" autocomplete="tel" /></label>
    <label><span>Role path</span><select name="role_path" required>
      <option value="">Select one</option><option>Member</option><option>Artist</option><option>Creator</option><option>Press</option><option>Partner</option><option>Investor</option><option>Event guest</option><option>General</option>
    </select></label>
    <label><span>Inquiry type</span><select name="inquiry_type" required>
      <option value="">Select one</option><option>Membership</option><option>Submissions</option><option>Events</option><option>Press</option><option>Partnership</option><option>Licensing</option><option>Investor</option><option>Portal</option><option>General</option>
    </select></label>
    <label><span>Message</span><textarea name="message" rows="5" required></textarea></label>
    <label class="check-row"><input type="checkbox" name="consent_email" value="yes" /> <span>Email follow-up is allowed.</span></label>
    <label class="check-row"><input type="checkbox" name="consent_sms" value="yes" /> <span>SMS follow-up is allowed if a phone number is supplied.</span></label>
    <input class="honeypot" name="company_url" tabindex="-1" autocomplete="off" />
    <button class="button button-primary" type="submit" data-submit-form>Send to Lux Veritas</button>
  </form>
</dialog>`;
}

function pageHero(eyebrow, title, copy, actions = "") {
  return `<section class="page-hero section">
    <div class="page-hero-inner">
      <p class="kicker">${eyebrow}</p>
      <h1>${title}</h1>
      <p>${copy}</p>
      ${actions}
    </div>
  </section>`;
}

function cta() {
  return `<section class="section cta-band">
    <div>
      <p class="kicker">Invitation</p>
      <h2>Where Truth Has a Home.</h2>
      <p>If you are looking for scale without distortion, reach without dilution, and freedom without chaos, you are in the right place.</p>
    </div>
    <div class="cta-actions">
      <button class="button button-primary" data-open-form="request">Request Access</button>
      <button class="button button-quiet" data-open-form="submission">Submissions</button>
    </div>
  </section>`;
}

function mediaPlayerShell(context = "music") {
  const compact = context === "spmvp";
  const items = mediaManifest.items.filter((item) => item.contexts.includes(context));
  return `<section class="section media-player-section" data-media-player data-player-context="${context}">
    <div class="media-player-copy">
      <p class="kicker">Lux Player</p>
      <h2>${compact ? "Start with the drop." : "Listen. Watch. Return."}</h2>
      <p>${compact ? "SPMVP is the current doorway. The public player captures listen, watch, and radio intent while deeper access opens by request." : "A fan-facing player for releases, visuals, sessions, and future radio programming. Public actions are remembered on this device today so the experience can become more personal as the world opens."}</p>
    </div>
    <div class="media-player" aria-label="Lux Veritas media player">
      <div class="media-now">
        <span data-media-mode>Signal</span>
        <h3 data-media-title>SPMVP</h3>
        <p data-media-status>Ready for public preview routing.</p>
        <div class="media-progress" aria-hidden="true"><span data-media-progress></span></div>
        <div class="media-source-shell" data-media-source-shell hidden>
          <audio controls preload="none" data-media-audio hidden></audio>
          <video controls playsinline preload="metadata" data-media-video hidden></video>
        </div>
        <div class="media-actions">
          <button class="button button-primary" type="button" data-media-action="play">Play Signal</button>
          <button class="button button-quiet" type="button" data-media-action="watch">Watch</button>
          <button class="button button-quiet" type="button" data-media-action="radio">Radio</button>
        </div>
      </div>
      <div class="media-queue" role="list" aria-label="Media queue">
        ${items.map((item, index) => `<button class="media-item${index === 0 ? " active" : ""}" type="button" data-media-item data-media-id="${item.id}" data-kind="${item.kind}" data-title="${item.title}" data-status="${item.status}" data-action="${item.primaryAction}" data-access="${item.access}" data-source-type="${item.sourceType}" data-source-url="${item.sourceUrl || ""}" data-poster-url="${item.posterUrl || ""}" role="listitem">
          <span>${item.label}</span><strong>${item.title}</strong><small>${item.summary}</small>
        </button>`).join("")}
      </div>
      <div class="media-report" data-media-report>0 media actions recorded in this session.</div>
    </div>
  </section>`;
}

function home() {
  return shell({
    path: "/index.html",
    title: "Lux Veritas | Escape to Truth",
    description: "Lux Veritas is a global media and cultural studio creating music, film, and live experiences built on truth, order, and lineage.",
    heroClass: "home-main",
    body: `<section class="hero section">
      <div class="hero-media" aria-hidden="true"></div>
      <div class="hero-inner">
        <p class="kicker">Global media and cultural studio</p>
        <h1>Escape to Truth</h1>
        <p class="hero-copy">Lux Veritas creates music, film, and live experiences built on truth, order, and lineage.</p>
        <div class="hero-actions">
          <button class="button button-primary" data-open-form="request">Request Access</button>
          <button class="button button-quiet" data-open-form="submission">Submissions</button>
        </div>
      </div>
      <div class="signal-strip" aria-label="Lux Veritas principles">
        <span>Light Without Illusion</span><span>Not Noise. Signal.</span><span>Truth, In Right Order</span>
      </div>
    </section>
    <section class="section identity"><div class="section-grid"><p class="kicker">Identity</p><div><h2>Not Noise. Signal.</h2><p>Lux Veritas is not a platform, a label, or a trend-driven studio. It is a cultural institution. We develop and produce work that endures. Every release is intentional. Every artist is protected. Every story serves something larger than attention.</p></div></div></section>
    <section class="section verticals"><div class="section-heading"><p class="kicker">Studios</p><h2>One institution. Many doors.</h2><p>Lux Veritas connects music, cinematic worlds, live rooms, publishing, community, and commerce into one living cultural universe.</p></div><div class="card-grid">
      ${["Music|Sound, releases, performance, and long-form artist collaboration.|/music.html","Film|Mythic narrative, anime, and episodic worlds shaped through image and atmosphere.|/film.html","Events|Presence-led gatherings, listening rooms, salons, and destination experiences.|/events.html","Codex|Principles, essays, and selected writing from inside the world.|/codex.html"].map((item, i) => {
        const [title, body, href] = item.split("|");
        return `<a class="vertical-card" href="${href}"><span>${String(i+1).padStart(2,"0")}</span><h3>${title}</h3><p>${body}</p></a>`;
      }).join("")}
    </div></section>
    <section class="section split-band"><div><p class="kicker">Journey</p><h2>Listen to the signal.<br />Watch the world open.<br />Join the circle.</h2></div><div><p>Attend the room.</p><p>Collect the drop.</p><p>Create from the source.</p><div class="hero-actions"><button class="button button-primary" data-open-form="request">Enter Lux Veritas</button><button class="button button-quiet" data-open-form="fan">Join for first access</button></div></div></section>
    ${cta()}`
  });
}

function music() {
  return shell({
    path: "/music.html",
    title: "Music | Lux Veritas",
    description: "Sound as signal. Lux Veritas releases music as the first doorway into a larger world.",
    body: `${pageHero("Music", "Sound as signal.", "Lux Veritas releases music as the first doorway into a larger world: songs, visuals, live rooms, stories, and fan participation moving together.\n\nEvery release is intentional, protected, and built to last.", `<div class="hero-actions"><a class="button button-primary" href="/spmvp.html">Listen</a><button class="button button-quiet" type="button" data-open-form="fan">Watch</button><button class="button button-quiet" type="button" data-open-form="fan">Join for early access</button></div>`)}
    ${mediaPlayerShell("music")}
    <section class="section"><div class="release-rail">${releaseCards.map(([title, type, body]) => `<article><span>${type}</span><h3>${title}</h3><p>${body}</p></article>`).join("")}</div></section>
    <section class="section split-band"><div><p class="kicker">Current Motion</p><h2>Music that arrives with atmosphere.</h2></div><div class="checklist"><p>Follow the latest release rooms, filmed sessions, and live appearances. If the work meets you, the next door is easy: listen, watch, join.</p><div class="hero-actions"><a class="button button-primary" href="/spmvp.html">Listen</a><button class="button button-quiet" data-open-form="fan">Join for early access</button></div></div></section>${cta()}`
  });
}

function film() {
  return shell({
    path: "/film.html",
    title: "Film | Lux Veritas",
    description: "Worlds in motion. Lux Veritas develops cinematic stories and episodic worlds.",
    body: `${pageHero("Film and Television", "Worlds in motion.", "Lux Veritas develops cinematic stories, episodic worlds, and visual mythologies connected to music, publishing, live experience, and fan participation.\n\nPublic chapters reveal only what is ready. Deeper lore opens by access.", `<div class="hero-actions"><button class="button button-primary" data-open-form="fan">Join for early chapters</button></div>`)}
    <section class="section"><div class="slate"><div><strong>Narrative Worlds</strong><span>Feature, episodic, and illustrated forms held to a clear emotional standard.</span></div><div><strong>Visual Language</strong><span>Image, texture, and rhythm used to build atmosphere before explanation.</span></div><div><strong>Selected Access</strong><span>Private screenings, early looks, and selected story rooms begin through request.</span></div></div></section>
    <section class="section empty-state"><p class="kicker">Private Development</p><h2>Some worlds are held back until their first true reveal.</h2><p>Unreleased projects and deeper story frameworks are not part of the public layer. Request access if your interest is aligned with screenings, partnerships, or development conversations.</p></section>${cta()}`
  });
}

function eventsIndex() {
  return shell({
    path: "/events.html",
    title: "Events | Lux Veritas",
    description: "Rooms with intention. Lux Veritas events prioritize signal, presence, and connection.",
    body: `${pageHero("Events", "Rooms with intention.", "Lux Veritas events are designed as listening rooms, salons, destination experiences, private screenings, and live cultural gatherings.\n\nSome rooms are public. Some are screened. All are built for signal, presence, and connection.", `<div class="hero-actions"><button class="button button-primary" data-open-form="request">Request access</button></div>`)}
    <section class="section"><div class="event-grid">${eventCards.map(card => `<a class="event-card" href="${card.href}"><span>${card.type}</span><h3>${card.title}</h3><p>${card.body}</p><small>${card.date}</small></a>`).join("")}</div></section>
    <section class="section split-band"><div><p class="kicker">Access</p><h2>The room comes first. Details follow.</h2></div><div><p>Public pages introduce the event and its atmosphere. Exact timing, location, guest structure, and private performance details arrive only after access is approved.</p></div></section>${cta()}`
  });
}

function eventPage(card) {
  return shell({
    path: card.href,
    title: `${card.title} | Lux Veritas Events`,
    description: card.body,
    body: `${pageHero(card.type, card.title, `${card.body} Each event page offers a first impression of the room, the mood, and the invitation.`, `<div class="hero-actions"><button class="button button-primary" data-open-form="event">Request Invitation</button><a class="button button-quiet" href="/events.html">All Events</a></div>`)}
    <section class="section split-band"><div><p class="kicker">Experience Notes</p><h2>Remembered, not consumed.</h2></div><div><p>Details arrive in stages. Public pages hold the atmosphere. Exact location, pricing, and guest details open only after the fit is confirmed.</p></div></section>`
  });
}

function codex() {
  return shell({
    path: "/codex.html",
    title: "Codex | Lux Veritas",
    description: "Light Without Illusion. The public Codex houses principles, frameworks, and long-form thinking.",
    body: `${pageHero("Codex", "Light Without Illusion.", "The Codex is where Lux Veritas shares selected principles and long-form thought. Not everything is public, and not everything arrives at once.", `<div class="hero-actions"><a class="button button-primary" href="/codex-inner.html">Request Access</a></div>`)}
    <section class="section"><div class="codex-list"><article class="codex-card outer"><span>Outer Codex</span><h3>Available publicly.</h3><p>${codexEntries[0][2]}</p></article><article class="codex-card inner"><span>Inner Codex</span><h3>Available to members and approved creators.</h3><p>This layer opens by access only.</p></article><article class="codex-card sanctum"><span>Sanctum</span><h3>Internal only.</h3><p>This layer opens by access only.</p></article></div></section>${cta()}`
  });
}

function gated(path, tier) {
  const sanctum = tier === "Sanctum";
  return shell({
    path,
    title: `${tier} Codex | Lux Veritas`,
    description: `${tier} Codex access request shell for Lux Veritas.`,
    noindex: true,
    body: `${pageHero(`${tier} Codex`, sanctum ? "Custodial access is not public." : "Initiated access begins with alignment.", `This layer opens by request. Public access ends at the visible Codex.`, `<div class="hero-actions"><button class="button button-primary" data-open-form="codex">Request ${tier} Access</button><a class="button button-quiet" href="/codex.html">Return to Codex</a></div>`)}
    <section class="section empty-state"><p class="kicker">Access Layer</p><h2>${tier} required.</h2><p>This area is not indexed publicly and opens only through invitation or approval.</p></section>`
  });
}

function blackgptDamon() {
  return shell({
    path: "/blackgpt-damon.html",
    title: "Private Steward Layer | Lux Veritas",
    description: "Private Lux Veritas steward layer for approved internal access only.",
    noindex: true,
    body: `${pageHero("Private Access", "Private steward layer.", "This area is reserved for approved internal access and is not part of the public website.", `<div class="hero-actions"><button class="button button-primary" data-open-form="codex">Request Codex Access</button><a class="button button-quiet" href="/codex.html">Return to Codex</a></div>`)}
    <section class="section empty-state"><p class="kicker">Screened Entry</p><h2>Internal materials are not public.</h2><p>Private source, governance, decision, and operating materials are withheld from the public layer.</p></section>`
  });
}

function about() {
  return shell({
    path: "/about.html",
    title: "About | Lux Veritas",
    description: "Lux Veritas is a global media and cultural studio operating across music, film, and live experiences.",
    body: `${pageHero("About", "Where Truth Has a Home.", "Lux Veritas is a global media and cultural studio operating across music, film, and live experiences. Founded on the belief that culture shapes reality, we create work that endures beyond cycles, platforms, and trends.")}
    <section class="section split-band"><div><p class="kicker">Stewardship</p><h2>Protected artists. Patient work. Long memory.</h2></div><div><p>The institution is built to care for artists, stories, and experiences with enough discipline to stay clear as it grows.</p></div></section>${cta()}`
  });
}

function utility(path, title, description, content, formType = "request", noindex = false, buttonLabel = "Open Form") {
  return shell({
    path,
    title: `${title} | Lux Veritas`,
    description,
    noindex,
    body: `${pageHero(title, title, description, `<div class="hero-actions"><button class="button button-primary" data-open-form="${formType}">${buttonLabel}</button></div>`)}
    <section class="section prose-block">${content}</section>`
  });
}

function signInShell() {
  return shell({
    path: "/auth/signin.html",
    title: "Sign In | Lux Veritas",
    description: "Private sign-in for invited members, collaborators, and approved guests.",
    noindex: true,
    body: `${pageHero("Private Access", "Sign In", "Use the email connected to your approved Lux Veritas access.\n\nAccess is screened by role and invitation.\n\nThis portal is for approved artists, creators, partners, members, and operators.\n\nSign in if you already have access, or request access if you are entering through submissions, membership, press, partnerships, licensing, or investor inquiry.")}
    <section class="section prose-block">
      <form class="inline-form auth-form" action="/portal/index.html" method="get" data-portal-signin-form>
        <label><span>Email</span><input type="email" name="email" autocomplete="email" placeholder="you@example.com" required /></label>
        <div class="form-status" data-portal-status hidden></div>
        <div class="hero-actions">
          <button class="button button-primary" type="submit" data-portal-signin>Continue</button>
          <button class="button button-quiet" type="button" data-open-form="request">Request Access</button>
        </div>
      </form>
    </section>`
  });
}

function accessShell(path, title, description, bodyCopy = "Access opens by request. Public information ends here.", primaryLabel = "Request Access", secondaryLabel = "Join") {
  return shell({
    path,
    title: `${title} | Lux Veritas`,
    description,
    noindex: true,
    body: `${pageHero("Access", title, description, `<div class="hero-actions"><button class="button button-primary" data-open-form="request">${primaryLabel}</button><a class="button button-quiet" href="/join.html">${secondaryLabel}</a></div>`)}
    <section class="section empty-state"><p class="kicker">Screened Entry</p><h2>Available by request.</h2><p>${bodyCopy}</p></section>`
  });
}

function portal(path, title, cards = "") {
  return shell({
    path,
    title: `${title} | Lux Veritas Portal`,
    description: "Private Lux Veritas access for invited members, collaborators, and selected partners.",
    noindex: true,
    body: `${pageHero("Portal", title, "The private layer is reserved for members, invited guests, collaborators, and selected partners.", `<div class="hero-actions"><a class="button button-primary" href="/auth/signin.html">Enter Portal</a><button class="button button-quiet" data-open-form="request">Request Access</button></div>`)}
    <section class="section portal-grid">${cards}</section>`
  });
}

function portalReport() {
  return shell({
    path: "/portal/reporting.html",
    title: "Local Activity Report | Lux Veritas Portal",
    description: "Private local activity report for Lux Veritas pilot testing.",
    noindex: true,
    body: `${pageHero("Portal", "Local Activity Report", "A private pilot view for checking activity captured on this device.")}
    <section class="section report-panel" data-local-report>
      <div class="section-heading">
        <p class="kicker">Pilot Signals</p>
        <h2>Captured here, exportable when needed.</h2>
        <p>This report reads only activity remembered by this browser: page events, media actions, form drafts, and private access attempts.</p>
      </div>
      <div class="report-grid" aria-label="Local activity totals">
        <article><span>Site Events</span><strong data-report-count="events">0</strong><small>Views and consent updates</small></article>
        <article><span>Media Actions</span><strong data-report-count="media">0</strong><small>Listen, watch, radio, and queue selections</small></article>
        <article><span>Form Drafts</span><strong data-report-count="submissions">0</strong><small>Requests prepared from this browser</small></article>
        <article><span>Portal Attempts</span><strong data-report-count="portal">0</strong><small>Private access email checks</small></article>
      </div>
      <div class="report-detail">
        <div>
          <p class="kicker">Latest Activity</p>
          <ul class="report-list" data-report-list><li>No local activity recorded yet.</li></ul>
        </div>
        <div class="report-actions">
          <button class="button button-primary" type="button" data-report-action="refresh">Refresh Report</button>
          <button class="button button-quiet" type="button" data-report-action="export">Export JSON</button>
          <button class="button button-quiet" type="button" data-report-action="clear">Clear Local Report</button>
        </div>
      </div>
      <div class="form-status" data-report-status hidden></div>
    </section>`
  });
}

function placeholder(path, title, description) {
  return shell({
    path,
    title: `${title} | Lux Veritas`,
    description,
    noindex: true,
    body: `${pageHero("Private Layer", title, description)}<section class="section empty-state"><p class="kicker">Access Only</p><h2>Not available for public indexing.</h2><p>This page is being held back until the experience is ready.</p></section>`
  });
}

const pages = [
  ["/index.html", home()],
  ["/music.html", music()],
  ["/film.html", film()],
  ["/events.html", eventsIndex()],
  ...eventCards.map(card => [card.href, eventPage(card)]),
  ["/codex.html", codex()],
  ["/codex-inner.html", gated("/codex-inner.html", "Inner")],
  ["/codex-sanctum.html", gated("/codex-sanctum.html", "Sanctum")],
  ["/blackgpt-damon.html", blackgptDamon()],
  ["/about.html", about()],
  ["/join.html", utility("/join.html", "Join", "Join Lux Veritas through releases, invitations, and selected access.", "<p>Start with the clearest door for you: join the list, request access, or send your work for review. The public layer is where trust begins. The private layer opens in time.</p>", "request", false, "Request Access")],
  ["/contact.html", utility("/contact.html", "Contact", "Use this path for aligned inquiries. The right team will route your message after review.", "<p>Use this path for aligned inquiries. The right team will route your message after review.</p>", "press", false, "Send Inquiry")],
  ["/press.html", utility("/press.html", "Press", "Short institutional boilerplate and screened media contact.", "<p>Lux Veritas is a global media and cultural studio creating music, film, and live experiences built on truth, order, and lineage.</p><p>A fuller press kit, visuals, and selected materials are shared by request.</p>", "press")],
  ["/submissions.html", utility("/submissions.html", "Submissions", "Lux Veritas accepts selected artist, creator, story, music, visual, and partnership submissions through a screened intake process.", "<p>Lux Veritas accepts selected artist, creator, story, music, visual, and partnership submissions through a screened intake process.</p><p>Please do not submit confidential material unless specifically invited. Submitting material does not create an obligation, partnership, employment relationship, or guarantee of review, response, release, or compensation.</p>", "submission", false, "Submit for review")],
  ["/ledger.html", utility("/ledger.html", "Public Ledger", "The Lux Veritas Ledger is our public stance on trust, credit, rights literacy, and artist protection.", "<p>The Lux Veritas Ledger is our public stance on trust, credit, rights literacy, and artist protection.</p><p>We believe releases should be intentional, credits should be clear, and creative work should be protected before it is scaled.</p><p>Deeper details are shared only through approved access.</p>", "request", false, "Request Access")],
  ["/legal/privacy.html", utility("/legal/privacy.html", "Privacy", "This page describes Lux Veritas website practices at a high level and remains subject to legal review.", `
    <h2>Overview</h2>
    <p>This page describes, at a high level, how Lux Veritas may collect and use information through its public website, forms, events, memberships, submissions, and related experiences.</p>
    <h2>Data Collected</h2>
    <p>Lux Veritas may collect information you provide directly, including your name, email address, phone number, interests, messages, submission materials, event requests, purchase-related details if commerce is offered, and other information you choose to send.</p>
    <h2>Email and SMS Consent</h2>
    <p>If you opt in, Lux Veritas may use your contact information to respond to your inquiry, send updates, share invitations, or communicate about releases, memberships, events, submissions, or related opportunities. SMS messages are used only where permission has been given.</p>
    <h2>Analytics</h2>
    <p>Lux Veritas may use basic analytics and site measurement tools to understand traffic, page usage, campaign performance, and general audience behavior.</p>
    <h2>Purchases</h2>
    <p>If products, tickets, or other purchases are made available, additional information needed to process those transactions may be collected through checkout, payment, fulfillment, or customer support providers.</p>
    <h2>Events</h2>
    <p>For event inquiries, registrations, invitations, or attendance, Lux Veritas may collect information needed to manage access, scheduling, guest communication, and event operations.</p>
    <h2>Submissions and User Content</h2>
    <p>If you submit music, stories, visuals, concepts, or other materials, Lux Veritas may store, review, and route that content internally for evaluation. Please do not submit confidential material unless specifically invited.</p>
    <h2>Memberships and Community</h2>
    <p>If membership, waitlists, or community features are offered, Lux Veritas may collect information related to access status, participation, preferences, and communication history.</p>
    <h2>Creator Participation and Licensing</h2>
    <p>For creator, collaborator, partner, or licensing conversations, Lux Veritas may collect contact details, business information, materials shared for review, and notes related to the request.</p>
    <h2>How Information May Be Used</h2>
    <p>Information may be used to respond to messages, review submissions, manage access requests, operate memberships, deliver events, support purchases, improve the site, and protect the integrity of Lux Veritas services and community spaces.</p>
    <h2>Contact</h2>
    <p>For privacy-related questions, use the contact path available on this site.</p>
  `, "press", true, "Contact")],
  ["/legal/terms.html", utility("/legal/terms.html", "Terms", "These terms describe general site use and remain subject to legal review.", `
    <h2>Overview</h2>
    <p>These terms describe general rules for accessing and using the Lux Veritas website, forms, releases, events, memberships, submissions, and related experiences.</p>
    <h2>Site Use</h2>
    <p>You may use this site only for lawful purposes and in a way that does not interfere with the site, its users, or Lux Veritas operations.</p>
    <h2>Submissions</h2>
    <p>Submitting material does not create an obligation, partnership, employment relationship, release commitment, or guarantee of review, response, compensation, or future collaboration.</p>
    <h2>User Content</h2>
    <p>If you send content, you represent that you have the right to share it for review. Lux Veritas may decline, ignore, or remove submissions or other user content at its discretion.</p>
    <h2>Memberships and Creator Participation</h2>
    <p>Membership access, creator participation, community features, and private areas may be limited, suspended, changed, or withdrawn at any time.</p>
    <h2>Events</h2>
    <p>Event availability, invitations, guest lists, schedules, locations, and access conditions may change. Entry may be limited, screened, or revoked where needed.</p>
    <h2>Purchases</h2>
    <p>If products, tickets, memberships, or other paid offerings are made available, additional purchase terms may apply at checkout or at the point of offer.</p>
    <h2>Refunds and Cancellations</h2>
    <p>If purchases or ticketed events are offered, any refund, cancellation, exchange, or resale terms will be presented with the relevant offer where applicable.</p>
    <h2>Licensing and Partnerships</h2>
    <p>Licensing, investor, studio, and partnership discussions are screened and do not become binding unless confirmed in a separate written agreement.</p>
    <h2>Intellectual Property</h2>
    <p>Lux Veritas names, branding, releases, visuals, text, and related materials remain protected except where rights are expressly granted.</p>
    <h2>Changes</h2>
    <p>Lux Veritas may update site content, offerings, and these terms from time to time.</p>
    <h2>Contact</h2>
    <p>For questions about these terms, use the contact path available on this site.</p>
  `, "press", true, "Contact")],
  ["/spmvp.html", shell({ path: "/spmvp.html", title: "SPMVP | Lux Veritas", description: "A release room for a new Lux Veritas music drop.", body: `${pageHero("New Drop", "SPMVP", "Start with the drop. Follow the signal. Join for the deeper version.", `<div class="hero-actions"><button class="button button-primary" type="button" data-media-action="play">Listen</button><button class="button button-quiet" type="button" data-media-action="watch">Watch</button><button class="button button-quiet" type="button" data-open-form="fan">Join for early access</button></div>`)}${mediaPlayerShell("spmvp")}<section class="section split-band"><div><p class="kicker">Context</p><h2>Enter through the work.</h2></div><div><p>Listen, watch, and enter the Lux Veritas circle for early access, private drops, and future live rooms.</p></div></section>` })],
  ["/auth/signin.html", signInShell()],
  ["/portal/index.html", shell({ path: "/portal/index.html", title: "Portal | Lux Veritas", description: "Private access for approved members, collaborators, and selected guests.", noindex: true, body: `${pageHero("Private Access", "Private Access", "This portal is for approved artists, creators, partners, members, and operators.", `<div class="hero-actions"><a class="button button-primary" href="/auth/signin.html">Sign In</a><button class="button button-quiet" data-open-form="request">Request Access</button></div>`)}<section class="section empty-state"><p class="kicker">Screened Entry</p><h2>Access is screened by role and invitation.</h2><p>Use the sign-in page if you already have access, or request access if you are entering through submissions, membership, press, partnerships, licensing, or investor inquiry.</p></section>` })],
  ["/portal/library.html", accessShell("/portal/library.html", "Creator", "Private creator materials are available by screened access.", "Creator tools and private materials are not published in the public layer.")],
  ["/portal/releases.html", accessShell("/portal/releases.html", "Licensing", "Private release and licensing materials are available by request.", "Licensing conversations and private release materials are screened before access opens.")],
  ["/portal/reporting.html", portalReport()],
  ["/portal/admin.html", accessShell("/portal/admin.html", "Admin", "This area is not available for public browsing.", "Administrative views are internal-only and not published in client-facing markup.")],
  ["/portal/admin/users.html", accessShell("/portal/admin/users.html", "Users", "This area is not available for public browsing.", "Administrative views are internal-only and not published in client-facing markup.")],
  ["/works/index.html", utility("/works/index.html", "Works", "Selected published projects and intentional teasers from across Lux Veritas.", "<p>Works gathers music, film, and related releases that are ready to be seen publicly. What appears here has been chosen for public view with intention.</p>")],
  ["/works/sample.html", placeholder("/works/sample.html", "Work Detail", "This work page is being held until the project is ready for public view.")],
  ["/brands/index.html", placeholder("/brands/index.html", "Brands", "Brand worlds will appear here when they are ready for public view.")],
  ["/brands/sample.html", placeholder("/brands/sample.html", "Brand Detail", "This brand page is being held until the experience is ready.")],
  ["/store.html", utility("/store.html", "Store", "A drop list for collectible releases and selected objects from the Lux Veritas world.", "<p>The store opens through selected drops. Join the waitlist for first notice on music, objects, and limited pieces as they arrive.</p>", "fan", false, "Join the waitlist")],
  ["/insights.html", utility("/insights.html", "Insights", "Selected Outer Codex essays and public writing from Lux Veritas.", "<p>Insights will gather public-facing essays, principles, and reflections from the Outer Codex.</p><p>Private maps, internal playbooks, and unpublished materials are not part of this public archive.</p>", "request", false)],
  ["/membership.html", utility("/membership.html", "Membership", "Membership begins with first access.", "<p>Join the Lux Veritas circle for early access, private drops, listening rooms, presales, behind-the-scenes releases, deeper Codex/lore, community moments, and exclusive merch.</p><p>Membership begins with first access.</p>", "fan", false, "Join the waitlist")],
  ["/investor.html", accessShell("/investor.html", "Strategic Access", "Investor, licensing, studio, and strategic partnership materials are available by screened request only.", "Use this page to request access. Public materials are intentionally limited.", "Request investor access", "Join")],
  ["/community.html", utility("/community.html", "Community", "Join the list to enter the circle.", "<p>The Lux Veritas community begins with owned fan identity: first access, private drops, member rooms, creator challenges, and live cultural moments.</p><p>Join the list to enter the circle.</p>", "fan", false, "Join the list")],
];

await Promise.all(
  pages.map(async ([path, html]) => {
    const file = join(".", path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
  })
);

const publicPaths = [
  "/index.html",
  "/music.html",
  "/film.html",
  "/events.html",
  ...eventCards.map((card) => card.href),
  "/codex.html",
  "/about.html",
  "/join.html",
  "/contact.html",
  "/press.html",
  "/submissions.html",
  "/ledger.html",
  "/works/index.html",
  "/store.html",
  "/insights.html",
  "/membership.html",
  "/spmvp.html",
  "/community.html",
];

await writeFile("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicPaths.map((path) => `  <url><loc>https://luxveritas.media${path.replace("index.html", "")}</loc></url>`).join("\n")}
</urlset>
`);

await writeFile("robots.txt", `User-agent: *
Allow: /
Sitemap: https://luxveritas.media/sitemap.xml
Disallow: /codex-inner.html
Disallow: /codex-sanctum.html
Disallow: /blackgpt-damon.html
Disallow: /auth/
Disallow: /portal/
Disallow: /brands/
Disallow: /investor.html
`);

console.log(`Built ${pages.length} pages.`);
