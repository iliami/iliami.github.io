import {
    EDGE_ID_OFFSET,
    compareVertexIds,
    createEdge,
    createGraph,
    createVertex,
} from "../../core/graph.js";

const findVertexByCoordinates = (vertices, x, y) =>
    vertices.find((vertex) => vertex.x === x && vertex.y === y);

export const parseGraphFromSvg = (svgText) => {
    const parsedDocument = new DOMParser().parseFromString(
        svgText,
        "text/xml",
    );

    if (parsedDocument.querySelector("parsererror")) {
        return createGraph();
    }

    const root = parsedDocument.documentElement;

    if (!root) {
        return createGraph();
    }

    const vertexElements = [];
    const edgeElements = [];

    for (const element of Array.from(root.children)) {
        if (element.localName !== "g") {
            continue;
        }

        const id = Number(element.getAttribute("id"));

        if (!Number.isFinite(id)) {
            continue;
        }

        if (id < EDGE_ID_OFFSET) {
            vertexElements.push(element);
        } else if (id > EDGE_ID_OFFSET) {
            edgeElements.push(element);
        }
    }

    const vertices = vertexElements
        .map((element) => {
            const circle = element.children[0];

            if (!circle) {
                return null;
            }

            const label =
                element.getAttribute("data-label") ??
                element.getAttribute("id") ??
                "";

            return createVertex(
                element.getAttribute("id"),
                Number(circle.getAttribute("cx")),
                Number(circle.getAttribute("cy")),
                label,
            );
        })
        .filter(Boolean)
        .sort((first, second) => compareVertexIds(first.id, second.id));

    const edges = edgeElements.flatMap((element) => {
        const line = element.children[0];

        if (!line) {
            return [];
        }

        const firstVertex = findVertexByCoordinates(
            vertices,
            Number(line.getAttribute("x1")),
            Number(line.getAttribute("y1")),
        );
        const secondVertex = findVertexByCoordinates(
            vertices,
            Number(line.getAttribute("x2")),
            Number(line.getAttribute("y2")),
        );

        if (!firstVertex || !secondVertex) {
            return [];
        }

        const weightAttribute = element.getAttribute("data-weight");
        const weight = weightAttribute === null ? 1 : Number(weightAttribute);

        return [
            createEdge(
                element.getAttribute("id"),
                firstVertex.id,
                secondVertex.id,
                Number.isFinite(weight) ? weight : 1,
                element.getAttribute("data-directed") === "true",
            ),
        ];
    });

    return createGraph(vertices, edges);
};
