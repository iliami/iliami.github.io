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
    getVertexLabel,
    hasEdgeBetween,
    moveVertex,
    removeEdge,
    removeVertex,
    renameVertex,
} from "./core.js";

import {
    COLORS,
    MODES,
    VERTEX_RADIUS,
    appendVertexOption,
    canvasSurface,
    clearGeneratedVertexOptions,
    contextMenu,
    createSvgElement,
    defaultMode,
    deselectVertex,
    downloadGraphButton,
    edgeMode,
    fitViewButton,
    getCanvasPoint,
    notifyGraphChange,
    renameCancelButton,
    renameDialog,
    renameForm,
    renameInput,
    selectVertex,
    setEdgeStroke,
    state,
    svg,
    updateAppStatus,
    updateStartButtons,
    updateVertexOption,
    updateZoomLabel,
    vertexMode,
    zoomInButton,
    zoomOutButton,
} from "./ui.js";

const GRID_SIZE = 24;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3.5;
const FIT_PADDING = 80;

let dragState = null;
let panState = null;
let edgeDrag = null;
let contextTarget = null;
let renameTargetId = null;
let suppressClickUntil = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getLabel = (vertex) => getVertexLabel(vertex);

export const updateViewBox = () => {
    const bounds = svg.getBoundingClientRect();

    if (!bounds.width || !bounds.height) {
        return;
    }

    const { x, y, scale } = state.view;
    const width = bounds.width / scale;
    const height = bounds.height / scale;

    svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);

    if (canvasSurface) {
        const size = GRID_SIZE * scale;
        const modulo = (value) => ((value % size) + size) % size;

        canvasSurface.style.setProperty("--grid-size", `${size}px`);
        canvasSurface.style.setProperty("--grid-x", `${modulo(-x * scale)}px`);
        canvasSurface.style.setProperty("--grid-y", `${modulo(-y * scale)}px`);
    }

    updateZoomLabel();
};

const zoomAt = (clientX, clientY, factor) => {
    const bounds = svg.getBoundingClientRect();
    const oldScale = state.view.scale;
    const newScale = clamp(oldScale * factor, MIN_SCALE, MAX_SCALE);

    if (newScale === oldScale || !bounds.width || !bounds.height) {
        return;
    }

    const pointerX = clientX - bounds.left;
    const pointerY = clientY - bounds.top;
    const worldX = state.view.x + pointerX / oldScale;
    const worldY = state.view.y + pointerY / oldScale;

    state.view.scale = newScale;
    state.view.x = worldX - pointerX / newScale;
    state.view.y = worldY - pointerY / newScale;

    updateViewBox();
};

const zoomAtCenter = (factor) => {
    const bounds = svg.getBoundingClientRect();
    zoomAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, factor);
};

export const resetView = () => {
    state.view.x = 0;
    state.view.y = 0;
    state.view.scale = 1;
    updateViewBox();
};

export const fitView = () => {
    const bounds = svg.getBoundingClientRect();

    if (!state.graph.vertices.length) {
        resetView();
        return;
    }

    if (!bounds.width || !bounds.height) {
        return;
    }

    const xs = state.graph.vertices.map((vertex) => vertex.x);
    const ys = state.graph.vertices.map((vertex) => vertex.y);
    const minX = Math.min(...xs) - VERTEX_RADIUS - FIT_PADDING;
    const maxX = Math.max(...xs) + VERTEX_RADIUS + FIT_PADDING;
    const minY = Math.min(...ys) - VERTEX_RADIUS - FIT_PADDING;
    const maxY = Math.max(...ys) + VERTEX_RADIUS + FIT_PADDING;
    const contentWidth = Math.max(maxX - minX, 1);
    const contentHeight = Math.max(maxY - minY, 1);
    const scale = clamp(
        Math.min(bounds.width / contentWidth, bounds.height / contentHeight),
        MIN_SCALE,
        MAX_SCALE,
    );

    state.view.scale = scale;
    state.view.x = minX - (bounds.width / scale - contentWidth) / 2;
    state.view.y = minY - (bounds.height / scale - contentHeight) / 2;

    updateViewBox();
};

const createVertexElement = (vertex) => {
    const label = getLabel(vertex);
    const group = createSvgElement("g", {
        id: vertex.id,
        class: "vertex",
        "data-label": label,
    });

    group.addEventListener("click", handleClickOnVertex);
    group.addEventListener("mousedown", handleMouseDownOnVertex);
    group.addEventListener("contextmenu", handleVertexContextMenu);

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

const createEdgeHitLine = (edge, firstVertex, secondVertex) =>
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

const createEdgeElement = (edge, graph) => {
    const firstVertex = getVertex(graph, edge.fromId);
    const secondVertex = getVertex(graph, edge.toId);

    if (!firstVertex || !secondVertex) {
        return null;
    }

    const group = createSvgElement("g", { id: edge.id, class: "edge" });
    group.addEventListener("contextmenu", handleEdgeContextMenu);

    const line = createSvgElement("line", {
        class: "edge_line",
        id: edge.id,
        x1: firstVertex.x,
        y1: firstVertex.y,
        x2: secondVertex.x,
        y2: secondVertex.y,
        stroke: COLORS.edge,
        "stroke-width": 3,
    });

    const hitLine = createEdgeHitLine(edge, firstVertex, secondVertex);

    group.append(line, hitLine);

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
    dragState = null;
    edgeDrag = null;

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
        appendVertexOption(vertex);
    }

    updateStartButtons();
    notifyGraphChange("render");
};

const addVertexAt = ({ x, y }) => {
    const id = getNextVertexId(state.graph);
    const vertex = createVertex(id, Math.round(x), Math.round(y));

    state.graph = addVertex(state.graph, vertex);

    const element = createVertexElement(vertex);
    state.vertexElements.set(id, element);
    svg.append(element);

    appendVertexOption(vertex);
    updateStartButtons();
    notifyGraphChange("vertex-add");
    updateAppStatus(`Добавлена вершина ${getLabel(vertex)}`);
};

export const returnDefaultColors = () => {
    for (const [vertexId, element] of state.vertexElements) {
        element.children[0].setAttribute("fill", COLORS.vertex);
        element.children[1].setAttribute("fill", COLORS.vertexText);

        if (vertexId === state.selectedVertexId) {
            element.children[0].setAttribute("fill", COLORS.vertex);
        }
    }

    for (const edgeId of state.edgeElements.keys()) {
        setEdgeStroke(edgeId, COLORS.edge);
    }
};

const updateEdgePositions = (vertexId, point) => {
    for (const edge of getIncidentEdges(state.graph, vertexId)) {
        const element = state.edgeElements.get(edge.id);

        if (!element) {
            continue;
        }

        element.querySelectorAll("line").forEach((line) => {
            if (edge.fromId === vertexId) {
                line.setAttribute("x1", point.x);
                line.setAttribute("y1", point.y);
            } else {
                line.setAttribute("x2", point.x);
                line.setAttribute("y2", point.y);
            }
        });
    }
};

const moveVertexElement = (vertexId, point) => {
    const element = state.vertexElements.get(vertexId);

    if (!element) {
        return;
    }

    element.children[0].setAttribute("cx", point.x);
    element.children[0].setAttribute("cy", point.y);
    element.children[1].setAttribute("x", point.x);
    element.children[1].setAttribute("y", point.y);
};

const createEdgeBetween = (firstVertexId, secondVertexId) => {
    if (firstVertexId === secondVertexId) {
        return false;
    }

    if (hasEdgeBetween(state.graph, firstVertexId, secondVertexId)) {
        updateAppStatus("Такое ребро уже существует");
        return false;
    }

    const edgeId = getNextEdgeId(state.graph);
    const edge = createEdge(edgeId, firstVertexId, secondVertexId);

    state.graph = addEdge(state.graph, edge);
    appendEdgeElement(edge, state.graph);
    notifyGraphChange("edge-add");

    const firstVertex = getVertex(state.graph, firstVertexId);
    const secondVertex = getVertex(state.graph, secondVertexId);

    updateAppStatus(
        `Добавлено ребро ${getLabel(firstVertex)} — ${getLabel(secondVertex)}`,
    );

    return true;
};

const startEdgeDrag = (vertex, event) => {
    const point = getCanvasPoint(event);
    const line = createSvgElement("line", {
        class: "edge_preview",
        x1: vertex.x,
        y1: vertex.y,
        x2: point.x,
        y2: point.y,
        stroke: COLORS.edgePreview,
        "stroke-width": 2.5,
        "stroke-dasharray": "7 6",
        "stroke-linecap": "round",
        "pointer-events": "none",
    });

    svg.append(line);
    edgeDrag = { sourceId: vertex.id, line };
    updateAppStatus("Создание ребра…");
};

const finishEdgeDrag = (event) => {
    if (!edgeDrag) {
        return;
    }

    const { sourceId, line } = edgeDrag;
    line.remove();
    edgeDrag = null;
    suppressClickUntil = performance.now() + 250;

    const element = document.elementFromPoint(event.clientX, event.clientY);
    const vertexElement = element?.closest?.(".vertex");

    if (!vertexElement) {
        updateAppStatus("Создание ребра отменено");
        return;
    }

    createEdgeBetween(sourceId, vertexElement.id);
};

const cancelEdgeDrag = () => {
    if (!edgeDrag) {
        return;
    }

    edgeDrag.line.remove();
    edgeDrag = null;
    updateAppStatus("Создание ребра отменено");
};

const hideContextMenu = () => {
    contextMenu.hidden = true;
    contextTarget = null;
};

const showContextMenu = (event, target) => {
    event.preventDefault();
    event.stopPropagation();

    contextTarget = target;
    contextMenu.hidden = false;

    const renameItem = contextMenu.querySelector('[data-action="rename"]');
    const weightItem = contextMenu.querySelector('[data-action="weight"]');

    renameItem.hidden = target.type !== "vertex";
    weightItem.hidden = target.type !== "edge";

    const menuBounds = contextMenu.getBoundingClientRect();
    const left = Math.min(
        event.clientX,
        window.innerWidth - menuBounds.width - 10,
    );
    const top = Math.min(
        event.clientY,
        window.innerHeight - menuBounds.height - 10,
    );

    contextMenu.style.left = `${Math.max(10, left)}px`;
    contextMenu.style.top = `${Math.max(10, top)}px`;
};

function handleVertexContextMenu(event) {
    showContextMenu(event, { type: "vertex", id: event.currentTarget.id });
}

function handleEdgeContextMenu(event) {
    showContextMenu(event, { type: "edge", id: event.currentTarget.id });
}

const openRenameDialog = (vertexId) => {
    const vertex = getVertex(state.graph, vertexId);

    if (!vertex) {
        return;
    }

    renameTargetId = vertexId;
    renameInput.value = getLabel(vertex);
    renameDialog.showModal();
    renameInput.focus();
    renameInput.select();
};

const deleteContextTarget = () => {
    if (!contextTarget) {
        return;
    }

    const { type, id } = contextTarget;

    if (type === "vertex") {
        const vertex = getVertex(state.graph, id);
        state.graph = removeVertex(state.graph, id);
        renderGraph(state.graph);
        updateAppStatus(`Вершина ${vertex ? getLabel(vertex) : id} удалена`);
        return;
    }

    const element = state.edgeElements.get(id);
    element?.remove();
    state.edgeElements.delete(id);
    state.graph = removeEdge(state.graph, id);
    notifyGraphChange("edge-delete");
    updateAppStatus("Ребро удалено");
};

function handleClickOnCanvas(event) {
    if (performance.now() < suppressClickUntil) {
        suppressClickUntil = 0;
        return;
    }

    if (event.target.closest(".vertex, .edge")) {
        return;
    }

    if (state.mode !== MODES.vertex || event.detail > 1) {
        return;
    }

    addVertexAt(getCanvasPoint(event));
}

function handleDoubleClickOnCanvas(event) {
    if (state.mode !== MODES.default) {
        return;
    }

    if (event.target.closest(".vertex, .edge")) {
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
        updateAppStatus(
            `Выбрана вершина ${getLabel(clickedVertex)}, укажите вторую`,
        );
        return;
    }

    const firstVertex = getVertex(state.graph, state.selectedVertexId);

    state.selectedVertexId = null;

    if (!firstVertex) {
        return;
    }

    deselectVertex(firstVertex.id);

    if (firstVertex.id === clickedVertex.id) {
        updateAppStatus("Ребро отменено");
        return;
    }

    createEdgeBetween(firstVertex.id, clickedVertex.id);
}

function handleMouseDownOnVertex(event) {
    if (event.button !== 0 || state.isSpaceDown || state.mode !== MODES.default) {
        return;
    }

    const vertex = getVertex(state.graph, event.currentTarget.id);

    if (!vertex) {
        return;
    }

    if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        startEdgeDrag(vertex, event);
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const point = getCanvasPoint(event);

    dragState = {
        vertexId: vertex.id,
        offsetX: vertex.x - point.x,
        offsetY: vertex.y - point.y,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        previousFill: event.currentTarget.children[0].getAttribute("fill"),
        previousTextFill:
            event.currentTarget.children[1].getAttribute("fill"),
    };

    state.selectedVertexId = vertex.id;
    state.prevCircleColor = dragState.previousFill;
    selectVertex(vertex.id);
    updateAppStatus(`Перемещение вершины ${getLabel(vertex)}`);
}

function handleCanvasMouseDown(event) {
    const isPanTrigger =
        event.button === 1 || (event.button === 0 && state.isSpaceDown);

    if (!isPanTrigger) {
        return;
    }

    event.preventDefault();

    state.isPanning = true;
    panState = {
        startX: event.clientX,
        startY: event.clientY,
        viewX: state.view.x,
        viewY: state.view.y,
        moved: false,
    };

    canvasSurface.classList.add("is_panning");
    updateAppStatus("Панорамирование холста");
}

function handleWindowMouseMove(event) {
    if (state.isPanning && panState) {
        const deltaX = event.clientX - panState.startX;
        const deltaY = event.clientY - panState.startY;

        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
            panState.moved = true;
        }

        state.view.x = panState.viewX - deltaX / state.view.scale;
        state.view.y = panState.viewY - deltaY / state.view.scale;
        updateViewBox();
        suppressClickUntil = performance.now() + 250;
        return;
    }

    if (edgeDrag) {
        const point = getCanvasPoint(event);

        edgeDrag.line.setAttribute("x2", point.x);
        edgeDrag.line.setAttribute("y2", point.y);
        return;
    }

    if (!dragState) {
        return;
    }

    const point = getCanvasPoint(event);
    const nextPoint = {
        x: Math.round(point.x + dragState.offsetX),
        y: Math.round(point.y + dragState.offsetY),
    };

    if (
        Math.abs(event.clientX - dragState.startX) > 2 ||
        Math.abs(event.clientY - dragState.startY) > 2
    ) {
        dragState.moved = true;
        suppressClickUntil = performance.now() + 250;
    }

    state.graph = moveVertex(state.graph, dragState.vertexId, nextPoint);
    updateEdgePositions(dragState.vertexId, nextPoint);
    moveVertexElement(dragState.vertexId, nextPoint);
}

function handleWindowMouseUp(event) {
    if (state.isPanning && panState) {
        state.isPanning = false;
        panState = null;
        canvasSurface.classList.remove("is_panning");
        updateAppStatus("Готово");
    }

    if (edgeDrag) {
        finishEdgeDrag(event);
    }

    if (!dragState) {
        return;
    }

    const { vertexId, moved, previousFill, previousTextFill } = dragState;
    const element = state.vertexElements.get(vertexId);

    if (element) {
        element.children[0].setAttribute(
            "fill",
            previousFill ?? COLORS.vertex,
        );
        element.children[1].setAttribute(
            "fill",
            previousTextFill ?? COLORS.vertexText,
        );
    }

    if (moved) {
        suppressClickUntil = performance.now() + 250;
        updateAppStatus("Готово");
    }

    state.selectedVertexId = null;
    state.prevCircleColor = null;
    dragState = null;
}

function handleWheel(event) {
    event.preventDefault();

    const multiplier =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
    const delta = event.deltaY * multiplier;
    const factor = Math.exp(-delta * 0.0014);

    zoomAt(event.clientX, event.clientY, factor);
}

function handleModeChange(event) {
    state.selectedVertexId = null;
    state.mode = MODES[event.currentTarget.id] ?? MODES.default;
    cancelEdgeDrag();

    const messages = {
        default: "Режим выбора",
        vertex: "Режим добавления вершин",
        edge: "Режим добавления рёбер",
    };

    updateAppStatus(messages[event.currentTarget.id] ?? "Готово");
}

const isTypingTarget = (target) =>
    target instanceof HTMLElement &&
    (target.matches("input, select, textarea, button, a") ||
        target.isContentEditable);

function handleKeyDown(event) {
    if (event.code === "Escape") {
        hideContextMenu();
        cancelEdgeDrag();
        return;
    }

    if (event.code !== "Space" || state.isSpaceDown || isTypingTarget(event.target)) {
        return;
    }

    event.preventDefault();
    state.isSpaceDown = true;
    canvasSurface.classList.add("is_space");
}

function handleKeyUp(event) {
    if (event.code !== "Space") {
        return;
    }

    state.isSpaceDown = false;
    canvasSurface.classList.remove("is_space");
}

const handleWindowBlur = () => {
    state.isSpaceDown = false;
    canvasSurface.classList.remove("is_space", "is_panning");
    state.isPanning = false;
    panState = null;
};

svg.addEventListener("click", handleClickOnCanvas);
svg.addEventListener("dblclick", handleDoubleClickOnCanvas);
svg.addEventListener("mousedown", handleCanvasMouseDown);
svg.addEventListener("wheel", handleWheel, { passive: false });

window.addEventListener("mousemove", handleWindowMouseMove);
window.addEventListener("mouseup", handleWindowMouseUp);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", handleWindowBlur);

defaultMode.addEventListener("click", handleModeChange);
vertexMode.addEventListener("click", handleModeChange);
edgeMode.addEventListener("click", handleModeChange);

zoomInButton.addEventListener("click", () => zoomAtCenter(1.2));
zoomOutButton.addEventListener("click", () => zoomAtCenter(1 / 1.2));
fitViewButton.addEventListener("click", fitView);

contextMenu.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button || button.disabled) {
        return;
    }

    const action = button.dataset.action;
    const target = contextTarget;

    if (action === "rename" && target?.type === "vertex") {
        const vertexId = target.id;
        hideContextMenu();
        openRenameDialog(vertexId);
        return;
    }

    if (action === "delete") {
        deleteContextTarget();
        hideContextMenu();
    }
});

document.addEventListener("mousedown", (event) => {
    if (!contextMenu.hidden && !contextMenu.contains(event.target)) {
        hideContextMenu();
    }
});

renameForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (renameTargetId !== null) {
        state.graph = renameVertex(state.graph, renameTargetId, renameInput.value);

        const vertex = getVertex(state.graph, renameTargetId);
        const element = state.vertexElements.get(renameTargetId);

        if (vertex && element) {
            const label = getLabel(vertex);
            element.setAttribute("data-label", label);
            element.children[1].textContent = label;
            updateVertexOption(vertex);
            updateAppStatus(`Вершина переименована в ${label}`);
            notifyGraphChange("rename");
        }
    }

    renameTargetId = null;
    renameDialog.close();
});

renameCancelButton.addEventListener("click", () => {
    renameTargetId = null;
    renameDialog.close();
});

renameDialog.addEventListener("close", () => {
    renameTargetId = null;
});

const resizeObserver = new ResizeObserver(() => {
    updateViewBox();
});

resizeObserver.observe(svg);
updateViewBox();
