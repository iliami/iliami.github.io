import {
    EDGE_ID_OFFSET,
    compareVertexIds,
    createEdge,
    createGraph,
    createVertex,
} from "./core.js";

import {
    downloadGraphButton,
    exportDropdown,
    exportMenu,
    exportToggle,
    state,
    svg,
    updateAppStatus,
    uploadGraphInput,
} from "./ui.js";

import { fitView, renderGraph } from "./graph-editor.js";

let exportUrl = null;

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

const pluralize = (count, one, few, many) => {
    const mod100 = count % 100;
    const mod10 = count % 10;

    if (mod100 >= 11 && mod100 <= 14) {
        return many;
    }

    if (mod10 === 1) {
        return one;
    }

    if (mod10 >= 2 && mod10 <= 4) {
        return few;
    }

    return many;
};

const buildExportSvg = () => {
    const clone = svg.cloneNode(true);

    clone
        .querySelectorAll(".edge_preview, .edge_hit")
        .forEach((element) => element.remove());

    const originalCircles = svg.querySelectorAll(".node_circle");
    const clonedCircles = clone.querySelectorAll(".node_circle");

    originalCircles.forEach((circle, index) => {
        const style = getComputedStyle(circle);
        const clonedCircle = clonedCircles[index];

        clonedCircle?.setAttribute("fill", style.fill);
        clonedCircle?.setAttribute("stroke", style.stroke);
        clonedCircle?.setAttribute("stroke-width", style.strokeWidth);
    });

    const originalLabels = svg.querySelectorAll(".node_label");
    const clonedLabels = clone.querySelectorAll(".node_label");

    originalLabels.forEach((label, index) => {
        const style = getComputedStyle(label);
        const clonedLabel = clonedLabels[index];

        clonedLabel?.setAttribute("fill", style.fill);
        clonedLabel?.setAttribute("font-family", style.fontFamily);
        clonedLabel?.setAttribute("font-size", style.fontSize);
        clonedLabel?.setAttribute("font-weight", style.fontWeight);
    });

    const originalEdgeLines = svg.querySelectorAll(".edge_line");
    const clonedEdgeLines = clone.querySelectorAll(".edge_line");

    originalEdgeLines.forEach((line, index) => {
        const style = getComputedStyle(line);
        const clonedLine = clonedEdgeLines[index];

        clonedLine?.setAttribute("stroke", style.stroke);
        clonedLine?.setAttribute("stroke-width", style.strokeWidth);
        clonedLine?.setAttribute("stroke-linecap", "round");
    });

    if (state.graph.vertices.length > 0) {
        const xs = state.graph.vertices.map((vertex) => vertex.x);
        const ys = state.graph.vertices.map((vertex) => vertex.y);
        const padding = 40;
        const minX = Math.min(...xs) - padding;
        const minY = Math.min(...ys) - padding;
        const width = Math.max(Math.max(...xs) - minX + padding, 1);
        const height = Math.max(Math.max(...ys) - minY + padding, 1);

        clone.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
        clone.setAttribute("width", String(Math.ceil(width)));
        clone.setAttribute("height", String(Math.ceil(height)));
    }

    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    return new XMLSerializer().serializeToString(clone);
};

const setExportMenuOpen = (isOpen) => {
    exportDropdown.classList.toggle("is_open", isOpen);
    exportToggle.setAttribute("aria-expanded", String(isOpen));
};

const closeExportMenu = () => {
    setExportMenuOpen(false);
};

function handleClickOnDownloadGraphButton(event) {
    if (state.graph.vertices.length === 0) {
        event.preventDefault();
        updateAppStatus("Нечего экспортировать: граф пуст");
        return;
    }

    const data = new Blob([buildExportSvg()], { type: "image/svg+xml" });

    if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
    }

    exportUrl = URL.createObjectURL(data);
    event.currentTarget.href = exportUrl;
    closeExportMenu();

    setTimeout(() => {
        if (exportUrl) {
            URL.revokeObjectURL(exportUrl);
            exportUrl = null;
        }

        downloadGraphButton.removeAttribute("href");
    }, 1500);
}

function handleChangeOnUploadGraphInput(event) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
        return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", () => {
        const graph = parseGraphFromSvg(String(reader.result));
        renderGraph(graph);
        fitView();

        if (graph.vertices.length > 0) {
            const vertexWord = pluralize(
                graph.vertices.length,
                "вершина",
                "вершины",
                "вершин",
            );
            const edgeWord = pluralize(
                graph.edges.length,
                "ребро",
                "ребра",
                "рёбер",
            );

            updateAppStatus(
                `Импортировано: ${graph.vertices.length} ${vertexWord}, ${graph.edges.length} ${edgeWord}`,
            );
        } else {
            updateAppStatus("Файл не содержит графа");
        }
    });

    reader.readAsText(file);
    event.currentTarget.value = "";
}

exportToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setExportMenuOpen(!exportDropdown.classList.contains("is_open"));
});

document.addEventListener("click", (event) => {
    if (!exportDropdown.contains(event.target)) {
        closeExportMenu();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeExportMenu();
    }
});

exportMenu.addEventListener("click", () => {
    closeExportMenu();
});

downloadGraphButton.addEventListener("click", handleClickOnDownloadGraphButton);
uploadGraphInput.addEventListener("change", handleChangeOnUploadGraphInput);

downloadGraphButton.download = "graph.graph";
