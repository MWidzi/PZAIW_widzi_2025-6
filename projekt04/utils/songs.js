import { DatabaseSync } from "node:sqlite";

const db_path = "./db.sqlite";
const db = new DatabaseSync(db_path);

console.log("Creating tables");

db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
        "song_id"	INTEGER,
        "game"	INTEGER NOT NULL,
        "key"	TEXT NOT NULL UNIQUE,
        "name"	TEXT NOT NULL,
        "jacket"	TEXT,
        PRIMARY KEY("song_id" AUTOINCREMENT),
        FOREIGN KEY("game") REFERENCES "games"("game_id") ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE IF NOT EXISTS song_difficulty (
        sd_id INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id INTEGER NOT NULL REFERENCES songs(song_id) ON DELETE NO ACTION,
        difficulty TEXT NOT NULL,
        level INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS scores (
        score_id INTEGER PRIMARY KEY AUTOINCREMENT,
        sd_id INTEGER NOT NULL REFERENCES song_difficulty(sd_id) ON DELETE NO ACTION,
        type TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS games (
        "game_id"	INTEGER PRIMARY KEY AUTOINCREMENT,
        "name"	TEXT NOT NULL,
        "name_short"  TEXT NOT NULL
    ) STRICT;
`);

const db_ops = {
    insert_songs: db.prepare(`INSERT INTO songs (game, name)
        VALUES (?, ?) RETURNING song_id, game, name, jacket;`
    ),
    insert_song_difficulty: db.prepare(`INSERT INTO song_difficulty (song_id, difficulty, level)
        VALUES (?, ?, ?) RETURNING sd_id, song_id, difficulty, level;`
    ),
    insert_scores: db.prepare(`INSERT INTO scores (sd_id, type)
        VALUES (?, ?) RETURNING score_id, sd_id, type;`
    ),
    select_scores_by_type: db.prepare(`SELECT * FROM scores WHERE type LIKE ?`),
    select_orderedLevelTable: db.prepare(`
        SELECT
            s.game as game,
            s.name as name,
            s.key as key,
            sd.difficulty AS difficulty,
            sd.level AS lvl,
            sd.sd_id AS sd_id,
            s.jacket as jacket
        FROM
            songs s
        JOIN
            song_difficulty sd ON s.song_id = sd.song_id
        ORDER BY
            lvl DESC
    `),
    select_games_table: db.prepare(`SELECT name FROM games`),
    add_scores: db.prepare(`INSERT INTO scores (sd_id, type) VALUES (?, ?) RETURNING score_id, sd_id, type`),
    delete_scores: db.prepare(`DELETE FROM scores WHERE sd_id = ?`),
    update_score_type: db.prepare(`UPDATE scores SET type = ? WHERE sd_id = ?`),
    get_game_min_max_diff: db.prepare(`SELECT max(song_difficulty.level) AS 'max', min(song_difficulty.level) AS 'min' FROM songs JOIN song_difficulty ON song_difficulty.song_id = songs.song_id WHERE songs.game = ?`),
    select_song_by_key: db.prepare(`SELECT * FROM songs WHERE songs.key LIKE ?`),

};

// AP - All Perfect (trafienie wszystkich nutek w ramach najwyższego timing judgementu)
// FC - Full Combo (trafienie wszystkich nutek, ale np z lekkim opoznieniem)
// są to typy wyników końcowych aplikowalne do prawie każdej gry rytmicznej

var APs = db_ops.select_scores_by_type.all("AP");
var FCs = db_ops.select_scores_by_type.all("FC");

if (process.env.POPULATE_DB) {
    console.log("Populating db...");
    songs_json.forEach(entry => {
        let song = db_ops.insert_songs.get(entry.game, entry.name);
        console.log("Created song:", song);

        for (let i = 0; i < entry.lvlTab.length; i++) {
            let diff = db_ops.insert_song_difficulty.get(song.song_id, entry.lvlDiffs[i], entry.lvlTab[i]);
            console.log("Created diff:", diff);

        }
    });
}

export function getOrderedLevelTable() {
    const query = db_ops.select_orderedLevelTable.all()
    return query;
}

export function getGamesTable() {
    const query = db_ops.select_games_table.all()
    return query;
}

export function calcSongRating(game, lvl) {
    // TODO: naprawic to zeby to nie bylo takie nieefektywne
    const maxLevel = db_ops.get_game_min_max_diff.get(game)['max'];

    if (maxLevel === undefined) {
        console.warn(`Unknown game: ${game}. Returning original level.`);
        return lvl;
    }

    if (maxLevel === 0) {
        console.warn(`Max level for game ${game} is 0. Returning 0.`);
        return 0;
    }

    return (lvl / maxLevel) * 10.0;
}

export function getAPs() {
    return APs.map(score => score.sd_id);
}

export function getFCs() {
    return FCs.map(score => score.sd_id);
}

// funkcja której logikę napisałem ja a LLM ją "podrasował"
export function validateAndSetWeighedTabs(apIds, fcIds) {
    const newApIds = new Set((Array.isArray(apIds) ? apIds : (apIds ? [apIds] : [])).map(id => parseInt(id, 10)));
    const newFcIdsRaw = (Array.isArray(fcIds) ? fcIds : (fcIds ? [fcIds] : [])).map(id => parseInt(id, 10));

    const newFcIds = new Set(newFcIdsRaw.filter(id => !newApIds.has(id)));

    const allScores = db_ops.select_scores_by_type.all('%');
    const currentApIds = new Set(allScores.filter(s => s.type === 'AP').map(s => s.sd_id));
    const currentFcIds = new Set(allScores.filter(s => s.type === 'FC').map(s => s.sd_id));

    const idsToAddAsAp = [...newApIds].filter(id => !currentApIds.has(id) && !currentFcIds.has(id));
    const idsToAddAsFc = [...newFcIds].filter(id => !currentFcIds.has(id) && !currentApIds.has(id));

    const allCurrentIds = new Set(allScores.map(s => s.sd_id));
    const uniqueIdsToRemove = [...allCurrentIds].filter(id => !newApIds.has(id) && !newFcIds.has(id));

    const idsToUpdateToAp = [...currentFcIds].filter(id => newApIds.has(id));
    const idsToUpdateToFc = [...currentApIds].filter(id => newFcIds.has(id));

    try {
        db.exec('BEGIN');
        for (const id of idsToAddAsAp) db_ops.add_scores.run(id, 'AP');
        for (const id of idsToAddAsFc) db_ops.add_scores.run(id, 'FC');

        for (const id of uniqueIdsToRemove) db_ops.delete_scores.run(id);

        for (const id of idsToUpdateToAp) db_ops.update_score_type.run('AP', id);
        for (const id of idsToUpdateToFc) db_ops.update_score_type.run('FC', id);
        db.exec('COMMIT');
    } catch (err) {
        console.error("Transaction failed, rolling back.", err);
        db.exec('ROLLBACK');
    }

    APs = db_ops.select_scores_by_type.all("AP");
    FCs = db_ops.select_scores_by_type.all("FC");
}

// TODO: Dodać walidację nazwy piosenki oraz czy link do jacketa zwraca 404 czy nie

export function getSongDetailsWithDifficulties(songKey) {
    const allSongsWithDifficulties = getOrderedLevelTable();
    const filteredDifficulties = allSongsWithDifficulties.filter(song => song.key === songKey);

    if (filteredDifficulties.length === 0) {
        return null; // Song not found
    }

    const song = {
        game: filteredDifficulties[0].game,
        key: filteredDifficulties[0].key,
        name: filteredDifficulties[0].name,
        jacket: filteredDifficulties[0].jacket,
        difficulties: []
    };

    filteredDifficulties.forEach(entry => {
        song.difficulties.push({
            name: entry.difficulty,
            level: entry.lvl,
            sd_id: entry.sd_id
        });
    });

    return song;
}

export default {
    getOrderedLevelTable,
    getAPs,
    getFCs,
    calcSongRating,
    validateAndSetWeighedTabs,
    getGamesTable,
    getSongDetailsWithDifficulties
}
