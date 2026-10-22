export const clamp = (value, min, max) =>
    Math.min(max, Math.max(min, value));

export const pluralize = (count, one, few, many) => {
    const mod100 = count % 100;
    const mod10 = count % 10;

    if (mod100 >= 11 && mod100 <= 14) {
        return many;
    }

    if (mod10 === 1) {
        return one;
    }

    if (mod10 >= 2 && mod10 <= 4) {
        return few;
    }

    return many;
};

export const formatError = (error) => {
    const message = error?.message ?? "Неизвестная ошибка";

    return error?.path ? `${message} (${error.path})` : message;
};

export const formatLabelList = (labelById, vertexIds) =>
    vertexIds.map((vertexId) => labelById(vertexId)).join(" → ");
