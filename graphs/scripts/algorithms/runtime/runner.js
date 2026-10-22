import {
    createAlgorithmHelpers,
    toAlgorithmRunError,
    validateAlgorithmResult,
} from "../contract.js";

import { buildGraphIndex } from "../../core/graph-index.js";

export const DEFAULT_RUN_TIMEOUT_MS = 10000;

const createDefaultWorker = () =>
    new Worker(new URL("./worker.js", import.meta.url), {
        type: "module",
    });

const createRunId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const runBuiltin = (descriptor, snapshot) => {
    const index = buildGraphIndex(snapshot.graph);

    const rawResult = descriptor.run({
        graph: index,
        startVertexId: snapshot.startVertexId ?? null,
        params: snapshot.params ?? {},
        helpers: createAlgorithmHelpers(index),
    });

    return validateAlgorithmResult(rawResult, {
        index,
        pseudocode: descriptor.meta?.pseudocode ?? [],
    });
};

const ABORTED_ERROR = Object.freeze({
    code: "aborted",
    message: "Запуск отменён",
});

export const createAlgorithmRunner = ({
    createWorker = createDefaultWorker,
    timeoutMs = DEFAULT_RUN_TIMEOUT_MS,
    makeRunId = createRunId,
} = {}) => {
    const requestWorker = async (descriptor, message, { signal } = {}) => {
        if (signal?.aborted) {
            throw ABORTED_ERROR;
        }

        let worker;

        try {
            worker = createWorker();
        } catch (error) {
            throw toAlgorithmRunError(error, "runtime");
        }

        const runId = makeRunId();

        return new Promise((resolve, reject) => {
            let settled = false;
            let timer = null;
            let removeAbort = null;

            const cleanup = () => {
                if (timer !== null) {
                    clearTimeout(timer);
                    timer = null;
                }

                removeAbort?.();
                removeAbort = null;

                worker.removeEventListener?.("message", handleMessage);
                worker.removeEventListener?.("error", handleError);
                worker.terminate?.();
            };

            const settle = (action) => {
                if (settled) {
                    return;
                }

                settled = true;
                cleanup();
                action();
            };

            const handleMessage = (event) => {
                const data = event?.data ?? {};

                if (data.runId !== runId) {
                    return;
                }

                if (data.type === "result" || data.type === "inspect-result") {
                    settle(() => resolve(data));
                    return;
                }

                if (data.type === "error") {
                    settle(() => reject(data.error));
                }
            };

            const handleError = (event) => {
                settle(() =>
                    reject(
                        toAlgorithmRunError(
                            { message: event?.message ?? "Ошибка Worker" },
                            "runtime",
                        ),
                    ),
                );
            };

            if (signal) {
                const onAbort = () => settle(() => reject(ABORTED_ERROR));

                signal.addEventListener("abort", onAbort, { once: true });
                removeAbort = () =>
                    signal.removeEventListener("abort", onAbort);
            }

            worker.addEventListener?.("message", handleMessage);
            worker.addEventListener?.("error", handleError);

            timer = setTimeout(() => {
                settle(() =>
                    reject({
                        code: "timeout",
                        message: `Алгоритм не завершился за ${timeoutMs} мс`,
                    }),
                );
            }, timeoutMs);

            worker.postMessage({
                ...message,
                runId,
                source: descriptor.code,
                timeoutMs,
            });
        });
    };

    const runInWorker = async (descriptor, snapshot, options) => {
        const data = await requestWorker(
            descriptor,
            {
                type: "run",
                pseudocode: descriptor.meta?.pseudocode ?? [],
                snapshot,
            },
            options,
        );

        const index = buildGraphIndex(snapshot.graph);

        return validateAlgorithmResult(data.result, {
            index,
            pseudocode: descriptor.meta?.pseudocode ?? [],
        });
    };

    const run = async (descriptor, snapshot, options = {}) => {
        if (descriptor.code !== undefined) {
            return runInWorker(descriptor, snapshot, options);
        }

        try {
            return runBuiltin(descriptor, snapshot);
        } catch (error) {
            throw toAlgorithmRunError(error);
        }
    };

    const inspect = (descriptor, options = {}) => {
        if (descriptor.code === undefined) {
            return Promise.resolve({ ok: true });
        }

        return requestWorker(descriptor, { type: "inspect" }, options);
    };

    return { run, inspect };
};
