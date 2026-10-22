export const getVertexLabelById = (graph, vertexId) =>
    graph.vertexById.get(vertexId)?.label ?? vertexId;

export const formatVisitedPath = (graph, visited) =>
    visited.map((vertexId) => getVertexLabelById(graph, vertexId)).join(" → ");
