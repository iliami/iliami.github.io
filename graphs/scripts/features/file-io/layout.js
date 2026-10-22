const DEFAULT_CENTER = { x: 500, y: 300 };
const DEFAULT_RADIUS = 140;

export const placeMissingVertices = (vertices) => {
    const positioned = vertices.filter(
        (vertex) => Number.isFinite(vertex.x) && Number.isFinite(vertex.y),
    );
    const missing = vertices.filter(
        (vertex) => !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y),
    );

    if (missing.length === 0) {
        return vertices;
    }

    const centerX =
        positioned.length > 0
            ? positioned.reduce((sum, vertex) => sum + vertex.x, 0) /
              positioned.length
            : DEFAULT_CENTER.x;
    const centerY =
        positioned.length > 0
            ? positioned.reduce((sum, vertex) => sum + vertex.y, 0) /
              positioned.length
            : DEFAULT_CENTER.y;
    const radius = Math.max(
        DEFAULT_RADIUS,
        Math.min(420, vertices.length * 38),
    );
    let missingIndex = 0;

    return vertices.map((vertex) => {
        if (Number.isFinite(vertex.x) && Number.isFinite(vertex.y)) {
            return vertex;
        }

        const angle =
            (missingIndex / Math.max(missing.length, 1)) * Math.PI * 2 -
            Math.PI / 2;
        const placed = {
            ...vertex,
            x: Math.round(centerX + Math.cos(angle) * radius),
            y: Math.round(centerY + Math.sin(angle) * radius),
        };

        missingIndex += 1;

        return placed;
    });
};
