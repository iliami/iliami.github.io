export const meta = Object.freeze({
    id: "hp",
    name: "Гамильтонов путь",
    shortName: "HP",
    description: "Проходит по всем вершинам",
    meta: "DFS · O(V + E)",
    requiresStartVertex: true,
    pseudocode: Object.freeze([
        "function hamiltonianPath(graph, start):",
        "  order = []; chosen = {}",
        "  function dfs(v):",
        "    order.push(v); chosen.add(v)",
        "    if len(order) == V: return order",
        "    for u in neighbors(v):",
        "      if u in chosen: continue",
        "      if dfs(u): return order",
        "    order.pop(); chosen.delete(v)",
        "    return false",
        "  for s in starts:",
        "    if dfs(s): return order",
        "  return null",
    ]),
});

export function run({ graph, startVertexId, helpers }) {
    const total = graph.vertexIds.length;
    const order = [];
    const chosen = new Set();
    const steps = [];
    let found = null;

    const label = (id) => graph.vertexById.get(id)?.label ?? id;
    const pushVertex = (vertexId, tone, line, message) =>
        steps.push(helpers.vertex(vertexId, { tone, line, message }));
    const pushEdge = (a, b, tone, line, message) =>
        steps.push(helpers.edge(a, b, { tone, line, message }));
    const log = (line, message) => steps.push(helpers.log(message, { line }));

    const leave = (vertexId) => {
        order.pop();
        chosen.delete(vertexId);
        pushVertex(
            vertexId,
            "rejected",
            9,
            `Тупик: убираем ${label(vertexId)} из пути`,
        );
        if (order.length > 0) {
            const parent = order[order.length - 1];
            pushVertex(parent, "active", 9, `Возврат в ${label(parent)}`);
        }
    };

    const dfs = (vertexId) => {
        order.push(vertexId);
        chosen.add(vertexId);
        pushVertex(
            vertexId,
            "visited",
            4,
            `Глубина ${order.length}: пробуем ${label(vertexId)}`,
        );

        if (order.length === total) {
            found = order.slice();
            return true;
        }

        for (const neighborId of graph.adjacency.get(vertexId) ?? []) {
            if (chosen.has(neighborId)) {
                log(
                    7,
                    `Ребро ${label(vertexId)}—${label(neighborId)}: ${label(neighborId)} уже в пути`,
                );
                continue;
            }

            pushEdge(
                vertexId,
                neighborId,
                "path",
                8,
                `Идём по ребру ${label(vertexId)}—${label(neighborId)}`,
            );

            if (dfs(neighborId)) {
                return true;
            }

            pushEdge(
                vertexId,
                neighborId,
                "rejected",
                9,
                `Откат ребра ${label(vertexId)}—${label(neighborId)}`,
            );
        }

        leave(vertexId);
        return false;
    };

    const starts = startVertexId ? [startVertexId] : graph.vertexIds;

    for (const startId of starts) {
        log(12, `Старт из ${label(startId)}`);
        if (dfs(startId)) break;
    }

    if (!found) {
        return {
            steps,
            visited: [],
            resultText: "Гамильтонова пути нет",
        };
    }

    for (const vertexId of found) {
        pushVertex(vertexId, "path", 5);
    }
    for (let i = 1; i < found.length; i += 1) {
        pushEdge(found[i - 1], found[i], "path", 5);
    }
    log(5, `Гамильтонов путь найден: ${found.map(label).join(" → ")}`);

    return {
        steps,
        visited: found,
        resultText: found.map(label).join(" → "),
    };
}
