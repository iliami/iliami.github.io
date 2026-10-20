import { getAdjacencyList, getAdjacencyMatrix } from "./core.js";

import {
    closeGraphInfoModalBtn,
    modal,
    modalBox,
    modalContent,
    showGraphInfoModalBtn,
    state,
} from "./ui.js";

const getGraphInfoAsString = (graph) => {
    if (graph.vertices.length === 0) {
        return "Нет графа";
    }

    const vertexIndexes = new Map(
        graph.vertices.map((vertex, index) => [vertex.id, index]),
    );

    const adjacencyMatrixText = getAdjacencyMatrix(graph)
        .map((row) => `${row.join(", ")},<br>`)
        .join("");

    const adjacencyListText = getAdjacencyList(graph)
        .map((neighbors, index) => {
            const neighborNumbers = neighbors.map(
                (neighborId) => vertexIndexes.get(neighborId) + 1,
            );

            return `${index + 1}: [${neighborNumbers.join(", ")}],<br>`;
        })
        .join("");

    return `<div style="padding: 10px;">Матрица смежности:<br>${adjacencyMatrixText}</div><div style="padding: 10px;">Список смежности:<br>${adjacencyListText}</div>`;
};

const openGraphInfoModal = (event) => {
    event.stopPropagation();

    modalContent.innerHTML = getGraphInfoAsString(state.graph);
    modal.showModal();
    state.isModalOpen = true;
};

const closeGraphInfoModal = () => {
    modal.close();
    state.isModalOpen = false;
};

showGraphInfoModalBtn.addEventListener("click", openGraphInfoModal);
closeGraphInfoModalBtn.addEventListener("click", closeGraphInfoModal);

modal.addEventListener("close", () => {
    state.isModalOpen = false;
});

document.addEventListener("click", (event) => {
    if (!state.isModalOpen || modalBox.contains(event.target)) {
        return;
    }

    closeGraphInfoModal();
});
