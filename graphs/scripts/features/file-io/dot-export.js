const quoteDot = (value) =>
    `"${String(value)
        .replaceAll("\\", "\\\\")
        .replaceAll('"', '\\"')
        .replaceAll("\n", "\\n")}"`;

const formatWeight = (weight) => String(weight ?? 1);

export const serializeGraphToDot = (graph) => {
    const hasDirectedEdges =
        Boolean(graph.directed) ||
        graph.edges.some((edge) => Boolean(edge.directed));
    const graphType = hasDirectedEdges ? "digraph" : "graph";
    const edgeOperator = hasDirectedEdges ? "->" : "--";
    const lines = [`${graphType} G {`];

    for (const vertex of graph.vertices) {
        const attributes = [
            `label=${quoteDot(vertex.label ?? vertex.id)}`,
            `pos=${quoteDot(`${vertex.x},${-vertex.y}!`)}`,
        ];

        lines.push(
            `    ${quoteDot(vertex.id)} [${attributes.join(", ")}];`,
        );
    }

    for (const edge of graph.edges) {
        const attributes = [`id=${quoteDot(edge.id)}`];

        if (Number(edge.weight) !== 1) {
            attributes.push(`weight=${formatWeight(edge.weight)}`);
        }

        if (hasDirectedEdges && !(graph.directed || edge.directed)) {
            attributes.push("dir=none");
        }

        lines.push(
            `    ${quoteDot(edge.fromId)} ${edgeOperator} ${quoteDot(edge.toId)} [${attributes.join(", ")}];`,
        );
    }

    lines.push("}", "");

    return lines.join("\n");
};
