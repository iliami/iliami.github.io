import { createSvgElement } from "../../app/dom.js";

export const EMPTY_RESULT_TEXT =
    "Запустите алгоритм, чтобы увидеть результат.";

const createChevron = () => {
    const svg = createSvgElement("svg", {
        class: "chevron",
        viewBox: "0 0 24 24",
        fill: "none",
        "aria-hidden": "true",
    });

    svg.append(
        createSvgElement("path", {
            d: "m9 6 6 6-6 6",
            stroke: "currentColor",
            "stroke-width": 1.8,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
        }),
    );

    return svg;
};

const createAlgorithmItem = (descriptor) => {
    const { id, source, meta } = descriptor;
    const { name, shortName, description } = meta;
    const code = shortName ?? name;

    const root = document.createElement("div");
    root.className = "algorithm_item";
    root.dataset.algorithm = id;
    root.dataset.generated = "true";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "algorithm_header";
    header.dataset.algorithmToggle = id;
    header.setAttribute("aria-expanded", "false");
    header.setAttribute("aria-controls", `algo_body_${id}`);

    const nameElement = document.createElement("span");
    nameElement.className = "algorithm_name";
    nameElement.append(document.createTextNode(name));

    const codeElement = document.createElement("span");
    codeElement.className = "algo_code";
    codeElement.textContent = code;
    nameElement.append(codeElement);

    if (source === "user") {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "мой";
        nameElement.append(badge);
    }

    const metaElement = document.createElement("span");
    metaElement.className = "algorithm_meta";
    metaElement.textContent = meta.meta ?? description ?? "";

    header.append(nameElement, metaElement, createChevron());

    const detail = document.createElement("div");
    detail.className = "algorithm_detail";
    detail.id = `algo_body_${id}`;
    detail.hidden = true;

    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.className = "btn btn_primary btn_small";
    startButton.dataset.algorithmStart = id;
    startButton.textContent = `Запустить ${code}`;
    startButton.disabled = true;

    const resultElement = document.createElement("p");
    resultElement.className = "result_text";
    resultElement.dataset.algorithmResult = id;
    resultElement.textContent = EMPTY_RESULT_TEXT;

    detail.append(startButton, resultElement);
    root.append(header, detail);

    return {
        descriptor,
        root,
        header,
        detail,
        startButton,
        resultElement,
    };
};

export const createAlgorithmListView = ({ container, onStart = () => {} }) => {
    if (!container) {
        throw new Error("Для списка алгоритмов нужен контейнер");
    }

    const items = new Map();

    let openId = null;
    let availabilityPredicate = () => true;

    const applyOpenState = () => {
        for (const [id, item] of items) {
            const isOpen = id === openId;

            item.root.classList.toggle("is_open", isOpen);
            item.header.setAttribute("aria-expanded", String(isOpen));
            item.detail.hidden = !isOpen;
        }
    };

    const setOpen = (id) => {
        openId = id;
        applyOpenState();
    };

    const toggle = (id) => {
        setOpen(openId === id ? null : id);
    };

    const applyAvailability = () => {
        for (const item of items.values()) {
            item.startButton.disabled = !availabilityPredicate(item.descriptor);
        }
    };

    container.addEventListener("click", (event) => {
        const startTrigger = event.target.closest("[data-algorithm-start]");

        if (startTrigger && container.contains(startTrigger)) {
            event.preventDefault();
            onStart(startTrigger.dataset.algorithmStart);
            return;
        }

        const toggleTrigger = event.target.closest("[data-algorithm-toggle]");

        if (toggleTrigger && container.contains(toggleTrigger)) {
            toggle(toggleTrigger.dataset.algorithmToggle);
        }
    });

    const render = (algorithms) => {
        for (const item of items.values()) {
            item.root.remove();
        }

        items.clear();

        const fragment = document.createDocumentFragment();

        for (const descriptor of algorithms) {
            const item = createAlgorithmItem(descriptor);

            items.set(descriptor.id, item);
            fragment.append(item.root);
        }

        container.prepend(fragment);

        if (openId !== null && !items.has(openId)) {
            openId = null;
        }

        if (openId === null && algorithms.length > 0) {
            openId = algorithms[0].id;
        }

        applyOpenState();
        applyAvailability();
    };

    return {
        render,

        setAvailability(predicate) {
            availabilityPredicate = predicate ?? (() => true);
            applyAvailability();
        },

        open(id) {
            if (items.has(id)) {
                setOpen(id);
            }
        },

        setResult(id, text) {
            const item = items.get(id);

            if (item) {
                item.resultElement.textContent = text;
            }
        },

        resetResults(text = EMPTY_RESULT_TEXT) {
            for (const item of items.values()) {
                item.resultElement.textContent = text;
            }
        },

        getResultElement(id) {
            return items.get(id)?.resultElement ?? null;
        },

        getDescriptor(id) {
            return items.get(id)?.descriptor ?? null;
        },
    };
};
