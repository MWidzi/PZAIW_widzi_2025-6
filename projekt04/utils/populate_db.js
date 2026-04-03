import { DatabaseSync } from "node:sqlite";
import { createUser, modifyRole } from "../models/user.js"
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const db_path = "./db.sqlite";

function askQuestion(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function getValidPassword() {
    while (true) {
        const password = await askQuestion("Enter admin account password (min 8 chars): ");
        if (password.length >= 8) {
            return password;
        }
        console.error("Password must be at least 8 characters. Please try again.");
    }
}

export async function runPopulation() {
    console.log("Running database population script (populate_db.js)...");

    const adminPassword = await getValidPassword();

    const db = new DatabaseSync(db_path);

    try {
        db.exec('PRAGMA foreign_keys = ON;');

        const db_ops = {
            insert_games_with_id: db.prepare(`INSERT INTO games (game_id, name, name_short) VALUES (?, ?, ?);`),
            insert_songs_with_id: db.prepare(`INSERT INTO songs (song_id, game, key, name, jacket) VALUES (?, ?, ?, ?, ?);`),
            insert_song_difficulty_with_id: db.prepare(`INSERT INTO song_difficulty (sd_id, song_id, difficulty, level) VALUES (?, ?, ?, ?);`),
        };

        const extractedDataPath = path.resolve(process.cwd(), 'extracted_db_data.json');
        const extractedData = JSON.parse(fs.readFileSync(extractedDataPath, 'utf8'));

        db.exec('BEGIN');

        db.exec("DELETE FROM song_difficulty;");
        db.exec("DELETE FROM songs;");
        db.exec("DELETE FROM games;");
        console.log("Cleared existing data from all tables for population.");


        extractedData.games.forEach(game => {
            db_ops.insert_games_with_id.run(
                parseInt(game.game_id, 10),
                game.name,
                game.name_short
            );
        });
        console.log(`Inserted ${extractedData.games.length} games.`);

        extractedData.songs.forEach(song => {
            console.log(`Debug: song.game type: ${typeof song.game}, value: ${song.game}`);
            db_ops.insert_songs_with_id.run(song.song_id, parseInt(song.game, 10), song.key, song.name, song.jacket);
        });
        console.log(`Inserted ${extractedData.songs.length} songs.`);

        extractedData.song_difficulty.forEach(diff => {
            db_ops.insert_song_difficulty_with_id.run(
                parseInt(diff.sd_id, 10),
                parseInt(diff.song_id, 10),
                diff.difficulty,
                parseInt(diff.level, 10)
            );
        });
        console.log(`Inserted ${extractedData.song_difficulty.length} difficulties.`);


        db.exec('COMMIT');
        console.log("Database populated successfully from extracted_db_data.json.");

    } catch (error) {
        console.error("Failed to populate database, rolling back:", error);
        db.exec('ROLLBACK');
        throw error;
    } finally {
        db.close();
    }


    const admin = await createUser("admin", adminPassword);
    if (admin) {
        modifyRole(admin.id, "admin");
    }
}
