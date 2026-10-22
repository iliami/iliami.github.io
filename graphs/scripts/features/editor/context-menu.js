import { $ } from "../../app/dom.js";
import {
    notifyGraphChange,
    state,
    updateAppStatus,
    updateVertexOption,
} from "../../app/state.js";
import {
    directEdgeTo,
    getEdge,
    getVertex,
    getVertexLabel,
    removeEdge,
    removeVertex,
    renameVertex,
    reverseEdge,
    setEdgeDirected,
    updateEdgeWeight,
} from "../../core/graph.js";
import { updateEdgeElement } from "./elements.js";

const createDirectionButton = ({
    label,
    title,
    className,
    dataset = {},
}) => {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);

    if (className) {
        button.className = className;
    }

    for (const [name, value] of Object.entries(dataset)) {
        button.dataset[name] = value;
    }

    return button;
};

export const createContextMenuController = ({ renderGraph }) => {
    const contextMenu = $("context_menu");
    const renameDialog = $("rename_dialog");
    const renameForm = $("rename_form");
    const renameInput = $("rename_input");
    const renameCancelButton = $("rename_cancel");
    const edgeFields = $("context_edge_fields");
    const weightInput = $("context_weight");
    const directionContainer = $("context_direction");

    let contextTarget = null;
    let renameTargetId = null;

    const getContextEdge = () =>
        contextTarget?.type === "edge"
            ? getEdge(state.graph, contextTarget.id)
            : null;

    const getDirectionPair = (edge) => {
        const from = getVertex(state.graph, edge.fromId);
        const to = getVertex(state.graph, edge.toId);

        if (
            !from ||
            !to ||
            from.id === to.id ||
            (from.x === to.x && from.y === to.y)
        ) {
            return null;
        }

        const vertical = from.x === to.x;
        const first = vertical
            ? from.y <= to.y
                ? from
                : to
            : from.x <= to.x
              ? from
              : to;
        const second = first.id === from.id ? to : from;

        return { vertical, first, second };
    };

    const getDirectionArrow = (pair, targetId) => {
        if (pair.first.id === targetId) {
            return pair.vertical ? "↑" : "←";
        }

        return pair.vertical ? "↓" : "→";
    };

    const renderDirectionControls = (edge) => {
        directionContainer.replaceChildren();

        const pair = getDirectionPair(edge);

        if (!pair) {
            directionContainer.hidden = true;
            return;
        }

        directionContainer.hidden = false;

        const directed = Boolean(state.graph.directed || edge.directed);

        directionContainer.classList.toggle("is_directed", directed);
        directionContainer.classList.toggle(
            "is_vertical",
            !directed && pair.first.x === pair.second.x,
        );

        if (directed) {
            const other = getVertex(state.graph, edge.fromId);
            const arrow = getDirectionArrow(pair, other.id);

            directionContainer.append(
                createDirectionButton({
                    label: arrow,
                    title: `Направить в другую вершину (${getVertexLabel(other)})`,
                    className: "context_direction_reverse",
                    dataset: { edgeReverse: "true" },
                }),
            );

            if (!state.graph.directed) {
                directionContainer.append(
                    createDirectionButton({
                        label: "✕",
                        title: "Убрать направление",
                        className: "context_direction_remove",
                        dataset: { edgeUndirected: "true" },
                    }),
                );
            }

            return;
        }

        directionContainer.append(
            createDirectionButton({
                label: getDirectionArrow(pair, pair.first.id),
                title: `Направить в вершину ${getVertexLabel(pair.first)}`,
                dataset: { edgeTarget: pair.first.id },
            }),
            createDirectionButton({
                label: getDirectionArrow(pair, pair.second.id),
                title: `Направить в вершину ${getVertexLabel(pair.second)}`,
                dataset: { edgeTarget: pair.second.id },
            }),
        );
    };

    const renderEdgeControls = (edge) => {
        edgeFields.hidden = false;
        weightInput.value = String(edge.weight ?? 1);
        renderDirectionControls(edge);
    };

    const commitWeight = (resetInvalid = false) => {
        const edge = getContextEdge();

        if (!edge) {
            return;
        }

        const rawValue = weightInput.value.trim();
        const weight = Number(rawValue);

        if (rawValue.length === 0 || !Number.isFinite(weight)) {
            if (resetInvalid) {
                weightInput.value = String(edge.weight);
            }
            return;
        }

        if (weight === edge.weight) {
            return;
        }

        state.graph = updateEdgeWeight(state.graph, edge.id, weight);

        const nextEdge = getEdge(state.graph, edge.id);

        updateEdgeElement(nextEdge, state.graph);
        notifyGraphChange("edge-weight");
        updateAppStatus(`Вес ребра: ${nextEdge.weight}`);
    };

    const applyDirection = (nextGraph, message) => {
        const edge = getContextEdge();

        if (!edge || nextGraph === state.graph) {
            return;
        }

        state.graph = nextGraph;

        const nextEdge = getEdge(state.graph, edge.id);

        updateEdgeElement(nextEdge, state.graph);
        renderEdgeControls(nextEdge);
        notifyGraphChange("edge-direction");
        updateAppStatus(message);
    };

    const hide = () => {
        commitWeight(true);
        contextMenu.hidden = true;
        contextTarget = null;
    };

    const show = (event, target) => {
        event.preventDefault();
        event.stopPropagation();

        if (contextTarget) {
            commitWeight(true);
        }

        contextTarget = target;
        contextMenu.hidden = false;

        const renameItem = contextMenu.querySelector('[data-action="rename"]');
        const isEdge = target.type === "edge";

        renameItem.hidden = isEdge;
        edgeFields.hidden = true;

        if (isEdge) {
            const edge = getEdge(state.graph, target.id);

            if (edge) {
                renderEdgeControls(edge);
            }
        }

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

    const openRenameDialog = (vertexId) => {
        const vertex = getVertex(state.graph, vertexId);

        if (!vertex) {
            return;
        }

        renameTargetId = vertexId;
        renameInput.value = getVertexLabel(vertex);
        renameDialog.showModal();
        renameInput.focus();
        renameInput.select();
    };

    const deleteTarget = () => {
        if (!contextTarget) {
            return;
        }

        const { type, id } = contextTarget;

        if (type === "vertex") {
            const vertex = getVertex(state.graph, id);
            state.graph = removeVertex(state.graph, id);
            renderGraph(state.graph);
            updateAppStatus(
                `Вершина ${vertex ? getVertexLabel(vertex) : id} удалена`,
            );
            return;
        }

        const element = state.edgeElements.get(id);
        element?.remove();
        state.edgeElements.delete(id);
        state.graph = removeEdge(state.graph, id);
        notifyGraphChange("edge-delete");
        updateAppStatus("Ребро удалено");
    };

    weightInput.addEventListener("input", () => commitWeight(false));
    weightInput.addEventListener("change", () => commitWeight(true));

    directionContainer.addEventListener("click", (event) => {
        const button = event.target.closest("button");

        if (!button || button.disabled) {
            return;
        }

        const edge = getContextEdge();

        if (!edge) {
            return;
        }

        if (button.dataset.edgeUndirected === "true") {
            applyDirection(
                setEdgeDirected(state.graph, edge.id, false),
                "Направление ребра убрано",
            );
            return;
        }

        if (button.dataset.edgeReverse === "true") {
            applyDirection(
                reverseEdge(state.graph, edge.id),
                "Направление ребра изменено",
            );
            return;
        }

        if (button.dataset.edgeTarget) {
            applyDirection(
                directEdgeTo(state.graph, edge.id, button.dataset.edgeTarget),
                "Направление ребра задано",
            );
        }
    });

    contextMenu.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");

        if (!button || button.disabled) {
            return;
        }

        const action = button.dataset.action;
        const target = contextTarget;

        if (action === "rename" && target?.type === "vertex") {
            const vertexId = target.id;
            hide();
            openRenameDialog(vertexId);
            return;
        }

        if (action === "delete") {
            deleteTarget();
            hide();
        }
    });

    document.addEventListener("mousedown", (event) => {
        if (!contextMenu.hidden && !contextMenu.contains(event.target)) {
            hide();
        }
    });

    renameForm.addEventListener("submit", (event) => {
        event.preventDefault();

        if (renameTargetId !== null) {
            state.graph = renameVertex(
                state.graph,
                renameTargetId,
                renameInput.value,
            );

            const vertex = getVertex(state.graph, renameTargetId);
            const element = state.vertexElements.get(renameTargetId);

            if (vertex && element) {
                const label = getVertexLabel(vertex);
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

    return { show, hide };
};
