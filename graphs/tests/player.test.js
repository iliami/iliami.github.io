import test from "node:test";
import assert from "node:assert/strict";

import {
    createAlgorithmPlayer,
    MAX_SPEED,
    MIN_SPEED,
} from "../scripts/algorithms/runtime/player.js";

const createScheduler = () => {
    let nextId = 1;
    const tasks = new Map();

    return {
        schedule(callback, delay) {
            const id = nextId;
            nextId += 1;
            tasks.set(id, { callback, delay });
            return id;
        },
        cancel(id) {
            tasks.delete(id);
        },
        tick() {
            const entry = tasks.entries().next().value;

            if (!entry) {
                return false;
            }

            const [id, task] = entry;
            tasks.delete(id);
            task.callback();
            return true;
        },
        get size() {
            return tasks.size;
        },
    };
};

const steps = [
    { type: "vertex", vertexId: "1" },
    { type: "vertex", vertexId: "2" },
    { type: "vertex", vertexId: "3" },
];

const createPlayer = (scheduler, onStatus = () => {}) =>
    createAlgorithmPlayer({
        schedule: scheduler.schedule,
        cancel: scheduler.cancel,
        onStatus,
        makeRunId: () => "run-1",
    });

const loadSteps = (player) => {
    player.load({
        algorithmId: "test",
        algorithmName: "TEST",
        steps,
        pseudocode: ["a", "b", "c"],
        resultText: "done",
    });
};

test("load resets playback state", () => {
    const scheduler = createScheduler();
    const rendered = [];
    const player = createAlgorithmPlayer({
        render: (state) => rendered.push(state),
        schedule: scheduler.schedule,
        cancel: scheduler.cancel,
        makeRunId: () => "run-1",
    });

    loadSteps(player);

    const state = player.getState();

    assert.equal(state.index, -1);
    assert.equal(state.playing, false);
    assert.equal(state.status, "ready");
    assert.equal(state.algorithmName, "TEST");
    assert.equal(state.resultText, "done");
    assert.equal(state.runId, "run-1");
    assert.equal(rendered.at(-1).status, "ready");
});

test("play advances steps and finishes", () => {
    const scheduler = createScheduler();
    const statuses = [];
    const player = createPlayer(scheduler, (status) => statuses.push(status));

    loadSteps(player);

    player.play();
    assert.equal(player.getState().playing, true);
    assert.equal(player.getState().status, "playing");
    assert.equal(scheduler.size, 1);

    assert.equal(scheduler.tick(), true);
    assert.equal(player.getState().index, 0);

    assert.equal(scheduler.tick(), true);
    assert.equal(player.getState().index, 1);

    assert.equal(scheduler.tick(), true);
    assert.equal(player.getState().index, 2);

    assert.equal(scheduler.tick(), true);
    assert.equal(player.getState().playing, false);
    assert.equal(player.getState().status, "finished");
    assert.equal(scheduler.size, 0);
    assert.ok(statuses.includes("finished"));
});

test("pause stops timer, step controls move index", () => {
    const scheduler = createScheduler();
    const player = createPlayer(scheduler);

    loadSteps(player);

    player.play();
    scheduler.tick();
    player.pause();

    assert.equal(player.getState().playing, false);
    assert.equal(player.getState().status, "paused");
    assert.equal(scheduler.size, 0);

    player.stepForward();
    assert.equal(player.getState().index, 1);

    player.stepBack();
    assert.equal(player.getState().index, 0);

    player.stepForward();
    player.stepForward();
    assert.equal(player.getState().index, 2);

    player.stepForward();
    assert.equal(player.getState().index, 2);
});

test("play from the end restarts from the first step", () => {
    const scheduler = createScheduler();
    const player = createPlayer(scheduler);

    loadSteps(player);
    player.play();

    for (let index = 0; index < 4; index += 1) {
        scheduler.tick();
    }

    assert.equal(player.getState().status, "finished");

    player.play();

    assert.equal(player.getState().index, -1);
    assert.equal(player.getState().playing, true);
    assert.equal(scheduler.size, 1);
});

test("speed is clamped and reschedules an active playback", () => {
    const scheduler = createScheduler();
    const player = createPlayer(scheduler);

    loadSteps(player);
    player.play();

    assert.equal(player.setSpeed(10), MAX_SPEED);
    assert.equal(player.setSpeed(0), MIN_SPEED);
    assert.equal(player.setSpeed("bad"), 1);

    player.play();
    const before = scheduler.size;
    player.setSpeed(2);

    assert.equal(player.getState().speed, 2);
    assert.equal(scheduler.size, before);
});

test("reset clears steps and timer but keeps algorithm metadata", () => {
    const scheduler = createScheduler();
    const player = createPlayer(scheduler);

    loadSteps(player);
    player.play();

    player.reset();

    assert.equal(player.getState().steps.length, 0);
    assert.equal(player.getState().index, -1);
    assert.equal(player.getState().playing, false);
    assert.equal(player.getState().status, "idle");
    assert.equal(player.getState().algorithmId, "test");
    assert.equal(player.getState().pseudocode.length, 3);
    assert.equal(scheduler.size, 0);
});
