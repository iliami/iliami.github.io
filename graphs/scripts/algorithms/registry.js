import {
    ALGORITHM_CONTRACT_VERSION,
    AlgorithmContractError,
    MAX_PSEUDOCODE_LINES,
} from "./contract.js";

import { builtinAlgorithms } from "./builtins/index.js";

const fail = (message, path) => {
    throw new AlgorithmContractError(message, { path });
};

const normalizeText = (value, path, { required = false } = {}) => {
    if (value === undefined) {
        if (required) {
            fail("Поле обязательно", path);
        }

        return undefined;
    }

    if (typeof value !== "string") {
        fail("Поле должно быть строкой", path);
    }

    if (required && value.trim().length === 0) {
        fail("Поле не может быть пустым", path);
    }

    return value.trim();
};

const normalizePseudocode = (value, path) => {
    if (value === undefined) {
        return [];
    }

    if (!Array.isArray(value)) {
        fail("Псевдокод должен быть массивом", path);
    }

    if (value.length > MAX_PSEUDOCODE_LINES) {
        fail(
            `Слишком много строк псевдокода: ${value.length} > ${MAX_PSEUDOCODE_LINES}`,
            path,
        );
    }

    return value.map((line, position) => {
        if (typeof line !== "string") {
            fail(
                "Строка псевдокода должна быть строкой",
                `${path}[${position}]`,
            );
        }

        return line;
    });
};

const normalizeParams = (value, path) => {
    if (value === undefined) {
        return undefined;
    }

    if (!Array.isArray(value)) {
        fail("params должен быть массивом", path);
    }

    return value.map((param) => ({ ...param }));
};

export const normalizeAlgorithmMeta = (meta) => {
    if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
        fail("meta должен быть объектом", "meta");
    }

    const id = normalizeText(meta.id, "meta.id", { required: true });
    const name = normalizeText(meta.name, "meta.name", { required: true });
    const shortName = normalizeText(meta.shortName, "meta.shortName");
    const description = normalizeText(meta.description, "meta.description");
    const label = normalizeText(meta.meta, "meta.meta");
    const params = normalizeParams(meta.params, "meta.params");

    return {
        id,
        name,
        ...(shortName !== undefined ? { shortName } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(label !== undefined ? { meta: label } : {}),
        requiresStartVertex: meta.requiresStartVertex !== false,
        pseudocode: normalizePseudocode(meta.pseudocode, "meta.pseudocode"),
        ...(params !== undefined ? { params } : {}),
    };
};

export const normalizeAlgorithmDescriptor = (
    descriptor,
    { source = "builtin", contractVersion = ALGORITHM_CONTRACT_VERSION } = {},
) => {
    if (
        descriptor === null ||
        typeof descriptor !== "object" ||
        Array.isArray(descriptor)
    ) {
        fail("Дескриптор алгоритма должен быть объектом", "descriptor");
    }

    const hasRun = typeof descriptor.run === "function";
    const code =
        typeof descriptor.code === "string" ? descriptor.code : undefined;

    if (!hasRun && code === undefined) {
        fail("Алгоритм должен экспортировать функцию run", "run");
    }

    const meta = normalizeAlgorithmMeta(descriptor.meta);

    return {
        id: meta.id,
        contractVersion,
        source,
        meta,
        ...(hasRun ? { run: descriptor.run } : {}),
        ...(code !== undefined ? { code } : {}),
    };
};

export const createAlgorithmRegistry = () => {
    const descriptors = new Map();
    const listeners = new Set();

    const list = () => Array.from(descriptors.values());

    const emit = () => {
        const snapshot = list();

        for (const listener of listeners) {
            listener(snapshot);
        }
    };

    const register = (descriptor, options = {}) => {
        const normalized = normalizeAlgorithmDescriptor(descriptor, options);

        if (descriptors.has(normalized.id) && !options.replace) {
            fail(`Алгоритм ${normalized.id} уже зарегистрирован`, "meta.id");
        }

        descriptors.set(normalized.id, normalized);
        emit();

        return normalized;
    };

    const remove = (id) => {
        const removed = descriptors.delete(id);

        if (removed) {
            emit();
        }

        return removed;
    };

    const subscribe = (listener) => {
        listeners.add(listener);

        return () => {
            listeners.delete(listener);
        };
    };

    return {
        register,
        remove,
        subscribe,
        list,
        get: (id) => descriptors.get(id) ?? null,
        has: (id) => descriptors.has(id),
    };
};

export const algorithmRegistry = createAlgorithmRegistry();

for (const algorithm of builtinAlgorithms) {
    algorithmRegistry.register(
        { meta: algorithm.meta, run: algorithm.run },
        { source: "builtin" },
    );
}
