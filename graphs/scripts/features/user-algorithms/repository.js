import { AlgorithmContractError } from "../../algorithms/contract.js";
import { normalizeAlgorithmMeta } from "../../algorithms/registry.js";

export const USER_ALGORITHMS_STORAGE_KEY = "graph-studio.user-algorithms";
export const USER_ALGORITHMS_VERSION = 1;
export const USER_CODE_CONSENT_KEY = "graph-studio.user-code-consent";
export const USER_ALGORITHM_ID_PREFIX = "user:";
export const MAX_USER_SOURCE_BYTES = 256 * 1024;

export const USER_CODE_CONSENT_MESSAGE = [
    "Пользовательский код выполнится в изолированном Web Worker.",
    "Worker не имеет доступа к DOM, но работает в том же origin,",
    "поэтому запускайте только код, которому доверяете.",
    "Продолжить?",
].join("\n");

export const DEFAULT_USER_ALGORITHM_SOURCE = [
    "export function run({ graph, startVertexId, helpers }) {",
    "    const steps = [];",
    "    const visited = [];",
    "",
    "    for (const vertexId of graph.vertexIds) {",
    "        visited.push(vertexId);",
    "        steps.push(helpers.vertex(vertexId));",
    "    }",
    "",
    "    return {",
    "        steps,",
    "        visited,",
    "        resultText: `Вершин: ${visited.length}`,",
    "    };",
    "}",
].join("\n");

const fail = (message, path) => {
    throw new AlgorithmContractError(message, { path });
};

const safeStorage = (getter) => {
    try {
        return getter() ?? null;
    } catch {
        return null;
    }
};

export const getLocalStorage = () =>
    safeStorage(() => globalThis.localStorage);

export const getSessionStorage = () =>
    safeStorage(() => globalThis.sessionStorage);

export const slugifyUserAlgorithmId = (value) => {
    const slug = String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");

    return slug || "algorithm";
};

export const normalizeUserAlgorithmId = (value) => {
    const raw = String(value ?? "").trim();
    const withoutPrefix = raw.startsWith(USER_ALGORITHM_ID_PREFIX)
        ? raw.slice(USER_ALGORITHM_ID_PREFIX.length)
        : raw;

    return `${USER_ALGORITHM_ID_PREFIX}${slugifyUserAlgorithmId(withoutPrefix)}`;
};

export const isUserAlgorithmId = (value) =>
    String(value ?? "").startsWith(USER_ALGORITHM_ID_PREFIX);

const normalizeSource = (source, path) => {
    if (typeof source !== "string") {
        fail("Исходник должен быть строкой", path);
    }

    if (source.trim().length === 0) {
        fail("Исходник не может быть пустым", path);
    }

    return source;
};

const normalizeTimestamp = (value, path, fallback) => {
    if (value === undefined) {
        return fallback;
    }

    if (!Number.isFinite(value) || value < 0) {
        fail("Метка времени должна быть неотрицательным числом", path);
    }

    return value;
};

export const createUserAlgorithmRecord = ({
    id,
    meta,
    source,
    createdAt,
    updatedAt,
    lastError,
} = {}) => {
    const normalizedId = normalizeUserAlgorithmId(
        id ?? meta?.id ?? meta?.name,
    );
    const normalizedMeta = normalizeAlgorithmMeta({
        ...meta,
        id: normalizedId,
    });
    const now = Date.now();

    return {
        id: normalizedMeta.id,
        meta: normalizedMeta,
        source: normalizeSource(source, "source"),
        createdAt: normalizeTimestamp(createdAt, "createdAt", now),
        updatedAt: normalizeTimestamp(updatedAt, "updatedAt", now),
        ...(typeof lastError === "string" && lastError.length > 0
            ? { lastError }
            : {}),
    };
};

export const normalizeUserAlgorithmRecord = (raw, path = "record") => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        fail("Запись должна быть объектом", path);
    }

    return createUserAlgorithmRecord({
        id: raw.id ?? raw.meta?.id,
        meta: raw.meta,
        source: raw.source,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        lastError: raw.lastError,
    });
};

const getUtf8Bytes = (text) => {
    if (typeof TextEncoder === "function") {
        return new TextEncoder().encode(text).length;
    }

    return unescape(encodeURIComponent(text)).length;
};

export const getUserAlgorithmsSourceBytes = (records = []) =>
    records.reduce(
        (total, record) => total + getUtf8Bytes(record.source ?? ""),
        0,
    );

export const serializeUserAlgorithms = (records = []) => {
    const bytes = getUserAlgorithmsSourceBytes(records);

    if (bytes > MAX_USER_SOURCE_BYTES) {
        fail(
            `Суммарный размер исходников ${bytes} байт превышает лимит ${MAX_USER_SOURCE_BYTES} байт`,
            "source",
        );
    }

    return JSON.stringify({
        version: USER_ALGORITHMS_VERSION,
        algorithms: records,
    });
};

export const parseUserAlgorithms = (json) => {
    let parsed;

    try {
        parsed = JSON.parse(json);
    } catch (error) {
        fail(`Повреждённый JSON: ${error.message}`, "json");
    }

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        fail("Ожидался объект с алгоритмами", "json");
    }

    if (!Array.isArray(parsed.algorithms)) {
        fail("Поле algorithms должно быть массивом", "algorithms");
    }

    return parsed.algorithms.map((entry, index) =>
        normalizeUserAlgorithmRecord(entry, `algorithms[${index}]`),
    );
};

export const loadUserAlgorithmRecords = (storage = getLocalStorage()) => {
    const raw = storage?.getItem(USER_ALGORITHMS_STORAGE_KEY);

    if (typeof raw !== "string" || raw.length === 0) {
        return { records: [], errors: [] };
    }

    let parsed;

    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return {
            records: [],
            errors: [
                {
                    id: "storage",
                    message: `Повреждённый JSON: ${error.message}`,
                },
            ],
        };
    }

    const errors = [];

    if (!Array.isArray(parsed?.algorithms)) {
        errors.push({
            id: "storage",
            message: "Поле algorithms отсутствует или не является массивом",
        });

        return { records: [], errors };
    }

    const records = [];

    parsed.algorithms.forEach((entry, index) => {
        try {
            records.push(
                normalizeUserAlgorithmRecord(entry, `algorithms[${index}]`),
            );
        } catch (error) {
            errors.push({
                id:
                    typeof entry?.id === "string" && entry.id.length > 0
                        ? entry.id
                        : `#${index}`,
                message: error?.message ?? "Некорректная запись",
                path: error?.path,
            });
        }
    });

    return { records, errors };
};

export const saveUserAlgorithmRecords = (storage, records) => {
    const payload = serializeUserAlgorithms(records);

    storage?.setItem(USER_ALGORITHMS_STORAGE_KEY, payload);

    return payload;
};

export const upsertUserAlgorithmRecord = (records, record) => {
    const index = records.findIndex(
        (candidate) => candidate.id === record.id,
    );

    if (index === -1) {
        return [...records, record];
    }

    const next = records.slice();
    next[index] = record;

    return next;
};

export const removeUserAlgorithmRecord = (records, id) =>
    records.filter((record) => record.id !== id);

export const createUserAlgorithmDescriptor = (record) => ({
    meta: record.meta,
    code: record.source,
});

export const hasUserCodeConsent = (storage = getSessionStorage()) =>
    storage?.getItem(USER_CODE_CONSENT_KEY) === "1";

export const grantUserCodeConsent = (storage = getSessionStorage()) => {
    storage?.setItem(USER_CODE_CONSENT_KEY, "1");
};

export const ensureUserCodeConsent = ({ storage, confirm } = {}) => {
    const targetStorage = storage ?? getSessionStorage();

    if (hasUserCodeConsent(targetStorage)) {
        return true;
    }

    const confirmFn = confirm ?? globalThis.confirm;

    if (typeof confirmFn !== "function") {
        return false;
    }

    const accepted = confirmFn(USER_CODE_CONSENT_MESSAGE);

    if (accepted) {
        grantUserCodeConsent(targetStorage);
    }

    return Boolean(accepted);
};
