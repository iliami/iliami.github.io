export const EDGE_ID_OFFSET = 100000;

export const STEP_TYPE = Object.freeze({
    edge: "edge",
    vertex: "vertex",
});

export const createVertex = (id, x, y) => ({ id, x, y });

export const createEdge = (id, fromId, toId) => ({ id, fromId, toId });

export const createGraph = (vertices = [], edges = []) => ({ vertices, edges });

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

export const findEdgeBetween = (graph, firstVertexId, secondVertexId) =>
    graph.edges.find(
        (edge) =>
            (edge.fromId === firstVertexId &&
                edge.toId === secondVertexId) ||
            (edge.fromId === secondVertexId &&
                edge.toId === firstVertexId),
    );

export const hasEdgeBetween = (graph, firstVertexId, secondVertexId) =>
    Boolean(findEdgeBetween(graph, firstVertexId, secondVertexId));

export const getIncidentEdges = (graph, vertexId) =>
    graph.edges.filter(
        (edge) => edge.fromId === vertexId || edge.toId === vertexId,
    );

export const getNeighbors = (graph, vertexId) =>
    getIncidentEdges(graph, vertexId)
        .map((edge) => (edge.fromId === vertexId ? edge.toId : edge.fromId))
        .sort(compareVertexIds);

export const getAdjacencyMatrix = (graph) => {
    const vertexIndexes = new Map(
        graph.vertices.map((vertex, index) => [vertex.id, index]),
    );
    const matrix = graph.vertices.map(() =>
        Array(graph.vertices.length).fill(0),
    );

    for (const edge of graph.edges) {
        const firstIndex = vertexIndexes.get(edge.fromId);
        const secondIndex = vertexIndexes.get(edge.toId);

        if (firstIndex === undefined || secondIndex === undefined) {
            continue;
        }

        matrix[firstIndex][secondIndex] = 1;
        matrix[secondIndex][firstIndex] = 1;
    }

    return matrix;
};

export const getAdjacencyList = (graph) =>
    graph.vertices.map((vertex) => getNeighbors(graph, vertex.id));

const createEdgeStep = (graph, firstVertexId, secondVertexId) => {
    const edge = findEdgeBetween(graph, firstVertexId, secondVertexId);
    return edge ? { type: STEP_TYPE.edge, edgeId: edge.id } : null;
};

export const bfsTraversal = (graph, startVertexId) => {
    const visited = [startVertexId];
    const visitedSet = new Set(visited);
    const queue = [startVertexId];
    const steps = [{ type: STEP_TYPE.vertex, vertexId: startVertexId }];

    while (queue.length > 0) {
        const currentVertexId = queue.shift();

        for (const nextVertexId of getNeighbors(graph, currentVertexId)) {
            if (visitedSet.has(nextVertexId)) {
                continue;
            }

            visitedSet.add(nextVertexId);
            visited.push(nextVertexId);
            queue.push(nextVertexId);

            const edgeStep = createEdgeStep(
                graph,
                currentVertexId,
                nextVertexId,
            );

            if (edgeStep) {
                steps.push(edgeStep);
            }

            steps.push({
                type: STEP_TYPE.vertex,
                vertexId: nextVertexId,
            });
        }
    }

    return { visited, steps };
};

export const dfsTraversal = (graph, startVertexId) => {
    const visited = [];
    const visitedSet = new Set();
    const steps = [];

    const visit = (vertexId, previousVertexId) => {
        if (visitedSet.has(vertexId)) {
            return;
        }

        visitedSet.add(vertexId);
        visited.push(vertexId);

        if (previousVertexId !== null) {
            const edgeStep = createEdgeStep(
                graph,
                previousVertexId,
                vertexId,
            );

            if (edgeStep) {
                steps.push(edgeStep);
            }
        }

        steps.push({ type: STEP_TYPE.vertex, vertexId });

        for (const nextVertexId of getNeighbors(graph, vertexId).reverse()) {
            visit(nextVertexId, vertexId);
        }
    };

    visit(startVertexId, null);

    return { visited, steps };
};
