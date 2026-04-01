import { DatabaseSync } from "node:sqlite";
import argon2 from "argon2";
import { error } from "node:console";

const PEPPER = process.env.PEPPER;
if (PEPPER == null) {
    console.error(
        `PEPPER environment variable missing`
    );
    process.exit(1);
}

const HASH_PARAMETERS = {
    secret: Buffer.from(PEPPER, "hex"),
};

const db_path = "./db.sqlite";
const db = new DatabaseSync(db_path);

db.exec(`
    CREATE TABLE IF NOT EXISTS "users" (
        "id"	INTEGER,
        "username"	TEXT UNIQUE,
        "password_hash"	TEXT,
        "creation_timestamp"	INTEGER,
        PRIMARY KEY("id" AUTOINCREMENT)
    ) STRICT;
`);

const db_ops = {
    create_user: db.prepare(`
        INSERT INTO users (username, password_hash, creation_timestamp) VALUES (?, ?, ?) RETURNING id;
    `),
    get_user: db.prepare(`
        SELECT id, username, creation_timestamp FROM users WHERE id = ?;
    `),
    find_by_username: db.prepare(`
        SELECT id, username, creation_timestamp FROM users WHERE username = ?;
    `),
    get_auth_data: db.prepare(`
        SELECT id, password_hash FROM users WHERE username = ?;
    `),

};

export async function createUser(username, password) {
    if (db_ops.find_by_username.get(username) != null) {
        return null;
    }

    let creationTimestamp = Date.now();
    let passwordHash = await argon2.hash(password, HASH_PARAMETERS);

    return db_ops.create_user.get(username, passwordHash, creationTimestamp);
}

export async function validatePassword(username, password) {
    let authData = db_ops.get_auth_data.get(username);
    if (authData != null) {
        if (await argon2.verify(authData.password_hash, password, HASH_PARAMETERS)) {
            return authData.id;
        }
    }

    return null;
}

export function getUser(userId) {
    return db_ops.get_user.get(userId);
}

export default {
    createUser,
    validatePassword,
    getUser,
}
