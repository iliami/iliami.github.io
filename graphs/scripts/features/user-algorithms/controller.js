import { $ } from "../../app/dom.js";
import { updateAppStatus } from "../../app/state.js";
import { formatError } from "../../app/utils.js";
import {
    algorithmRegistry,
    normalizeAlgorithmMeta,
} from "../../algorithms/registry.js";
import {
    inspectUserAlgorithm,
    requestAlgorithmRun,
} from "../algorithms/controller.js";
import { createUserAlgorithmListView } from "./list-view.js";
import {
    DEFAULT_USER_ALGORITHM_SOURCE,
    createUserAlgorithmDescriptor,
    createUserAlgorithmRecord,
    ensureUserCodeConsent,
    getLocalStorage,
    loadUserAlgorithmRecords,
    removeUserAlgorithmRecord,
    saveUserAlgorithmRecords,
    slugifyUserAlgorithmId,
    upsertUserAlgorithmRecord,
} from "./repository.js";

const listElement = $("user_algorithm_list");
const addButton = $("user_algorithm_add");

const dialog = $("user_algorithm_dialog");
const form = $("user_algorithm_form");
const titleElement = $("user_algorithm_title");
const nameInput = $("user_algorithm_name");
const shortNameInput = $("user_algorithm_short_name");
const metaInput = $("user_algorithm_meta");
const descriptionInput = $("user_algorithm_description");
const requiresStartInput = $("user_algorithm_requires_start");
const pseudocodeInput = $("user_algorithm_pseudocode");
const sourceInput = $("user_algorithm_source");
const errorElement = $("user_algorithm_error");

const importButton = $("user_algorithm_import");
const exportButton = $("user_algorithm_export");
const deleteButton = $("user_algorithm_delete");
const validateButton = $("user_algorithm_validate");
const saveButton = $("user_algorithm_save");
const cancelButton = $("user_algorithm_cancel");
const runButton = $("user_algorithm_run");
const fileInput = $("user_algorithm_file");

let records = [];
let errors = [];
let editingId = null;
let initialized = false;

const clearError = () => {
    if (errorElement) {
        errorElement.textContent = "";
        errorElement.hidden = true;
    }
};

const showError = (message) => {
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.hidden = false;
    }
};

const readPseudocode = () => {
    const lines = pseudocodeInput.value.split(/\r?\n/);

    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
        lines.pop();
    }

    return lines;
};

const buildMetaFromForm = () =>
    normalizeAlgorithmMeta({
        id: editingId ?? "user:placeholder",
        name: nameInput.value,
        shortName: shortNameInput.value || undefined,
        description: descriptionInput.value || undefined,
        meta: metaInput.value || undefined,
        requiresStartVertex: requiresStartInput.checked,
        pseudocode: readPseudocode(),
    });

const buildUniqueId = (name) => {
    const base = slugifyUserAlgorithmId(name);
    const taken = new Set(records.map((record) => record.id));
    let candidate = `user:${base}`;
    let index = 2;

    while (taken.has(candidate)) {
        candidate = `user:${base}-${index}`;
        index += 1;
    }

    return candidate;
};

const registerRecord = (record) => {
    try {
        algorithmRegistry.register(createUserAlgorithmDescriptor(record), {
            source: "user",
            replace: true,
        });
    } catch (error) {
        updateAppStatus(
            `Не удалось зарегистрировать алгоритм: ${formatError(error)}`,
        );
    }
};

const listView = createUserAlgorithmListView({
    container: listElement,
    onAction: (action, id) => handleAction(action, id),
});

const renderRows = () => {
    listView.render(records, errors);
};

const openEditor = (id) => {
    clearError();

    const record = id ? records.find((candidate) => candidate.id === id) : null;

    editingId = record?.id ?? null;

    titleElement.textContent = record
        ? "Изменить алгоритм"
        : "Новый алгоритм";
    nameInput.value = record?.meta.name ?? "";
    shortNameInput.value = record?.meta.shortName ?? "";
    metaInput.value = record?.meta.meta ?? "";
    descriptionInput.value = record?.meta.description ?? "";
    requiresStartInput.checked = record
        ? record.meta.requiresStartVertex !== false
        : true;
    pseudocodeInput.value = (record?.meta.pseudocode ?? []).join("\n");
    sourceInput.value = record?.source ?? DEFAULT_USER_ALGORITHM_SOURCE;

    deleteButton.disabled = record === null;

    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    } else {
        dialog.setAttribute("open", "");
        dialog.open = true;
    }
};

const closeEditor = () => {
    clearError();
    editingId = null;

    if (typeof dialog.close === "function") {
        dialog.close();
    } else {
        dialog.removeAttribute("open");
        dialog.open = false;
    }
};

const saveRecord = () => {
    clearError();

    let meta;

    try {
        meta = buildMetaFromForm();
    } catch (error) {
        showError(formatError(error));
        return null;
    }

    const source = sourceInput.value;

    if (source.trim().length === 0) {
        showError("Поле «Код» не может быть пустым");
        return null;
    }

    if (!ensureUserCodeConsent()) {
        showError("Сохранение пользовательского кода отменено");
        return null;
    }

    const existing = editingId
        ? records.find((record) => record.id === editingId)
        : null;

    const id = existing ? existing.id : buildUniqueId(meta.name);

    let record;

    try {
        record = createUserAlgorithmRecord({
            id,
            meta,
            source,
            createdAt: existing?.createdAt,
            updatedAt: Date.now(),
        });
    } catch (error) {
        showError(formatError(error));
        return null;
    }

    const nextRecords = upsertUserAlgorithmRecord(records, record);

    try {
        saveUserAlgorithmRecords(getLocalStorage(), nextRecords);
    } catch (error) {
        showError(formatError(error));
        return null;
    }

    records = nextRecords;
    editingId = id;

    registerRecord(record);
    renderRows();
    updateAppStatus(`Сохранено: ${record.meta.name}`);

    return id;
};

const deleteRecord = (id) => {
    const record = records.find((candidate) => candidate.id === id);

    if (!record) {
        return;
    }

    const confirmFn = globalThis.confirm;

    if (
        typeof confirmFn === "function" &&
        !confirmFn(`Удалить алгоритм «${record.meta.name}»?`)
    ) {
        return;
    }

    const nextRecords = removeUserAlgorithmRecord(records, id);

    try {
        saveUserAlgorithmRecords(getLocalStorage(), nextRecords);
    } catch (error) {
        showError(formatError(error));
        return;
    }

    records = nextRecords;

    algorithmRegistry.remove(id);

    if (editingId === id) {
        closeEditor();
    }

    renderRows();
    updateAppStatus(`Удалён алгоритм: ${record.meta.name}`);
};

const runRecord = (id) => {
    if (!records.some((record) => record.id === id)) {
        return;
    }

    requestAlgorithmRun(id);
};

const downloadSource = (name, source) => {
    const blob = new Blob([source], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${slugifyUserAlgorithmId(name)}.js`;

    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const handleValidate = async () => {
    clearError();

    try {
        buildMetaFromForm();
    } catch (error) {
        showError(formatError(error));
        return;
    }

    if (sourceInput.value.trim().length === 0) {
        showError("Поле «Код» не может быть пустым");
        return;
    }

    if (!ensureUserCodeConsent()) {
        showError("Проверка пользовательского кода отменена");
        return;
    }

    updateAppStatus("Проверка модуля…");

    try {
        await inspectUserAlgorithm(sourceInput.value);
        updateAppStatus("Модуль корректен");
    } catch (error) {
        showError(formatError(error));
        updateAppStatus(`Ошибка проверки: ${formatError(error)}`);
    }
};

const handleImportFile = (file) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
        const text = String(reader.result);
        sourceInput.value = text;

        if (nameInput.value.trim().length === 0) {
            const base = file.name
                .replace(/\.[^.]+$/, "")
                .replace(/[-_]+/g, " ");
            nameInput.value = base;
        }

        updateAppStatus(`Импортирован файл: ${file.name}`);
    });

    reader.readAsText(file);
};

const handleAction = (action, id) => {
    if (action === "run") {
        runRecord(id);
    } else if (action === "edit") {
        openEditor(id);
    } else if (action === "delete") {
        deleteRecord(id);
    }
};

export const initUserAlgorithms = () => {
    if (initialized || !listElement || !dialog || !form) {
        return;
    }

    initialized = true;

    addButton?.addEventListener("click", () => openEditor(null));

    cancelButton?.addEventListener("click", () => closeEditor());

    saveButton?.addEventListener("click", () => {
        if (saveRecord()) {
            closeEditor();
        }
    });

    runButton?.addEventListener("click", () => {
        const id = saveRecord();

        if (id) {
            closeEditor();
            runRecord(id);
        }
    });

    validateButton?.addEventListener("click", () => {
        handleValidate();
    });

    deleteButton?.addEventListener("click", () => {
        if (editingId) {
            deleteRecord(editingId);
        }
    });

    exportButton?.addEventListener("click", () => {
        downloadSource(nameInput.value || "algorithm", sourceInput.value);
    });

    importButton?.addEventListener("click", () => fileInput?.click());

    fileInput?.addEventListener("change", (event) => {
        const file = event.currentTarget.files?.[0];

        if (file) {
            handleImportFile(file);
        }

        event.currentTarget.value = "";
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
    });

    dialog.addEventListener("close", () => {
        clearError();
        editingId = null;
    });

    const loaded = loadUserAlgorithmRecords(getLocalStorage());

    records = loaded.records;
    errors = loaded.errors;

    for (const record of records) {
        registerRecord(record);
    }

    renderRows();

    if (errors.length > 0) {
        updateAppStatus(`Повреждённых записей: ${errors.length}`);
    }
};
