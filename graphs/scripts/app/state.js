import { createGraph, getVertexLabel } from "../core/graph.js";
import { MODES } from "./constants.js";
import { createEvent } from "./events.js";
import { pluralize } from "./utils.js";
import {
    appStatus,
    graphStats,
    returnDefaultColorsButton,
    selectorVertexNumber,
    zoomLevelLabel,
} from "./dom.js";

export const state = {
    graph: createGraph(),
    mode: MODES.default,
    selectedVertexId: null,
    prevCircleColor: null,
    ignoreNextCanvasClick: false,
    isSpaceDown: false,
    isPanning: false,
    view: {
        x: 0,
        y: 0,
        scale: 1,
    },
    vertexElements: new Map(),
    edgeElements: new Map(),
};

const graphChange = createEvent();
const algorithmAvailabilityChange = createEvent();

export const onGraphChange = graphChange.subscribe;
export const onAlgorithmAvailabilityChange = algorithmAvailabilityChange.subscribe;

export const refreshAlgorithmAvailability = () => {
    const hasVertices = state.graph.vertices.length > 0;

    if (selectorVertexNumber) {
        selectorVertexNumber.disabled = !hasVertices;
    }

    if (returnDefaultColorsButton) {
        returnDefaultColorsButton.disabled = !hasVertices;
    }

    algorithmAvailabilityChange.emit({ hasVertices });
};

export const notifyGraphChange = (reason = "update") => {
    updateGraphStats();
    refreshAlgorithmAvailability();
    graphChange.emit(state.graph, reason);
};

export const updateGraphStats = () => {
    if (!graphStats) {
        return;
    }

    const vertexCount = state.graph.vertices.length;
    const edgeCount = state.graph.edges.length;
    const vertexWord = pluralize(vertexCount, "вершина", "вершины", "вершин");
    const edgeWord = pluralize(edgeCount, "ребро", "ребра", "рёбер");

    graphStats.textContent = `${vertexCount} ${vertexWord} · ${edgeCount} ${edgeWord}`;
};

export const updateZoomLabel = () => {
    if (zoomLevelLabel) {
        zoomLevelLabel.textContent = `${Math.round(state.view.scale * 100)}%`;
    }
};

export const updateAppStatus = (text) => {
    if (appStatus) {
        appStatus.textContent = text;
        appStatus.title = text;
    }
};

export const appendVertexOption = (vertex) => {
    if (!selectorVertexNumber) {
        return;
    }

    const exists = Array.from(selectorVertexNumber.options).some(
        (option) => option.value === vertex.id,
    );

    if (exists) {
        return;
    }

    const option = document.createElement("option");
    option.value = vertex.id;
    option.textContent = getVertexLabel(vertex);
    option.dataset.generated = "true";
    selectorVertexNumber.append(option);
};

export const updateVertexOption = (vertex) => {
    if (!selectorVertexNumber) {
        return;
    }

    const option = Array.from(selectorVertexNumber.options).find(
        (candidate) => candidate.value === vertex.id,
    );

    if (option) {
        option.textContent = getVertexLabel(vertex);
    }
};

export const clearGeneratedVertexOptions = () => {
    if (!selectorVertexNumber) {
        return;
    }

    for (const option of Array.from(selectorVertexNumber.options)) {
        if (option.dataset.generated === "true") {
            option.remove();
        }
    }
};

refreshAlgorithmAvailability();
updateGraphStats();
