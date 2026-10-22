const createActionButton = (label, action, id, className) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.dataset.userAction = action;
    button.dataset.userId = id;

    return button;
};

const createRow = (record) => {
    const row = document.createElement("div");
    row.className = "user_algorithm_row";
    row.dataset.userId = record.id;

    const head = document.createElement("div");
    head.className = "user_algorithm_row_head";

    const name = document.createElement("span");
    name.className = "user_algorithm_row_name";
    name.textContent = record.meta.name;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "мой";

    head.append(name, badge);

    const meta = document.createElement("span");
    meta.className = "user_algorithm_row_meta";
    meta.textContent = record.meta.meta ?? record.meta.description ?? "";

    const actions = document.createElement("div");
    actions.className = "user_algorithm_actions";
    actions.append(
        createActionButton(
            "Запустить",
            "run",
            record.id,
            "btn btn_primary btn_small",
        ),
        createActionButton("Изменить", "edit", record.id, "btn btn_small"),
        createActionButton("Удалить", "delete", record.id, "btn btn_small"),
    );

    row.append(head, meta, actions);

    return row;
};

const createErrorRow = (error) => {
    const row = document.createElement("div");
    row.className = "user_algorithm_row is_error";

    const name = document.createElement("span");
    name.className = "user_algorithm_row_name";
    name.textContent = "Ошибка";

    const message = document.createElement("span");
    message.className = "user_algorithm_row_meta";
    message.textContent = error.message;

    row.append(name, message);

    return row;
};

export const createUserAlgorithmListView = ({ container, onAction }) => {
    container.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-user-action]");

        if (!trigger || !container.contains(trigger)) {
            return;
        }

        const { userAction, userId } = trigger.dataset;
        onAction(userAction, userId);
    });

    const render = (records, errors) => {
        container.replaceChildren();

        if (records.length === 0 && errors.length === 0) {
            const empty = document.createElement("p");
            empty.className = "user_algorithm_empty";
            empty.textContent = "Пока нет своих алгоритмов";
            container.append(empty);
            return;
        }

        const fragment = document.createDocumentFragment();

        for (const record of records) {
            fragment.append(createRow(record));
        }

        for (const error of errors) {
            fragment.append(createErrorRow(error));
        }

        container.append(fragment);
    };

    return { render };
};
