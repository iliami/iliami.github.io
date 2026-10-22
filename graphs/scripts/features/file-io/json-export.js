export const serializeGraphToJson = (graph) =>
    JSON.stringify(
        {
            format: "graph-studio",
            version: 1,
            directed: Boolean(graph.directed),
            vertices: graph.vertices.map((vertex) => ({
                id: vertex.id,
                x: vertex.x,
                y: vertex.y,
                label: vertex.label,
            })),
            edges: graph.edges.map((edge) => ({
                id: edge.id,
                fromId: edge.fromId,
                toId: edge.toId,
                weight: edge.weight,
                directed: Boolean(edge.directed),
            })),
        },
        null,
        2,
    );
