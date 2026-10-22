import { MODES } from "../../app/constants.js";
import { $ } from "../../app/dom.js";
import {
    onAlgorithmAvailabilityChange,
    onGraphChange,
    state,
    updateAppStatus,
} from "../../app/state.js";
import { getVertexLabel } from "../../core/graph.js";
import { getGraphIndex } from "../../core/graph-index.js";
import { algorithmRegistry } from "../../algorithms/registry.js";
import { createAlgorithmPlayer } from "../../algorithms/runtime/player.js";
import { createAlgorithmRunner } from "../../algorithms/runtime/runner.js";
import { ensureUserCodeConsent } from "../user-algorithms/repository.js";
import { returnDefaultColors } from "../editor/controller.js";
import { createAlgorithmListView } from "./list-view.js";
import { createAlgorithmView } from "./player-view.js";

const algorithmList = $("algorithm_list");
const algorithmLog = $("algorithm_log");
const clearLogButton = $("clear_log");
const playPauseButton = $("play_pause");
const stepBackButton = $("step_back");
const stepForwardButton = $("step_forward");
const speedInput = $("speed");
const speedValue = $("speed_value");
const defaultMode = $("default");
const returnDefaultColorsButton = $("default_colors");
const selectorVertexNumber = $("vertex_num");

const view = createAlgorithmView();
const runner = createAlgorithmRunner();

let currentRun = null;
let initialized = false;

const player = createAlgorithmPlayer({
    render: (playerState) => view.render(playerState),
    onStatus: (status) => {
        if (status === "finished") {
            updateAppStatus("Готово");
        }
    },
});

const getSelectedStartVertex = () => {
    const selectedId = selectorVertexNumber?.value;
    const selected = state.graph.vertices.find(
        (vertex) => vertex.id === selectedId,
    );

    return selected ?? state.graph.vertices[0] ?? null;
};

const getVertexLabelById = (vertexId) => {
    const vertex = state.graph.vertices.find(
        (candidate) => candidate.id === vertexId,
    );

    return vertex ? getVertexLabel(vertex) : vertexId;
};

const formatVisitedResult = (visitedIds) =>
    visitedIds.map((vertexId) => getVertexLabelById(vertexId)).join(" → ");

const updateAlgorithmAvailability = () => {
    const hasVertices = state.graph.vertices.length > 0;

    listView.setAvailability((descriptor) =>
        descriptor.meta.requiresStartVertex !== false ? hasVertices : true,
    );
};

const startAlgorithm = async (descriptor) => {
    const { meta } = descriptor;
    const requiresStart = meta.requiresStartVertex !== false;
    const startVertex = requiresStart ? getSelectedStartVertex() : null;

    if (requiresStart && !startVertex) {
        updateAppStatus("Добавьте вершину, чтобы запустить алгоритм");
        return;
    }

    if (descriptor.source === "user" && !ensureUserCodeConsent()) {
        updateAppStatus("Запуск пользовательского кода отменён");
        return;
    }

    player.pause();

    if (defaultMode) {
        defaultMode.checked = true;
    }

    state.mode = MODES.default;

    const controller = new AbortController();

    currentRun?.abort();
    currentRun = controller;

    const label = (meta.shortName ?? meta.name).toUpperCase();

    updateAppStatus(`${label}: выполняется…`);

    try {
        const result = await runner.run(
            descriptor,
            {
                graph: state.graph,
                startVertexId: startVertex?.id ?? null,
                params: {},
            },
            { signal: controller.signal },
        );

        if (controller.signal.aborted) {
            return;
        }

        const index = getGraphIndex(state.graph);
        const resultText =
            result.resultText || formatVisitedResult(result.visited);

        view.setGraph(index);
        view.setResultTarget(listView.getResultElement(meta.id));
        view.showResult(resultText);

        player.load({
            algorithmId: meta.id,
            algorithmName: meta.shortName ?? meta.name,
            steps: result.steps,
            pseudocode: meta.pseudocode ?? [],
            resultText,
        });

        updateAppStatus(
            requiresStart
                ? `${label}: старт из вершины ${getVertexLabel(startVertex)}`
                : `${label}: запуск`,
        );

        player.play();
    } catch (error) {
        if (error?.code === "aborted" || controller.signal.aborted) {
            return;
        }

        const path = error?.path ? ` (${error.path})` : "";
        const message = error?.message ?? "неизвестная ошибка";

        updateAppStatus(`Ошибка алгоритма: ${message}${path}`);
    } finally {
        if (currentRun === controller) {
            currentRun = null;
        }
    }
};

const listView = createAlgorithmListView({
    container: algorithmList,
    onStart: (algorithmId) => {
        const descriptor = algorithmRegistry.get(algorithmId);

        if (descriptor) {
            startAlgorithm(descriptor);
        }
    },
});

const renderAlgorithmList = () => {
    listView.render(algorithmRegistry.list());
    updateAlgorithmAvailability();
};

export const initAlgorithmPanel = () => {
    if (initialized) {
        return;
    }

    initialized = true;

    playPauseButton?.addEventListener("click", () => {
        if (player.getState().playing) {
            player.pause();
            updateAppStatus("Пауза");
            return;
        }

        player.play();
        updateAppStatus("Выполняется алгоритм");
    });

    stepForwardButton?.addEventListener("click", () => {
        player.stepForward();
    });

    stepBackButton?.addEventListener("click", () => {
        player.stepBack();
    });

    speedInput?.addEventListener("input", () => {
        const speed = player.setSpeed(Number(speedInput.value) || 1);

        if (speedValue) {
            speedValue.textContent = `${speed.toFixed(1)}×`;
        }
    });

    returnDefaultColorsButton?.addEventListener("click", () => {
        returnDefaultColors();
        player.reset();
        updateAppStatus("Цвета сброшены");
    });

    clearLogButton?.addEventListener("click", () => {
        algorithmLog?.replaceChildren();
    });

    onGraphChange((graph, reason) => {
        view.setGraph(getGraphIndex(graph));

        if (reason === "rename") {
            if (player.getState().index >= 0) {
                view.render(player.getState());
            }
            return;
        }

        currentRun?.abort();
        listView.resetResults();
        player.reset();
    });

    onAlgorithmAvailabilityChange(() => {
        updateAlgorithmAvailability();
    });

    algorithmRegistry.subscribe(() => {
        listView.render(algorithmRegistry.list());
        updateAlgorithmAvailability();
    });

    renderAlgorithmList();
    view.setGraph(getGraphIndex(state.graph));

    const initialAlgorithm = algorithmRegistry.list()[0];

    if (initialAlgorithm) {
        player.load({
            algorithmId: initialAlgorithm.meta.id,
            algorithmName:
                initialAlgorithm.meta.shortName ?? initialAlgorithm.meta.name,
            steps: [],
            pseudocode: initialAlgorithm.meta.pseudocode ?? [],
            resultText: "",
        });
    }
};

export const requestAlgorithmRun = (algorithmId) => {
    const descriptor = algorithmRegistry.get(algorithmId);

    if (descriptor) {
        startAlgorithm(descriptor);
    }
};

export const inspectUserAlgorithm = (source) =>
    runner.inspect({ code: source }, {});
