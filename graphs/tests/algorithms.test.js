import test from "node:test";
import assert from "node:assert/strict";

import { createEdge, createGraph, createVertex } from "../scripts/core/graph.js";
import { buildGraphIndex } from "../scripts/core/graph-index.js";

import {
    createAlgorithmHelpers,
    STEP_TYPE,
    validateAlgorithmResult,
} from "../scripts/algorithms/contract.js";

import * as bfsAlgorithm from "../scripts/algorithms/builtins/bfs.js";
import * as dfsAlgorithm from "../scripts/algorithms/builtins/dfs.js";

const createDiamondGraph = () => {
    const vertices = ["1", "2", "3", "4"].map((id, index) =>
        createVertex(id, index * 100, 0, `V${id}`),
    );

    return createGraph(vertices, [
        createEdge("100001", "1", "2"),
        createEdge("100002", "1", "3"),
        createEdge("100003", "2", "4"),
        createEdge("100004", "3", "4"),
    ]);
};

const runAlgorithm = (algorithm, graph, startVertexId = "1") => {
    const index = buildGraphIndex(graph);
    const rawResult = algorithm.run({
        graph: index,
        startVertexId,
        params: {},
        helpers: createAlgorithmHelpers(index),
    });

    return validateAlgorithmResult(rawResult, {
        index,
        pseudocode: algorithm.meta.pseudocode,
    });
};

test("BFS visits vertices by layers from the start vertex", () => {
    const result = runAlgorithm(bfsAlgorithm, createDiamondGraph());

    assert.deepEqual(result.visited, ["1", "2", "3", "4"]);
    assert.equal(result.resultText, "V1 → V2 → V3 → V4");
    assert.deepEqual(
        result.steps.filter((step) => step.type === STEP_TYPE.vertex).map(
            (step) => [step.vertexId, step.line],
        ),
        [
            ["1", 2],
            ["2", 11],
            ["3", 11],
            ["4", 11],
        ],
    );
    assert.deepEqual(
        result.steps
            .filter((step) => step.type === STEP_TYPE.edge)
            .map((step) => step.line),
        [10, 10, 10],
    );
});

test("DFS goes deep before backtracking", () => {
    const result = runAlgorithm(dfsAlgorithm, createDiamondGraph());

    assert.deepEqual(result.visited, ["1", "3", "4", "2"]);
    assert.equal(result.resultText, "V1 → V3 → V4 → V2");
    assert.deepEqual(
        result.steps
            .filter((step) => step.type === STEP_TYPE.edge)
            .map((step) => step.line),
        [7, 7, 7],
    );
    assert.deepEqual(
        result.steps.filter((step) => step.type === STEP_TYPE.vertex).map(
            (step) => step.vertexId,
        ),
        ["1", "3", "4", "2"],
    );
});

test("built-in metadata describes start requirements and pseudocode", () => {
    for (const algorithm of [bfsAlgorithm, dfsAlgorithm]) {
        assert.equal(algorithm.meta.requiresStartVertex, true);
        assert.ok(algorithm.meta.pseudocode.length > 0);
        assert.equal(typeof algorithm.meta.id, "string");
        assert.equal(typeof algorithm.meta.name, "string");
    }
});

test("BFS and DFS results pass contract validation", () => {
    const graph = createDiamondGraph();
    const index = buildGraphIndex(graph);

    for (const algorithm of [bfsAlgorithm, dfsAlgorithm]) {
        const rawResult = algorithm.run({
            graph: index,
            startVertexId: "1",
            params: {},
            helpers: createAlgorithmHelpers(index),
        });

        assert.doesNotThrow(() =>
            validateAlgorithmResult(rawResult, {
                index,
                pseudocode: algorithm.meta.pseudocode,
            }),
        );
    }
});
