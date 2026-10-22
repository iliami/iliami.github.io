import { $ } from "../../app/dom.js";
import { onGraphChange, state } from "../../app/state.js";
import { getStructureText } from "./format.js";
import { renderStructure } from "./render.js";

const COPY_TITLE = "Скопировать представление в Python";

const graphInfoContent = $("graph_info_content");
const copyStructureButton = $("copy_structure");
const graphTabs = Array.from(document.querySelectorAll("[data-view]"));

let activeView = "matrix";
let currentCopyText = null;
let copyFeedbackTimer = null;
let initialized = false;

const updateCopyButton = () => {
    if (!copyStructureButton) {
        return;
    }

    currentCopyText = getStructureText(state.graph, activeView);
    copyStructureButton.disabled = currentCopyText === null;
};

const showCopyFeedback = () => {
    if (!copyStructureButton) {
        return;
    }

    copyStructureButton.classList.add("is_copied");
    copyStructureButton.title = "Скопировано";
    clearTimeout(copyFeedbackTimer);

    copyFeedbackTimer = setTimeout(() => {
        copyStructureButton.classList.remove("is_copied");
        copyStructureButton.title = COPY_TITLE;
    }, 1200);
};

const copyCurrentStructure = async () => {
    if (!currentCopyText) {
        return;
    }

    let copied = false;

    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(currentCopyText);
            copied = true;
        } catch {
            copied = false;
        }
    }

    if (copied) {
        showCopyFeedback();
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = currentCopyText;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    document.body.append(textarea);
    textarea.select();

    try {
        copied = document.execCommand("copy");
    } catch {
        copied = false;
    }

    textarea.remove();

    if (copied) {
        showCopyFeedback();
    }
};

const renderGraphInfo = () => {
    graphInfoContent.replaceChildren();
    updateCopyButton();
    graphInfoContent.append(renderStructure(state.graph, activeView));
};

export const initInspector = () => {
    if (initialized) {
        return;
    }

    initialized = true;

    copyStructureButton?.addEventListener("click", copyCurrentStructure);

    graphTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            activeView = tab.dataset.view ?? "matrix";

            graphTabs.forEach((candidate) => {
                const isActive = candidate === tab;
                candidate.classList.toggle("is_active", isActive);
                candidate.setAttribute("aria-selected", String(isActive));
            });

            renderGraphInfo();
        });
    });

    onGraphChange(() => {
        renderGraphInfo();
    });

    renderGraphInfo();
};
