import {
    $,
    downloadGraphButton,
    downloadGraphDotButton,
    downloadGraphJsonButton,
} from "../../app/dom.js";
import { state, updateAppStatus } from "../../app/state.js";
import { pluralize } from "../../app/utils.js";
import { fitView, renderGraph } from "../editor/controller.js";
import { serializeGraphToDot } from "./dot-export.js";
import { parseGraphFromDot } from "./dot-import.js";
import { serializeGraphToJson } from "./json-export.js";
import { parseGraphFromJson } from "./json-import.js";
import { buildExportSvg } from "./svg-export.js";
import { parseGraphFromSvg } from "./svg-import.js";

const uploadGraphInput = $("upload_graph");
const uploadGraphButton = $("upload_graph_button");
const exportDropdown = $("export_dropdown");
const exportToggle = $("export_toggle");
const exportMenu = $("export_menu");

const exportFormats = [
    {
        link: downloadGraphButton,
        filename: "graph.graph.svg",
        type: "image/svg+xml",
        build: () => buildExportSvg(),
    },
    {
        link: downloadGraphJsonButton,
        filename: "graph.json",
        type: "application/json;charset=utf-8",
        build: () => serializeGraphToJson(state.graph),
    },
    {
        link: downloadGraphDotButton,
        filename: "graph.dot",
        type: "text/vnd.graphviz;charset=utf-8",
        build: () => serializeGraphToDot(state.graph),
    },
].filter((format) => Boolean(format.link));

let exportUrl = null;
let exportLink = null;
let exportTimer = null;
let initialized = false;

const setExportMenuOpen = (isOpen) => {
    exportDropdown.classList.toggle("is_open", isOpen);
    exportToggle.setAttribute("aria-expanded", String(isOpen));
};

const closeExportMenu = () => {
    setExportMenuOpen(false);
};

const releaseExportUrl = () => {
    if (exportTimer) {
        clearTimeout(exportTimer);
        exportTimer = null;
    }

    if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
        exportUrl = null;
    }

    exportLink?.removeAttribute("href");
    exportLink = null;
};

const parseImportedGraph = (fileName, text) => {
    const name = fileName.toLowerCase();

    if (name.endsWith(".svg")) {
        return parseGraphFromSvg(text);
    }

    if (name.endsWith(".json")) {
        return parseGraphFromJson(text);
    }

    if (name.endsWith(".dot") || name.endsWith(".gv")) {
        return parseGraphFromDot(text);
    }

    return null;
};

const handleDownloadGraph = (event, format) => {
    if (state.graph.vertices.length === 0) {
        event.preventDefault();
        updateAppStatus("Нечего экспортировать: граф пуст");
        return;
    }

    releaseExportUrl();

    const data = new Blob([format.build()], { type: format.type });
    const link = event.currentTarget;

    exportUrl = URL.createObjectURL(data);
    exportLink = link;
    link.href = exportUrl;
    link.download = format.filename;
    closeExportMenu();

    exportTimer = setTimeout(releaseExportUrl, 1500);
};

function handleChangeOnUploadGraphInput(event) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
        return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", () => {
        const graph = parseImportedGraph(file.name, String(reader.result));

        if (!graph) {
            updateAppStatus("Неподдерживаемый формат файла");
            return;
        }

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

    reader.addEventListener("error", () => {
        updateAppStatus("Не удалось прочитать файл");
    });

    reader.readAsText(file);
    event.currentTarget.value = "";
}

export const initFileIO = () => {
    if (initialized) {
        return;
    }

    initialized = true;

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

    for (const format of exportFormats) {
        format.link.addEventListener("click", (event) => {
            handleDownloadGraph(event, format);
        });
    }

    uploadGraphInput.addEventListener(
        "change",
        handleChangeOnUploadGraphInput,
    );

    uploadGraphButton?.addEventListener("click", () => uploadGraphInput.click());
};
