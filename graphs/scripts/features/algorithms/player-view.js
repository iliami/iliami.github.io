import { COLORS } from "../../app/constants.js";
import { $ } from "../../app/dom.js";
import { STEP_TONE, STEP_TYPE } from "../../algorithms/contract.js";
import { setEdgeStroke, setVertexFill } from "../../ui/canvas.js";

const EMPTY_LOG_TEXT = "Запустите алгоритм, чтобы увидеть шаги выполнения.";

const VERTEX_TONES = {
    [STEP_TONE.visited]: [COLORS.vertexVisited, COLORS.vertexVisitedText],
    [STEP_TONE.active]: [COLORS.vertexActive, COLORS.vertexActiveText],
    [STEP_TONE.path]: [COLORS.simulationVertex, COLORS.vertexText],
    [STEP_TONE.rejected]: [COLORS.vertex, COLORS.vertexText],
};

const EDGE_TONES = {
    [STEP_TONE.visited]: COLORS.edgeVisited,
    [STEP_TONE.active]: COLORS.edgeVisited,
    [STEP_TONE.path]: COLORS.simulationEdge,
    [STEP_TONE.rejected]: COLORS.edge,
};

const playPauseButton = $("play_pause");
const stepBackButton = $("step_back");
const stepForwardButton = $("step_forward");
const playerStepLabel = $("player_step");
const pseudocodeElement = $("pseudocode");
const pseudocodeTitle = $("pseudocode_title");
const algorithmLog = $("algorithm_log");

const getVertexLabel = (graph, vertexId) =>
    graph.vertexById.get(vertexId)?.label ?? vertexId;

const getEdgeLabel = (graph, edgeId) => {
    const edge = graph.edgeById.get(edgeId);

    if (!edge) {
        return null;
    }

    return `${getVertexLabel(graph, edge.fromId)} — ${getVertexLabel(graph, edge.toId)}`;
};

const createLogEntry = (index, text) => {
    const entry = document.createElement("div");
    entry.className = "log_entry";

    const logIndex = document.createElement("span");
    logIndex.className = "log_index";
    logIndex.textContent = String(index + 1).padStart(2, "0");

    const content = document.createElement("span");
    content.textContent = text;

    entry.append(logIndex, content);

    return entry;
};

const getStepText = (graph, step) => {
    if (step.type === STEP_TYPE.log) {
        return step.message;
    }

    if (typeof step.message === "string" && step.message.length > 0) {
        return step.message;
    }

    if (step.type === STEP_TYPE.edge) {
        const label = getEdgeLabel(graph, step.edgeId);
        return label ? `Ребро ${label}` : "Ребро";
    }

    return `Посещена вершина ${getVertexLabel(graph, step.vertexId)}`;
};

export const createAlgorithmView = () => {
    let graph = null;
    let resultElement = null;

    const resetSimulation = () => {
        if (!graph) {
            return;
        }

        for (const vertexId of graph.vertexById.keys()) {
            setVertexFill(vertexId, COLORS.vertex, COLORS.vertexText);
        }

        for (const edgeId of graph.edgeById.keys()) {
            setEdgeStroke(edgeId, COLORS.edge);
        }
    };

    const renderPseudocode = (pseudocodeLines, title, activeLine) => {
        pseudocodeTitle.textContent = title ?? "";
        pseudocodeElement.replaceChildren();

        pseudocodeLines.forEach((code, index) => {
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
            pseudocodeElement.append(line);
        });
    };

    const renderLog = (steps, upToIndex) => {
        algorithmLog.replaceChildren();

        if (upToIndex < 0 || steps.length === 0) {
            const empty = document.createElement("div");
            empty.className = "log_empty";
            empty.textContent = EMPTY_LOG_TEXT;
            algorithmLog.append(empty);
            return;
        }

        const fragment = document.createDocumentFragment();

        for (let index = 0; index <= upToIndex; index += 1) {
            const step = steps[index];

            if (!step) {
                continue;
            }

            fragment.append(createLogEntry(index, getStepText(graph, step)));
        }

        algorithmLog.append(fragment);
        algorithmLog.scrollTop = algorithmLog.scrollHeight;
    };

    const updateControls = (playerState) => {
        const total = playerState.steps.length;
        const hasSteps = total > 0;
        const atEnd = playerState.index >= total - 1;

        playPauseButton.disabled = !hasSteps;
        playPauseButton.classList.toggle("is_playing", playerState.playing);
        playPauseButton.title = playerState.playing ? "Пауза" : "Воспроизвести";
        playPauseButton.setAttribute(
            "aria-label",
            playerState.playing ? "Пауза" : "Воспроизвести",
        );

        stepForwardButton.disabled = !hasSteps || atEnd;
        stepBackButton.disabled = !hasSteps || playerState.index < 0;

        playerStepLabel.textContent = `${Math.max(playerState.index + 1, 0)} / ${total}`;
    };

    const applyStepsUpTo = (playerState) => {
        resetSimulation();

        let activeVertexId = null;

        for (let index = 0; index <= playerState.index; index += 1) {
            const step = playerState.steps[index];

            if (!step) {
                continue;
            }

            if (step.type === STEP_TYPE.edge) {
                setEdgeStroke(
                    step.edgeId,
                    EDGE_TONES[step.tone] ?? EDGE_TONES[STEP_TONE.visited],
                );
                continue;
            }

            if (step.type === STEP_TYPE.vertex) {
                const tone = step.tone ?? STEP_TONE.visited;
                const [fill, text] =
                    VERTEX_TONES[tone] ?? VERTEX_TONES[STEP_TONE.visited];

                setVertexFill(step.vertexId, fill, text);

                if (tone !== STEP_TONE.rejected) {
                    activeVertexId = step.vertexId;
                } else if (activeVertexId === step.vertexId) {
                    activeVertexId = null;
                }
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
            playerState.index >= 0
                ? (playerState.steps[playerState.index]?.line ?? null)
                : null;

        renderPseudocode(
            playerState.pseudocode,
            playerState.algorithmName,
            activeLine,
        );
        renderLog(playerState.steps, playerState.index);
        updateControls(playerState);
    };

    return {
        setGraph(nextGraph) {
            graph = nextGraph;
        },

        setResultTarget(element) {
            resultElement = element ?? null;
        },

        showResult(text) {
            if (resultElement) {
                resultElement.textContent = text;
            }
        },

        render(playerState) {
            applyStepsUpTo(playerState);
        },

        reset() {
            resetSimulation();
            updateControls({
                steps: [],
                index: -1,
                playing: false,
            });
        },
    };
};
