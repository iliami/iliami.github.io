import test from "node:test";
import assert from "node:assert/strict";

import { AlgorithmContractError } from "../scripts/algorithms/contract.js";

import {
    MAX_USER_SOURCE_BYTES,
    USER_ALGORITHMS_STORAGE_KEY,
    USER_CODE_CONSENT_KEY,
    createUserAlgorithmRecord,
    ensureUserCodeConsent,
    grantUserCodeConsent,
    getUserAlgorithmsSourceBytes,
    hasUserCodeConsent,
    loadUserAlgorithmRecords,
    normalizeUserAlgorithmId,
    normalizeUserAlgorithmRecord,
    removeUserAlgorithmRecord,
    saveUserAlgorithmRecords,
    serializeUserAlgorithms,
    upsertUserAlgorithmRecord,
} from "../scripts/features/user-algorithms/repository.js";

const createStorage = (initial = {}) => {
    const map = new Map(Object.entries(initial));

    return {
        getItem: (key) => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => {
            map.set(key, String(value));
        },
        removeItem: (key) => {
            map.delete(key);
        },
        dump: () => Object.fromEntries(map),
    };
};

const createRecord = (overrides = {}) =>
    createUserAlgorithmRecord({
        id: "user:leaves",
        meta: {
            name: "Листья",
            pseudocode: ["line one"],
        },
        source: "export function run() { return { steps: [] }; }",
        ...overrides,
    });

test("normalizeUserAlgorithmId slugifies names and keeps the prefix", () => {
    assert.equal(normalizeUserAlgorithmId("Листья"), "user:листья");
    assert.equal(normalizeUserAlgorithmId("  Minimum Spanning Tree  "), "user:minimum-spanning-tree");
    assert.equal(normalizeUserAlgorithmId("user:Leaves"), "user:leaves");
    assert.equal(normalizeUserAlgorithmId("!!!"), "user:algorithm");
});

test("createUserAlgorithmRecord normalizes id, meta and timestamps", () => {
    const record = createRecord();

    assert.equal(record.id, "user:leaves");
    assert.equal(record.meta.id, "user:leaves");
    assert.equal(record.meta.name, "Листья");
    assert.equal(record.meta.requiresStartVertex, true);
    assert.deepEqual(record.meta.pseudocode, ["line one"]);
    assert.equal(typeof record.createdAt, "number");
    assert.equal(record.updatedAt, record.createdAt);
});

test("createUserAlgorithmRecord derives id from the name when omitted", () => {
    const record = createUserAlgorithmRecord({
        meta: { name: "Euler Path" },
        source: "export function run() { return { steps: [] }; }",
    });

    assert.equal(record.id, "user:euler-path");
});

test("createUserAlgorithmRecord rejects invalid records", () => {
    assert.throws(
        () => createRecord({ source: "   " }),
        (error) =>
            error instanceof AlgorithmContractError &&
            error.path === "source",
    );

    assert.throws(
        () => createRecord({ meta: { pseudocode: ["ok"] } }),
        (error) =>
            error instanceof AlgorithmContractError &&
            error.path === "meta.name",
    );

    assert.throws(
        () => normalizeUserAlgorithmRecord(null),
        (error) => error instanceof AlgorithmContractError,
    );
});

test("serializeUserAlgorithms enforces the total source size limit", () => {
    const small = createRecord();

    assert.doesNotThrow(() => serializeUserAlgorithms([small]));
    assert.ok(getUserAlgorithmsSourceBytes([small]) > 0);

    const big = createRecord({
        id: "user:big",
        source: "a".repeat(MAX_USER_SOURCE_BYTES + 1),
    });

    assert.throws(
        () => serializeUserAlgorithms([big]),
        (error) =>
            error instanceof AlgorithmContractError &&
            error.path === "source",
    );
});

test("save and load round-trips records through storage", () => {
    const storage = createStorage();
    const record = createRecord();

    saveUserAlgorithmRecords(storage, [record]);

    const loaded = loadUserAlgorithmRecords(storage);

    assert.equal(loaded.errors.length, 0);
    assert.equal(loaded.records.length, 1);
    assert.equal(loaded.records[0].id, "user:leaves");
    assert.equal(loaded.records[0].meta.name, "Листья");
});

test("loadUserAlgorithmRecords reports broken entries and keeps valid ones", () => {
    const valid = createRecord();
    const storage = createStorage({
        [USER_ALGORITHMS_STORAGE_KEY]: JSON.stringify({
            version: 1,
            algorithms: [
                valid,
                {
                    id: "user:broken",
                    meta: { id: "user:broken", name: "Broken" },
                    source: "",
                },
            ],
        }),
    });

    const loaded = loadUserAlgorithmRecords(storage);

    assert.equal(loaded.records.length, 1);
    assert.equal(loaded.records[0].id, "user:leaves");
    assert.equal(loaded.errors.length, 1);
    assert.equal(loaded.errors[0].id, "user:broken");
});

test("loadUserAlgorithmRecords tolerates corrupted or missing payloads", () => {
    assert.deepEqual(loadUserAlgorithmRecords(createStorage()), {
        records: [],
        errors: [],
    });

    const corrupted = loadUserAlgorithmRecords(
        createStorage({ [USER_ALGORITHMS_STORAGE_KEY]: "{not-json" }),
    );

    assert.equal(corrupted.records.length, 0);
    assert.equal(corrupted.errors.length, 1);

    const wrongShape = loadUserAlgorithmRecords(
        createStorage({
            [USER_ALGORITHMS_STORAGE_KEY]: JSON.stringify({ version: 1 }),
        }),
    );

    assert.equal(wrongShape.records.length, 0);
    assert.equal(wrongShape.errors.length, 1);
});

test("upsert and remove keep records unique by id", () => {
    const first = createRecord();
    const updated = { ...first, meta: { ...first.meta, name: "Новые листья" } };

    const upserted = upsertUserAlgorithmRecord([first], updated);

    assert.equal(upserted.length, 1);
    assert.equal(upserted[0].meta.name, "Новые листья");

    const appended = upsertUserAlgorithmRecord(upserted, createRecord({ id: "user:other" }));

    assert.equal(appended.length, 2);
    assert.equal(removeUserAlgorithmRecord(appended, "user:leaves").length, 1);
});

test("consent is asked once and cached in session storage", () => {
    const storage = createStorage();
    let calls = 0;
    const confirm = () => {
        calls += 1;
        return true;
    };

    assert.equal(ensureUserCodeConsent({ storage, confirm }), true);
    assert.equal(ensureUserCodeConsent({ storage, confirm }), true);
    assert.equal(calls, 1);
    assert.equal(hasUserCodeConsent(storage), true);
    assert.equal(storage.dump()[USER_CODE_CONSENT_KEY], "1");
});

test("consent is not granted when declined or unavailable", () => {
    const declined = createStorage();

    assert.equal(
        ensureUserCodeConsent({ storage: declined, confirm: () => false }),
        false,
    );
    assert.equal(hasUserCodeConsent(declined), false);

    const unavailable = createStorage();

    assert.equal(
        ensureUserCodeConsent({ storage: unavailable, confirm: undefined }),
        false,
    );

    grantUserCodeConsent(unavailable);
    assert.equal(hasUserCodeConsent(unavailable), true);
});
