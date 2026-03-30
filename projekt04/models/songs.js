import { DatabaseSync } from "node:sqlite";
import hepburn from "hepburn";

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
    insert_songs: db.prepare(`INSERT INTO songs (game, key, name, jacket)
        VALUES (?, ?, ?, ?) RETURNING song_id, game, name, jacket;`
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
    select_games_table: db.prepare(`SELECT game_id, name, name_short FROM games`),
    add_scores: db.prepare(`INSERT INTO scores (sd_id, type) VALUES (?, ?) RETURNING score_id, sd_id, type`),
    delete_scores: db.prepare(`DELETE FROM scores WHERE sd_id = ?`),
    update_score_type: db.prepare(`UPDATE scores SET type = ? WHERE sd_id = ?`),
    get_game_min_max_diff: db.prepare(`SELECT max(song_difficulty.level) AS 'max', min(song_difficulty.level) AS 'min' FROM songs JOIN song_difficulty ON song_difficulty.song_id = songs.song_id WHERE songs.game = ?`),
    select_song_by_key: db.prepare(`SELECT * FROM songs WHERE songs.key LIKE ?`),
    select_difficulties_by_song_id: db.prepare(`SELECT sd_id, difficulty, level FROM song_difficulty WHERE song_id = ?`),

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

export function validateSongName(name) {
    var errors = [];

    if (typeof name != "string") {
        errors.push("Song name should be a string");
    } else {
        if (name.length < 3 || name.length > 100) {
            errors.push("Song name should have 3-100 characters");
        }
    }

    return errors;
}

export async function validateSongJacket(url) {
    var errors = [];

    if (typeof url != "string") {
        errors.push("Url needs to be a string");
        return errors;
    }

    try {
        new URL(url);
    } catch {
        errors.push(`${url}: Invalid URL format`);
        return errors;
    }

    try {
        const response = await fetch(url, { method: 'HEAD' });

        if (response.status === 404) {
            errors.push(`${url}: 404, resource not found`)
        }
    } catch (error) {
        errors.push(`${url}: ${error.name || 'Error'} - ${error.message}`);
    }

    return errors;
}

export function validateSongGame(game, games) {
    var errors = [];

    if (typeof game !== 'number' || !Number.isInteger(game)) {
        errors.push("Game needs to be an int");
    } else {
        const gameExists = games.some(gameItem => gameItem.game_id === game);
        if (!gameExists) {
            errors.push("Game is not supported");
        }
    }

    return errors;
}

export function generateSongKey(name, game, games) {
    // Konwersja na romaji jesli string zawiera kane
    // dla informacji: 
    //   kana - alfabety japonskie
    //   romaji - dzwieki jezyka japonskiego zapisane w łaćińskich literach

    let processedName = name;
    if (hepburn.containsKana(name)) {
        processedName = hepburn.fromKana(name).toLowerCase();
    }

    // mini funkcja zmodyfikowana przez llm
    function slugify(str) {
        return str.toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s.-]/g, "")
            .replace(/\s+/g, " ")
            .replace(/(\s|[.-])+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    }

    const gameName = slugify(games[game - 1].name_short);
    const songName = slugify(processedName);

    return gameName + "-" + songName;
}

export function songExists(songKey) {
    let song = db_ops.select_song_by_key.get(songKey);
    return song != null;
}

export function insertSong(game, key, name, jacket) {
    return db_ops.insert_songs.get(game, key, name, jacket);
}

export function getSongDetailsWithDifficulties(songKey) {
    const songEntry = db_ops.select_song_by_key.get(songKey);

    if (!songEntry) {
        return null; // Song not found
    }

    const difficulties = db_ops.select_difficulties_by_song_id.all(songEntry.song_id);

    const song = {
        song_id: songEntry.song_id,
        game: songEntry.game,
        key: songEntry.key,
        name: songEntry.name,
        jacket: songEntry.jacket,
        difficulties: difficulties.map(diff => ({
            name: diff.difficulty,
            level: diff.level,
            sd_id: diff.sd_id
        }))
    };

    return song;
}

// Sekcja związana z insertowaniem poziomów trudności wraz z piosenką wygenerowana przez llm
export function insertDifficulties(song_id, difficulties) {
    db.exec('BEGIN');
    try {
        for (const diff of difficulties) {
            db_ops.insert_song_difficulty.run(song_id, diff.name, diff.level);
        }
        db.exec('COMMIT');
    } catch (error) {
        console.error("Failed to insert difficulties, rolling back:", error);
        db.exec('ROLLBACK');
        throw error;
    }
}

export function validateDifficulties(difficulties) {
    const errors = [];

    if (!Array.isArray(difficulties) || difficulties.length === 0) {
        errors.push("At least one difficulty must be provided.");
        return errors;
    }

    difficulties.forEach((diff, index) => {
        if (!diff || typeof diff !== 'object') {
            errors.push(`Difficulty entry ${index + 1} is malformed.`);
            return;
        }

        const { name, level } = diff;

        if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
            errors.push(`Difficulty name for entry ${index + 1} must be a string between 1 and 50 characters.`);
        }

        const parsedLevel = parseInt(level, 10);
        if (isNaN(parsedLevel)) {
            errors.push(`Difficulty level for entry ${index + 1} must be an integer`);
        }
        diff.level = parsedLevel;
    });

    return errors;
}

export default {
    getOrderedLevelTable,
    getAPs,
    getFCs,
    calcSongRating,
    validateAndSetWeighedTabs,
    getGamesTable,
    getSongDetailsWithDifficulties,
    validateSongName,
    validateSongJacket,
    validateSongGame,
    generateSongKey,
    songExists,
    insertSong,
    insertDifficulties,
    validateDifficulties
}
