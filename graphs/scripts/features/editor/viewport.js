import { VERTEX_RADIUS } from "../../app/constants.js";
import { app, canvasSurface, svg } from "../../app/dom.js";
import { state, updateZoomLabel } from "../../app/state.js";
import { clamp } from "../../app/utils.js";

const GRID_SIZE = 24;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3.5;
const FIT_MAX_SCALE = 2;
const FIT_PADDING = 80;

const getVisibleInsets = () => {
    if (!app) {
        return { left: 0, right: 0, top: 0 };
    }

    const styles = getComputedStyle(app);
    const inset = (name) => parseFloat(styles.getPropertyValue(name)) || 0;

    return {
        left: inset("--left-offset"),
        right: inset("--right-offset"),
        top: app.classList.contains("is_focus") ? 0 : inset("--header-h"),
    };
};

export const updateViewBox = () => {
    const bounds = svg.getBoundingClientRect();

    if (!bounds.width || !bounds.height) {
        return;
    }

    const { x, y, scale } = state.view;
    const width = bounds.width / scale;
    const height = bounds.height / scale;

    svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);

    if (canvasSurface) {
        const size = GRID_SIZE * scale;
        const modulo = (value) => ((value % size) + size) % size;

        canvasSurface.style.setProperty("--grid-size", `${size}px`);
        canvasSurface.style.setProperty("--grid-x", `${modulo(-x * scale)}px`);
        canvasSurface.style.setProperty("--grid-y", `${modulo(-y * scale)}px`);
    }

    updateZoomLabel();
};

export const zoomAt = (clientX, clientY, factor) => {
    const bounds = svg.getBoundingClientRect();
    const oldScale = state.view.scale;
    const newScale = clamp(oldScale * factor, MIN_SCALE, MAX_SCALE);

    if (newScale === oldScale || !bounds.width || !bounds.height) {
        return;
    }

    const pointerX = clientX - bounds.left;
    const pointerY = clientY - bounds.top;
    const worldX = state.view.x + pointerX / oldScale;
    const worldY = state.view.y + pointerY / oldScale;

    state.view.scale = newScale;
    state.view.x = worldX - pointerX / newScale;
    state.view.y = worldY - pointerY / newScale;

    updateViewBox();
};

export const zoomAtCenter = (factor) => {
    const bounds = svg.getBoundingClientRect();
    const insets = getVisibleInsets();
    const centerX =
        bounds.left +
        insets.left +
        (bounds.width - insets.left - insets.right) / 2;
    const centerY =
        bounds.top + insets.top + (bounds.height - insets.top) / 2;

    zoomAt(centerX, centerY, factor);
};

export const resetView = () => {
    state.view.x = 0;
    state.view.y = 0;
    state.view.scale = 1;
    updateViewBox();
};

export const fitView = () => {
    const bounds = svg.getBoundingClientRect();

    if (!state.graph.vertices.length) {
        resetView();
        return;
    }

    if (!bounds.width || !bounds.height) {
        return;
    }

    const xs = state.graph.vertices.map((vertex) => vertex.x);
    const ys = state.graph.vertices.map((vertex) => vertex.y);
    const minX = Math.min(...xs) - VERTEX_RADIUS - FIT_PADDING;
    const maxX = Math.max(...xs) + VERTEX_RADIUS + FIT_PADDING;
    const minY = Math.min(...ys) - VERTEX_RADIUS - FIT_PADDING;
    const maxY = Math.max(...ys) + VERTEX_RADIUS + FIT_PADDING;
    const contentWidth = Math.max(maxX - minX, 1);
    const contentHeight = Math.max(maxY - minY, 1);
    const insets = getVisibleInsets();
    const availableWidth = Math.max(
        bounds.width - insets.left - insets.right,
        1,
    );
    const availableHeight = Math.max(bounds.height - insets.top, 1);
    const scale = clamp(
        Math.min(
            availableWidth / contentWidth,
            availableHeight / contentHeight,
        ),
        MIN_SCALE,
        FIT_MAX_SCALE,
    );

    state.view.scale = scale;
    state.view.x =
        minX -
        (insets.left + (availableWidth - contentWidth * scale) / 2) / scale;
    state.view.y =
        minY -
        (insets.top + (availableHeight - contentHeight * scale) / 2) / scale;

    updateViewBox();
};
