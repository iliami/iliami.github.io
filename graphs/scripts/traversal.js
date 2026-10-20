import { STEP_TYPE, bfsTraversal, dfsTraversal } from "./core.js";

import {
    COLORS,
    MODES,
    btnStartBFS,
    btnStartDFS,
    returnDefaultColorsButton,
    defaultMode,
    lockControls,
    selectorVertexNumber,
    setEdgeStroke,
    setVertexFill,
    state,
    textResultBFS,
    textResultDFS,
    unlockControls,
} from "./ui.js";

import { returnDefaultColors } from "./graph-editor.js";

const DEFAULT_SLEEP_MS = 400;

const getSelectedStartVertex = () => {
    const index = Number(selectorVertexNumber.value) - 1;
    return state.graph.vertices[index] ?? state.graph.vertices[0] ?? null;
};

const formatTraversalResult = (graph, visitedIds) => {
    const vertexIndexes = new Map(
        graph.vertices.map((vertex, index) => [vertex.id, index]),
    );

    return visitedIds
        .map((vertexId) => vertexIndexes.get(vertexId) + 1)
        .join(", ");
};

const applyTraversalStep = (step) => {
    if (step.type === STEP_TYPE.edge) {
        setEdgeStroke(step.edgeId, COLORS.simulationEdge);
        return;
    }

    if (
        state.selectedVertexId !== null &&
        state.selectedVertexId === step.vertexId
    ) {
        state.prevCircleColor = COLORS.simulationVertex;
        return;
    }

    setVertexFill(step.vertexId, COLORS.simulationVertex);
};

const animateTraversal = (steps, onComplete) => {
    let delay = DEFAULT_SLEEP_MS;

    for (const step of steps) {
        setTimeout(() => applyTraversalStep(step), delay);
        delay += DEFAULT_SLEEP_MS;
    }

    setTimeout(onComplete, delay);
};

const startTraversal = (traverse, resultElement) => {
    const startVertex = getSelectedStartVertex();

    if (!startVertex) {
        return;
    }

    returnDefaultColors();

    defaultMode.checked = true;
    state.mode = MODES.default;

    lockControls();

    const { visited, steps } = traverse(state.graph, startVertex.id);

    resultElement.textContent = formatTraversalResult(state.graph, visited);

    animateTraversal(steps, unlockControls);
};

function handleClickOnButtonStartBFS() {
    startTraversal(bfsTraversal, textResultBFS);
}

function handleClickOnButtonStartDFS() {
    startTraversal(dfsTraversal, textResultDFS);
}

btnStartBFS.addEventListener("click", handleClickOnButtonStartBFS);
btnStartDFS.addEventListener("click", handleClickOnButtonStartDFS);
returnDefaultColorsButton.addEventListener("click", returnDefaultColors);
