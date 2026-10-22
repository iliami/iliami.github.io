import {
    EDGE_ID_OFFSET,
    createEdge,
    createGraph,
    createVertex,
} from "../../core/graph.js";
import { placeMissingVertices } from "./layout.js";

const toId = (value) =>
    value === undefined || value === null ? "" : String(value);

const createEdgeId = (usedIds, index) => {
    let nextId = EDGE_ID_OFFSET + index + 1;

    while (usedIds.has(String(nextId))) {
        nextId += 1;
    }

    return String(nextId);
};

const readPosition = (raw) => ({
    x: Number(raw.x ?? raw.position?.x),
    y: Number(raw.y ?? raw.position?.y),
});

export const parseGraphFromJson = (text) => {
    let data;

    try {
        data = JSON.parse(String(text).replace(/^\uFEFF/, ""));
    } catch {
        return createGraph();
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return createGraph();
    }

    const directed = Boolean(data.directed);
    const usedVertexIds = new Set();
    const vertexEntries = [];

    for (const [index, raw] of (Array.isArray(data.vertices)
        ? data.vertices
        : []
    ).entries()) {
        if (!raw || typeof raw !== "object") {
            continue;
        }

        const id = toId(
            raw.id ?? raw.vertexId ?? raw.name ?? index + 1,
        ).trim();

        if (!id || usedVertexIds.has(id)) {
            continue;
        }

        usedVertexIds.add(id);
        vertexEntries.push({
            id,
            label: raw.label == null ? id : String(raw.label),
            ...readPosition(raw),
        });
    }

    const vertices = placeMissingVertices(vertexEntries).map((vertex) =>
        createVertex(vertex.id, vertex.x, vertex.y, vertex.label),
    );
    const usedEdgeIds = new Set(usedVertexIds);
    const edges = [];

    for (const [index, raw] of (Array.isArray(data.edges)
        ? data.edges
        : []
    ).entries()) {
        if (!raw || typeof raw !== "object") {
            continue;
        }

        const fromId = toId(
            raw.fromId ?? raw.from ?? raw.source ?? raw.u,
        ).trim();
        const toIdValue = toId(
            raw.toId ?? raw.to ?? raw.target ?? raw.v,
        ).trim();

        if (!usedVertexIds.has(fromId) || !usedVertexIds.has(toIdValue)) {
            continue;
        }

        const requestedId = toId(raw.id).trim();
        const edgeId =
            requestedId && !usedEdgeIds.has(requestedId)
                ? requestedId
                : createEdgeId(usedEdgeIds, index);

        usedEdgeIds.add(edgeId);
        edges.push(
            createEdge(
                edgeId,
                fromId,
                toIdValue,
                raw.weight ?? 1,
                raw.directed === undefined ? directed : Boolean(raw.directed),
            ),
        );
    }

    return createGraph(vertices, edges, { directed });
};
