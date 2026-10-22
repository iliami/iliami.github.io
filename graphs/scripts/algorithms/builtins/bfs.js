import { formatVisitedPath } from "./labels.js";

export const meta = Object.freeze({
    id: "bfs",
    name: "Обход в ширину",
    shortName: "BFS",
    description: "Посещает вершины по уровням от стартовой вершины",
    meta: "Очередь · O(V + E)",
    requiresStartVertex: true,
    pseudocode: Object.freeze([
        "function BFS(graph, start):",
        "  visited ← {start}",
        "  queue ← [start]",
        "  while queue не пуста:",
        "    u ← queue.shift()",
        "    for v in neighbors(u):",
        "      if v ∉ visited:",
        "        visited.add(v)",
        "        queue.push(v)",
        "        отметить ребро (u, v)",
        "        посетить v",
        "  return visited",
    ]),
});

export const run = ({ graph, startVertexId, helpers }) => {
    const visited = [startVertexId];
    const visitedSet = new Set(visited);
    const queue = [startVertexId];
    const steps = [helpers.vertex(startVertexId, { line: 2 })];

    while (queue.length > 0) {
        const currentVertexId = queue.shift();

        for (const nextVertexId of graph.adjacency.get(currentVertexId) ?? []) {
            if (visitedSet.has(nextVertexId)) {
                continue;
            }

            visitedSet.add(nextVertexId);
            visited.push(nextVertexId);
            queue.push(nextVertexId);

            steps.push(
                helpers.edge(currentVertexId, nextVertexId, { line: 10 }),
            );
            steps.push(helpers.vertex(nextVertexId, { line: 11 }));
        }
    }

    return {
        visited,
        steps,
        resultText: formatVisitedPath(graph, visited),
    };
};
