import {
    addEdge,
    addVertex,
    createEdge,
    createGraph,
    createVertex,
    getIncidentEdges,
    getNextEdgeId,
    getNextVertexId,
    getVertex,
    hasEdgeBetween,
    moveVertex,
} from "./core.js";

import {
    COLORS,
    MODES,
    VERTEX_RADIUS,
    appendVertexOption,
    clearGeneratedVertexOptions,
    createSvgElement,
    defaultMode,
    deselectVertex,
    downloadGraphButton,
    edgeMode,
    getCanvasPoint,
    selectVertex,
    state,
    svg,
    updateStartButtons,
    vertexMode,
} from "./ui.js";

const createVertexElement = (vertex) => {
    const group = createSvgElement("g", { id: vertex.id });

    group.addEventListener("click", handleClickOnVertex);
    group.addEventListener("mousedown", handleMouseDownOnVertex);
    group.addEventListener("mouseup", handleMouseUpOnVertex);

    const circle = createSvgElement("circle", {
        id: vertex.id,
        r: VERTEX_RADIUS,
        cx: vertex.x,
        cy: vertex.y,
        fill: COLORS.vertex,
    });

    const text = createSvgElement("text", {
        id: vertex.id,
        x: vertex.x,
        y: vertex.y,
        dy: ".3em",
        fill: COLORS.vertexText,
        "text-anchor": "middle",
    });

    text.textContent = vertex.id;
    group.append(circle, text);

    return group;
};

const createEdgeElement = (edge, graph) => {
    const firstVertex = getVertex(graph, edge.fromId);
    const secondVertex = getVertex(graph, edge.toId);

    if (!firstVertex || !secondVertex) {
        return null;
    }

    const group = createSvgElement("g", { id: edge.id });
    const line = createSvgElement("line", {
        id: edge.id,
        x1: firstVertex.x,
        y1: firstVertex.y,
        x2: secondVertex.x,
        y2: secondVertex.y,
        stroke: COLORS.edge,
        "stroke-width": 4,
    });

    group.append(line);

    return group;
};

const appendEdgeElement = (edge, graph) => {
    const element = createEdgeElement(edge, graph);

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

export const resetCanvas = () => {
    svg.replaceChildren();

    state.graph = createGraph();
    state.vertexElements.clear();
    state.edgeElements.clear();
    state.selectedVertexId = null;
    state.prevCircleColor = null;

    clearGeneratedVertexOptions();
    downloadGraphButton.removeAttribute("href");
    updateStartButtons();
};

export const renderGraph = (graph) => {
    resetCanvas();
    state.graph = graph;

    for (const edge of graph.edges) {
        appendEdgeElement(edge, graph);
    }

    for (const vertex of graph.vertices) {
        const element = createVertexElement(vertex);
        state.vertexElements.set(vertex.id, element);
        svg.append(element);
    }

    for (let index = 0; index < graph.vertices.length; index += 1) {
        appendVertexOption(index + 1);
    }

    updateStartButtons();
};

const addVertexAt = ({ x, y }) => {
    const id = getNextVertexId(state.graph);
    const vertex = createVertex(id, x, y);

    state.graph = addVertex(state.graph, vertex);

    const element = createVertexElement(vertex);
    state.vertexElements.set(id, element);
    svg.append(element);

    appendVertexOption(state.graph.vertices.length);
    updateStartButtons();
};

export const returnDefaultColors = () => {
    for (const element of state.vertexElements.values()) {
        element.children[0].setAttribute("fill", COLORS.vertex);
    }

    for (const element of state.edgeElements.values()) {
        element.children[0].setAttribute("stroke", COLORS.edge);
    }
};

function handleClickOnCanvas(event) {
    if (state.mode !== MODES.vertex) {
        return;
    }

    addVertexAt(getCanvasPoint(event));
}

function handleClickOnVertex(event) {
    if (state.mode !== MODES.edge) {
        return;
    }

    const clickedVertex = getVertex(state.graph, event.currentTarget.id);

    if (!clickedVertex) {
        return;
    }

    if (state.selectedVertexId === null) {
        state.selectedVertexId = clickedVertex.id;
        selectVertex(clickedVertex.id);
        return;
    }

    const firstVertex = getVertex(state.graph, state.selectedVertexId);

    state.selectedVertexId = null;

    if (!firstVertex) {
        return;
    }

    deselectVertex(firstVertex.id);

    if (firstVertex.id === clickedVertex.id) {
        return;
    }

    if (hasEdgeBetween(state.graph, firstVertex.id, clickedVertex.id)) {
        return;
    }

    const edgeId = getNextEdgeId(state.graph);
    const edge = createEdge(edgeId, firstVertex.id, clickedVertex.id);

    state.graph = addEdge(state.graph, edge);
    appendEdgeElement(edge, state.graph);
}

function handleMouseDownOnVertex(event) {
    if (state.mode !== MODES.default) {
        return;
    }

    const vertexId = event.currentTarget.id;
    const element = state.vertexElements.get(vertexId);

    if (!element) {
        return;
    }

    state.selectedVertexId = vertexId;
    state.prevCircleColor = element.children[0].getAttribute("fill");
    element.children[0].setAttribute("fill", COLORS.vertexSelected);
}

function handleMouseUpOnVertex() {
    if (state.mode !== MODES.default || state.selectedVertexId === null) {
        return;
    }

    const element = state.vertexElements.get(state.selectedVertexId);

    if (element) {
        element.children[0].setAttribute(
            "fill",
            state.prevCircleColor ?? COLORS.vertex,
        );
    }

    state.selectedVertexId = null;
    state.prevCircleColor = null;
}

function handleMouseMoveVertexOnCanvas(event) {
    if (state.mode !== MODES.default || state.selectedVertexId === null) {
        return;
    }

    const vertexId = state.selectedVertexId;
    const point = getCanvasPoint(event);

    for (const edge of getIncidentEdges(state.graph, vertexId)) {
        const element = state.edgeElements.get(edge.id);

        if (!element) {
            continue;
        }

        const line = element.children[0];

        if (edge.fromId === vertexId) {
            line.setAttribute("x1", point.x);
            line.setAttribute("y1", point.y);
        } else {
            line.setAttribute("x2", point.x);
            line.setAttribute("y2", point.y);
        }
    }

    state.graph = moveVertex(state.graph, vertexId, point);

    const element = state.vertexElements.get(vertexId);

    if (!element) {
        return;
    }

    element.children[0].setAttribute("cx", point.x);
    element.children[0].setAttribute("cy", point.y);
    element.children[1].setAttribute("x", point.x);
    element.children[1].setAttribute("y", point.y);
}

function handleModeChange(event) {
    state.selectedVertexId = null;
    state.mode = MODES[event.currentTarget.id] ?? MODES.default;
}

svg.addEventListener("click", handleClickOnCanvas);
svg.addEventListener("mousemove", handleMouseMoveVertexOnCanvas);

defaultMode.addEventListener("click", handleModeChange);
vertexMode.addEventListener("click", handleModeChange);
edgeMode.addEventListener("click", handleModeChange);
