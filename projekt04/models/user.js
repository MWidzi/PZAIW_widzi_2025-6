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

const allowedRoles = ["user", "admin"];

const db_path = "./db.sqlite";
const db = new DatabaseSync(db_path);

db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS "users" (
        "id"	INTEGER,
        "username"	TEXT UNIQUE,
        "password_hash"	TEXT,
        "creation_timestamp"	INTEGER,
        "role"	TEXT DEFAULT 'user',
        PRIMARY KEY("id" AUTOINCREMENT)
    ) STRICT;
`);

const db_ops = {
    create_user: db.prepare(`
        INSERT INTO users (username, password_hash, creation_timestamp) VALUES (?, ?, ?) RETURNING id;
    `),
    get_user: db.prepare(`
        SELECT id, username, creation_timestamp, role FROM users WHERE id = ?;
    `),
    find_by_username: db.prepare(`
        SELECT id, username, creation_timestamp, role FROM users WHERE username = ?;
    `),
    get_auth_data: db.prepare(`
        SELECT id, password_hash FROM users WHERE username = ?;
    `),
    modify_role: db.prepare(`
        UPDATE users SET role=? WHERE users.id == ?
    `),
    get_all_users: db.prepare(`
        SELECT id, username, creation_timestamp, role FROM users;
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

export function modifyRole(userId, role) {
    if (typeof role != "string") {
        return "Role must be a string"
    }
    if (!allowedRoles.includes(role)) {
        return "No such role exists";
    }
    if (getUser(userId) == null) {
        return "User dosen't exist";
    }

    db_ops.modify_role.run(role, userId);
    return null;
}

export function getAllUsers() {
    return db_ops.get_all_users.all();
}

export function insertUserWithId(id, username, password_hash, creation_timestamp, role) {
    db_ops.insert_users_with_id.run(id, username, password_hash, creation_timestamp, role);
}

export default {
    createUser,
    validatePassword,
    getUser,
    modifyRole,
    getAllUsers,
}
