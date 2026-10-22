# Алгоритмы: контракт и пример

Алгоритм — обычный ES-модуль с чистой функцией `run`. Встроенные и пользовательские алгоритмы используют один контракт. Встроенные исполняются в главном потоке, пользовательские — в изолированном Worker.

## Файл алгоритма

Разрешены три формы экспорта:

```js
// 1
export const meta = { /* ... */ };
export function run(context) { /* ... */ }

// 2
export default function run(context) { /* ... */ }

// 3
export default { meta, run };
```

`run` может быть `async`; результат всё равно проверяется целиком.

## `meta`

| Поле | Тип | Обязательно | По умолчанию | Описание |
| --- | --- | --- | --- | --- |
| `id` | `string` | да | — | Уникальный id. У пользовательских нормализуется в `user:<slug>`; id встроенных зарезервированы. |
| `name` | `string` | да | — | Полное имя. |
| `shortName` | `string` | нет | `name` | Короткий код (например, `BFS`). |
| `description` | `string` | нет | — | Описание в одну строку. |
| `meta` | `string` | нет | — | Метка сложности, например `Очередь · O(V + E)`. |
| `requiresStartVertex` | `boolean` | нет | `true` | Нужна ли стартовая вершина. |
| `pseudocode` | `string[]` | нет | `[]` | Строки псевдокода; нумерация для `line` идёт с 1. Максимум 500 строк. |
| `params` | `object[]` | нет | — | Зарезервировано, в v1 в UI не показывается. |

## `run(context)`

```js
run({
    graph,          // GraphIndex (read-only)
    startVertexId,  // string | null
    params,         // Record<string, unknown>
    helpers,        // см. ниже
});
```

Контекст **не содержит** DOM, `window`, `state`, `setTimeout` и не позволяет менять граф. `graph` — это `GraphIndex` из `core/graph-index.js`:

```js
graph.vertexIds          // string[] в порядке графа
graph.vertexById         // Map<string, Vertex>
graph.edgeById           // Map<string, Edge>
graph.adjacency          // Map<string, string[]> — соседи
graph.incident           // Map<string, Edge[]>
graph.outgoing           // Map<string, Edge[]>
graph.incoming           // Map<string, Edge[]>
```

## Хелперы

```js
helpers.vertex(vertexId, { line?, tone?, message? }) // AlgorithmStep
helpers.edge(firstVertexId, secondVertexId, options?) // находит ребро и создаёт шаг
helpers.edgeById(edgeId, options?)
helpers.log(message, { line? })
helpers.degree(vertexId) // число соседей
```

`helpers.edge` и `helpers.edgeById` бросают `AlgorithmContractError`, если ребра нет.

## Результат

```js
{
    steps: AlgorithmStep[],   // обязателен, максимум 20 000
    visited?: string[],       // только существующие id вершин
    resultText?: string,      // до 5000 символов; если пусто — показываются `visited`
    stats?: Record<string, string | number>,
}
```

Результат должен быть сериализуемым (structured clone).

### Шаги

```js
{ type: "vertex", vertexId, line?, tone?, message? }
{ type: "edge",   edgeId,   line?, tone?, message? }
{ type: "log",    message,  line? }
```

- `line` — номер строки в `meta.pseudocode`, начиная с 1; должен попадать в диапазон, иначе ошибка контракта.
- `tone` ∈ `visited | active | path | rejected`:
  - `vertex` по умолчанию красит вершину как посещённую, `active` делает её текущей;
  - `edge` по умолчанию красит ребро как посещённое;
  - `log` добавляет запись в лог, не меняя цвета;
  - без `line` псевдокод не подсвечивается.

## Лимиты и ошибки

| Константа | Значение |
| --- | --- |
| `MAX_STEPS` | 2 000 000 |
| `MAX_LOG_MESSAGE_LENGTH` | 2 000 |
| `MAX_RESULT_TEXT_LENGTH` | 5 000 |
| `MAX_PSEUDOCODE_LINES` | 500 |

Ошибка запуска (`AlgorithmRunError`):

```js
{ code: "runtime" | "timeout" | "aborted" | "contract" | "import", message, stack?, path? }
```

`path` указывает на проблемное место, например `steps[3].vertexId`.

## Пример: «Листья»

```js
export const meta = {
    id: "leaves",
    name: "Листья",
    shortName: "LEAVES",
    description: "Вершины степени 1",
    meta: "Степень · O(V + E)",
    requiresStartVertex: false,
    pseudocode: [
        "function leaves(graph):",
        "  for v in graph.vertexIds:",
        "    if degree(v) == 1:",
        "      посетить v",
        "  return leaves",
    ],
};

export function run({ graph, helpers }) {
    const steps = [];
    const leaves = [];

    for (const vertexId of graph.vertexIds) {
        if ((graph.adjacency.get(vertexId) ?? []).length === 1) {
            leaves.push(vertexId);
            steps.push(helpers.vertex(vertexId, { line: 4 }));
        }
    }

    return {
        steps,
        visited: leaves,
        resultText: leaves.length
            ? leaves.map((id) => graph.vertexById.get(id).label).join(" → ")
            : "Листьев нет",
    };
}
```

## Реестр

```js
import {
    algorithmRegistry,
    createAlgorithmRegistry,
} from "./registry.js";

algorithmRegistry.register(
    { meta, run },
    { source: "builtin" },
);
```

`register(descriptor, { source, replace, contractVersion })` нормализует дескриптор и бросает `AlgorithmContractError` при нарушении контракта. Дескриптор после нормализации:

```js
{ id, contractVersion, source, meta, run }        // встроенный
{ id, contractVersion, source, meta, code }       // пользовательский: code — текст модуля
```

API реестра: `register`, `get(id)`, `list()`, `has(id)`, `remove(id)`, `subscribe(listener) → unsubscribe`.

## Правила

1. `run` — детерминированная чистая функция: она читает граф и возвращает шаги.
2. Нельзя менять граф, обращаться к DOM, таймерам и `window`.
3. Для пользовательских модулей код верхнего уровня тоже выполняется при импорте, поэтому держите все побочные эффекты внутри `run`.
4. Часть модуля может использовать `helpers.vertex`, `helpers.edge` и `graph.adjacency` — граф передаётся как `GraphIndex`, построенный из исходного объекта, и автоматически не переиспользуется между запусками.
5. Добавление встроенного алгоритма: новый файл в `algorithms/builtins/` и регистрация в `algorithms/builtins/index.js`. Правки `index.html`, `features/algorithms/` и `ui/workspace.js` не нужны.

## Где что исполняется

```mermaid
flowchart LR
    subgraph main["Главный поток"]
        controller --> runner
        runner -->|встроенный| run["descriptor.run(context)"]
    end
    subgraph worker["Web Worker (пользовательский)"]
        runner2["algorithms/runtime/runner"] -->|postMessage| worker["algorithms/runtime/worker"]
        worker -->|Blob + import| module["модуль пользователя"]
        module --> run2["run(context)"]
    end
```

Пользовательский код идёт только через Worker: создаётся на каждый запуск, получает снимок графа, ограничен таймаутом 10000 мс и уничтожается после результата, ошибки или отмены. Отмена — через `AbortController` и `worker.terminate()`.
