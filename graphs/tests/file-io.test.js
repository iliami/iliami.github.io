import test from "node:test";
import assert from "node:assert/strict";

import { createEdge, createGraph, createVertex } from "../scripts/core/graph.js";
import { serializeGraphToDot } from "../scripts/features/file-io/dot-export.js";
import { parseGraphFromDot } from "../scripts/features/file-io/dot-import.js";
import { serializeGraphToJson } from "../scripts/features/file-io/json-export.js";
import { parseGraphFromJson } from "../scripts/features/file-io/json-import.js";

const createSampleGraph = () =>
    createGraph(
        [
            createVertex("1", 100, 200, "A"),
            createVertex("2", 300, 200, "B"),
            createVertex("3", 200, 400, "C"),
        ],
        [
            createEdge("100001", "1", "2", 2, true),
            createEdge("100002", "1", "3", 1, false),
        ],
    );

test("JSON export round-trips vertices, edges and direction", () => {
    const graph = createSampleGraph();
    const parsed = parseGraphFromJson(serializeGraphToJson(graph));

    assert.deepEqual(parsed.vertices, graph.vertices);
    assert.deepEqual(parsed.edges, graph.edges);
    assert.equal(parsed.directed, false);
});

test("JSON import accepts aliases and lays out missing positions", () => {
    const parsed = parseGraphFromJson(
        JSON.stringify({
            directed: false,
            vertices: [
                { id: "1", x: 10, y: 20, label: "A" },
                { name: "2", label: "B" },
            ],
            edges: [
                { source: "1", target: "2", weight: "3", directed: true },
            ],
        }),
    );

    assert.equal(parsed.vertices.length, 2);
    assert.equal(parsed.vertices[1].id, "2");
    assert.ok(Number.isFinite(parsed.vertices[1].x));
    assert.ok(Number.isFinite(parsed.vertices[1].y));
    assert.deepEqual(parsed.edges[0], {
        id: "100001",
        fromId: "1",
        toId: "2",
        weight: 3,
        directed: true,
    });
});

test("JSON import rejects broken payloads", () => {
    assert.deepEqual(parseGraphFromJson("{"), createGraph());
    assert.deepEqual(parseGraphFromJson("[]"), createGraph());
});

test("DOT export writes graph type, labels, positions and directions", () => {
    const dot = serializeGraphToDot(createSampleGraph());

    assert.match(dot, /^digraph G \{/);
    assert.match(dot, /"1" \[label="A", pos="100,-200!"\];/);
    assert.match(dot, /"1" -> "2" \[id="100001", weight=2\];/);
    assert.match(dot, /"1" -> "3" \[id="100002", dir=none\];/);
});

test("DOT import reads labels, weights, positions and direction", () => {
    const graph = parseGraphFromDot(`
        digraph G {
            a [label="A", pos="10,20!"];
            b [label="B", pos="30,40!"];
            a -> b [weight=4];
        }
    `);

    assert.equal(graph.directed, true);
    assert.deepEqual(graph.vertices, [
        createVertex("1", 10, -20, "A"),
        createVertex("2", 30, -40, "B"),
    ]);
    assert.deepEqual(graph.edges, [
        createEdge("100001", "1", "2", 4, true),
    ]);
});

test("DOT import keeps mixed direction when dir=none is present", () => {
    const graph = parseGraphFromDot(`
        digraph G {
            a; b; c;
            a -> b;
            b -> c [dir=none];
        }
    `);

    assert.equal(graph.directed, false);
    assert.equal(graph.edges[0].directed, true);
    assert.equal(graph.edges[1].directed, false);
});

test("DOT import reverses edges marked with dir=back", () => {
    const graph = parseGraphFromDot(`
        digraph G {
            a -> b [dir=back];
        }
    `);

    assert.equal(graph.edges[0].fromId, "2");
    assert.equal(graph.edges[0].toId, "1");
    assert.equal(graph.edges[0].directed, true);
});

test("DOT export round-trips labels, weights, positions and directions", () => {
    const graph = createSampleGraph();
    const parsed = parseGraphFromDot(serializeGraphToDot(graph));

    assert.deepEqual(parsed.vertices, graph.vertices);
    assert.deepEqual(parsed.edges, graph.edges);
    assert.equal(parsed.directed, false);
});

test("DOT import unescapes quoted labels", () => {
    const graph = parseGraphFromDot(
        'digraph G { a [label="A \\"quoted\\" \\\\ path"]; }',
    );

    assert.equal(graph.vertices[0].label, 'A "quoted" \\ path');
});

test("DOT import handles node and edge defaults", () => {
    const graph = parseGraphFromDot(`
        graph G {
            node [label="default"];
            edge [weight=2];
            a -- b [label="ignored"];
        }
    `);

    assert.equal(graph.vertices[0].label, "default");
    assert.equal(graph.edges[0].weight, 2);
    assert.equal(graph.edges[0].directed, false);
});

test("DOT import rejects unsupported content", () => {
    assert.deepEqual(parseGraphFromDot("not a graph"), createGraph());
});
