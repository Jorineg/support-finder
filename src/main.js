import "./style.css";
import data from "./data.json";

const { questions, support_options } = data;

const state = {
  answers: {},
  currentIndex: 0,
  direction: "forward",
  infoOpen: false,
  showResults: false,
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
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "lt":
      return actual < expected;
    case "lte":
      return actual <= expected;
    case "gt":
      return actual > expected;
    case "gte":
      return actual >= expected;
    case "in":
      return expected.includes(actual);
    default:
      return false;
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
    render();
    return;
  }

  state.direction = delta > 0 ? "forward" : "backward";
  state.currentIndex = newIndex;
  state.infoOpen = false;
  render();
}

function setAnswer(questionId, value) {
  state.answers[questionId] = value;
}

// --- Rendering ---

function render() {
  const app = document.getElementById("app");

  if (state.showResults) {
    app.innerHTML = renderResults();
    return;
  }

  const visible = getVisibleQuestions();
  if (visible.length === 0) {
    app.innerHTML = renderWelcome();
    return;
  }

  const question = visible[state.currentIndex];
  if (!question) {
    state.currentIndex = visible.length - 1;
    render();
    return;
  }

  const animClass =
    state.direction === "forward" ? "slide-enter" : "slide-enter-reverse";

  app.innerHTML = `
    <div class="min-h-screen flex flex-col relative">
      <div class="blob-1"></div>
      <div class="blob-2"></div>
      ${renderProgressBar(state.currentIndex, visible.length)}
      <div class="flex-1 flex items-center justify-center px-4 py-8 relative z-1">
        <div class="w-full max-w-2xl ${animClass}" id="question-card">
          <div class="card-gradient rounded-2xl shadow-xl shadow-indigo-500/5 border border-white/80 backdrop-blur-sm p-8 md:p-12">
            ${renderQuestionContent(question)}
          </div>
          <div class="mt-8 flex items-center ${state.currentIndex === 0 ? "justify-end" : "justify-between"}">
            ${state.currentIndex > 0 ? renderBackButton() : ""}
            ${renderNextArea(question)}
          </div>
        </div>
      </div>
    </div>
  `;

  bindQuestionEvents(question);
}

function renderProgressBar(current, total) {
  const pct = ((current + 1) / total) * 100;
  return `
    <div class="w-full bg-white/50 h-2.5 sticky top-0 z-10 backdrop-blur-sm">
      <div class="gradient-bar h-2.5 transition-all duration-500 ease-out rounded-r-full" style="width: ${pct}%"></div>
    </div>
    <div class="text-center pt-6 pb-2">
      <span class="text-sm font-semibold text-violet tracking-wide uppercase">${current + 1} of ${total}</span>
    </div>
  `;
}

function renderQuestionContent(q) {
  const infoBtn = `<button id="info-toggle" class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-light hover:bg-amber/20 text-amber hover:text-amber transition-colors ml-2 align-middle flex-shrink-0" aria-label="More info">
    <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>
  </button>`;

  const infoPanel = state.infoOpen
    ? `<div class="mt-6 p-5 bg-amber-light/50 border border-amber/20 rounded-xl text-base text-gray-600 leading-relaxed info-panel-enter">${q.detail}</div>`
    : "";

  let inputHtml = "";
  const currentAnswer = state.answers[q.id];

  switch (q.type) {
    case "yesno":
      inputHtml = renderYesNo(q.id, currentAnswer);
      break;
    case "number":
      inputHtml = renderNumberInput(q, currentAnswer);
      break;
    case "choice":
      inputHtml = renderChoice(q, currentAnswer);
      break;
  }

  return `
    <div class="flex items-start gap-1 mb-8">
      <h2 class="text-2xl md:text-3xl font-bold text-gray-800 leading-snug">${q.question}</h2>
      ${infoBtn}
    </div>
    ${infoPanel}
    <div class="mt-2">${inputHtml}</div>
  `;
}

function renderYesNo(questionId, currentAnswer) {
  const yesActive = currentAnswer === true;
  const noActive = currentAnswer === false;

  return `
    <div class="grid grid-cols-2 gap-4">
      <button data-answer="true" class="yesno-btn group relative py-5 px-6 rounded-xl text-xl font-semibold border-2 transition-all duration-200 cursor-pointer
        ${yesActive ? "bg-success text-white border-success shadow-lg shadow-success/25" : "bg-success-light/50 text-success border-success/20 hover:border-success hover:bg-success-light"}">
        <span class="flex items-center justify-center gap-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
          Yes
        </span>
      </button>
      <button data-answer="false" class="yesno-btn group relative py-5 px-6 rounded-xl text-xl font-semibold border-2 transition-all duration-200 cursor-pointer
        ${noActive ? "bg-danger text-white border-danger shadow-lg shadow-danger/25" : "bg-danger-light/50 text-danger border-danger/20 hover:border-danger hover:bg-danger-light"}">
        <span class="flex items-center justify-center gap-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          No
        </span>
      </button>
    </div>
  `;
}

function renderNumberInput(q, currentAnswer) {
  const val = currentAnswer !== undefined ? currentAnswer : "";
  return `
    <div class="flex flex-col items-center gap-3">
      <div class="relative w-full max-w-xs">
        <input id="number-input" type="number" value="${val}"
          min="${q.min ?? ""}" max="${q.max ?? ""}"
          placeholder="Enter amount"
          class="w-full text-center text-3xl font-bold text-gray-900 bg-white/70 border-2 border-violet/20 rounded-xl py-4 px-6 focus:outline-none focus:border-violet focus:ring-4 focus:ring-violet/10 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        ${q.unit ? `<span class="absolute right-4 top-1/2 -translate-y-1/2 text-base font-medium text-gray-400">${q.unit}</span>` : ""}
      </div>
      ${q.min !== undefined || q.max !== undefined ? `<span class="text-sm text-gray-400">${q.min !== undefined ? `Min: ${q.min.toLocaleString()}` : ""}${q.min !== undefined && q.max !== undefined ? " · " : ""}${q.max !== undefined ? `Max: ${q.max.toLocaleString()}` : ""}</span>` : ""}
    </div>
  `;
}

function renderChoice(q, currentAnswer) {
  return `
    <div class="flex flex-col gap-3">
      ${q.options
        .map(
          (opt) => `
        <button data-value="${opt.value}" class="choice-btn w-full text-left py-4 px-6 rounded-xl text-lg font-medium border-2 transition-all duration-200 cursor-pointer
          ${currentAnswer === opt.value ? "gradient-btn text-white border-transparent shadow-lg shadow-violet/25" : "bg-white/70 text-gray-700 border-violet/15 hover:border-violet hover:bg-violet-light/50"}">
          <span class="flex items-center gap-3">
            <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
              ${currentAnswer === opt.value ? "border-white" : "border-violet/30"}">
              ${currentAnswer === opt.value ? '<span class="w-2.5 h-2.5 rounded-full bg-white"></span>' : ""}
            </span>
            ${opt.label}
          </span>
        </button>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderBackButton() {
  return `
    <button id="back-btn" class="flex items-center gap-2 py-3 px-6 rounded-xl text-lg font-medium text-gray-500 hover:text-gray-700 hover:bg-white border-2 border-transparent hover:border-gray-200 transition-all cursor-pointer">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      Back
    </button>
  `;
}

function renderNextArea(question) {
  const currentAnswer = state.answers[question.id];
  const hasAnswer = currentAnswer !== undefined && currentAnswer !== "";
  const visible = getVisibleQuestions();
  const isLast = state.currentIndex === visible.length - 1;

  return `
    <button id="next-btn" ${!hasAnswer ? "disabled" : ""} class="flex items-center gap-2 py-3 px-8 rounded-xl text-lg font-semibold transition-all cursor-pointer
      ${hasAnswer ? "gradient-btn text-white shadow-lg shadow-violet/25 hover:shadow-xl hover:shadow-violet/30" : "bg-gray-100 text-gray-300 cursor-not-allowed"}">
      ${isLast ? "See Results" : "Next"}
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
    </button>
  `;
}

function renderResults() {
  const eligible = getEligibleOptions();
  const visible = getVisibleQuestions();

  const typeColors = {
    grant: { border: "border-l-success", badge: "bg-success-light text-success" },
    scholarship: { border: "border-l-teal", badge: "bg-teal-light text-teal" },
    loan: { border: "border-l-amber", badge: "bg-amber-light text-amber" },
    benefit: { border: "border-l-violet", badge: "bg-violet-light text-violet" },
    support: { border: "border-l-primary", badge: "bg-primary-light text-primary" },
  };

  function getTypeColor(type) {
    if (type.includes("Scholarship")) return typeColors.scholarship;
    if (type.includes("Grant")) return typeColors.grant;
    if (type.includes("Loan") || type.includes("loan")) return typeColors.loan;
    if (type.includes("benefit")) return typeColors.benefit;
    return typeColors.support;
  }

  const cardHtml =
    eligible.length > 0
      ? eligible
          .map((opt, i) => {
            const colors = getTypeColor(opt.type);
            return `
    <div class="fade-in card-gradient rounded-2xl shadow-lg shadow-indigo-500/5 border border-white/80 border-l-4 ${colors.border} p-6 md:p-8" style="animation-delay: ${i * 80}ms; animation-fill-mode: both">
      <div class="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 class="text-xl font-bold text-gray-900">${opt.name}</h3>
          <p class="text-sm text-gray-400 mt-0.5">${opt.fullName}</p>
        </div>
        <span class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${colors.badge}">
          ${opt.type}
        </span>
      </div>
      <p class="text-gray-600 leading-relaxed mb-4">${opt.description}</p>
      <div class="flex items-center justify-between pt-4 border-t border-gray-100">
        <span class="text-lg font-bold gradient-text">${opt.maxAmount}</span>
        <a href="${opt.url}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-violet hover:text-primary font-semibold transition-colors">
          Learn more
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        </a>
      </div>
    </div>
  `;
          })
          .join("")
      : `
    <div class="fade-in card-gradient rounded-2xl shadow-lg shadow-indigo-500/5 border border-white/80 p-8 md:p-12 text-center">
      <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-violet-light flex items-center justify-center">
        <svg class="w-8 h-8 text-violet" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
      </div>
      <h3 class="text-xl font-bold text-gray-900 mb-2">No matching programs found</h3>
      <p class="text-gray-500">Based on your answers, we couldn't find matching support options. Consider reviewing your answers or consulting your university's student advisory service (Studierendenwerk) for personalized guidance.</p>
    </div>
  `;

  return `
    <div class="min-h-screen relative">
      <div class="blob-1"></div>
      <div class="blob-2"></div>
      <div class="blob-3"></div>
      <div class="w-full gradient-bar h-2.5"></div>
      <div class="max-w-3xl mx-auto px-4 py-12 relative z-1">
        <div class="text-center mb-10 fade-in">
          <div class="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-success to-teal flex items-center justify-center shadow-lg shadow-success/20">
            <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h1 class="text-3xl md:text-4xl font-bold gradient-text mb-3">Your Results</h1>
          <p class="text-lg text-gray-500">
            ${eligible.length > 0 ? `You may be eligible for <strong class="gradient-text">${eligible.length}</strong> support option${eligible.length > 1 ? "s" : ""}` : "We've analyzed your answers"}
          </p>
        </div>
        <div class="flex flex-col gap-6">${cardHtml}</div>
        <div class="flex justify-center mt-12 gap-4">
          <button id="back-to-questions" class="flex items-center gap-2 py-3 px-6 rounded-xl text-lg font-medium text-violet hover:text-primary bg-white/70 border-2 border-violet/20 hover:border-violet/40 transition-all cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Review Answers
          </button>
          <button id="restart-btn" class="flex items-center gap-2 py-3 px-6 rounded-xl text-lg font-semibold gradient-btn text-white shadow-lg shadow-violet/25 transition-all cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Start Over
          </button>
        </div>
        <p class="text-center text-sm text-gray-400 mt-8">
          This is an informational tool only. Eligibility shown here is approximate. Always verify directly with the respective program.
        </p>
      </div>
    </div>
  `;
}

function renderWelcome() {
  return `
    <div class="min-h-screen flex items-center justify-center px-4 relative">
      <div class="blob-1"></div>
      <div class="blob-2"></div>
      <div class="blob-3"></div>
      <div class="max-w-2xl text-center fade-in relative z-1">
        <div class="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-primary via-violet to-pink-500 flex items-center justify-center shadow-xl shadow-violet/25">
          <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"/></svg>
        </div>
        <h1 class="text-4xl md:text-5xl font-bold gradient-text mb-4">Student Support Finder</h1>
        <p class="text-xl text-gray-600 mb-2">Find financial support options for students in Germany</p>
        <p class="text-base text-gray-400 mb-10">Answer a few quick questions and we'll show you which programs you may be eligible for.</p>
        <button id="start-btn" class="inline-flex items-center gap-3 py-4 px-10 rounded-xl text-xl font-semibold gradient-btn text-white shadow-xl shadow-violet/25 hover:shadow-2xl hover:shadow-violet/30 transition-all cursor-pointer">
          Get Started
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
        </button>
        <div class="mt-12 flex justify-center gap-8 text-sm text-gray-400">
          <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-success"></span> Scholarships</span>
          <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-violet"></span> BAföG</span>
          <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber"></span> Loans</span>
          <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-teal"></span> Benefits</span>
        </div>
      </div>
    </div>
  `;
}

// --- Event Binding ---

function bindQuestionEvents(question) {
  document.getElementById("info-toggle")?.addEventListener("click", () => {
    state.infoOpen = !state.infoOpen;
    render();
  });

  document.getElementById("back-btn")?.addEventListener("click", () => {
    navigate(-1);
  });

  document.getElementById("next-btn")?.addEventListener("click", () => {
    navigate(1);
  });

  if (question.type === "yesno") {
    document.querySelectorAll(".yesno-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.answer === "true";
        setAnswer(question.id, val);
        render();
        setTimeout(() => navigate(1), 250);
      });
    });
  }

  if (question.type === "choice") {
    document.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setAnswer(question.id, btn.dataset.value);
        render();
        setTimeout(() => navigate(1), 250);
      });
    });
  }

  if (question.type === "number") {
    const input = document.getElementById("number-input");
    if (input) {
      input.addEventListener("input", () => {
        const val = input.value === "" ? undefined : Number(input.value);
        setAnswer(question.id, val);
        const nextBtn = document.getElementById("next-btn");
        if (nextBtn) {
          const hasAnswer = val !== undefined && val !== "";
          nextBtn.disabled = !hasAnswer;
          nextBtn.className = `flex items-center gap-2 py-3 px-8 rounded-xl text-lg font-semibold transition-all cursor-pointer ${hasAnswer ? "gradient-btn text-white shadow-lg shadow-violet/25" : "bg-gray-100 text-gray-300 cursor-not-allowed"}`;
        }
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && input.value !== "") {
          navigate(1);
        }
      });
      input.focus();
    }
  }
}

// Global click handler for results page
document.addEventListener("click", (e) => {
  const backBtn = e.target.closest("#back-to-questions");
  const restartBtn = e.target.closest("#restart-btn");
  const startBtn = e.target.closest("#start-btn");

  if (backBtn) {
    state.showResults = false;
    render();
  }

  if (restartBtn) {
    state.answers = {};
    state.currentIndex = 0;
    state.showResults = false;
    state.infoOpen = false;
    render();
  }

  if (startBtn) {
    state.currentIndex = 0;
    render();
  }
});

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  if (state.showResults) return;

  if (e.key === "ArrowLeft" || e.key === "Backspace") {
    if (document.activeElement?.tagName === "INPUT") return;
    navigate(-1);
  }
  if (e.key === "ArrowRight") {
    if (document.activeElement?.tagName === "INPUT") return;
    const visible = getVisibleQuestions();
    const q = visible[state.currentIndex];
    if (q && state.answers[q.id] !== undefined) {
      navigate(1);
    }
  }
});

render();
