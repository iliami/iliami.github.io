import { createGraph } from "./core.js";

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
    edge: "var(--edge)",
    simulationVertex: "var(--node-simulation-bg)",
    simulationEdge: "var(--edge-simulation)",
});

export const svg = document.getElementById("canvas");

export const defaultMode = document.getElementById("default");
export const vertexMode = document.getElementById("vertex");
export const edgeMode = document.getElementById("edge");

export const modal = document.querySelector("dialog");
export const modalBox = document.getElementById("graph_info_modal_box");
export const modalContent = document.getElementById("graph_info_modal_content");
export const showGraphInfoModalBtn = document.getElementById(
    "show_graph_info_modal",
);
export const closeGraphInfoModalBtn = document.getElementById(
    "close_graph_info_modal",
);

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

export const state = {
    graph: createGraph(),
    mode: MODES.default,
    selectedVertexId: null,
    prevCircleColor: null,
    isModalOpen: false,
    vertexElements: new Map(),
    edgeElements: new Map(),
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

    return {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
    };
};

export const setVertexFill = (vertexId, color) => {
    const element = state.vertexElements.get(vertexId);

    if (!element) {
        return;
    }

    element.children[0].setAttribute("fill", color);
};

export const setEdgeStroke = (edgeId, color) => {
    const element = state.edgeElements.get(edgeId);

    if (!element) {
        return;
    }

    element.children[0].setAttribute("stroke", color);
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

export const appendVertexOption = (value) => {
    const stringValue = String(value);
    const optionExists = Array.from(selectorVertexNumber.options).some(
        (option) => option.value === stringValue,
    );

    if (optionExists) {
        return;
    }

    const option = document.createElement("option");
    option.value = stringValue;
    option.textContent = stringValue;
    option.dataset.generated = "true";
    selectorVertexNumber.append(option);
};

export const clearGeneratedVertexOptions = () => {
    for (const option of Array.from(selectorVertexNumber.options)) {
        if (option.dataset.generated === "true") {
            option.remove();
        }
    }
};

export const updateStartButtons = () => {
    const hasVertices = state.graph.vertices.length > 0;
    btnStartBFS.disabled = !hasVertices;
    btnStartDFS.disabled = !hasVertices;
};

const controls = [
    defaultMode,
    vertexMode,
    edgeMode,
    showGraphInfoModalBtn,
    closeGraphInfoModalBtn,
    selectorVertexNumber,
    btnStartBFS,
    btnStartDFS,
    returnDefaultColorsButton,
    uploadGraphInput,
];

const setControlsDisabled = (disabled) => {
    for (const control of controls) {
        control.disabled = disabled;
    }
};

export const lockControls = () => {
    setControlsDisabled(true);
};

export const unlockControls = () => {
    setControlsDisabled(false);
    updateStartButtons();
};

updateStartButtons();
