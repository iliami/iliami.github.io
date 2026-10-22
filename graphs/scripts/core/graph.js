export const EDGE_ID_OFFSET = 100000;

export const createVertex = (id, x, y, label = id) => ({
    id,
    x,
    y,
    label,
});

export const normalizeEdgeWeight = (weight) => {
    const numeric = Number(weight);

    return Number.isFinite(numeric) ? numeric : 1;
};

export const createEdge = (id, fromId, toId, weight = 1, directed = false) => ({
    id,
    fromId,
    toId,
    weight: normalizeEdgeWeight(weight),
    directed: Boolean(directed),
});

export const createGraph = (
    vertices = [],
    edges = [],
    { directed = false } = {},
) => ({ vertices, edges, directed });

export const addVertex = (graph, vertex) => ({
    ...graph,
    vertices: [...graph.vertices, vertex],
});

export const addEdge = (graph, edge) => ({
    ...graph,
    edges: [...graph.edges, edge],
});

export const moveVertex = (graph, vertexId, { x, y }) => ({
    ...graph,
    vertices: graph.vertices.map((vertex) =>
        vertex.id === vertexId ? { ...vertex, x, y } : vertex,
    ),
});

export const removeVertex = (graph, vertexId) => ({
    ...graph,
    vertices: graph.vertices.filter((vertex) => vertex.id !== vertexId),
    edges: graph.edges.filter(
        (edge) => edge.fromId !== vertexId && edge.toId !== vertexId,
    ),
});

export const removeEdge = (graph, edgeId) => ({
    ...graph,
    edges: graph.edges.filter((edge) => edge.id !== edgeId),
});

export const getEdge = (graph, edgeId) =>
    graph.edges.find((edge) => edge.id === edgeId);

const updateEdge = (graph, edgeId, updater) => ({
    ...graph,
    edges: graph.edges.map((edge) =>
        edge.id === edgeId ? updater(edge) : edge,
    ),
});

export const updateEdgeWeight = (graph, edgeId, weight) =>
    updateEdge(graph, edgeId, (edge) => ({
        ...edge,
        weight: normalizeEdgeWeight(weight),
    }));

export const setEdgeDirected = (graph, edgeId, directed) =>
    updateEdge(graph, edgeId, (edge) => ({
        ...edge,
        directed: Boolean(directed),
    }));

export const reverseEdge = (graph, edgeId) =>
    updateEdge(graph, edgeId, (edge) => ({
        ...edge,
        fromId: edge.toId,
        toId: edge.fromId,
    }));

export const directEdgeTo = (graph, edgeId, toId) =>
    updateEdge(graph, edgeId, (edge) => {
        if (toId !== edge.fromId && toId !== edge.toId) {
            return edge;
        }

        if (toId === edge.fromId) {
            return {
                ...edge,
                fromId: edge.toId,
                toId,
                directed: true,
            };
        }

        return {
            ...edge,
            directed: true,
        };
    });

export const renameVertex = (graph, vertexId, label) => ({
    ...graph,
    vertices: graph.vertices.map((vertex) =>
        vertex.id === vertexId
            ? { ...vertex, label: label.trim() || vertex.id }
            : vertex,
    ),
});

export const getVertexLabel = (vertex) => vertex.label ?? vertex.id;

export const getVertex = (graph, vertexId) =>
    graph.vertices.find((vertex) => vertex.id === vertexId);

export const getNextVertexId = (graph) => {
    const usedIds = new Set(graph.vertices.map((vertex) => vertex.id));
    let nextId = graph.vertices.length + 1;

    while (usedIds.has(String(nextId))) {
        nextId += 1;
    }

    return String(nextId);
};

export const getNextEdgeId = (graph) => {
    const usedIds = new Set(graph.edges.map((edge) => edge.id));
    let nextId = EDGE_ID_OFFSET + graph.edges.length + 1;

    while (usedIds.has(String(nextId))) {
        nextId += 1;
    }

    return String(nextId);
};

export const compareVertexIds = (firstId, secondId) =>
    Number(firstId) - Number(secondId);

export const hasEdgeBetween = (graph, firstVertexId, secondVertexId) =>
    graph.edges.some(
        (edge) =>
            (edge.fromId === firstVertexId &&
                edge.toId === secondVertexId) ||
            (edge.fromId === secondVertexId && edge.toId === firstVertexId),
    );
