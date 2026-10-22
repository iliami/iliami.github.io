import { SVG_NAMESPACE } from "./constants.js";

export const $ = (id) => document.getElementById(id);

export const app = $("app");
export const svg = $("canvas");
export const canvasSurface = $("canvas_surface");

export const graphStats = $("graph_stats");
export const zoomLevelLabel = $("zoom_level");
export const appStatus = $("app_status");
export const selectorVertexNumber = $("vertex_num");
export const returnDefaultColorsButton = $("default_colors");
export const downloadGraphButton = $("download_graph");
export const downloadGraphJsonButton = $("download_graph_json");
export const downloadGraphDotButton = $("download_graph_dot");

export const createSvgElement = (tagName, attributes = {}) => {
    const element = document.createElementNS(SVG_NAMESPACE, tagName);

    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, String(value));
    }

    return element;
};
