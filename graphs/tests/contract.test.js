import test from "node:test";
import assert from "node:assert/strict";

import { createEdge, createGraph, createVertex } from "../scripts/core/graph.js";
import { buildGraphIndex } from "../scripts/core/graph-index.js";

import {
    AlgorithmContractError,
    createAlgorithmHelpers,
    createEdgeStep,
    createLogStep,
    createVertexStep,
    MAX_LOG_MESSAGE_LENGTH,
    MAX_STEPS,
    STEP_TONE,
    toAlgorithmRunError,
    validateAlgorithmResult,
} from "../scripts/algorithms/contract.js";

const createIndex = () => {
    const graph = createGraph(
        [createVertex("1", 0, 0), createVertex("2", 100, 0)],
        [createEdge("100001", "1", "2")],
    );

    return buildGraphIndex(graph);
};

const pseudocode = ["line one", "line two"];

test("validator normalizes a valid result", () => {
    const index = createIndex();
    const result = validateAlgorithmResult(
        {
            steps: [
                createVertexStep("1", { line: 1 }),
                createEdgeStep("100001", {
                    line: 2,
                    tone: STEP_TONE.visited,
                }),
                createLogStep("check", { line: 1 }),
            ],
            visited: ["1", "2"],
            resultText: "1 → 2",
            stats: { rounds: 2, note: "ok", ignored: null },
        },
        { index, pseudocode },
    );

    assert.deepEqual(result.visited, ["1", "2"]);
    assert.equal(result.resultText, "1 → 2");
    assert.deepEqual(result.stats, { rounds: 2, note: "ok" });
    assert.equal(result.steps.length, 3);
});

test("validator rejects unknown vertex and bad line", () => {
    const index = createIndex();

    assert.throws(
        () =>
            validateAlgorithmResult(
                { steps: [createVertexStep("99")] },
                { index, pseudocode },
            ),
        (error) =>
            error instanceof AlgorithmContractError &&
            error.path === "steps[0].vertexId",
    );

    assert.throws(
        () =>
            validateAlgorithmResult(
                { steps: [createVertexStep("1", { line: 3 })] },
                { index, pseudocode },
            ),
        (error) =>
            error instanceof AlgorithmContractError &&
            error.path === "steps[0].line",
    );
});

test("validator rejects unknown tone, type and empty log message", () => {
    const index = createIndex();

    assert.throws(
        () =>
            validateAlgorithmResult(
                { steps: [createVertexStep("1", { tone: "glow" })] },
                { index, pseudocode },
            ),
        AlgorithmContractError,
    );

    assert.throws(
        () =>
            validateAlgorithmResult(
                { steps: [{ type: "edge-case", vertexId: "1" }] },
                { index, pseudocode },
            ),
        AlgorithmContractError,
    );

    assert.throws(
        () =>
            validateAlgorithmResult(
                { steps: [createLogStep("   ")] },
                { index, pseudocode },
            ),
        AlgorithmContractError,
    );
});

test("validator enforces result limits", () => {
    const index = createIndex();

    assert.throws(
        () =>
            validateAlgorithmResult(
                {
                    steps: Array.from({ length: MAX_STEPS + 1 }, () =>
                        createVertexStep("1"),
                    ),
                },
                { index, pseudocode },
            ),
        /Слишком много шагов/,
    );

    assert.throws(
        () =>
            validateAlgorithmResult(
                { steps: [createLogStep("x".repeat(MAX_LOG_MESSAGE_LENGTH + 1))] },
                { index, pseudocode },
            ),
        /длиннее/,
    );
});

test("helpers resolve edges and degree", () => {
    const index = createIndex();
    const helpers = createAlgorithmHelpers(index);

    assert.deepEqual(helpers.edge("1", "2"), {
        type: "edge",
        edgeId: "100001",
    });
    assert.equal(helpers.degree("1"), 1);
    assert.throws(
        () => helpers.edge("1", "1"),
        (error) =>
            error instanceof AlgorithmContractError &&
            error.code === "contract",
    );
});

test("toAlgorithmRunError keeps code, message and path", () => {
    const error = new AlgorithmContractError("bad", { path: "steps[0]" });
    const converted = toAlgorithmRunError(error);

    assert.equal(converted.code, "contract");
    assert.equal(converted.message, "bad");
    assert.equal(converted.path, "steps[0]");
    assert.equal(toAlgorithmRunError(new Error("boom")).code, "runtime");
});
