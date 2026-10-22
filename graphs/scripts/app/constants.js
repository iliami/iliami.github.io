export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export const VERTEX_RADIUS = 18;

export const MODES = Object.freeze({
    default: 1,
    vertex: 2,
    edge: 3,
});

export const COLORS = Object.freeze({
    vertex: "var(--node-bg)",
    vertexText: "var(--node-text)",
    vertexSelected: "var(--node-selected-bg)",
    vertexSelectedText: "var(--node-selected-text)",
    vertexVisited: "var(--node-visited-bg)",
    vertexVisitedText: "var(--node-visited-text)",
    vertexActive: "var(--node-active-bg)",
    vertexActiveText: "var(--node-active-text)",
    edge: "var(--edge)",
    edgeVisited: "var(--edge-visited)",
    edgePreview: "var(--edge-preview)",
    simulationVertex: "var(--node-simulation-bg)",
    simulationEdge: "var(--edge-simulation)",
});
