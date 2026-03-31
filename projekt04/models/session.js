import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";

const db_path = "./db.sqlite";
const db = new DatabaseSync(db_path, { readBigInts: true });

const SESSION_COOKIE = "__Host-rating-user-id";
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

db.exec(`
    CREATE TABLE IF NOT EXISTS "sessions" (
        "id"	INTEGER,
        "user_id"	INTEGER,
        "creation_timestamp"	INTEGER,
        PRIMARY KEY("id")
    ) STRICT;
`);

const db_ops = {
    create_session: db.prepare(`
        INSERT INTO sessions (id, user_id, creation_timestamp)
        VALUES (?, ?, ?) RETURNING id, user_id, creation_timestamp;
    `),
    get_session: db.prepare(`
        SELECT id, user_id, creation_timestamp FROM sessions WHERE id = ?;
    `),
    delete_session: db.prepare(`
        DELETE FROM sessions WHERE id = ?;
    `),
};

export function createSession(user, res) {
    let sessionId = randomBytes(8).readBigInt64BE();
    let creationTimestamp = Date.now();

    let session = db_ops.create_session.get(sessionId, user, creationTimestamp);
    res.locals.session = session;
    res.locals.user = session.user_id != null ? getUser(session.user_id) : null;

    res.cookie(SESSION_COOKIE, {
        maxAge: ONE_WEEK,
        httpOnly: true,
        secure: true,
    });

    return session;
}

export function deleteSession(res) {
    let sessionId = res.locals.session.id;
    db_ops.delete_session.run(sessionId);

    res.cookie(SESSION_COOKIE, sessionId.toString(), {
        maxAge: 0,
        httpOnly: true,
        secure: true,
    });

}

function sessionHandler(req, res, next) {
    let sessionId = req.cookies[SESSION_COOKIE];
    let session = null;

    if (sessionId != null) {
        if (!sessionId.match(/^-?[0-9]+$/)) {
            sessionId = null;
        } else {
            sessionId = BigInt(sessionId);
        }
    }

    if (sessionId != null) session = db_ops.get_session.get(sessionId);

    if (session != null) {
        res.locals.session = session;
        res.locals.user = session.user_id != null ? getUser(session.user_id) : null;

        res.cookie(SESSION_COOKIE, res.locals.session.id.toString(), {
            maxAge: ONE_WEEK,
            httpOnly: true,
            secure: true,
        });
    } else {
        session = createSession(null, res);
    }

    setImmediate(printUserSession);

    next();

    function printUserSession() {
        console.info(
            "Session:",
            session.id,
            "user:",
            session.user_id,
            "created at:",
            new Date(Number(session.creation_timestamp)).toISOString(),
        );
    }
}

export default {
    createSession,
    sessionHandler
}
