import {
    AlgorithmContractError,
    createAlgorithmHelpers,
    toAlgorithmRunError,
    validateAlgorithmResult,
} from "../contract.js";

import { buildGraphIndex } from "../../core/graph-index.js";

const resolveRunExport = (module) => {
    if (typeof module.run === "function") {
        return module.run;
    }

    const defaultExport = module.default;

    if (typeof defaultExport === "function") {
        return defaultExport;
    }

    if (
        defaultExport !== null &&
        typeof defaultExport === "object" &&
        typeof defaultExport.run === "function"
    ) {
        return defaultExport.run;
    }

    return null;
};

const importUserModule = async (source) => {
    const blob = new Blob([source], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);

    try {
        return await import(/* @vite-ignore */ url);
    } catch (error) {
        throw new AlgorithmContractError(
            `Не удалось импортировать модуль: ${error?.message ?? "неизвестная ошибка"}`,
            { path: "source", code: "import" },
        );
    } finally {
        URL.revokeObjectURL(url);
    }
};

const inspectUserSource = async (source) => {
    const module = await importUserModule(source);

    if (typeof resolveRunExport(module) !== "function") {
        throw new AlgorithmContractError(
            "Модуль должен экспортировать функцию run",
            { path: "run" },
        );
    }
};

const runUserSource = async ({ source, pseudocode, snapshot }) => {
    const module = await importUserModule(source);
    const run = resolveRunExport(module);

    if (typeof run !== "function") {
        throw new AlgorithmContractError(
            "Модуль должен экспортировать функцию run",
            { path: "run" },
        );
    }

    const graph = buildGraphIndex(snapshot.graph);

    const result = await run({
        graph,
        startVertexId: snapshot.startVertexId ?? null,
        params: snapshot.params ?? {},
        helpers: createAlgorithmHelpers(graph),
    });

    return validateAlgorithmResult(result, {
        index: graph,
        pseudocode: Array.isArray(pseudocode) ? pseudocode : [],
    });
};

const respond = (message) => {
    self.postMessage(message);
};

self.addEventListener("message", async (event) => {
    const data = event.data;

    if (
        data === null ||
        typeof data !== "object" ||
        (data.type !== "run" && data.type !== "inspect")
    ) {
        return;
    }

    const { runId } = data;

    try {
        if (data.type === "inspect") {
            await inspectUserSource(data.source);
            respond({ type: "inspect-result", runId });
            return;
        }

        const result = await runUserSource(data);
        respond({ type: "result", runId, result });
    } catch (error) {
        respond({
            type: "error",
            runId,
            error: toAlgorithmRunError(error, error?.code ?? "runtime"),
        });
    }
});
