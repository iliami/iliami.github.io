import test from "node:test";
import assert from "node:assert/strict";

import { createEdge, createGraph, createVertex } from "../scripts/core/graph.js";

import {
    findEdgeBetween,
    getAdjacencyList,
    getAdjacencyMatrix,
    getGraphIndex,
    getIncidenceMatrix,
    getIncidentEdges,
    getNeighbors,
} from "../scripts/core/graph-index.js";

const createSampleGraph = () => {
    const vertices = ["1", "2", "3", "4"].map((id, index) =>
        createVertex(id, index * 100, 0),
    );

    return createGraph(vertices, [
        createEdge("100001", "1", "2"),
        createEdge("100002", "1", "3"),
        createEdge("100003", "2", "4"),
        createEdge("100004", "3", "4"),
    ]);
};

test("undirected index builds sorted adjacency and incident edges", () => {
    const graph = createSampleGraph();
    const index = getGraphIndex(graph);

    assert.deepEqual(index.vertexIds, ["1", "2", "3", "4"]);
    assert.deepEqual(getNeighbors(index, "1"), ["2", "3"]);
    assert.deepEqual(getNeighbors(index, "4"), ["2", "3"]);
    assert.equal(index.incident.get("1").length, 2);
    assert.equal(index.incident.get("2").length, 2);
    assert.equal(index.edgeById.size, 4);
});

test("graph index is cached per graph object", () => {
    const graph = createSampleGraph();

    assert.equal(getGraphIndex(graph), getGraphIndex(graph));
    assert.notEqual(
        getGraphIndex(graph),
        getGraphIndex(createGraph(graph.vertices, graph.edges)),
    );
});

test("edge lookup works in both directions for undirected graph", () => {
    const graph = createSampleGraph();
    const index = getGraphIndex(graph);

    assert.equal(findEdgeBetween(index, "1", "2").id, "100001");
    assert.equal(findEdgeBetween(index, "2", "1").id, "100001");
    assert.equal(findEdgeBetween(index, "1", "4"), null);
});

test("adjacency and incidence matrices match the graph", () => {
    const graph = createSampleGraph();

    assert.deepEqual(getAdjacencyMatrix(graph), [
        [0, 1, 1, 0],
        [1, 0, 0, 1],
        [1, 0, 0, 1],
        [0, 1, 1, 0],
    ]);

    assert.deepEqual(getIncidenceMatrix(graph), [
        [1, 1, 0, 0],
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [0, 0, 1, 1],
    ]);

    assert.deepEqual(getAdjacencyList(graph), [
        ["2", "3"],
        ["1", "4"],
        ["1", "4"],
        ["2", "3"],
    ]);
});

test("directed index uses outgoing neighbors and asymmetric matrix", () => {
    const graph = createGraph(
        [
            createVertex("1", 0, 0),
            createVertex("2", 100, 0),
            createVertex("3", 200, 0),
        ],
        [createEdge("100001", "1", "2"), createEdge("100002", "3", "2")],
        { directed: true },
    );
    const index = getGraphIndex(graph);

    assert.deepEqual(getNeighbors(index, "1"), ["2"]);
    assert.deepEqual(getNeighbors(index, "2"), []);
    assert.deepEqual(getNeighbors(index, "3"), ["2"]);
    assert.equal(index.incoming.get("2").length, 2);
    assert.equal(getIncidentEdges(index, "1").length, 1);
    assert.equal(getIncidentEdges(index, "2").length, 2);
    assert.equal(getIncidentEdges(index, "3").length, 1);
    assert.equal(findEdgeBetween(index, "2", "1"), null);

    assert.deepEqual(getAdjacencyMatrix(index), [
        [0, 1, 0],
        [0, 0, 0],
        [0, 1, 0],
    ]);
});

test("per-edge direction affects adjacency and matrices", () => {
    const graph = createGraph(
        [
            createVertex("1", 0, 0),
            createVertex("2", 100, 0),
            createVertex("3", 200, 0),
        ],
        [
            createEdge("100001", "1", "2", 1, true),
            createEdge("100002", "2", "3"),
        ],
    );
    const index = getGraphIndex(graph);

    assert.deepEqual(getNeighbors(index, "1"), ["2"]);
    assert.deepEqual(getNeighbors(index, "2"), ["3"]);
    assert.deepEqual(getNeighbors(index, "3"), ["2"]);
    assert.equal(getIncidentEdges(index, "2").length, 2);
    assert.equal(findEdgeBetween(index, "2", "1"), null);
    assert.equal(findEdgeBetween(index, "2", "3").id, "100002");
    assert.equal(findEdgeBetween(index, "3", "2").id, "100002");
    assert.deepEqual(getAdjacencyMatrix(index), [
        [0, 1, 0],
        [0, 0, 1],
        [0, 1, 0],
    ]);
});

test("edge weight is preserved in the index", () => {
    const graph = createGraph(
        [createVertex("1", 0, 0), createVertex("2", 100, 0)],
        [createEdge("100001", "1", "2", 7)],
    );

    assert.equal(getGraphIndex(graph).edgeById.get("100001").weight, 7);
});
