import test from "node:test";
import assert from "node:assert/strict";

import {
    addEdge,
    addVertex,
    createEdge,
    createGraph,
    createVertex,
    directEdgeTo,
    getEdge,
    getNextEdgeId,
    getNextVertexId,
    removeVertex,
    renameVertex,
    reverseEdge,
    setEdgeDirected,
    updateEdgeWeight,
} from "../scripts/core/graph.js";

const createSampleGraph = () => {
    const first = createVertex("1", 0, 0);
    const second = createVertex("2", 100, 0);

    return createGraph(
        [first, second],
        [createEdge("100001", "1", "2")],
    );
};

test("createEdge stores default weight and direction", () => {
    assert.deepEqual(createEdge("e", "1", "2"), {
        id: "e",
        fromId: "1",
        toId: "2",
        weight: 1,
        directed: false,
    });

    assert.equal(createEdge("e", "1", "2", 5).weight, 5);
    assert.equal(createEdge("e", "1", "2", 5, true).directed, true);
    assert.equal(createEdge("e", "1", "2", "bad").weight, 1);
});

test("createGraph stores directed flag", () => {
    assert.equal(createGraph().directed, false);
    assert.equal(createGraph([], [], { directed: true }).directed, true);
});

test("graph operations stay immutable", () => {
    const graph = createSampleGraph();
    const next = addVertex(graph, createVertex("3", 200, 0));

    assert.equal(graph.vertices.length, 2);
    assert.equal(next.vertices.length, 3);
    assert.notEqual(next, graph);

    const withEdge = addEdge(next, createEdge("100002", "2", "3"));

    assert.equal(next.edges.length, 1);
    assert.equal(withEdge.edges.length, 2);
});

test("removeVertex removes incident edges and keeps graph options", () => {
    const graph = createGraph(
        [createVertex("1", 0, 0), createVertex("2", 100, 0)],
        [createEdge("100001", "1", "2")],
        { directed: true },
    );
    const next = removeVertex(graph, "1");

    assert.deepEqual(
        next.vertices.map((vertex) => vertex.id),
        ["2"],
    );
    assert.equal(next.edges.length, 0);
    assert.equal(next.directed, true);
});

test("edge weight and direction are updated immutably", () => {
    const graph = createSampleGraph();
    const weighted = updateEdgeWeight(graph, "100001", 4.5);

    assert.equal(getEdge(weighted, "100001").weight, 4.5);
    assert.equal(getEdge(graph, "100001").weight, 1);

    const reversed = directEdgeTo(weighted, "100001", "1");
    const reversedEdge = getEdge(reversed, "100001");

    assert.equal(reversedEdge.fromId, "2");
    assert.equal(reversedEdge.toId, "1");
    assert.equal(reversedEdge.directed, true);

    const restored = directEdgeTo(reversed, "100001", "2");

    assert.equal(getEdge(restored, "100001").fromId, "1");
    assert.equal(getEdge(restored, "100001").toId, "2");

    const flipped = reverseEdge(restored, "100001");

    assert.equal(getEdge(flipped, "100001").fromId, "2");
    assert.equal(getEdge(flipped, "100001").directed, true);

    const undirected = setEdgeDirected(flipped, "100001", false);

    assert.equal(getEdge(undirected, "100001").directed, false);
});

test("renameVertex trims label and keeps id fallback", () => {
    const graph = createSampleGraph();
    const renamed = renameVertex(graph, "1", "  Start  ");

    assert.equal(renamed.vertices[0].label, "Start");

    const empty = renameVertex(graph, "1", "   ");

    assert.equal(empty.vertices[0].label, "1");
});

test("next ids skip used values", () => {
    const graph = createGraph(
        [createVertex("1", 0, 0), createVertex("3", 0, 0)],
        [createEdge("100002", "1", "3")],
    );

    assert.equal(getNextVertexId(graph), "4");
    assert.equal(getNextEdgeId(graph), "100003");
});
