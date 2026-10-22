import { formatVisitedPath } from "./labels.js";

export const meta = Object.freeze({
    id: "dfs",
    name: "Обход в глубину",
    shortName: "DFS",
    description: "Уходит как можно глубже, затем возвращается",
    meta: "Рекурсия · O(V + E)",
    requiresStartVertex: true,
    pseudocode: Object.freeze([
        "function DFS(graph, start):",
        "  visited ← {}",
        "  function visit(u, parent):",
        "    if u ∈ visited: return",
        "    visited.add(u)",
        "    if parent ≠ null:",
        "      отметить ребро (parent, u)",
        "    посетить u",
        "    for v in neighbors(u):",
        "      visit(v, u)",
        "  visit(start, null)",
        "  return visited",
    ]),
});

export const run = ({ graph, startVertexId, helpers }) => {
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
            steps.push(helpers.edge(previousVertexId, vertexId, { line: 7 }));
        }

        steps.push(helpers.vertex(vertexId, { line: 8 }));

        const neighbors = graph.adjacency.get(vertexId) ?? [];

        for (let position = neighbors.length - 1; position >= 0; position -= 1) {
            visit(neighbors[position], vertexId);
        }
    };

    visit(startVertexId, null);

    return {
        visited,
        steps,
        resultText: formatVisitedPath(graph, visited),
    };
};
