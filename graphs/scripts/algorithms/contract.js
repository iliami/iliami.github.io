import { findEdgeBetween } from "../core/graph-index.js";

export const ALGORITHM_CONTRACT_VERSION = 1;

export const STEP_TYPE = Object.freeze({
    vertex: "vertex",
    edge: "edge",
    log: "log",
});

export const STEP_TONE = Object.freeze({
    visited: "visited",
    active: "active",
    path: "path",
    rejected: "rejected",
});

export const MAX_STEPS = 2000000;
export const MAX_LOG_MESSAGE_LENGTH = 2000;
export const MAX_RESULT_TEXT_LENGTH = 5000;
export const MAX_PSEUDOCODE_LINES = 500;

const STEP_TONES = new Set(Object.values(STEP_TONE));

export class AlgorithmContractError extends Error {
    constructor(message, { path = "", code = "contract" } = {}) {
        super(message);
        this.name = "AlgorithmContractError";
        this.code = code;
        this.path = path;
    }
}

const getStepOptions = (options = {}) => {
    const stepOptions = {};

    if (options.line !== undefined) {
        stepOptions.line = options.line;
    }

    if (options.tone !== undefined) {
        stepOptions.tone = options.tone;
    }

    if (options.message !== undefined) {
        stepOptions.message = options.message;
    }

    return stepOptions;
};

export const createVertexStep = (vertexId, options = {}) => ({
    type: STEP_TYPE.vertex,
    vertexId,
    ...getStepOptions(options),
});

export const createEdgeStep = (edgeId, options = {}) => ({
    type: STEP_TYPE.edge,
    edgeId,
    ...getStepOptions(options),
});

export const createLogStep = (message, options = {}) => ({
    type: STEP_TYPE.log,
    message,
    ...getStepOptions(options),
});

export const createAlgorithmHelpers = (index) => ({
    vertex: (vertexId, options) => createVertexStep(vertexId, options),
    edge: (firstVertexId, secondVertexId, options) => {
        const edge = findEdgeBetween(index, firstVertexId, secondVertexId);

        if (!edge) {
            throw new AlgorithmContractError(
                `Ребро ${firstVertexId} — ${secondVertexId} не найдено`,
                { path: "helpers.edge" },
            );
        }

        return createEdgeStep(edge.id, options);
    },
    edgeById: (edgeId, options) => {
        if (!index.edgeById.has(edgeId)) {
            throw new AlgorithmContractError(`Ребро ${edgeId} не найдено`, {
                path: "helpers.edgeById",
            });
        }

        return createEdgeStep(edgeId, options);
    },
    log: (message, options) => createLogStep(message, options),
    degree: (vertexId) => index.adjacency.get(vertexId)?.length ?? 0,
});

const fail = (message, path) => {
    throw new AlgorithmContractError(message, { path });
};

const validateMessage = (value, path, { required = false } = {}) => {
    if (value === undefined) {
        if (required) {
            fail("Сообщение обязательно", path);
        }

        return undefined;
    }

    if (typeof value !== "string") {
        fail("Сообщение должно быть строкой", path);
    }

    if (value.length > MAX_LOG_MESSAGE_LENGTH) {
        fail(`Сообщение длиннее ${MAX_LOG_MESSAGE_LENGTH} символов`, path);
    }

    if (required && value.trim().length === 0) {
        fail("Сообщение не может быть пустым", path);
    }

    return value;
};

const validateLine = (line, path, pseudocode) => {
    if (line === undefined) {
        return undefined;
    }

    if (!Number.isInteger(line) || line < 1) {
        fail("Номер строки должен быть положительным целым числом", path);
    }

    if (pseudocode.length === 0) {
        fail("Номер строки указан, но псевдокод пуст", path);
    }

    if (line > pseudocode.length) {
        fail(
            `Номер строки ${line} выходит за границы псевдокода (${pseudocode.length})`,
            path,
        );
    }

    return line;
};

const validateTone = (tone, path) => {
    if (tone === undefined) {
        return undefined;
    }

    if (!STEP_TONES.has(tone)) {
        fail(`Неизвестный тон шага: ${String(tone)}`, path);
    }

    return tone;
};

const normalizeStep = (step, index, pseudocode, path) => {
    if (step === null || typeof step !== "object" || Array.isArray(step)) {
        fail("Шаг должен быть объектом", path);
    }

    const line = validateLine(step.line, `${path}.line`, pseudocode);
    const tone = validateTone(step.tone, `${path}.tone`);
    const message = validateMessage(step.message, `${path}.message`);

    if (step.type === STEP_TYPE.vertex) {
        if (typeof step.vertexId !== "string") {
            fail("vertexId должен быть строкой", `${path}.vertexId`);
        }

        if (!index.vertexById.has(step.vertexId)) {
            fail(
                `Вершина ${step.vertexId} отсутствует в графе`,
                `${path}.vertexId`,
            );
        }

        return {
            type: STEP_TYPE.vertex,
            vertexId: step.vertexId,
            ...(line !== undefined ? { line } : {}),
            ...(tone !== undefined ? { tone } : {}),
            ...(message !== undefined ? { message } : {}),
        };
    }

    if (step.type === STEP_TYPE.edge) {
        if (typeof step.edgeId !== "string") {
            fail("edgeId должен быть строкой", `${path}.edgeId`);
        }

        if (!index.edgeById.has(step.edgeId)) {
            fail(`Ребро ${step.edgeId} отсутствует в графе`, `${path}.edgeId`);
        }

        return {
            type: STEP_TYPE.edge,
            edgeId: step.edgeId,
            ...(line !== undefined ? { line } : {}),
            ...(tone !== undefined ? { tone } : {}),
            ...(message !== undefined ? { message } : {}),
        };
    }

    if (step.type === STEP_TYPE.log) {
        return {
            type: STEP_TYPE.log,
            message: validateMessage(step.message, `${path}.message`, {
                required: true,
            }),
            ...(line !== undefined ? { line } : {}),
        };
    }

    fail(`Неизвестный тип шага: ${String(step.type)}`, `${path}.type`);

    return null;
};

export const validateAlgorithmResult = (
    result,
    { index, pseudocode = [] } = {},
) => {
    if (!index) {
        fail("Для проверки результата нужен GraphIndex", "index");
    }

    if (
        result === null ||
        typeof result !== "object" ||
        Array.isArray(result)
    ) {
        fail("Результат должен быть объектом", "result");
    }

    if (!Array.isArray(result.steps)) {
        fail("steps должен быть массивом", "steps");
    }

    if (result.steps.length > MAX_STEPS) {
        fail(
            `Слишком много шагов: ${result.steps.length} > ${MAX_STEPS}`,
            "steps",
        );
    }

    const steps = result.steps.map((step, position) =>
        normalizeStep(step, index, pseudocode, `steps[${position}]`),
    );

    const visited = result.visited ?? [];

    if (!Array.isArray(visited)) {
        fail("visited должен быть массивом", "visited");
    }

    const normalizedVisited = visited.map((vertexId, position) => {
        if (typeof vertexId !== "string") {
            fail("id вершины должен быть строкой", `visited[${position}]`);
        }

        if (!index.vertexById.has(vertexId)) {
            fail(
                `Вершина ${vertexId} отсутствует в графе`,
                `visited[${position}]`,
            );
        }

        return vertexId;
    });

    let resultText = "";

    if (result.resultText !== undefined) {
        if (typeof result.resultText !== "string") {
            fail("resultText должен быть строкой", "resultText");
        }

        if (result.resultText.length > MAX_RESULT_TEXT_LENGTH) {
            fail(
                `resultText длиннее ${MAX_RESULT_TEXT_LENGTH} символов`,
                "resultText",
            );
        }

        resultText = result.resultText;
    }

    let stats;

    if (result.stats !== undefined) {
        if (
            result.stats === null ||
            typeof result.stats !== "object" ||
            Array.isArray(result.stats)
        ) {
            fail("stats должен быть объектом", "stats");
        }

        stats = Object.fromEntries(
            Object.entries(result.stats).filter(
                ([, value]) =>
                    typeof value === "string" || Number.isFinite(value),
            ),
        );
    }

    return {
        steps,
        visited: normalizedVisited,
        resultText,
        ...(stats ? { stats } : {}),
    };
};

export const toAlgorithmRunError = (error, fallbackCode = "runtime") => ({
    code: error?.code ?? fallbackCode,
    message:
        typeof error?.message === "string"
            ? error.message
            : "Неизвестная ошибка алгоритма",
    ...(typeof error?.stack === "string" ? { stack: error.stack } : {}),
    ...(typeof error?.path === "string" && error.path
        ? { path: error.path }
        : {}),
});
