import {
    EDGE_ID_OFFSET,
    createEdge,
    createGraph,
    createVertex,
} from "../../core/graph.js";
import { placeMissingVertices } from "./layout.js";

const PUNCTUATION = new Set(["{", "}", "[", "]", ";", ",", "=", ":"]);
const isWhitespace = (character) => /\s/.test(character);

const tokenizeDot = (text) => {
    const tokens = [];
    let index = String(text).startsWith("\uFEFF") ? 1 : 0;

    const push = (type, value) => {
        tokens.push({ type, value });
    };

    while (index < text.length) {
        const character = text[index];

        if (isWhitespace(character)) {
            index += 1;
            continue;
        }

        if (character === "/" && text[index + 1] === "/") {
            index += 2;

            while (index < text.length && text[index] !== "\n") {
                index += 1;
            }

            continue;
        }

        if (character === "/" && text[index + 1] === "*") {
            const end = text.indexOf("*/", index + 2);

            index = end === -1 ? text.length : end + 2;
            continue;
        }

        if (character === "#") {
            while (index < text.length && text[index] !== "\n") {
                index += 1;
            }

            continue;
        }

        if (character === '"') {
            let value = "";

            index += 1;

            while (index < text.length && text[index] !== '"') {
                if (text[index] === "\\" && index + 1 < text.length) {
                    const escaped = text[index + 1];

                    if (escaped === "n") {
                        value += "\n";
                    } else if (escaped === '"' || escaped === "\\") {
                        value += escaped;
                    } else {
                        value += `\\${escaped}`;
                    }

                    index += 2;
                    continue;
                }

                value += text[index];
                index += 1;
            }

            index += 1;
            push("value", value);
            continue;
        }

        if (
            (character === "-" && text[index + 1] === ">") ||
            (character === "-" && text[index + 1] === "-")
        ) {
            push("operator", text.slice(index, index + 2));
            index += 2;
            continue;
        }

        if (PUNCTUATION.has(character)) {
            push("punctuation", character);
            index += 1;
            continue;
        }

        let value = "";

        while (
            index < text.length &&
            !isWhitespace(text[index]) &&
            !PUNCTUATION.has(text[index]) &&
            !(
                text[index] === "-" &&
                (text[index + 1] === ">" || text[index + 1] === "-")
            )
        ) {
            value += text[index];
            index += 1;
        }

        if (value.length > 0) {
            push("value", value);
        } else {
            index += 1;
        }
    }

    return tokens;
};

const readEndpoint = (tokens, state) => {
    const token = tokens[state.index];

    if (!token || token.type !== "value") {
        return null;
    }

    state.index += 1;
    const id = String(token.value);

    if (tokens[state.index]?.value === ":") {
        state.index += 1;

        if (tokens[state.index]?.type === "value") {
            state.index += 1;
        }

        if (tokens[state.index]?.value === ":") {
            state.index += 1;

            if (tokens[state.index]?.type === "value") {
                state.index += 1;
            }
        }
    }

    return id;
};

const readAttributes = (tokens, state) => {
    const attributes = Object.create(null);

    while (tokens[state.index]?.value === "[") {
        state.index += 1;

        while (
            state.index < tokens.length &&
            tokens[state.index].value !== "]"
        ) {
            const token = tokens[state.index];

            if ([",", ";", "="].includes(token.value)) {
                state.index += 1;
                continue;
            }

            if (token.type !== "value") {
                state.index += 1;
                continue;
            }

            const key = String(token.value).toLowerCase();

            state.index += 1;

            let value = "true";

            if (tokens[state.index]?.value === "=") {
                state.index += 1;
                value = String(tokens[state.index]?.value ?? "");
                state.index += 1;
            }

            attributes[key] = value;

            if ([",", ";"].includes(tokens[state.index]?.value)) {
                state.index += 1;
            }
        }

        if (tokens[state.index]?.value === "]") {
            state.index += 1;
        }
    }

    return attributes;
};

const ensureNode = (context, id) => {
    if (!context.nodes.has(id)) {
        context.nodes.set(id, { ...context.nodeDefaults });
    }

    return context.nodes.get(id);
};

const parsePosition = (value) => {
    if (typeof value !== "string") {
        return {};
    }

    const match = value.match(
        /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    );

    if (!match) {
        return {};
    }

    return {
        x: Number(match[1]),
        y: -Number(match[2]),
    };
};

const createEdgeId = (usedIds, index) => {
    let nextId = EDGE_ID_OFFSET + index + 1;

    while (usedIds.has(String(nextId))) {
        nextId += 1;
    }

    return String(nextId);
};

const parseStatementList = (tokens, state, context) => {
    while (state.index < tokens.length) {
        const token = tokens[state.index];

        if (token.value === "}") {
            state.index += 1;
            return;
        }

        if (token.value === ";") {
            state.index += 1;
            continue;
        }

        if (token.value === "{") {
            state.index += 1;
            parseStatementList(tokens, state, context);
            continue;
        }

        if (String(token.value).toLowerCase() === "subgraph") {
            state.index += 1;

            if (tokens[state.index]?.value !== "{") {
                state.index += 1;
            }

            if (tokens[state.index]?.value === "{") {
                state.index += 1;
                parseStatementList(tokens, state, context);
            }

            continue;
        }

        const keyword = String(token.value).toLowerCase();

        if (
            ["graph", "node", "edge"].includes(keyword) &&
            tokens[state.index + 1]?.value === "["
        ) {
            state.index += 1;

            const attributes = readAttributes(tokens, state);

            context[`${keyword}Defaults`] = {
                ...context[`${keyword}Defaults`],
                ...attributes,
            };
            continue;
        }

        const firstEndpoint = readEndpoint(tokens, state);

        if (firstEndpoint === null) {
            state.index += 1;
            continue;
        }

        ensureNode(context, firstEndpoint);
        const chain = [];
        let previousEndpoint = firstEndpoint;

        while (tokens[state.index]?.type === "operator") {
            const operator = tokens[state.index].value;

            state.index += 1;

            const nextEndpoint = readEndpoint(tokens, state);

            if (nextEndpoint === null) {
                break;
            }

            ensureNode(context, nextEndpoint);
            chain.push({
                fromId: previousEndpoint,
                toId: nextEndpoint,
                directed: operator === "->",
            });
            previousEndpoint = nextEndpoint;
        }

        const attributes = readAttributes(tokens, state);

        if (chain.length === 0) {
            context.nodes.set(firstEndpoint, {
                ...ensureNode(context, firstEndpoint),
                ...attributes,
            });
            continue;
        }

        const mergedAttributes = {
            ...context.edgeDefaults,
            ...attributes,
        };

        for (const edge of chain) {
            context.rawEdges.push({
                ...edge,
                attributes: mergedAttributes,
            });
        }
    }
};

export const parseGraphFromDot = (text) => {
    const tokens = tokenizeDot(text);
    const state = { index: 0 };

    if (tokens[state.index]?.value.toLowerCase() === "strict") {
        state.index += 1;
    }

    const graphType = tokens[state.index]?.value.toLowerCase();

    if (graphType !== "graph" && graphType !== "digraph") {
        return createGraph();
    }

    const isDirectedGraph = graphType === "digraph";

    state.index += 1;

    while (
        state.index < tokens.length &&
        tokens[state.index].value !== "{"
    ) {
        state.index += 1;
    }

    if (tokens[state.index]?.value !== "{") {
        return createGraph();
    }

    state.index += 1;

    const context = {
        nodes: new Map(),
        rawEdges: [],
        graphDefaults: {},
        nodeDefaults: {},
        edgeDefaults: {},
    };

    parseStatementList(tokens, state, context);

    const dotIds = [...context.nodes.keys()];
    const appIdByDotId = new Map(
        dotIds.map((dotId, index) => [dotId, String(index + 1)]),
    );
    const vertexEntries = [...context.nodes].map(
        ([dotId, attributes], index) => ({
            id: String(index + 1),
            label: attributes.label ?? dotId,
            ...parsePosition(attributes.pos),
        }),
    );
    const vertices = placeMissingVertices(vertexEntries).map((vertex) =>
        createVertex(vertex.id, vertex.x, vertex.y, vertex.label),
    );
    const usedEdgeIds = new Set();
    const edges = [];
    let usedUndirected = false;

    for (const [index, rawEdge] of context.rawEdges.entries()) {
        const attributes = rawEdge.attributes;
        const direction = String(attributes.dir ?? "").toLowerCase();
        const directed =
            direction === "none"
                ? false
                : direction === "back" ||
                    direction === "forward" ||
                    direction === "both"
                  ? true
                  : rawEdge.directed;
        const fromId = appIdByDotId.get(
            direction === "back" ? rawEdge.toId : rawEdge.fromId,
        );
        const toId = appIdByDotId.get(
            direction === "back" ? rawEdge.fromId : rawEdge.toId,
        );

        if (!fromId || !toId) {
            continue;
        }

        const edgeId = createEdgeId(usedEdgeIds, index);

        usedEdgeIds.add(edgeId);

        if (!directed) {
            usedUndirected = true;
        }

        edges.push(
            createEdge(
                edgeId,
                fromId,
                toId,
                attributes.weight ?? 1,
                directed,
            ),
        );
    }

    const graphDirected = isDirectedGraph && !usedUndirected;

    return createGraph(vertices, edges, { directed: graphDirected });
};
