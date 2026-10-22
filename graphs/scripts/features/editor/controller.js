import { COLORS, MODES } from "../../app/constants.js";
import {
    $,
    canvasSurface,
    createSvgElement,
    downloadGraphButton,
    svg,
} from "../../app/dom.js";
import {
    appendVertexOption,
    clearGeneratedVertexOptions,
    notifyGraphChange,
    refreshAlgorithmAvailability,
    state,
    updateAppStatus,
} from "../../app/state.js";
import {
    addEdge,
    addVertex,
    createEdge,
    createGraph,
    createVertex,
    getNextEdgeId,
    getNextVertexId,
    getVertex,
    getVertexLabel,
    hasEdgeBetween,
    moveVertex,
} from "../../core/graph.js";
import { getIncidentEdges } from "../../core/graph-index.js";
import {
    deselectVertex,
    getCanvasPoint,
    selectVertex,
    setEdgeStroke,
} from "../../ui/canvas.js";
import { createContextMenuController } from "./context-menu.js";
import {
    appendEdgeElement,
    clearVertexHover,
    createVertexElement,
    moveVertexElement,
    updateEdgePositions,
} from "./elements.js";
import {
    fitView,
    resetView,
    updateViewBox,
    zoomAt,
    zoomAtCenter,
} from "./viewport.js";

export { fitView, resetView, updateViewBox };

const defaultMode = $("default");
const vertexMode = $("vertex");
const edgeMode = $("edge");
const zoomInButton = $("zoom_in");
const zoomOutButton = $("zoom_out");
const fitViewButton = $("fit_view");

let dragState = null;
let panState = null;
let edgeDrag = null;
let suppressClickUntil = 0;
let pendingDragEvent = null;
let dragFrame = null;
let contextMenuController = null;
let initialized = false;

const vertexHandlers = {
    onClick: handleClickOnVertex,
    onMouseDown: handleMouseDownOnVertex,
    onContextMenu: handleVertexContextMenu,
    onMouseEnter: handleVertexHoverIn,
    onMouseLeave: handleVertexHoverOut,
};

const edgeHandlers = {
    onClick: handleEdgeClick,
    onContextMenu: handleEdgeContextMenu,
};

const getLabel = (vertex) => getVertexLabel(vertex);

export const resetCanvas = () => {
    svg.replaceChildren();
    svg.classList.remove("is_hovering_vertex");

    state.graph = createGraph();
    state.vertexElements.clear();
    state.edgeElements.clear();
    state.selectedVertexId = null;
    state.prevCircleColor = null;
    dragState = null;
    edgeDrag = null;

    clearGeneratedVertexOptions();
    downloadGraphButton?.removeAttribute("href");
    refreshAlgorithmAvailability();
};

export const renderGraph = (graph) => {
    resetCanvas();
    state.graph = graph;

    for (const edge of graph.edges) {
        appendEdgeElement(edge, graph, edgeHandlers);
    }

    for (const vertex of graph.vertices) {
        const element = createVertexElement(vertex, vertexHandlers);
        state.vertexElements.set(vertex.id, element);
        svg.append(element);
        appendVertexOption(vertex);
    }

    refreshAlgorithmAvailability();
    notifyGraphChange("render");
};

const addVertexAt = ({ x, y }) => {
    const id = getNextVertexId(state.graph);
    const vertex = createVertex(id, Math.round(x), Math.round(y));

    state.graph = addVertex(state.graph, vertex);

    const element = createVertexElement(vertex, vertexHandlers);
    state.vertexElements.set(id, element);
    svg.append(element);

    appendVertexOption(vertex);
    refreshAlgorithmAvailability();
    notifyGraphChange("vertex-add");
    updateAppStatus(`Добавлена вершина ${getLabel(vertex)}`);
};

export const returnDefaultColors = () => {
    for (const [vertexId, element] of state.vertexElements) {
        element.children[0].setAttribute("fill", COLORS.vertex);
        element.children[0].setAttribute("stroke", "var(--node-border)");
        element.children[1].setAttribute("fill", COLORS.vertexText);

        if (vertexId === state.selectedVertexId) {
            element.children[0].setAttribute("fill", COLORS.vertex);
        }
    }

    for (const edgeId of state.edgeElements.keys()) {
        setEdgeStroke(edgeId, COLORS.edge);
    }
};

function handleVertexHoverIn(event) {
    const vertexId = event.currentTarget.id;

    if (!state.vertexElements.has(vertexId)) {
        return;
    }

    clearVertexHover();
    svg.classList.add("is_hovering_vertex");
    state.vertexElements.get(vertexId)?.classList.add("is_hovered");

    for (const edge of getIncidentEdges(state.graph, vertexId)) {
        state.edgeElements.get(edge.id)?.classList.add("is_related");

        const otherVertexId = edge.fromId === vertexId ? edge.toId : edge.fromId;
        state.vertexElements.get(otherVertexId)?.classList.add("is_related");
    }
}

function handleVertexHoverOut() {
    clearVertexHover();
}

const createEdgeBetween = (
    firstVertexId,
    secondVertexId,
    { directed = false } = {},
) => {
    if (firstVertexId === secondVertexId) {
        return false;
    }

    if (hasEdgeBetween(state.graph, firstVertexId, secondVertexId)) {
        updateAppStatus("Такое ребро уже существует");
        return false;
    }

    const edgeId = getNextEdgeId(state.graph);
    const edge = createEdge(
        edgeId,
        firstVertexId,
        secondVertexId,
        1,
        directed,
    );

    state.graph = addEdge(state.graph, edge);
    appendEdgeElement(edge, state.graph, edgeHandlers);
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
    const directed = state.isSpaceDown;
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
    edgeDrag = { sourceId: vertex.id, line, directed };
    updateAppStatus(
        directed ? "Создание направленного ребра…" : "Создание ребра…",
    );
};

const finishEdgeDrag = (event) => {
    if (!edgeDrag) {
        return;
    }

    const { sourceId, line, directed } = edgeDrag;
    line.remove();
    edgeDrag = null;
    suppressClickUntil = performance.now() + 250;

    const element = document.elementFromPoint(event.clientX, event.clientY);
    const vertexElement = element?.closest?.(".vertex");

    if (!vertexElement) {
        updateAppStatus("Создание ребра отменено");
        return;
    }

    createEdgeBetween(sourceId, vertexElement.id, { directed });
};

const cancelEdgeDrag = () => {
    if (!edgeDrag) {
        return;
    }

    edgeDrag.line.remove();
    edgeDrag = null;
    updateAppStatus("Создание ребра отменено");
};

function handleVertexContextMenu(event) {
    contextMenuController?.show(event, {
        type: "vertex",
        id: event.currentTarget.id,
    });
}

function handleEdgeClick(event) {
    contextMenuController?.show(event, {
        type: "edge",
        id: event.currentTarget.id,
    });
}

function handleEdgeContextMenu(event) {
    contextMenuController?.show(event, {
        type: "edge",
        id: event.currentTarget.id,
    });
}

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
    if (
        event.button !== 0 ||
        (state.isSpaceDown && !event.shiftKey) ||
        state.mode !== MODES.default
    ) {
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
        previousStroke: event.currentTarget.children[0].getAttribute("stroke"),
        previousTextFill: event.currentTarget.children[1].getAttribute("fill"),
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

function applyVertexDrag() {
    dragFrame = null;

    const event = pendingDragEvent;
    pendingDragEvent = null;

    if (!event || !dragState) {
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
    moveVertexElement(dragState.vertexId, nextPoint);
    updateEdgePositions(dragState.vertexId);
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

    pendingDragEvent = event;

    if (dragFrame === null) {
        dragFrame = requestAnimationFrame(applyVertexDrag);
    }
}

function handleWindowMouseUp(event) {
    if (dragFrame !== null) {
        cancelAnimationFrame(dragFrame);
        dragFrame = null;
    }

    if (pendingDragEvent && dragState) {
        applyVertexDrag();
    }

    pendingDragEvent = null;

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

    const { vertexId, moved, previousFill, previousStroke, previousTextFill } =
        dragState;
    const element = state.vertexElements.get(vertexId);

    if (element) {
        element.children[0].setAttribute(
            "fill",
            previousFill ?? COLORS.vertex,
        );
        element.children[0].setAttribute(
            "stroke",
            previousStroke ?? "var(--node-border)",
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
        contextMenuController?.hide();
        cancelEdgeDrag();
        return;
    }

    if (
        event.code !== "Space" ||
        state.isSpaceDown ||
        isTypingTarget(event.target)
    ) {
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

export const initEditor = () => {
    if (initialized) {
        return;
    }

    initialized = true;
    contextMenuController = createContextMenuController({ renderGraph });

    svg.addEventListener("click", handleClickOnCanvas);
    svg.addEventListener("dblclick", handleDoubleClickOnCanvas);
    svg.addEventListener("mousedown", handleCanvasMouseDown);
    svg.addEventListener("wheel", handleWheel, { passive: false });

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    defaultMode?.addEventListener("click", handleModeChange);
    vertexMode?.addEventListener("click", handleModeChange);
    edgeMode?.addEventListener("click", handleModeChange);

    zoomInButton?.addEventListener("click", () => zoomAtCenter(1.2));
    zoomOutButton?.addEventListener("click", () => zoomAtCenter(1 / 1.2));
    fitViewButton?.addEventListener("click", fitView);

    const resizeObserver = new ResizeObserver(() => {
        updateViewBox();
    });

    resizeObserver.observe(svg);
    updateViewBox();
};
