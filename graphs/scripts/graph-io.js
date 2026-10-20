import {
    EDGE_ID_OFFSET,
    compareVertexIds,
    createEdge,
    createGraph,
    createVertex,
} from "./core.js";

import {
    downloadGraphButton,
    state,
    svg,
    uploadGraphInput,
} from "./ui.js";

import { renderGraph } from "./graph-editor.js";

const findVertexByCoordinates = (vertices, x, y) =>
    vertices.find((vertex) => vertex.x === x && vertex.y === y);

const parseGraphFromSvg = (svgText) => {
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

            return createVertex(
                element.getAttribute("id"),
                Number(circle.getAttribute("cx")),
                Number(circle.getAttribute("cy")),
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

        return [
            createEdge(
                element.getAttribute("id"),
                firstVertex.id,
                secondVertex.id,
            ),
        ];
    });

    return createGraph(vertices, edges);
};

function handleClickOnDownloadGraphButton(event) {
    if (state.graph.vertices.length === 0) {
        return;
    }

    const svgString = new XMLSerializer().serializeToString(svg);
    const data = new Blob([svgString], { type: "text/xml" });

    event.currentTarget.href = URL.createObjectURL(data);
}

function handleChangeOnUploadGraphInput(event) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
        return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", () => {
        renderGraph(parseGraphFromSvg(String(reader.result)));
    });

    reader.readAsText(file);
    event.currentTarget.value = "";
}

downloadGraphButton.download = "graph.graph";
downloadGraphButton.addEventListener("click", handleClickOnDownloadGraphButton);
uploadGraphInput.addEventListener("change", handleChangeOnUploadGraphInput);
