import { COLORS, VERTEX_RADIUS } from "../../app/constants.js";
import { createSvgElement, svg } from "../../app/dom.js";
import { state } from "../../app/state.js";
import { getVertex, getVertexLabel } from "../../core/graph.js";
import { getIncidentEdges } from "../../core/graph-index.js";

const EDGE_ARROW_LENGTH = 12;
const EDGE_ARROW_HALF_WIDTH = 6;
const EDGE_WEIGHT_OFFSET = 13;

const isDirectedEdge = (edge, graph) =>
    Boolean(graph.directed || edge.directed);

const getEdgeGeometry = (edge, graph) => {
    const firstVertex = getVertex(graph, edge.fromId);
    const secondVertex = getVertex(graph, edge.toId);

    if (!firstVertex || !secondVertex) {
        return null;
    }

    const deltaX = secondVertex.x - firstVertex.x;
    const deltaY = secondVertex.y - firstVertex.y;
    const length = Math.hypot(deltaX, deltaY) || 1;
    const unitX = deltaX / length;
    const unitY = deltaY / length;
    const normalX = -unitY;
    const normalY = unitX;
    const tipX = secondVertex.x - unitX * VERTEX_RADIUS;
    const tipY = secondVertex.y - unitY * VERTEX_RADIUS;
    const baseX = tipX - unitX * EDGE_ARROW_LENGTH;
    const baseY = tipY - unitY * EDGE_ARROW_LENGTH;

    return {
        firstVertex,
        secondVertex,
        unitX,
        unitY,
        normalX,
        normalY,
        tipX,
        tipY,
        baseX,
        baseY,
        weightX:
            (firstVertex.x + secondVertex.x) / 2 +
            normalX * EDGE_WEIGHT_OFFSET,
        weightY:
            (firstVertex.y + secondVertex.y) / 2 +
            normalY * EDGE_WEIGHT_OFFSET,
    };
};

const getArrowPoints = (geometry) => {
    const { tipX, tipY, baseX, baseY, normalX, normalY } = geometry;
    const leftX = baseX + normalX * EDGE_ARROW_HALF_WIDTH;
    const leftY = baseY + normalY * EDGE_ARROW_HALF_WIDTH;
    const rightX = baseX - normalX * EDGE_ARROW_HALF_WIDTH;
    const rightY = baseY - normalY * EDGE_ARROW_HALF_WIDTH;

    return [
        `${tipX},${tipY}`,
        `${leftX},${leftY}`,
        `${rightX},${rightY}`,
    ].join(" ");
};

const createEdgeHitLine = (firstVertex, secondVertex) =>
    createSvgElement("line", {
        class: "edge_hit",
        x1: firstVertex.x,
        y1: firstVertex.y,
        x2: secondVertex.x,
        y2: secondVertex.y,
        stroke: "transparent",
        "stroke-width": 18,
        "pointer-events": "stroke",
    });

export const layoutEdgeElement = (element, edge, graph) => {
    const geometry = getEdgeGeometry(edge, graph);

    if (!geometry) {
        return;
    }

    const { firstVertex, secondVertex } = geometry;
    const line = element.querySelector(".edge_line");
    const hitLine = element.querySelector(".edge_hit");
    const arrow = element.querySelector(".edge_arrow");
    const weight = element.querySelector(".edge_weight");
    const directed = isDirectedEdge(edge, graph);

    line?.setAttribute("x1", firstVertex.x);
    line?.setAttribute("y1", firstVertex.y);
    line?.setAttribute("x2", secondVertex.x);
    line?.setAttribute("y2", secondVertex.y);

    hitLine?.setAttribute("x1", firstVertex.x);
    hitLine?.setAttribute("y1", firstVertex.y);
    hitLine?.setAttribute("x2", secondVertex.x);
    hitLine?.setAttribute("y2", secondVertex.y);

    element.classList.toggle("is_directed", directed);
    element.dataset.directed = String(directed);
    element.dataset.weight = String(edge.weight);

    if (arrow) {
        if (directed) {
            arrow.setAttribute("points", getArrowPoints(geometry));
            arrow.removeAttribute("display");
        } else {
            arrow.setAttribute("display", "none");
        }
    }

    if (weight) {
        const showWeight = Number(edge.weight) !== 1;

        weight.textContent = showWeight ? String(edge.weight) : "";
        weight.setAttribute("x", geometry.weightX);
        weight.setAttribute("y", geometry.weightY);

        if (showWeight) {
            weight.removeAttribute("display");
        } else {
            weight.setAttribute("display", "none");
        }
    }
};

export const createVertexElement = (vertex, handlers) => {
    const label = getVertexLabel(vertex);
    const group = createSvgElement("g", {
        id: vertex.id,
        class: "vertex",
        "data-label": label,
    });

    group.addEventListener("click", handlers.onClick);
    group.addEventListener("mousedown", handlers.onMouseDown);
    group.addEventListener("contextmenu", handlers.onContextMenu);
    group.addEventListener("mouseenter", handlers.onMouseEnter);
    group.addEventListener("mouseleave", handlers.onMouseLeave);

    const circle = createSvgElement("circle", {
        class: "node_circle",
        id: vertex.id,
        r: VERTEX_RADIUS,
        cx: vertex.x,
        cy: vertex.y,
        fill: COLORS.vertex,
    });

    const text = createSvgElement("text", {
        class: "node_label",
        id: vertex.id,
        x: vertex.x,
        y: vertex.y,
        dy: ".34em",
        fill: COLORS.vertexText,
        "text-anchor": "middle",
    });

    text.textContent = label;
    group.append(circle, text);

    return group;
};

export const createEdgeElement = (edge, graph, handlers) => {
    const firstVertex = getVertex(graph, edge.fromId);
    const secondVertex = getVertex(graph, edge.toId);

    if (!firstVertex || !secondVertex) {
        return null;
    }

    const group = createSvgElement("g", { id: edge.id, class: "edge" });
    group.addEventListener("contextmenu", handlers.onContextMenu);
    group.addEventListener("click", handlers.onClick);

    const line = createSvgElement("line", {
        class: "edge_line",
        id: edge.id,
        x1: firstVertex.x,
        y1: firstVertex.y,
        x2: secondVertex.x,
        y2: secondVertex.y,
        stroke: COLORS.edge,
        "stroke-width": 2.5,
    });

    const arrow = createSvgElement("polygon", {
        class: "edge_arrow",
        fill: COLORS.edge,
        "pointer-events": "none",
    });

    const weight = createSvgElement("text", {
        class: "edge_weight",
        "text-anchor": "middle",
        "dominant-baseline": "central",
        "pointer-events": "none",
    });

    const hitLine = createEdgeHitLine(firstVertex, secondVertex);

    group.append(line, arrow, weight, hitLine);
    layoutEdgeElement(group, edge, graph);

    return group;
};

export const appendEdgeElement = (edge, graph, handlers) => {
    const element = createEdgeElement(edge, graph, handlers);

    if (!element) {
        return;
    }

    state.edgeElements.set(edge.id, element);

    const firstVertexElement = state.vertexElements.values().next().value;

    if (firstVertexElement) {
        svg.insertBefore(element, firstVertexElement);
    } else {
        svg.append(element);
    }
};

export const moveVertexElement = (vertexId, point) => {
    const element = state.vertexElements.get(vertexId);

    if (!element) {
        return;
    }

    element.children[0].setAttribute("cx", point.x);
    element.children[0].setAttribute("cy", point.y);
    element.children[1].setAttribute("x", point.x);
    element.children[1].setAttribute("y", point.y);
};

export const updateEdgeElement = (edge, graph) => {
    const element = state.edgeElements.get(edge.id);

    if (!element) {
        return;
    }

    layoutEdgeElement(element, edge, graph);
};

export const updateEdgePositions = (vertexId) => {
    for (const edge of getIncidentEdges(state.graph, vertexId)) {
        updateEdgeElement(edge, state.graph);
    }
};

export const clearVertexHover = () => {
    svg.classList.remove("is_hovering_vertex");

    for (const element of state.vertexElements.values()) {
        element.classList.remove("is_hovered", "is_related");
    }

    for (const element of state.edgeElements.values()) {
        element.classList.remove("is_related");
    }
};
