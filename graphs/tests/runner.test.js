import test from "node:test";
import assert from "node:assert/strict";

import { createGraph, createVertex } from "../scripts/core/graph.js";
import { createAlgorithmRunner } from "../scripts/algorithms/runtime/runner.js";

const createSnapshot = () => ({
    graph: createGraph([
        createVertex("1", 0, 0),
        createVertex("2", 40, 0),
    ]),
    startVertexId: "1",
    params: {},
});

const createFakeWorker = (handler) => {
    const listeners = new Map();

    return {
        addEventListener: (type, listener) => listeners.set(type, listener),
        removeEventListener: (type) => listeners.delete(type),
        postMessage: (message) => handler(message, listeners),
        terminate: () => {},
    };
};

const respondWithResult = (result) => (message, listeners) => {
    listeners.get("message")?.({
        data: { type: "result", runId: message.runId, result },
    });
};

const noopWorker = () => createFakeWorker(() => {});

const builtinDescriptor = (run) => ({
    meta: { id: "test", name: "Test", pseudocode: [] },
    run,
});

test("runner executes builtin algorithms without a worker", async () => {
    let workerCreated = 0;
    const runner = createAlgorithmRunner({
        createWorker: () => {
            workerCreated += 1;
            return createFakeWorker(() => {});
        },
    });

    const result = await runner.run(
        builtinDescriptor(({ graph }) => ({
            steps: [],
            visited: graph.vertexIds.slice(),
        })),
        createSnapshot(),
    );

    assert.deepEqual(result.visited, ["1", "2"]);
    assert.equal(workerCreated, 0);
});

test("runner converts builtin failures into run errors", async () => {
    const runner = createAlgorithmRunner();

    await assert.rejects(
        runner.run(
            builtinDescriptor(() => {
                throw new Error("boom");
            }),
            createSnapshot(),
        ),
        (error) => error.code === "runtime" && error.message === "boom",
    );
});

test("runner validates builtin results against the graph", async () => {
    const runner = createAlgorithmRunner();

    await assert.rejects(
        runner.run(
            builtinDescriptor(() => ({
                steps: [],
                visited: ["missing"],
            })),
            createSnapshot(),
        ),
        (error) => error.path === "visited[0]",
    );
});

test("runner executes user algorithms in a worker and validates the result", async () => {
    const runner = createAlgorithmRunner({
        createWorker: () =>
            createFakeWorker(
                respondWithResult({
                    steps: [{ type: "vertex", vertexId: "1" }],
                    visited: ["1"],
                    resultText: "ok",
                }),
            ),
    });

    const result = await runner.run(
        {
            meta: { id: "user:test", name: "User", pseudocode: [] },
            code: "export function run() {}",
        },
        createSnapshot(),
    );

    assert.equal(result.resultText, "ok");
    assert.equal(result.steps.length, 1);
});

test("runner re-checks worker results in the main thread", async () => {
    const runner = createAlgorithmRunner({
        createWorker: () =>
            createFakeWorker(
                respondWithResult({ steps: [], visited: ["missing"] }),
            ),
    });

    await assert.rejects(
        runner.run(
            {
                meta: { id: "user:test", name: "User", pseudocode: [] },
                code: "export function run() {}",
            },
            createSnapshot(),
        ),
        (error) => error.path === "visited[0]",
    );
});

test("runner forwards worker errors", async () => {
    const runner = createAlgorithmRunner({
        createWorker: () =>
            createFakeWorker((message, listeners) => {
                listeners.get("message")?.({
                    data: {
                        type: "error",
                        runId: message.runId,
                        error: { code: "runtime", message: "boom" },
                    },
                });
            }),
    });

    await assert.rejects(
        runner.run(
            {
                meta: { id: "user:test", name: "User", pseudocode: [] },
                code: "export function run() {}",
            },
            createSnapshot(),
        ),
        (error) => error.code === "runtime" && error.message === "boom",
    );
});

test("runner stops user algorithms on timeout", async () => {
    const runner = createAlgorithmRunner({
        createWorker: noopWorker,
        timeoutMs: 5,
    });

    await assert.rejects(
        runner.run(
            {
                meta: { id: "user:loop", name: "Loop", pseudocode: [] },
                code: "while (true) {}",
            },
            createSnapshot(),
        ),
        (error) => error.code === "timeout",
    );
});

test("runner aborts user algorithms through an AbortSignal", async () => {
    const runner = createAlgorithmRunner({
        createWorker: noopWorker,
        timeoutMs: 1000,
    });
    const controller = new AbortController();

    const promise = runner.run(
        {
            meta: { id: "user:slow", name: "Slow", pseudocode: [] },
            code: "export function run() {}",
        },
        createSnapshot(),
        { signal: controller.signal },
    );

    controller.abort();

    await assert.rejects(promise, (error) => error.code === "aborted");
});

test("runner inspects user source in a worker", async () => {
    const runner = createAlgorithmRunner({
        createWorker: () =>
            createFakeWorker((message, listeners) => {
                listeners.get("message")?.({
                    data: { type: "inspect-result", runId: message.runId },
                });
            }),
    });

    const inspected = await runner.inspect({ code: "export function run() {}" });

    assert.equal(inspected.type, "inspect-result");
    assert.deepEqual(await runner.inspect({}), { ok: true });
});
