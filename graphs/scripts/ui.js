import { createGraph, getVertexLabel } from "./core.js";

export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
export const VERTEX_RADIUS = 20;

export const MODES = Object.freeze({
    default: 1,
    vertex: 2,
    edge: 3,
});

export const COLORS = Object.freeze({
    vertex: "var(--node-bg)",
    vertexText: "var(--node-text)",
    vertexSelected: "var(--node-selected-bg)",
    vertexSelectedText: "var(--node-selected-text)",
    vertexVisited: "var(--node-visited-bg)",
    vertexVisitedText: "var(--node-visited-text)",
    vertexActive: "var(--node-active-bg)",
    vertexActiveText: "var(--node-active-text)",
    edge: "var(--edge)",
    edgeVisited: "var(--edge-visited)",
    edgePreview: "var(--edge-preview)",
    simulationVertex: "var(--node-simulation-bg)",
    simulationEdge: "var(--edge-simulation)",
});

export const svg = document.getElementById("canvas");
export const canvasSurface = document.getElementById("canvas_surface");

export const defaultMode = document.getElementById("default");
export const vertexMode = document.getElementById("vertex");
export const edgeMode = document.getElementById("edge");

export const selectorVertexNumber = document.getElementById("vertex_num");

export const btnStartBFS = document.getElementById("BFS_start");
export const textResultBFS = document.getElementById("BFS_result");
export const btnStartDFS = document.getElementById("DFS_start");
export const textResultDFS = document.getElementById("DFS_result");

export const returnDefaultColorsButton = document.getElementById(
    "default_colors",
);
export const downloadGraphButton = document.getElementById("download_graph");
export const uploadGraphInput = document.getElementById("upload_graph");

export const exportDropdown = document.getElementById("export_dropdown");
export const exportToggle = document.getElementById("export_toggle");
export const exportMenu = document.getElementById("export_menu");

export const zoomInButton = document.getElementById("zoom_in");
export const zoomOutButton = document.getElementById("zoom_out");
export const zoomLevelLabel = document.getElementById("zoom_level");
export const fitViewButton = document.getElementById("fit_view");

export const playPauseButton = document.getElementById("play_pause");
export const stepBackButton = document.getElementById("step_back");
export const stepForwardButton = document.getElementById("step_forward");
export const playerProgress = document.getElementById("player_progress");
export const playerStatus = document.getElementById("player_status");
export const playerStepLabel = document.getElementById("player_step");
export const speedInput = document.getElementById("speed");
export const speedValue = document.getElementById("speed_value");

export const pseudocode = document.getElementById("pseudocode");
export const pseudocodeTitle = document.getElementById("pseudocode_title");
export const algorithmLog = document.getElementById("algorithm_log");
export const clearLogButton = document.getElementById("clear_log");

export const graphInfoContent = document.getElementById("graph_info_content");
export const graphStats = document.getElementById("graph_stats");
export const graphTabs = Array.from(document.querySelectorAll("[data-view]"));

export const contextMenu = document.getElementById("context_menu");
export const renameDialog = document.getElementById("rename_dialog");
export const renameForm = document.getElementById("rename_form");
export const renameInput = document.getElementById("rename_input");
export const renameCancelButton = document.getElementById("rename_cancel");

export const appStatus = document.getElementById("app_status");

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

const graphChangeListeners = new Set();

export const onGraphChange = (listener) => {
    graphChangeListeners.add(listener);

    return () => {
        graphChangeListeners.delete(listener);
    };
};

export const notifyGraphChange = (reason = "update") => {
    updateGraphStats();
    updateStartButtons();

    for (const listener of graphChangeListeners) {
        listener(state.graph, reason);
    }
};

export const createSvgElement = (tagName, attributes = {}) => {
    const element = document.createElementNS(SVG_NAMESPACE, tagName);

    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, String(value));
    }

    return element;
};

export const getCanvasPoint = (event) => {
    const bounds = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;

    if (!bounds.width || !bounds.height) {
        return { x: 0, y: 0 };
    }

    return {
        x: viewBox.x + ((event.clientX - bounds.left) * viewBox.width) / bounds.width,
        y: viewBox.y + ((event.clientY - bounds.top) * viewBox.height) / bounds.height,
    };
};

export const setVertexFill = (vertexId, color, textColor) => {
    const element = state.vertexElements.get(vertexId);

    if (!element) {
        return;
    }

    element.children[0].setAttribute("fill", color);

    if (textColor) {
        element.children[1].setAttribute("fill", textColor);
    }
};

export const setEdgeStroke = (edgeId, color) => {
    const element = state.edgeElements.get(edgeId);

    if (!element) {
        return;
    }

    element
        .querySelectorAll(".edge_line")
        .forEach((line) => line.setAttribute("stroke", color));
};

export const selectVertex = (vertexId) => {
    const element = state.vertexElements.get(vertexId);

    if (!element) {
        return;
    }

    element.children[0].setAttribute("fill", COLORS.vertexSelected);
    element.children[1].setAttribute("fill", COLORS.vertexSelectedText);
};

export const deselectVertex = (vertexId) => {
    const element = state.vertexElements.get(vertexId);

    if (!element) {
        return;
    }

    element.children[0].setAttribute("fill", COLORS.vertex);
    element.children[1].setAttribute("fill", COLORS.vertexText);
};

export const appendVertexOption = (vertex) => {
    const optionExists = Array.from(selectorVertexNumber.options).some(
        (option) => option.value === vertex.id,
    );

    if (optionExists) {
        return;
    }

    const option = document.createElement("option");
    option.value = vertex.id;
    option.textContent = getVertexLabel(vertex);
    option.dataset.generated = "true";
    selectorVertexNumber.append(option);
};

export const updateVertexOption = (vertex) => {
    const option = Array.from(selectorVertexNumber.options).find(
        (candidate) => candidate.value === vertex.id,
    );

    if (option) {
        option.textContent = getVertexLabel(vertex);
    }
};

export const clearGeneratedVertexOptions = () => {
    for (const option of Array.from(selectorVertexNumber.options)) {
        if (option.dataset.generated === "true") {
            option.remove();
        }
    }
};

const pluralize = (count, one, few, many) => {
    const mod100 = count % 100;
    const mod10 = count % 10;

    if (mod100 >= 11 && mod100 <= 14) {
        return many;
    }

    if (mod10 === 1) {
        return one;
    }

    if (mod10 >= 2 && mod10 <= 4) {
        return few;
    }

    return many;
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

export const updateStartButtons = () => {
    const hasVertices = state.graph.vertices.length > 0;

    btnStartBFS.disabled = !hasVertices;
    btnStartDFS.disabled = !hasVertices;
    selectorVertexNumber.disabled = !hasVertices;
    returnDefaultColorsButton.disabled = !hasVertices;
};

export const updateZoomLabel = () => {
    if (zoomLevelLabel) {
        zoomLevelLabel.textContent = `${Math.round(state.view.scale * 100)}%`;
    }
};

export const updateAppStatus = (text) => {
    if (appStatus) {
        appStatus.textContent = text;
    }
};

updateStartButtons();
updateGraphStats();
