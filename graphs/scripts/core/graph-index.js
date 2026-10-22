export const getEdgePairKey = (firstId, secondId, directed = false) => {
    if (directed) {
        return `${firstId}\u0000${secondId}`;
    }

    return firstId <= secondId
        ? `${firstId}\u0000${secondId}`
        : `${secondId}\u0000${firstId}`;
};

export const compareVertexIds = (firstId, secondId) => {
    const firstNumber = Number(firstId);
    const secondNumber = Number(secondId);

    if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
        return firstNumber - secondNumber;
    }

    return String(firstId).localeCompare(String(secondId));
};

const sortNeighbors = (neighbors) =>
    Array.from(neighbors).sort(compareVertexIds);

export const buildGraphIndex = (graph) => {
    const directed = Boolean(graph.directed);
    const vertexIds = graph.vertices.map((vertex) => vertex.id);
    const vertexById = new Map(
        graph.vertices.map((vertex) => [vertex.id, vertex]),
    );
    const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
    const adjacencySets = new Map(
        vertexIds.map((vertexId) => [vertexId, new Set()]),
    );
    const incident = new Map(vertexIds.map((vertexId) => [vertexId, []]));
    const outgoing = new Map(vertexIds.map((vertexId) => [vertexId, []]));
    const incoming = new Map(vertexIds.map((vertexId) => [vertexId, []]));
    const edgeByPair = new Map();

    for (const edge of graph.edges) {
        const { fromId, toId } = edge;
        const fromExists = vertexById.has(fromId);
        const toExists = vertexById.has(toId);
        const edgeDirected = directed || Boolean(edge.directed);

        if (fromExists && toExists) {
            const neighborSource = adjacencySets.get(fromId);
            const neighborTarget = adjacencySets.get(toId);

            neighborSource.add(toId);

            if (!edgeDirected && fromId !== toId) {
                neighborTarget.add(fromId);
            }

            edgeByPair.set(
                getEdgePairKey(fromId, toId, true),
                edge,
            );

            if (!edgeDirected && fromId !== toId) {
                edgeByPair.set(
                    getEdgePairKey(toId, fromId, true),
                    edge,
                );
            }
        }

        if (fromExists) {
            outgoing.get(fromId).push(edge);
            incident.get(fromId).push(edge);
        }

        if (!edgeDirected && fromExists && toExists && fromId !== toId) {
            outgoing.get(toId).push(edge);
        }

        if (toExists) {
            incoming.get(toId).push(edge);

            if (fromId !== toId) {
                incident.get(toId).push(edge);
            }
        }

        if (!edgeDirected && fromExists && toExists && fromId !== toId) {
            incoming.get(fromId).push(edge);
        }
    }

    const adjacency = new Map(
        vertexIds.map((vertexId) => [
            vertexId,
            sortNeighbors(adjacencySets.get(vertexId)),
        ]),
    );

    return {
        graph,
        directed,
        vertexIds,
        vertexById,
        edgeById,
        adjacency,
        incident,
        outgoing,
        incoming,
        edgeByPair,
    };
};

const indexCache = new WeakMap();

export const getGraphIndex = (graph) => {
    const cached = indexCache.get(graph);

    if (cached) {
        return cached;
    }

    const index = buildGraphIndex(graph);
    indexCache.set(graph, index);

    return index;
};

const isGraphIndex = (value) =>
    value !== null &&
    typeof value === "object" &&
    value.vertexById instanceof Map &&
    Array.isArray(value.vertexIds);

const resolveIndex = (graphOrIndex) =>
    isGraphIndex(graphOrIndex)
        ? graphOrIndex
        : getGraphIndex(graphOrIndex);

export const getVertexById = (graphOrIndex, vertexId) =>
    resolveIndex(graphOrIndex).vertexById.get(vertexId);

export const getEdgeById = (graphOrIndex, edgeId) =>
    resolveIndex(graphOrIndex).edgeById.get(edgeId);

export const getNeighbors = (graphOrIndex, vertexId) =>
    resolveIndex(graphOrIndex).adjacency.get(vertexId) ?? [];

export const getIncidentEdges = (graphOrIndex, vertexId) =>
    resolveIndex(graphOrIndex).incident.get(vertexId) ?? [];

export const findEdgeBetween = (graphOrIndex, firstVertexId, secondVertexId) => {
    const index = resolveIndex(graphOrIndex);

    return (
        index.edgeByPair.get(
            getEdgePairKey(firstVertexId, secondVertexId, true),
        ) ?? null
    );
};

export const hasEdgeBetween = (graphOrIndex, firstVertexId, secondVertexId) =>
    Boolean(findEdgeBetween(graphOrIndex, firstVertexId, secondVertexId));

export const getAdjacencyList = (graphOrIndex) => {
    const index = resolveIndex(graphOrIndex);

    return index.vertexIds.map((vertexId) => [...index.adjacency.get(vertexId)]);
};

const adjacencyMatrixCache = new WeakMap();

export const getAdjacencyMatrix = (graphOrIndex) => {
    const index = resolveIndex(graphOrIndex);
    const cached = adjacencyMatrixCache.get(index);

    if (cached) {
        return cached;
    }

    const columnByVertexId = new Map(
        index.vertexIds.map((vertexId, column) => [vertexId, column]),
    );
    const matrix = index.vertexIds.map(() =>
        Array(index.vertexIds.length).fill(0),
    );

    for (const edge of index.graph.edges) {
        const row = columnByVertexId.get(edge.fromId);
        const column = columnByVertexId.get(edge.toId);

        if (row === undefined || column === undefined) {
            continue;
        }

        matrix[row][column] = 1;

        if (!index.directed && !edge.directed) {
            matrix[column][row] = 1;
        }
    }

    adjacencyMatrixCache.set(index, matrix);

    return matrix;
};

const incidenceMatrixCache = new WeakMap();

export const getIncidenceMatrix = (graphOrIndex) => {
    const index = resolveIndex(graphOrIndex);
    const cached = incidenceMatrixCache.get(index);

    if (cached) {
        return cached;
    }

    const rowByVertexId = new Map(
        index.vertexIds.map((vertexId, row) => [vertexId, row]),
    );
    const matrix = index.vertexIds.map(() =>
        Array(index.graph.edges.length).fill(0),
    );

    index.graph.edges.forEach((edge, column) => {
        const fromRow = rowByVertexId.get(edge.fromId);
        const toRow = rowByVertexId.get(edge.toId);

        if (fromRow !== undefined) {
            matrix[fromRow][column] = 1;
        }

        if (toRow !== undefined) {
            matrix[toRow][column] = 1;
        }
    });

    incidenceMatrixCache.set(index, matrix);

    return matrix;
};
