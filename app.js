const formCopy = {
  request: {
    kicker: "Request Access",
    title: "Screened Access",
    copy: "For events, partnerships, private links, and portal consideration.",
    tag: "LV_RequestAccess"
  },
  submission: {
    kicker: "Submissions",
    title: "Artist and Creator Intake",
    copy: "Send a concise signal. The review path is selective by design.",
    tag: "LV_Submission"
  },
  press: {
    kicker: "Press / Partners",
    title: "Institutional Contact",
    copy: "For press, venues, distribution, investor, and brand partnership inquiries.",
    tag: "LV_Press"
  },
  event: {
    kicker: "Event RSVP",
    title: "Request Invitation",
    copy: "Event access is screened. Tell us which room you are approaching.",
    tag: "LV_EventInterest"
  },
  codex: {
    kicker: "Codex Request",
    title: "Tier Access Request",
    copy: "Inner and Sanctum access require review, alignment, and server-side approval.",
    tag: "LV_Codex_Request"
  },
  fan: {
    kicker: "Fan Engine",
    title: "Join the List",
    copy: "Get release signals and selected Lux Veritas updates.",
    tag: "LV-TAG-Life::Lead"
  }
};

const webhookConfig = {
  request: "",
  submission: "",
  press: "",
  event: "",
  codex: "",
  fan: ""
};

const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const dialog = document.querySelector("[data-dialog]");
const dialogForm = dialog?.querySelector(".dialog-shell");
const statusBox = document.querySelector("[data-form-status]");
let activeFormType = "request";

function setScrolledHeader() {
  header?.classList.toggle("scrolled", window.scrollY > 24);
}

function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  return Object.fromEntries(keys.map((key) => [key, params.get(key) || localStorage.getItem(key) || ""]));
}

function persistUtmParams() {
  Object.entries(getUtmParams()).forEach(([key, value]) => {
    if (value) localStorage.setItem(key, value);
  });
}

function openForm(type) {
  activeFormType = type in formCopy ? type : "request";
  const config = formCopy[activeFormType];
  document.querySelector("[data-form-kicker]").textContent = config.kicker;
  document.querySelector("[data-form-title]").textContent = config.title;
  document.querySelector("[data-form-copy]").textContent = config.copy;
  statusBox.hidden = true;
  dialog.showModal();
}

function trackEvent(name, detail = {}) {
  const consent = localStorage.getItem("luxveritas_consent");
  const payload = {
    event: name,
    page: window.location.pathname,
    detail,
    utm: getUtmParams(),
    timestamp: new Date().toISOString(),
    consent
  };
  const events = JSON.parse(localStorage.getItem("luxveritas_events") || "[]");
  events.push(payload);
  localStorage.setItem("luxveritas_events", JSON.stringify(events.slice(-100)));
  window.dataLayer = window.dataLayer || [];
  if (consent === "accepted") window.dataLayer.push(payload);
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(dialogForm).entries());
  if (data.company_url) return;

  const payload = {
    ...data,
    source: "luxveritas.media",
    source_page: window.location.pathname,
    formType: activeFormType,
    tag: formCopy[activeFormType].tag,
    ...getUtmParams(),
    timestamp: new Date().toISOString()
  };

  const submissions = JSON.parse(localStorage.getItem("luxveritas_submissions") || "[]");
  submissions.push(payload);
  localStorage.setItem("luxveritas_submissions", JSON.stringify(submissions.slice(-50)));
  trackEvent("lead", { formType: activeFormType });

  const endpoint = webhookConfig[activeFormType];
  if (endpoint) {
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.warn("Webhook submission failed", error);
    }
  }

  statusBox.textContent = "Received. Your signal has been recorded.";
  statusBox.hidden = false;
  dialogForm.reset();
}

function mountConsentBanner() {
  if (localStorage.getItem("luxveritas_consent")) return;
  const banner = document.createElement("div");
  banner.className = "consent-banner show";
  banner.innerHTML = `<p>Lux Veritas uses essential local storage for forms and optional analytics after consent.</p>
    <div class="consent-actions">
      <button class="button button-primary" data-consent="accepted">Accept all</button>
      <button class="button button-quiet" data-consent="rejected">Reject non-essential</button>
    </div>`;
  document.body.appendChild(banner);
  banner.addEventListener("click", (event) => {
    const button = event.target.closest("[data-consent]");
    if (!button) return;
    localStorage.setItem("luxveritas_consent", button.dataset.consent);
    banner.remove();
    trackEvent("consent_update", { value: button.dataset.consent });
  });
}

window.addEventListener("scroll", setScrolledHeader, { passive: true });
setScrolledHeader();
persistUtmParams();
mountConsentBanner();
trackEvent("view_content");

navToggle?.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll("[data-open-form]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openForm(button.dataset.openForm);
  });
});

document.querySelectorAll("[data-track]").forEach((button) => {
  button.addEventListener("click", () => {
    trackEvent(button.dataset.track, { label: button.textContent.trim() });
  });
});

dialogForm?.addEventListener("submit", handleFormSubmit);

document.querySelectorAll(".section, .vertical-card, .release-rail article, .slate div, .event-card, .codex-card, .ops-grid article, .portal-grid article").forEach((el) => {
  el.setAttribute("data-reveal", "");
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => entry.target.classList.toggle("visible", entry.isIntersecting)),
    { threshold: 0.12 }
  );
  document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
} else {
  document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("visible"));
}
