import { svg } from "../../app/dom.js";
import { state } from "../../app/state.js";

export const buildExportSvg = () => {
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

    const originalArrows = svg.querySelectorAll(".edge_arrow");
    const clonedArrows = clone.querySelectorAll(".edge_arrow");

    originalArrows.forEach((arrow, index) => {
        const style = getComputedStyle(arrow);
        const clonedArrow = clonedArrows[index];

        clonedArrow?.setAttribute("fill", style.fill);
    });

    const originalWeights = svg.querySelectorAll(".edge_weight");
    const clonedWeights = clone.querySelectorAll(".edge_weight");

    originalWeights.forEach((weight, index) => {
        const style = getComputedStyle(weight);
        const clonedWeight = clonedWeights[index];

        clonedWeight?.setAttribute("fill", style.fill);
        clonedWeight?.setAttribute("stroke", style.stroke);
        clonedWeight?.setAttribute("stroke-width", style.strokeWidth);
        clonedWeight?.setAttribute("paint-order", "stroke");
        clonedWeight?.setAttribute("font-family", style.fontFamily);
        clonedWeight?.setAttribute("font-size", style.fontSize);
        clonedWeight?.setAttribute("font-weight", style.fontWeight);
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
