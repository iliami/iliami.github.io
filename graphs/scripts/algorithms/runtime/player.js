export const MIN_SPEED = 0.1;
export const MAX_SPEED = 3;
export const BASE_DELAY_MS = 650;
export const MIN_DELAY_MS = 80;

const createRunId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const clampSpeed = (value) => {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
        return 1;
    }

    return Math.max(MIN_SPEED, Math.min(MAX_SPEED, numeric));
};

export const createAlgorithmPlayer = ({
    render = () => {},
    schedule = (callback, delay) => globalThis.setTimeout(callback, delay),
    cancel = (handle) => globalThis.clearTimeout(handle),
    onStatus = () => {},
    baseDelayMs = BASE_DELAY_MS,
    minDelayMs = MIN_DELAY_MS,
    makeRunId = createRunId,
} = {}) => {
    const state = {
        runId: null,
        algorithmId: null,
        algorithmName: "",
        steps: [],
        index: -1,
        playing: false,
        speed: 1,
        resultText: "",
        pseudocode: [],
        status: "idle",
    };

    let timer = null;

    const getState = () => ({
        ...state,
        steps: state.steps,
        pseudocode: state.pseudocode,
    });

    const emit = () => {
        render(getState());
    };

    const clearTimer = () => {
        if (timer !== null) {
            cancel(timer);
            timer = null;
        }
    };

    const getDelay = () => Math.max(minDelayMs, baseDelayMs / state.speed);

    const finish = () => {
        state.playing = false;
        state.status = "finished";
        emit();
        onStatus("finished");
    };

    const scheduleNextStep = () => {
        clearTimer();

        if (!state.playing) {
            return;
        }

        timer = schedule(() => {
            timer = null;

            if (!state.playing) {
                return;
            }

            if (state.index >= state.steps.length - 1) {
                finish();
                return;
            }

            state.index += 1;
            emit();
            scheduleNextStep();
        }, getDelay());
    };

    const load = ({
        algorithmId,
        algorithmName = "",
        steps = [],
        pseudocode = [],
        resultText = "",
    }) => {
        clearTimer();

        state.runId = makeRunId();
        state.algorithmId = algorithmId;
        state.algorithmName = algorithmName;
        state.steps = Array.isArray(steps) ? steps : [];
        state.pseudocode = Array.isArray(pseudocode) ? pseudocode : [];
        state.index = -1;
        state.playing = false;
        state.resultText = resultText;
        state.status = state.steps.length > 0 ? "ready" : "idle";

        emit();
    };

    const pause = () => {
        if (!state.playing) {
            return;
        }

        state.playing = false;
        state.status = "paused";
        clearTimer();
        emit();
        onStatus("paused");
    };

    const play = () => {
        if (state.steps.length === 0 || state.playing) {
            return;
        }

        if (state.index >= state.steps.length - 1) {
            state.index = -1;
            emit();
        }

        state.playing = true;
        state.status = "playing";
        emit();
        onStatus("playing");
        scheduleNextStep();
    };

    const stepForward = () => {
        if (state.steps.length === 0) {
            return;
        }

        pause();
        clearTimer();

        if (state.index < state.steps.length - 1) {
            state.index += 1;
            state.status = "paused";
            emit();
        }
    };

    const stepBack = () => {
        if (state.steps.length === 0 || state.index < 0) {
            return;
        }

        pause();
        clearTimer();

        state.index -= 1;
        state.status = "paused";
        emit();
    };

    const setSpeed = (value) => {
        state.speed = clampSpeed(value);

        if (state.playing) {
            scheduleNextStep();
        }

        return state.speed;
    };

    const reset = () => {
        clearTimer();

        state.steps = [];
        state.index = -1;
        state.playing = false;
        state.resultText = "";
        state.status = "idle";
        state.runId = null;

        emit();
    };

    const destroy = () => {
        clearTimer();
    };

    return {
        load,
        play,
        pause,
        stepForward,
        stepBack,
        setSpeed,
        reset,
        destroy,
        getState,
    };
};
