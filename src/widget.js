import "./widget.css";
import data from "./data.json";

const { questions, support_options } = data;

const state = {
  answers: {},
  currentIndex: 0,
  direction: "forward",
  infoOpen: false,
  showResults: false,
  popupOpen: false,
  started: false,
};

function getVisibleQuestions() {
  return questions.filter((q) => {
    if (!q.condition) return true;
    const { field, op, value } = q.condition;
    const answer = state.answers[field];
    if (answer === undefined) return false;
    return evalOp(op, answer, value);
  });
}

function evalOp(op, actual, expected) {
  switch (op) {
    case "eq":  return actual === expected;
    case "neq": return actual !== expected;
    case "lt":  return actual < expected;
    case "lte": return actual <= expected;
    case "gt":  return actual > expected;
    case "gte": return actual >= expected;
    case "in":  return expected.includes(actual);
    default:    return false;
  }
}

function checkEligibility(option) {
  return option.rules.every((rule) => {
    const answer = state.answers[rule.field];
    if (answer === undefined) return false;
    return evalOp(rule.op, answer, rule.value);
  });
}

function getEligibleOptions() {
  return support_options.filter(checkEligibility);
}

function navigate(delta) {
  const visible = getVisibleQuestions();
  const newIndex = state.currentIndex + delta;
  if (newIndex < 0) return;
  if (newIndex >= visible.length) {
    state.direction = "forward";
    state.showResults = true;
    state.infoOpen = false;
    renderPopupContent();
    return;
  }
  state.direction = delta > 0 ? "forward" : "backward";
  state.currentIndex = newIndex;
  state.infoOpen = false;
  renderPopupContent();
}

function setAnswer(questionId, value) {
  state.answers[questionId] = value;
}

// --- Popup Shell ---

function createPopupShell() {
  const existing = document.getElementById("ssf-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "ssf-overlay";
  overlay.innerHTML = `
    <div class="ssf-backdrop"></div>
    <div class="ssf-popup">
      <button id="ssf-close" class="ssf-close-btn" aria-label="Close">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      <div id="ssf-content"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector(".ssf-backdrop").addEventListener("click", closePopup);
  document.getElementById("ssf-close").addEventListener("click", closePopup);

  requestAnimationFrame(() => overlay.classList.add("ssf-visible"));
}

function closePopup() {
  const overlay = document.getElementById("ssf-overlay");
  if (!overlay) return;
  overlay.classList.remove("ssf-visible");
  overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
  state.popupOpen = false;
}

function openPopup() {
  state.popupOpen = true;
  createPopupShell();
  renderPopupContent();
}

// --- Content Rendering (inside popup) ---

function renderPopupContent() {
  const container = document.getElementById("ssf-content");
  if (!container) return;

  if (!state.started) {
    container.innerHTML = renderWelcome();
    bindWelcomeEvents();
    return;
  }

  if (state.showResults) {
    container.innerHTML = renderResults();
    bindResultsEvents();
    return;
  }

  const visible = getVisibleQuestions();
  const question = visible[state.currentIndex];
  if (!question) {
    state.currentIndex = Math.max(0, visible.length - 1);
    renderPopupContent();
    return;
  }

  const animClass = state.direction === "forward" ? "ssf-slide-enter" : "ssf-slide-enter-rev";

  container.innerHTML = `
    ${renderProgressBar(state.currentIndex, visible.length)}
    <div class="ssf-question-wrap ${animClass}">
      ${renderQuestionContent(question)}
      <div class="ssf-nav ${state.currentIndex === 0 ? "ssf-nav-end" : ""}">
        ${state.currentIndex > 0 ? renderBackButton() : ""}
        ${renderNextButton(question)}
      </div>
    </div>
  `;

  bindQuestionEvents(question);
}

function renderProgressBar(current, total) {
  const pct = ((current + 1) / total) * 100;
  return `
    <div class="ssf-progress-track">
      <div class="ssf-progress-bar" style="width: ${pct}%"></div>
    </div>
    <div class="ssf-step-label">${current + 1} of ${total}</div>
  `;
}

function renderQuestionContent(q) {
  const infoPanel = state.infoOpen
    ? `<div class="ssf-info-panel ssf-info-enter">${q.detail}</div>`
    : "";

  let inputHtml = "";
  const cur = state.answers[q.id];
  if (q.type === "yesno") inputHtml = renderYesNo(q.id, cur);
  else if (q.type === "number") inputHtml = renderNumberInput(q, cur);
  else if (q.type === "choice") inputHtml = renderChoice(q, cur);

  return `
    <div class="ssf-q-header">
      <h2 class="ssf-q-title">${q.question}</h2>
      <button id="ssf-info-toggle" class="ssf-info-btn" aria-label="More info">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>
      </button>
    </div>
    ${infoPanel}
    <div class="ssf-input-area">${inputHtml}</div>
  `;
}

function renderYesNo(qid, cur) {
  return `
    <div class="ssf-yesno-grid">
      <button data-answer="true" class="ssf-yesno ${cur === true ? "ssf-yes-active" : "ssf-yes-idle"}">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        Yes
      </button>
      <button data-answer="false" class="ssf-yesno ${cur === false ? "ssf-no-active" : "ssf-no-idle"}">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        No
      </button>
    </div>
  `;
}

function renderNumberInput(q, cur) {
  const val = cur !== undefined ? cur : "";
  return `
    <div class="ssf-number-wrap">
      <div class="ssf-number-field">
        <input id="ssf-number" type="number" value="${val}" min="${q.min ?? ""}" max="${q.max ?? ""}" placeholder="Enter amount" class="ssf-number-input" />
        ${q.unit ? `<span class="ssf-number-unit">${q.unit}</span>` : ""}
      </div>
      ${q.min !== undefined || q.max !== undefined ? `<span class="ssf-number-range">${q.min !== undefined ? `Min: ${q.min.toLocaleString()}` : ""}${q.min !== undefined && q.max !== undefined ? " · " : ""}${q.max !== undefined ? `Max: ${q.max.toLocaleString()}` : ""}</span>` : ""}
    </div>
  `;
}

function renderChoice(q, cur) {
  return `
    <div class="ssf-choice-list">
      ${q.options.map((opt) => `
        <button data-value="${opt.value}" class="ssf-choice ${cur === opt.value ? "ssf-choice-active" : ""}">
          <span class="ssf-radio ${cur === opt.value ? "ssf-radio-on" : ""}">
            ${cur === opt.value ? '<span class="ssf-radio-dot"></span>' : ""}
          </span>
          ${opt.label}
        </button>
      `).join("")}
    </div>
  `;
}

function renderBackButton() {
  return `
    <button id="ssf-back" class="ssf-btn-back">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      Back
    </button>
  `;
}

function renderNextButton(question) {
  const cur = state.answers[question.id];
  const has = cur !== undefined && cur !== "";
  const visible = getVisibleQuestions();
  const isLast = state.currentIndex === visible.length - 1;
  return `
    <button id="ssf-next" ${!has ? "disabled" : ""} class="ssf-btn-next ${has ? "" : "ssf-btn-disabled"}">
      ${isLast ? "See Results" : "Next"}
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
    </button>
  `;
}

function renderWelcome() {
  return `
    <div class="ssf-welcome">
      <div class="ssf-welcome-icon">
        <svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" class="ssf-icon-white"><path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"/></svg>
      </div>
      <h2 class="ssf-welcome-title">Student Support Finder</h2>
      <p class="ssf-welcome-sub">Find financial support options for students in Germany</p>
      <p class="ssf-welcome-desc">Answer a few quick questions to discover which programs you may be eligible for.</p>
      <button id="ssf-start" class="ssf-btn-start">
        Get Started
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
      </button>
    </div>
  `;
}

function renderResults() {
  const eligible = getEligibleOptions();

  const typeColor = (type) => {
    if (type.includes("Scholarship")) return "ssf-border-teal ssf-badge-teal";
    if (type.includes("Grant")) return "ssf-border-green ssf-badge-green";
    if (type.includes("Loan") || type.includes("loan")) return "ssf-border-amber ssf-badge-amber";
    if (type.includes("benefit")) return "ssf-border-violet ssf-badge-violet";
    return "ssf-border-indigo ssf-badge-indigo";
  };

  const cards = eligible.length > 0
    ? eligible.map((opt, i) => `
      <div class="ssf-result-card ssf-fade-in ${typeColor(opt.type).split(" ")[0]}" style="animation-delay:${i * 60}ms;animation-fill-mode:both">
        <div class="ssf-result-header">
          <div>
            <h3 class="ssf-result-name">${opt.name}</h3>
            <p class="ssf-result-full">${opt.fullName}</p>
          </div>
          <span class="ssf-result-badge ${typeColor(opt.type).split(" ")[1]}">${opt.type}</span>
        </div>
        <p class="ssf-result-desc">${opt.description}</p>
        <div class="ssf-result-footer">
          <span class="ssf-result-amount">${opt.maxAmount}</span>
          <a href="${opt.url}" target="_blank" rel="noopener" class="ssf-result-link">
            Learn more
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </a>
        </div>
      </div>
    `).join("")
    : `<div class="ssf-result-empty ssf-fade-in">
        <p class="ssf-result-empty-title">No matching programs found</p>
        <p class="ssf-result-empty-desc">Consider consulting your university's student advisory service for personalized guidance.</p>
      </div>`;

  return `
    <div class="ssf-results">
      <div class="ssf-results-header ssf-fade-in">
        <div class="ssf-results-icon">
          <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="ssf-icon-white"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h2 class="ssf-results-title">Your Results</h2>
        <p class="ssf-results-sub">${eligible.length > 0 ? `You may be eligible for <strong>${eligible.length}</strong> option${eligible.length > 1 ? "s" : ""}` : "We've analyzed your answers"}</p>
      </div>
      <div class="ssf-results-list">${cards}</div>
      <div class="ssf-results-actions">
        <button id="ssf-review" class="ssf-btn-back">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          Review
        </button>
        <button id="ssf-restart" class="ssf-btn-next">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Start Over
        </button>
      </div>
      <p class="ssf-disclaimer">Eligibility shown is approximate. Always verify directly with the respective program.</p>
    </div>
  `;
}

// --- Event Binding ---

function bindWelcomeEvents() {
  document.getElementById("ssf-start")?.addEventListener("click", () => {
    state.started = true;
    state.currentIndex = 0;
    renderPopupContent();
  });
}

function bindResultsEvents() {
  document.getElementById("ssf-review")?.addEventListener("click", () => {
    state.showResults = false;
    renderPopupContent();
  });
  document.getElementById("ssf-restart")?.addEventListener("click", () => {
    state.answers = {};
    state.currentIndex = 0;
    state.showResults = false;
    state.started = false;
    state.infoOpen = false;
    renderPopupContent();
  });
}

function bindQuestionEvents(question) {
  document.getElementById("ssf-info-toggle")?.addEventListener("click", () => {
    state.infoOpen = !state.infoOpen;
    renderPopupContent();
  });

  document.getElementById("ssf-back")?.addEventListener("click", () => navigate(-1));
  document.getElementById("ssf-next")?.addEventListener("click", () => navigate(1));

  if (question.type === "yesno") {
    document.querySelectorAll(".ssf-yesno").forEach((btn) => {
      btn.addEventListener("click", () => {
        setAnswer(question.id, btn.dataset.answer === "true");
        renderPopupContent();
        setTimeout(() => navigate(1), 200);
      });
    });
  }

  if (question.type === "choice") {
    document.querySelectorAll(".ssf-choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        setAnswer(question.id, btn.dataset.value);
        renderPopupContent();
        setTimeout(() => navigate(1), 200);
      });
    });
  }

  if (question.type === "number") {
    const input = document.getElementById("ssf-number");
    if (input) {
      input.addEventListener("input", () => {
        const val = input.value === "" ? undefined : Number(input.value);
        setAnswer(question.id, val);
        const btn = document.getElementById("ssf-next");
        if (btn) {
          const has = val !== undefined;
          btn.disabled = !has;
          btn.classList.toggle("ssf-btn-disabled", !has);
        }
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && input.value !== "") navigate(1);
      });
      input.focus();
    }
  }
}

// Keyboard: Escape closes popup
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.popupOpen) closePopup();
});

// --- Floating Action Button ---

function createFAB() {
  const fab = document.createElement("button");
  fab.id = "ssf-fab";
  fab.innerHTML = `
    <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"/></svg>
    <span>Check your eligibility for financial support</span>
  `;
  fab.addEventListener("click", openPopup);
  document.body.appendChild(fab);
}

createFAB();
