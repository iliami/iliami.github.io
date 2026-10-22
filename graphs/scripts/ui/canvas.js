import { COLORS } from "../app/constants.js";
import { svg } from "../app/dom.js";
import { state } from "../app/state.js";

const VERTEX_STROKES = new Map([
    [COLORS.vertex, "var(--node-border)"],
    [COLORS.vertexSelected, "var(--node-selected-border)"],
    [COLORS.vertexVisited, "var(--node-visited-border)"],
    [COLORS.vertexActive, "var(--node-active-border)"],
    [COLORS.simulationVertex, "var(--node-simulation-border)"],
]);

export const getCanvasPoint = (event) => {
    const bounds = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;

    if (!bounds.width || !bounds.height) {
        return { x: 0, y: 0 };
    }

    return {
        x:
            viewBox.x +
            ((event.clientX - bounds.left) * viewBox.width) / bounds.width,
        y:
            viewBox.y +
            ((event.clientY - bounds.top) * viewBox.height) / bounds.height,
    };
};

export const setVertexFill = (vertexId, color, textColor) => {
    const element = state.vertexElements.get(vertexId);

    if (!element) {
        return;
    }

    element.children[0].setAttribute("fill", color);

    const stroke = VERTEX_STROKES.get(color);

    if (stroke) {
        element.children[0].setAttribute("stroke", stroke);
    }

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

    element
        .querySelectorAll(".edge_arrow")
        .forEach((arrow) => arrow.setAttribute("fill", color));
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
