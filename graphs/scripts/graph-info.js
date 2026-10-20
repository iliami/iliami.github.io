import {
    getAdjacencyList,
    getAdjacencyMatrix,
    getIncidenceMatrix,
} from "./core.js";

import { graphInfoContent, graphTabs, onGraphChange, state } from "./ui.js";

let activeView = "matrix";

const getLabel = (vertex) => vertex?.label ?? vertex?.id ?? "";

const createEmptyState = (text) => {
    const container = document.createElement("div");
    container.className = "empty_state";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.innerHTML =
        '<circle cx="6" cy="6" r="2.2" stroke="currentColor" stroke-width="1.6"/>' +
        '<circle cx="18" cy="18" r="2.2" stroke="currentColor" stroke-width="1.6"/>' +
        '<path d="M8 8l8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="3 3"/>';

    const paragraph = document.createElement("p");
    paragraph.textContent = text;

    container.append(icon, paragraph);

    return container;
};

const createCell = (content, className) => {
    const cell = document.createElement("td");
    cell.textContent = content;

    if (className) {
        cell.className = className;
    }

    return cell;
};

const createHeaderCell = (content) => {
    const cell = document.createElement("th");
    cell.textContent = content;
    return cell;
};

const renderAdjacencyMatrix = (graph) => {
    const labels = graph.vertices.map(getLabel);
    const matrix = getAdjacencyMatrix(graph);
    const table = document.createElement("table");
    table.className = "graph_table";

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.append(createHeaderCell("V"));

    labels.forEach((label) => headRow.append(createHeaderCell(label)));
    head.append(headRow);

    const body = document.createElement("tbody");

    matrix.forEach((row, rowIndex) => {
        const tableRow = document.createElement("tr");
        const rowHead = document.createElement("th");
        rowHead.className = "row_head";
        rowHead.textContent = labels[rowIndex];
        tableRow.append(rowHead);

        row.forEach((value) => {
            tableRow.append(
                createCell(value, value === 1 ? "cell_one" : undefined),
            );
        });

        body.append(tableRow);
    });

    table.append(head, body);
    return table;
};

const renderAdjacencyList = (graph) => {
    const adjacencyList = getAdjacencyList(graph);
    const container = document.createElement("div");
    container.className = "adjacency_list";

    graph.vertices.forEach((vertex, index) => {
        const row = document.createElement("div");
        row.className = "adjacency_row";

        const chip = document.createElement("span");
        chip.className = "vertex_chip";
        chip.textContent = getLabel(vertex);

        const arrow = document.createElement("span");
        arrow.className = "adjacency_arrow";
        arrow.textContent = "→";

        const neighbors = document.createElement("span");
        neighbors.className = "adjacency_neighbors";

        const neighborLabels = adjacencyList[index].map((neighborId) => {
            const neighbor = graph.vertices.find(
                (candidate) => candidate.id === neighborId,
            );
            return getLabel(neighbor);
        });

        neighbors.textContent =
            neighborLabels.length > 0 ? `[${neighborLabels.join(", ")}]` : "—";

        row.append(chip, arrow, neighbors);
        container.append(row);
    });

    return container;
};

const renderIncidenceMatrix = (graph) => {
    const labels = graph.vertices.map(getLabel);
    const matrix = getIncidenceMatrix(graph);
    const table = document.createElement("table");
    table.className = "graph_table";

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.append(createHeaderCell("V \\ E"));

    graph.edges.forEach((edge, index) => {
        headRow.append(createHeaderCell(`e${index + 1}`));
    });

    head.append(headRow);

    const body = document.createElement("tbody");

    matrix.forEach((row, rowIndex) => {
        const tableRow = document.createElement("tr");
        const rowHead = document.createElement("th");
        rowHead.className = "row_head";
        rowHead.textContent = labels[rowIndex];
        tableRow.append(rowHead);

        row.forEach((value) => {
            tableRow.append(
                createCell(value, value === 1 ? "cell_filled" : undefined),
            );
        });

        body.append(tableRow);
    });

    table.append(head, body);
    return table;
};

const renderGraphInfo = () => {
    graphInfoContent.replaceChildren();

    if (state.graph.vertices.length === 0) {
        graphInfoContent.append(
            createEmptyState(
                "Добавьте вершины на холст — представления графа появятся здесь автоматически.",
            ),
        );
        return;
    }

    if (activeView === "list") {
        graphInfoContent.append(renderAdjacencyList(state.graph));
        return;
    }

    if (activeView === "incidence") {
        if (state.graph.edges.length === 0) {
            graphInfoContent.append(
                createEmptyState(
                    "В графе пока нет рёбер. Создайте связь, чтобы увидеть матрицу инцидентности.",
                ),
            );
            return;
        }

        graphInfoContent.append(renderIncidenceMatrix(state.graph));
        return;
    }

    graphInfoContent.append(renderAdjacencyMatrix(state.graph));
};

graphTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        activeView = tab.dataset.view ?? "matrix";

        graphTabs.forEach((candidate) => {
            const isActive = candidate === tab;
            candidate.classList.toggle("is_active", isActive);
            candidate.setAttribute("aria-selected", String(isActive));
        });

        renderGraphInfo();
    });
});

onGraphChange(() => {
    renderGraphInfo();
});

renderGraphInfo();
