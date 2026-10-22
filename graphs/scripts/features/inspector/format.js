import {
    getAdjacencyList,
    getAdjacencyMatrix,
    getIncidenceMatrix,
} from "../../core/graph-index.js";

const getLabel = (vertex) => vertex?.label ?? vertex?.id ?? "";

export const formatMatrix = (matrix) => {
    if (matrix.length === 0) {
        return "[]";
    }

    const rows = matrix.map((row) => `    [${row.join(", ")}]`);
    return `[\n${rows.join(",\n")},\n]`;
};

export const formatAdjacencyList = (graph) => {
    const adjacency = getAdjacencyList(graph);

    if (graph.vertices.length === 0) {
        return "{}";
    }

    const entries = graph.vertices.map((vertex, index) => {
        const neighbors = adjacency[index].map((neighborId) => {
            const neighbor = graph.vertices.find(
                (candidate) => candidate.id === neighborId,
            );

            return JSON.stringify(getLabel(neighbor));
        });

        return `    ${JSON.stringify(getLabel(vertex))}: [${neighbors.join(", ")}]`;
    });

    return `{\n${entries.join(",\n")},\n}`;
};

export const getStructureText = (graph, activeView) => {
    if (graph.vertices.length === 0) {
        return null;
    }

    if (activeView === "list") {
        return formatAdjacencyList(graph);
    }

    if (activeView === "incidence") {
        if (graph.edges.length === 0) {
            return null;
        }

        return formatMatrix(getIncidenceMatrix(graph));
    }

    return formatMatrix(getAdjacencyMatrix(graph));
};
