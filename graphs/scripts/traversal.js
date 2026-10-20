import { STEP_TYPE, bfsTraversal, dfsTraversal } from "./core.js";

import {
    COLORS,
    MODES,
    algorithmLog,
    btnStartBFS,
    btnStartDFS,
    clearLogButton,
    defaultMode,
    onGraphChange,
    playPauseButton,
    playerProgress,
    playerStatus,
    playerStepLabel,
    pseudocode,
    pseudocodeTitle,
    returnDefaultColorsButton,
    selectorVertexNumber,
    setEdgeStroke,
    setVertexFill,
    speedInput,
    speedValue,
    state,
    stepBackButton,
    stepForwardButton,
    textResultBFS,
    textResultDFS,
    updateAppStatus,
} from "./ui.js";

import { returnDefaultColors } from "./graph-editor.js";

const BASE_DELAY_MS = 650;

const PSEUDOCODE = {
    bfs: {
        title: "BFS",
        lines: [
            "function BFS(graph, start):",
            "  visited ← {start}",
            "  queue ← [start]",
            "  while queue не пуста:",
            "    u ← queue.shift()",
            "    for v in neighbors(u):",
            "      if v ∉ visited:",
            "        visited.add(v)",
            "        queue.push(v)",
            "        отметить ребро (u, v)",
            "        посетить v",
            "  return visited",
        ],
    },
    dfs: {
        title: "DFS",
        lines: [
            "function DFS(graph, start):",
            "  visited ← {}",
            "  function visit(u, parent):",
            "    if u ∈ visited: return",
            "    visited.add(u)",
            "    if parent ≠ null:",
            "      отметить ребро (parent, u)",
            "    посетить u",
            "    for v in neighbors(u):",
            "      visit(v, u)",
            "  visit(start, null)",
            "  return visited",
        ],
    },
};

const player = {
    steps: [],
    visited: [],
    index: -1,
    playing: false,
    timer: null,
    speed: 1,
    algorithm: "bfs",
    startVertexId: null,
};

const getVertexById = (vertexId) =>
    state.graph.vertices.find((vertex) => vertex.id === vertexId);

const getVertexLabelById = (vertexId) => {
    const vertex = getVertexById(vertexId);
    return vertex ? (vertex.label ?? vertex.id) : vertexId;
};

const getSelectedStartVertex = () => {
    const selectedId = selectorVertexNumber.value;
    const selected = state.graph.vertices.find(
        (vertex) => vertex.id === selectedId,
    );

    return selected ?? state.graph.vertices[0] ?? null;
};

const setPlayerStatus = (text) => {
    playerStatus.textContent = text;
};

const formatTraversalResult = (visitedIds) =>
    visitedIds.map(getVertexLabelById).join(" → ");

const clearTimer = () => {
    if (player.timer !== null) {
        clearTimeout(player.timer);
        player.timer = null;
    }
};

const renderPseudocode = (activeLine) => {
    const config = PSEUDOCODE[player.algorithm] ?? PSEUDOCODE.bfs;

    pseudocodeTitle.textContent = config.title;
    pseudocode.replaceChildren();

    config.lines.forEach((code, index) => {
        const line = document.createElement("div");
        line.className = "code_line";

        if (index + 1 === activeLine) {
            line.classList.add("is_active");
        }

        const lineNumber = document.createElement("span");
        lineNumber.className = "line_no";
        lineNumber.textContent = String(index + 1);

        const codeText = document.createElement("span");
        codeText.textContent = code;

        line.append(lineNumber, codeText);
        pseudocode.append(line);
    });
};

const renderLog = (upToIndex) => {
    algorithmLog.replaceChildren();

    if (upToIndex < 0 || player.steps.length === 0) {
        const empty = document.createElement("div");
        empty.className = "log_empty";
        empty.textContent = "Запустите BFS или DFS, чтобы увидеть шаги выполнения.";
        algorithmLog.append(empty);
        return;
    }

    const fragment = document.createDocumentFragment();

    for (let index = 0; index <= upToIndex; index += 1) {
        const step = player.steps[index];

        if (!step) {
            continue;
        }

        const entry = document.createElement("div");
        entry.className = "log_entry";

        const logIndex = document.createElement("span");
        logIndex.className = "log_index";
        logIndex.textContent = String(index + 1).padStart(2, "0");

        const text = document.createElement("span");

        if (step.type === STEP_TYPE.edge) {
            const edge = state.graph.edges.find(
                (candidate) => candidate.id === step.edgeId,
            );

            if (edge) {
                const label = document.createElement("b");
                label.textContent = `${getVertexLabelById(edge.fromId)} — ${getVertexLabelById(edge.toId)}`;
                text.append("Ребро ", label);
            } else {
                text.textContent = "Ребро";
            }
        } else {
            const label = document.createElement("b");
            label.textContent = getVertexLabelById(step.vertexId);
            text.append("Посещена вершина ", label);
        }

        entry.append(logIndex, text);
        fragment.append(entry);
    }

    algorithmLog.append(fragment);
    algorithmLog.scrollTop = algorithmLog.scrollHeight;
};

const resetSimulation = () => {
    for (const vertexId of state.vertexElements.keys()) {
        setVertexFill(vertexId, COLORS.vertex, COLORS.vertexText);
    }

    for (const edgeId of state.edgeElements.keys()) {
        setEdgeStroke(edgeId, COLORS.edge);
    }
};

const updatePlayerUI = () => {
    const total = player.steps.length;
    const hasSteps = total > 0;
    const atEnd = player.index >= total - 1;

    playerProgress.max = String(Math.max(total - 1, 0));
    playerProgress.value = String(Math.max(player.index, 0));
    playerProgress.disabled = !hasSteps;

    playPauseButton.disabled = !hasSteps;
    playPauseButton.classList.toggle("is_playing", player.playing);
    playPauseButton.title = player.playing ? "Пауза" : "Воспроизвести";
    playPauseButton.setAttribute(
        "aria-label",
        player.playing ? "Пауза" : "Воспроизвести",
    );

    stepForwardButton.disabled = !hasSteps || atEnd;
    stepBackButton.disabled = !hasSteps || player.index < 0;

    playerStepLabel.textContent = `${Math.max(player.index + 1, 0)} / ${total}`;
};

const applyStepsUpTo = (upToIndex) => {
    resetSimulation();

    let activeVertexId = null;

    for (let index = 0; index <= upToIndex; index += 1) {
        const step = player.steps[index];

        if (!step) {
            continue;
        }

        if (step.type === STEP_TYPE.edge) {
            setEdgeStroke(step.edgeId, COLORS.edgeVisited);
        } else {
            setVertexFill(
                step.vertexId,
                COLORS.vertexVisited,
                COLORS.vertexVisitedText,
            );
            activeVertexId = step.vertexId;
        }
    }

    if (activeVertexId !== null) {
        setVertexFill(
            activeVertexId,
            COLORS.vertexActive,
            COLORS.vertexActiveText,
        );
    }

    const activeLine =
        upToIndex >= 0 ? player.steps[upToIndex]?.line ?? null : null;

    renderPseudocode(activeLine);
    renderLog(upToIndex);
    updatePlayerUI();
};

const getDelay = () => Math.max(80, BASE_DELAY_MS / player.speed);

const scheduleNextStep = () => {
    clearTimer();

    if (!player.playing) {
        return;
    }

    player.timer = setTimeout(() => {
        player.timer = null;

        if (!player.playing) {
            return;
        }

        if (player.index >= player.steps.length - 1) {
            player.playing = false;
            updatePlayerUI();
            setPlayerStatus("Завершено");
            updateAppStatus("Готово");
            return;
        }

        player.index += 1;
        applyStepsUpTo(player.index);
        setPlayerStatus("Воспроизведение");
        scheduleNextStep();
    }, getDelay());
};

const play = () => {
    if (player.steps.length === 0) {
        return;
    }

    if (player.index >= player.steps.length - 1) {
        player.index = -1;
        applyStepsUpTo(player.index);
    }

    player.playing = true;
    updatePlayerUI();
    setPlayerStatus("Воспроизведение");
    updateAppStatus("Выполняется алгоритм");
    scheduleNextStep();
};

const pausePlayback = (statusText = "Пауза") => {
    player.playing = false;
    clearTimer();
    updatePlayerUI();

    if (player.steps.length > 0) {
        setPlayerStatus(statusText);
    }
};

const startTraversal = (traverse, algorithm, resultElement) => {
    const startVertex = getSelectedStartVertex();

    if (!startVertex) {
        return;
    }

    clearTimer();
    resetSimulation();

    defaultMode.checked = true;
    state.mode = MODES.default;

    const { visited, steps } = traverse(state.graph, startVertex.id);

    player.steps = steps;
    player.visited = visited;
    player.index = -1;
    player.playing = false;
    player.algorithm = algorithm;
    player.startVertexId = startVertex.id;

    resultElement.textContent = formatTraversalResult(visited);

    renderPseudocode(null);
    renderLog(-1);
    updatePlayerUI();
    setPlayerStatus("Готово к запуску");
    updateAppStatus(
        `${algorithm.toUpperCase()}: старт из вершины ${getVertexLabelById(startVertex.id)}`,
    );

    play();
};

function handleClickOnButtonStartBFS() {
    startTraversal(bfsTraversal, "bfs", textResultBFS);
}

function handleClickOnButtonStartDFS() {
    startTraversal(dfsTraversal, "dfs", textResultDFS);
}

const resetPlayer = (statusText) => {
    clearTimer();
    player.playing = false;
    player.steps = [];
    player.visited = [];
    player.index = -1;
    player.startVertexId = null;

    renderPseudocode(null);
    renderLog(-1);
    updatePlayerUI();
    setPlayerStatus(statusText);
};btnStartBFS.addEventListener("click", handleClickOnButtonStartBFS);
btnStartDFS.addEventListener("click", handleClickOnButtonStartDFS);

playPauseButton.addEventListener("click", () => {
    if (player.playing) {
        pausePlayback();
        updateAppStatus("Пауза");
        return;
    }

    play();
});

stepForwardButton.addEventListener("click", () => {
    if (player.steps.length === 0) {
        return;
    }

    pausePlayback("Пошагово");

    if (player.index < player.steps.length - 1) {
        player.index += 1;
        applyStepsUpTo(player.index);
        setPlayerStatus(
            player.index >= player.steps.length - 1 ? "Завершено" : "Пошагово",
        );
    }
});

stepBackButton.addEventListener("click", () => {
    if (player.steps.length === 0 || player.index < 0) {
        return;
    }

    pausePlayback("Пошагово");
    player.index -= 1;
    applyStepsUpTo(player.index);
    setPlayerStatus(player.index < 0 ? "Готово к запуску" : "Пошагово");
});

playerProgress.addEventListener("input", () => {
    if (player.steps.length === 0) {
        return;
    }

    pausePlayback("Перемотка");
    player.index = Number(playerProgress.value);
    applyStepsUpTo(player.index);
    setPlayerStatus(
        player.index >= player.steps.length - 1 ? "Завершено" : "Пошагово",
    );
});

speedInput.addEventListener("input", () => {
    player.speed = Math.max(0.1, Math.min(3, Number(speedInput.value) || 1));
    speedValue.textContent = `${player.speed.toFixed(1)}×`;

    if (player.playing) {
        scheduleNextStep();
    }
});

returnDefaultColorsButton.addEventListener("click", () => {
    returnDefaultColors();
    resetPlayer("Готово");
    updateAppStatus("Цвета сброшены");
});

clearLogButton.addEventListener("click", () => {
    algorithmLog.replaceChildren();
});

onGraphChange((graph, reason) => {
    if (reason === "rename") {
        if (player.index >= 0) {
            renderLog(player.index);
        }
        return;
    }

    textResultBFS.textContent = "Запустите обход, чтобы увидеть порядок вершин.";
    textResultDFS.textContent = "Запустите обход, чтобы увидеть порядок вершин.";

    if (player.steps.length === 0 && !player.playing) {
        return;
    }

    resetPlayer("Граф изменён");
});

renderPseudocode(null);
renderLog(-1);
updatePlayerUI();
setPlayerStatus("Готово");
