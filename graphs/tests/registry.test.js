import test from "node:test";
import assert from "node:assert/strict";

import { AlgorithmContractError } from "../scripts/algorithms/contract.js";
import {
    algorithmRegistry,
    createAlgorithmRegistry,
    normalizeAlgorithmDescriptor,
} from "../scripts/algorithms/registry.js";

const createDescriptor = (overrides = {}) => ({
    meta: {
        id: "leaves",
        name: "Листья",
        shortName: "LEAVES",
        meta: "Степень · O(V + E)",
        requiresStartVertex: false,
        pseudocode: ["line one"],
        ...overrides.meta,
    },
    run: overrides.run ?? (() => ({ steps: [] })),
});

test("registry registers, lists and reads descriptors in order", () => {
    const registry = createAlgorithmRegistry();
    const first = registry.register(createDescriptor());
    const second = registry.register(
        createDescriptor({ meta: { id: "isolated", name: "Изолированные" } }),
    );

    assert.equal(first.id, "leaves");
    assert.equal(first.contractVersion, 1);
    assert.equal(first.source, "builtin");
    assert.equal(first.meta.requiresStartVertex, false);

    assert.deepEqual(
        registry.list().map((descriptor) => descriptor.id),
        ["leaves", "isolated"],
    );
    assert.equal(registry.get("isolated"), second);
    assert.equal(registry.has("leaves"), true);
    assert.equal(registry.get("missing"), null);
});

test("registry rejects duplicate ids unless replace is requested", () => {
    const registry = createAlgorithmRegistry();

    registry.register(createDescriptor());

    assert.throws(
        () => registry.register(createDescriptor()),
        (error) =>
            error instanceof AlgorithmContractError &&
            error.path === "meta.id",
    );

    const replacement = registry.register(createDescriptor(), {
        replace: true,
        source: "user",
    });

    assert.equal(replacement.source, "user");
    assert.equal(registry.list().length, 1);
});

test("registry rejects invalid descriptors with a path", () => {
    const registry = createAlgorithmRegistry();

    assert.throws(
        () => registry.register({ meta: { id: "x", name: "X" } }),
        (error) =>
            error instanceof AlgorithmContractError && error.path === "run",
    );

    assert.throws(
        () => registry.register(createDescriptor({ meta: { id: "" } })),
        (error) =>
            error instanceof AlgorithmContractError &&
            error.path === "meta.id",
    );

    assert.throws(
        () =>
            registry.register(
                createDescriptor({ meta: { pseudocode: "not-an-array" } }),
            ),
        (error) =>
            error instanceof AlgorithmContractError &&
            error.path === "meta.pseudocode",
    );
});

test("registry remove deletes descriptor and notifies subscribers", () => {
    const registry = createAlgorithmRegistry();
    const events = [];
    const unsubscribe = registry.subscribe((list) => {
        events.push(list.map((descriptor) => descriptor.id));
    });

    registry.register(createDescriptor());
    registry.register(
        createDescriptor({ meta: { id: "isolated", name: "Изолированные" } }),
    );

    assert.equal(registry.remove("leaves"), true);
    assert.equal(registry.remove("leaves"), false);
    assert.deepEqual(events.at(-1), ["isolated"]);

    unsubscribe();
    registry.remove("isolated");
    assert.equal(events.length, 3);
});

test("normalizeAlgorithmDescriptor defaults optional fields", () => {
    const descriptor = normalizeAlgorithmDescriptor(
        {
            meta: { id: "  leaves  ", name: "  Листья  " },
            run: () => ({ steps: [] }),
        },
        { source: "user" },
    );

    assert.equal(descriptor.id, "leaves");
    assert.equal(descriptor.meta.name, "Листья");
    assert.equal(descriptor.meta.requiresStartVertex, true);
    assert.deepEqual(descriptor.meta.pseudocode, []);
    assert.equal(descriptor.meta.shortName, undefined);
    assert.equal(descriptor.source, "user");
});

test("builtin registry contains all bundled algorithms", () => {
    assert.deepEqual(
        algorithmRegistry.list().map((descriptor) => descriptor.id),
        ["bfs", "dfs", "hp"],
    );

    for (const id of ["bfs", "dfs", "hp"]) {
        assert.equal(algorithmRegistry.get(id).source, "builtin");
    }
});
