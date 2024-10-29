//#region TIME

const ms = 400;
let sleepTime = ms;

//#endregion TIME

//#region SVG

const ns = "http://www.w3.org/2000/svg";

const svg = document.getElementById("canvas");
const svgCoords = svg.getBoundingClientRect();
svg.addEventListener("click", handleClickOnCanvas);
svg.addEventListener("mousemove", handleMouseMoveVertexOnCanvas);

//#endregion SVG

//#region MODE

const modes = {
    default: 1,
    vertex: 2,
    edge: 3,
};

const defaultMode = document.getElementById("default");
defaultMode.addEventListener("click", handleClickOnRadioButton_ChangeMode);

const vertexMode = document.getElementById("vertex");
vertexMode.addEventListener("click", handleClickOnRadioButton_ChangeMode);

const edgeMode = document.getElementById("edge");
edgeMode.addEventListener("click", handleClickOnRadioButton_ChangeMode);

//#endregion MODE

//#region MODAL WINDOW
const modal = document.querySelector("dialog");
const modalBox = document.getElementById("graph_info_modal_box");
const modalContent = document.getElementById("graph_info_modal_content");
const showGraphInfoModalBtn = document.getElementById("show_graph_info_modal");
const closeGraphInfoModalBtn = document.getElementById(
    "close_graph_info_modal"
);

const getGraphInfoAsString = () => {
    if (vertexes.length > 0) {
        let adjMatrixStr = "Матрица смежности:<br>";
        for (let i = 0; i < vertexes.length; i++) {
            adjMatrixStr += adjacencyMatrix[i].join(", ") + ",<br>";
        }

        let adjListStr = "Список смежности:<br>";
        for (let i = 0; i < vertexes.length; i++) {
            const adjList = adjacencyList[i].map((x) => x + 1);
            adjListStr += i + 1 + ": [" + adjList.join(", ") + "]<br>";
        }

        return `<div style="padding: 10px;">${adjMatrixStr}</div><div style="padding: 10px;">${adjListStr}</div>`;
    } else {
        return "Нет графа";
    }
};

let isModalOpen = false;

showGraphInfoModalBtn.addEventListener("click", (e) => {
    modal.showModal();
    isModalOpen = true;
    e.stopPropagation();
    modalContent.innerHTML = getGraphInfoAsString();
});

closeGraphInfoModalBtn.addEventListener("click", () => {
    modal.close();
    isModalOpen = false;
});

document.addEventListener("click", (e) => {
    if (isModalOpen && !modalBox.contains(e.target)) {
        modal.close();
    }
});
//#endregion MODAL WINDOW

//#region BFS AND DFS
const selectorVertexNumber = document.getElementById("vertex_num");
selectorVertexNumber.addEventListener(
    "change",
    handleChangeOnSelectorVertexNumber
);

//#region BFS

const BFS_with_colors = (graph, node) => {
    blockControls();

    const vertex = vertexes[node];
    const circle = vertex.element.children[0];
    setTimeout(() => circle.setAttribute("fill", "#a30559"), sleepTime);
    sleepTime += ms;

    const visited = [node];
    const queue = [node];

    while (queue.length > 0) {
        const curNode = queue.shift();
        graph[curNode]
            .filter((nextNode) => !visited.includes(nextNode))
            .map((nextNode) => {
                visited.push(nextNode);
                queue.push(nextNode);

                //#region
                const nextVertex = vertexes[nextNode];
                const circle = nextVertex.element.children[0];

                const curVertex = vertexes[curNode];
                const edge = edges.find(
                    (_e) =>
                        (_e.firstVertex.name === curVertex.name &&
                            _e.secondVertex.name === nextVertex.name) ||
                        (_e.firstVertex.name === nextVertex.name &&
                            _e.secondVertex.name === curVertex.name)
                );
                const line = edge.element.children[0];

                setTimeout(
                    () => line.setAttribute("stroke", "#999fa8"),
                    sleepTime
                );
                sleepTime += ms;

                setTimeout(
                    () => circle.setAttribute("fill", "#a30559"),
                    sleepTime
                );
                sleepTime += ms;
                //#endregion
            });
    }

    setTimeout(unblockControls, sleepTime);

    sleepTime = ms;

    return visited;
};

const btnStartBFS = document.getElementById("BFS_start");
btnStartBFS.addEventListener("click", handleClickOnButtonStartBFS);

const textResultBFS = document.getElementById("BFS_result");

//#endregion BFS

//#region DFS

const DFS_with_colors = (graph, node) => {
    blockControls();

    function DFS(graph, node, prevNode, visited) {
        if (!visited.includes(node)) {
            visited.push(node);

            //#region
            const vertex = vertexes[node];
            const circle = vertex.element.children[0];

            if (prevNode != null) {
                const prevVertex = vertexes[prevNode];
                const edge = edges.find(
                    (_e) =>
                        (_e.firstVertex.name === prevVertex.name &&
                            _e.secondVertex.name === vertex.name) ||
                        (_e.firstVertex.name === vertex.name &&
                            _e.secondVertex.name === prevVertex.name)
                );
                const line = edge.element.children[0];

                setTimeout(
                    () => line.setAttribute("stroke", "#999fa8"),
                    sleepTime
                );
                sleepTime += ms;
            }

            setTimeout(() => circle.setAttribute("fill", "#a30559"), sleepTime);
            sleepTime += ms;
            //#endregion

            for (const n of graph[node].toReversed()) {
                DFS(graph, n, node, visited);
                sleepTime += ms;
            }
        }

        if (prevNode == null) {
            setTimeout(unblockControls, sleepTime);
            sleepTime = ms;
        }

        return visited;
    }
    return DFS(graph, node, null, []);
};

const btnStartDFS = document.getElementById("DFS_start");
btnStartDFS.addEventListener("click", handleClickOnButtonStartDFS);

const textResultDFS = document.getElementById("DFS_result");

//#endregion DFS

//#endregion BFS AND DFS

//#region SOMETHING

//#region RETURN DEFAULT COLORS

const returnDefaultColorsButton = document.getElementById("default_colors");
returnDefaultColorsButton.addEventListener(
    "click",
    handleClickOnButtonReturnDefaultColors
);

const returnDefaultColors = () => {
    for (const _v of vertexes) {
        const circle = _v.element.children[0];
        circle.setAttribute("fill", "#8000FF");
    }
    for (const _e of edges) {
        const line = _e.element.children[0];
        line.setAttribute("stroke", "black");
    }
};

//#endregion RETURN DEFAULT COLORS

//#region IMPORT & EXPORT

const downloadGraphButton = document.getElementById("download_graph");
downloadGraphButton.download = "graph.graph";
downloadGraphButton.addEventListener("click", handleClickOnDownloadGraphButton);

const uploadGraphInput = document.getElementById("upload_graph");
uploadGraphInput.addEventListener("change", handleChangeOnUploadGraphInput);

//#endregion IMPORT & EXPORT

const clear = () => {
    while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
    }
    while (vertexes.length > 0) {
        vertexes.pop();
    }
    while (edges.length > 0) {
        edges.pop();
    }
    while (adjacencyList.length > 0) {
        adjacencyList.pop();
    }
    while (adjacencyMatrix.length > 0) {
        adjacencyMatrix.pop();
    }
};

const blockControls = () => {
    defaultMode.setAttribute("disabled", "disabled");
    vertexMode.setAttribute("disabled", "disabled");
    edgeMode.setAttribute("disabled", "disabled");
    showGraphInfoModalBtn.setAttribute("disabled", "disabled");
    closeGraphInfoModalBtn.setAttribute("disabled", "disabled");
    selectorVertexNumber.setAttribute("disabled", "disabled");
    btnStartBFS.setAttribute("disabled", "disabled");
    btnStartDFS.setAttribute("disabled", "disabled");
    returnDefaultColorsButton.setAttribute("disabled", "disabled");
    uploadGraphInput.setAttribute("disabled", "disabled");
};

const unblockControls = () => {
    defaultMode.removeAttribute("disabled");
    vertexMode.removeAttribute("disabled");
    edgeMode.removeAttribute("disabled");
    showGraphInfoModalBtn.removeAttribute("disabled");
    closeGraphInfoModalBtn.removeAttribute("disabled");
    selectorVertexNumber.removeAttribute("disabled");
    btnStartBFS.removeAttribute("disabled");
    btnStartDFS.removeAttribute("disabled");
    returnDefaultColorsButton.removeAttribute("disabled");
    uploadGraphInput.removeAttribute("disabled");
};

const vertexes = [];
const edges = [];
const adjacencyMatrix = [];
const adjacencyList = [];
let mode = 1;
let selectedVertex = null;
let selectedVertexNumber = 1;

//#endregion SOMETHING

function handleClickOnCanvas(e) {
    if (mode === 2) {
        const vertexName = `${vertexes.length + 1}`;
        const r = 20;
        const cx = e.clientX - svgCoords.left;
        const cy = e.clientY - svgCoords.top;

        const g = document.createElementNS(ns, "g");
        const circle = document.createElementNS(ns, "circle");
        const text = document.createElementNS(ns, "text");

        g.setAttribute("id", vertexName);
        g.addEventListener("click", handleClickOnVertex);
        g.addEventListener("mousedown", handleMouseDownOnVertex);
        g.addEventListener("mouseup", handleMouseUpOnVertex);

        circle.setAttribute("r", r);
        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", cy);
        circle.setAttribute("fill", "#8000FF");
        circle.setAttribute("id", vertexName);

        text.setAttribute("x", cx);
        text.setAttribute("y", cy);
        text.setAttribute("dy", ".3em");
        text.setAttribute("fill", "#ffff00");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("id", vertexName);
        text.append(vertexName);

        g.append(circle);
        g.append(text);
        svg.append(g);

        vertexes.push({
            name: vertexName,
            x: cx,
            y: cy,
            element: g,
        });

        const newSelectorVertexNumberOption = document.createElement("option");

        newSelectorVertexNumberOption.setAttribute("id", vertexes.length);
        newSelectorVertexNumberOption.setAttribute("value", vertexes.length);
        newSelectorVertexNumberOption.append(vertexes.length);

        selectorVertexNumber.append(newSelectorVertexNumberOption);

        btnStartBFS.removeAttribute("disabled");
        btnStartDFS.removeAttribute("disabled");

        adjacencyList.push([]);

        adjacencyMatrix.push(Array(vertexes.length).fill(0));
        for (let i = 0; i < vertexes.length - 1; i++) {
            adjacencyMatrix[i].push(0);
        }
    }
}

function handleClickOnVertex(e) {
    if (mode === 3) {
        if (!selectedVertex) {
            selectedVertex = vertexes.find((v) => v.name == e.target.id);
            const circle = selectedVertex.element.children[0];
            circle.setAttribute("fill", "#3e017a");
        } else {
            const selectedSecondVertex = vertexes.find(
                (v) => v.name == e.target.id
            );

            const circle = selectedVertex.element.children[0];
            circle.setAttribute("fill", "#8000FF");

            if (selectedVertex.name === selectedSecondVertex.name) {
                selectedVertex = null;
                return;
            }

            const _edges = edges.filter(
                (_e) =>
                    _e.firstVertex.name === selectedVertex.name ||
                    _e.secondVertex.name === selectedVertex.name
            );

            for (const _e of _edges) {
                if (
                    selectedVertex.name === _e.firstVertex.name &&
                    selectedSecondVertex.name === _e.secondVertex.name
                ) {
                    selectedVertex = null;
                    return;
                } else if (
                    selectedSecondVertex.name === _e.firstVertex.name &&
                    selectedVertex.name === _e.secondVertex.name
                ) {
                    selectedVertex = null;
                    return;
                }
            }

            const edgeName = `${100000 + (edges.length + 1)}`;

            const g = document.createElementNS(ns, "g");
            const line = document.createElementNS(ns, "line");

            g.setAttribute("id", edgeName);

            line.setAttribute("x1", selectedVertex.x);
            line.setAttribute("y1", selectedVertex.y);
            line.setAttribute("x2", selectedSecondVertex.x);
            line.setAttribute("y2", selectedSecondVertex.y);
            line.setAttribute("stroke", "black");
            line.setAttribute("stroke-width", 4);
            line.setAttribute("id", edgeName);

            g.append(line);

            selectedVertex.element.remove();
            selectedSecondVertex.element.remove();
            svg.append(g);
            svg.append(selectedVertex.element);
            svg.append(selectedSecondVertex.element);

            edges.push({
                firstVertex: selectedVertex,
                secondVertex: selectedSecondVertex,
                element: g,
            });

            const i = Number(selectedVertex.name) - 1;
            const j = Number(selectedSecondVertex.name) - 1;

            adjacencyList[i].push(j);
            adjacencyList[i].sort((a, b) => a - b);
            adjacencyList[j].push(i);
            adjacencyList[j].sort((a, b) => a - b);

            adjacencyMatrix[i][j] = 1;
            adjacencyMatrix[j][i] = 1;

            selectedVertex = null;
        }
    }
}

function handleMouseDownOnVertex(e) {
    if (mode === 1) {
        selectedVertex = vertexes.find((v) => v.name == e.target.id);
        const circle = selectedVertex.element.children[0];
        circle.setAttribute("fill", "#3e017a");
    }
}

function handleMouseUpOnVertex(e) {
    if (mode === 1) {
        const circle = selectedVertex.element.children[0];
        circle.setAttribute("fill", "#8000FF");
        selectedVertex = null;
    }
}

function handleMouseMoveVertexOnCanvas(e) {
    if (mode === 1) {
        if (selectedVertex) {
            const newCoords = {
                x: e.clientX - svgCoords.left,
                y: e.clientY - svgCoords.top,
            };

            const _edges = edges.filter(
                (_e) =>
                    _e.firstVertex.name === selectedVertex.name ||
                    _e.secondVertex.name === selectedVertex.name
            );

            for (const _e of _edges) {
                const line = _e.element.children[0];
                if (selectedVertex.name === _e.firstVertex.name) {
                    line.setAttribute("x1", newCoords.x);
                    line.setAttribute("y1", newCoords.y);
                } else {
                    line.setAttribute("x2", newCoords.x);
                    line.setAttribute("y2", newCoords.y);
                }
            }

            selectedVertex.x = newCoords.x;
            selectedVertex.y = newCoords.y;

            const circle = selectedVertex.element.children[0];
            circle.setAttribute("cx", newCoords.x);
            circle.setAttribute("cy", newCoords.y);

            const text = selectedVertex.element.children[1];
            text.setAttribute("x", newCoords.x);
            text.setAttribute("y", newCoords.y);
        }
    }
}

function handleClickOnRadioButton_ChangeMode(e) {
    selectedVertex = null;
    mode = modes[e.target.id];
}

function handleChangeOnSelectorVertexNumber(e) {
    selectedVertexNumber = this.options[this.selectedIndex].value;
}

function handleClickOnButtonStartDFS(ev) {
    returnDefaultColors();
    const visited = DFS_with_colors(adjacencyList, selectedVertexNumber - 1);
    textResultDFS.innerHTML = visited.map((v) => v + 1).join(", ");
}

function handleClickOnButtonStartBFS(ev) {
    returnDefaultColors();
    const visited = BFS_with_colors(adjacencyList, selectedVertexNumber - 1);
    textResultBFS.innerHTML = visited.map((v) => v + 1).join(", ");
}

function handleClickOnButtonReturnDefaultColors(e) {
    returnDefaultColors();
    returnDefaultColorsButton.setAttribute("disabled", "disabled");
}

function handleClickOnDownloadGraphButton(e) {
    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(svg);
    var data = new Blob([svgString], { type: "text/xml" });
    e.target.href = window.URL.createObjectURL(data);
}

function handleChangeOnUploadGraphInput(e) {
    const file = uploadGraphInput.files[0];
    const reader = new FileReader();

    reader.readAsText(file);

    reader.onload = () => {
        clear();

        const graph = new DOMParser().parseFromString(reader.result, "text/xml")
            .children[0];

        // SVG append
        while (graph.firstChild) {
            const g = graph.removeChild(graph.firstChild);
            svg.append(g);
        }

        const svgElements = svg.children;

        // Vertexes
        for (const g of svgElements) {
            if (g.id - 100000 < 0) {
                g.addEventListener("click", handleClickOnVertex);
                g.addEventListener("mousedown", handleMouseDownOnVertex);
                g.addEventListener("mouseup", handleMouseUpOnVertex);

                const circle = g.children[0];
                circle.setAttribute("fill", "#8000FF");
                vertexes.push({
                    name: g.getAttribute("id"),
                    x: circle.getAttribute("cx"),
                    y: circle.getAttribute("cy"),
                    element: g,
                });

                const newSelectorVertexNumberOption =
                    document.createElement("option");

                newSelectorVertexNumberOption.setAttribute(
                    "id",
                    vertexes.length
                );
                newSelectorVertexNumberOption.setAttribute(
                    "value",
                    vertexes.length
                );
                newSelectorVertexNumberOption.append(vertexes.length);

                selectorVertexNumber.append(newSelectorVertexNumberOption);

                btnStartBFS.removeAttribute("disabled");
                btnStartDFS.removeAttribute("disabled");

                adjacencyList.push([]);

                adjacencyMatrix.push(Array(vertexes.length).fill(0));
                for (let i = 0; i < vertexes.length - 1; i++) {
                    adjacencyMatrix[i].push(0);
                }
            }
        }
        vertexes.sort((a, b) => a.name - b.name);

        // Edges
        for (const g of svgElements) {
            if (g.id - 100000 > 0) {
                const line = g.children[0];
                line.setAttribute("stroke", "black");

                const firstVertexCoords = {
                    x: line.getAttribute("x1"),
                    y: line.getAttribute("y1"),
                };
                const secondVertexCoords = {
                    x: line.getAttribute("x2"),
                    y: line.getAttribute("y2"),
                };

                const firstVertex = vertexes.find(
                    (v) =>
                        v.x == firstVertexCoords.x && v.y == firstVertexCoords.y
                );
                const secondVertex = vertexes.find(
                    (v) =>
                        v.x == secondVertexCoords.x &&
                        v.y == secondVertexCoords.y
                );

                edges.push({
                    firstVertex: firstVertex,
                    secondVertex: secondVertex,
                    element: g,
                });

                const i = Number(firstVertex.name) - 1;
                const j = Number(secondVertex.name) - 1;

                adjacencyList[i].push(j);
                adjacencyList[i].sort((a, b) => a - b);
                adjacencyList[j].push(i);
                adjacencyList[j].sort((a, b) => a - b);

                adjacencyMatrix[i][j] = 1;
                adjacencyMatrix[j][i] = 1;

                selectedVertex = null;
            }
        }
    };
}
