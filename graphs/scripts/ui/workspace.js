import { $, svg } from "../app/dom.js";
import { state } from "../app/state.js";
import { clamp } from "../app/utils.js";

const app = $("app");
const leftPanel = $("left_panel");
const rightPanel = $("right_panel");

const leftToggle = $("toggle_left_panel");
const rightToggle = $("toggle_right_panel");
const leftClose = $("left_panel_close");
const rightClose = $("right_panel_close");
const focusToggle = $("focus_toggle");
const focusExit = $("focus_exit");

const pointerCoords = $("pointer_coords");
const playerDock = $("player_dock");

const speedControl = $("speed_control");
const speedToggle = $("speed_toggle");
const speedMenu = $("speed_menu");
const speedInput = $("speed");
const speedPresets = Array.from(document.querySelectorAll("[data-speed]"));

const HUD_STACK_BREAKPOINT = 580;

let focusMode = false;
let resizeState = null;
let initialized = false;
let setLeftTab = () => {};
let setRightTab = () => {};

const isPanelOpen = (side) =>
    !app.classList.contains(
        side === "left" ? "is_left_closed" : "is_right_closed",
    );

const updateWorkspaceMetrics = () => {
    const leftWidth =
        !focusMode && isPanelOpen("left")
            ? (leftPanel?.getBoundingClientRect().width ?? 0)
            : 0;
    const rightWidth =
        !focusMode && isPanelOpen("right")
            ? (rightPanel?.getBoundingClientRect().width ?? 0)
            : 0;

    app.style.setProperty("--left-offset", `${Math.round(leftWidth)}px`);
    app.style.setProperty("--right-offset", `${Math.round(rightWidth)}px`);

    const maxPanelWidth = Math.max(leftWidth, rightWidth);
    const transportMaxWidth = Math.max(
        0,
        window.innerWidth - maxPanelWidth * 2 - 16,
    );

    app.style.setProperty(
        "--transport-max-width",
        `${Math.round(transportMaxWidth)}px`,
    );
    playerDock?.classList.toggle(
        "is_stacked",
        transportMaxWidth < HUD_STACK_BREAKPOINT,
    );
    app.classList.toggle("is_transport_narrow", transportMaxWidth < 300);
};

const setPanel = (side, open) => {
    const closedClass = side === "left" ? "is_left_closed" : "is_right_closed";
    const toggle = side === "left" ? leftToggle : rightToggle;

    if (open && window.innerWidth < 900) {
        const otherSide = side === "left" ? "right" : "left";

        if (isPanelOpen(otherSide)) {
            setPanel(otherSide, false);
        }
    }

    app.classList.toggle(closedClass, !open);

    if (toggle) {
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute(
            "aria-label",
            open
                ? side === "left"
                    ? "Скрыть панель алгоритмов"
                    : "Скрыть инспектор"
                : side === "left"
                  ? "Показать панель алгоритмов"
                  : "Показать инспектор",
        );
    }

    updateWorkspaceMetrics();
};

const togglePanel = (side) => setPanel(side, !isPanelOpen(side));

const setFocusMode = (enabled) => {
    focusMode = enabled;
    app.classList.toggle("is_focus", enabled);

    if (focusToggle) {
        focusToggle.setAttribute("aria-pressed", String(enabled));
        focusToggle.setAttribute(
            "aria-label",
            enabled ? "Выключить режим фокуса" : "Включить режим фокуса",
        );
        focusToggle.title = enabled
            ? "Выключить режим фокуса (Tab / F)"
            : "Режим фокуса (Tab / F)";
    }

    updateWorkspaceMetrics();
};

const createPanelTabs = (panel) => {
    if (!panel) {
        return () => {};
    }

    const tabs = Array.from(panel.querySelectorAll("[data-panel-tab]"));
    const panes = Array.from(panel.querySelectorAll("[data-panel-pane]"));

    const setTab = (name, moveFocus = false) => {
        tabs.forEach((tab) => {
            const isActive = tab.dataset.panelTab === name;
            tab.classList.toggle("is_active", isActive);
            tab.setAttribute("aria-selected", String(isActive));
            tab.tabIndex = isActive ? 0 : -1;

            if (isActive && moveFocus) {
                tab.focus();
            }
        });

        panes.forEach((pane) => {
            const isActive = pane.dataset.panelPane === name;
            pane.hidden = !isActive;
            pane.classList.toggle("is_active", isActive);
        });
    };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => setTab(tab.dataset.panelTab));
    });

    tabs.forEach((tab, index) => {
        tab.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                return;
            }

            event.preventDefault();

            const direction = event.key === "ArrowRight" ? 1 : -1;
            const nextIndex = (index + direction + tabs.length) % tabs.length;
            setTab(tabs[nextIndex].dataset.panelTab, true);
        });
    });

    return setTab;
};

const updatePointerCoords = (event) => {
    if (!pointerCoords) {
        return;
    }

    const bounds = svg.getBoundingClientRect();

    if (!bounds.width || !bounds.height) {
        return;
    }

    const x = state.view.x + (event.clientX - bounds.left) / state.view.scale;
    const y = state.view.y + (event.clientY - bounds.top) / state.view.scale;

    pointerCoords.textContent = `x ${Math.round(x)} · y ${Math.round(y)}`;
};

const syncSpeedUI = () => {
    if (!speedInput) {
        return;
    }

    const value = Number(speedInput.value) || 1;

    speedPresets.forEach((button) => {
        const isActive = Math.abs(Number(button.dataset.speed) - value) < 0.05;

        button.classList.toggle("is_active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
};

const setSpeedMenuOpen = (open) => {
    if (!speedMenu || !speedToggle) {
        return;
    }

    speedMenu.hidden = !open;
    speedToggle.setAttribute("aria-expanded", String(open));

    if (open) {
        syncSpeedUI();
    }
};

const initPanelResizing = () => {
    document.querySelectorAll("[data-resize]").forEach((handle) => {
        handle.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) {
                return;
            }

            event.preventDefault();
            handle.setPointerCapture(event.pointerId);

            const side = handle.dataset.resize;
            const panel = side === "left" ? leftPanel : rightPanel;

            if (!panel) {
                return;
            }

            resizeState = {
                side,
                startX: event.clientX,
                startWidth: panel.getBoundingClientRect().width,
                appLeft: app.getBoundingClientRect().left,
                appRight: app.getBoundingClientRect().right,
            };

            document.body.classList.add("is_resizing");
        });

        handle.addEventListener("pointermove", (event) => {
            if (!resizeState) {
                return;
            }

            const { side, appLeft, appRight } = resizeState;

            if (side === "left") {
                const maxWidth = Math.min(480, window.innerWidth * 0.6);
                const width = clamp(event.clientX - appLeft, 200, maxWidth);

                app.style.setProperty(
                    "--left-panel-width",
                    `${Math.round(width)}px`,
                );
            } else {
                const maxWidth = Math.min(560, window.innerWidth * 0.7);
                const width = clamp(appRight - event.clientX, 240, maxWidth);

                app.style.setProperty(
                    "--right-panel-width",
                    `${Math.round(width)}px`,
                );
            }

            updateWorkspaceMetrics();
        });

        const stopResize = (event) => {
            if (!resizeState) {
                return;
            }

            resizeState = null;
            document.body.classList.remove("is_resizing");
            updateWorkspaceMetrics();

            if (handle.hasPointerCapture?.(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }
        };

        handle.addEventListener("pointerup", stopResize);
        handle.addEventListener("pointercancel", stopResize);
    });
};

const isTextInput = (target) =>
    target instanceof HTMLElement &&
    (target.matches("input, select, textarea") || target.isContentEditable);

const isTypingContext = (target) =>
    target instanceof HTMLElement &&
    (target.matches("input, select, textarea, button, a") ||
        target.isContentEditable);

const initShortcuts = () => {
    document.addEventListener("keydown", (event) => {
        const target = event.target;

        if (event.code === "Escape" && speedMenu && !speedMenu.hidden) {
            event.preventDefault();
            setSpeedMenuOpen(false);
            speedToggle?.focus();
            return;
        }

        if ((event.ctrlKey || event.metaKey) && event.code === "KeyB") {
            event.preventDefault();
            togglePanel("left");
            return;
        }

        if ((event.ctrlKey || event.metaKey) && event.code === "KeyI") {
            event.preventDefault();
            togglePanel("right");
            return;
        }

        if (event.code === "Escape" && focusMode) {
            event.preventDefault();
            setFocusMode(false);
            return;
        }

        if (
            event.code === "KeyF" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
        ) {
            if (isTextInput(target)) {
                return;
            }

            event.preventDefault();
            setFocusMode(!focusMode);
            return;
        }

        if (
            event.code === "Tab" &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
        ) {
            if (document.activeElement !== svg || isTypingContext(target)) {
                return;
            }

            event.preventDefault();
            setFocusMode(!focusMode);
        }
    });
};

const initSpeedMenu = () => {
    speedToggle?.addEventListener("click", () => {
        setSpeedMenuOpen(speedMenu.hidden);
    });

    speedInput?.addEventListener("input", syncSpeedUI);

    speedPresets.forEach((button) => {
        button.addEventListener("click", () => {
            if (!speedInput) {
                return;
            }

            speedInput.value = button.dataset.speed;
            speedInput.dispatchEvent(new Event("input", { bubbles: true }));
            setSpeedMenuOpen(false);
            speedToggle?.focus();
        });
    });

    document.addEventListener("click", (event) => {
        if (!speedControl || !speedMenu || speedMenu.hidden) {
            return;
        }

        if (!speedControl.contains(event.target)) {
            setSpeedMenuOpen(false);
        }
    });

    syncSpeedUI();
};

export const initWorkspace = () => {
    if (initialized) {
        return;
    }

    initialized = true;

    leftToggle?.addEventListener("click", () => togglePanel("left"));
    rightToggle?.addEventListener("click", () => togglePanel("right"));
    leftClose?.addEventListener("click", () => setPanel("left", false));
    rightClose?.addEventListener("click", () => setPanel("right", false));

    focusToggle?.addEventListener("click", () => setFocusMode(!focusMode));
    focusExit?.addEventListener("click", () => setFocusMode(false));

    setLeftTab = createPanelTabs(leftPanel);
    setRightTab = createPanelTabs(rightPanel);

    svg.addEventListener("mousemove", updatePointerCoords);
    svg.addEventListener("mouseleave", () => {
        if (pointerCoords) {
            pointerCoords.textContent = "x — · y —";
        }
    });

    initSpeedMenu();
    initPanelResizing();
    initShortcuts();

    if (window.innerWidth < 900) {
        setPanel("left", false);
        setPanel("right", false);
    }

    setLeftTab("algorithms");
    setRightTab("structure");

    window.addEventListener("resize", () => {
        if (
            !focusMode &&
            window.innerWidth < 900 &&
            isPanelOpen("left") &&
            isPanelOpen("right")
        ) {
            setPanel("right", false);
            return;
        }

        updateWorkspaceMetrics();
    });

    updateWorkspaceMetrics();
};
