import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import userModel from "./models/user.js";
import settings from "./models/settings.js";
import session from "./models/session.js";
import auth from "./controllers/authentication.js";

import songs, { getAllSongs, getFCs, insertSong, validateSongJacket } from "./models/songs.js";
import utils from "./utils/util_functions.js";

import { runPopulation } from './utils/populate_db.js';

if (process.env.POPULATE_DB) {
    console.log("POPULATE_DB environment variable detected. Running population script...");
    await runPopulation();
    console.log("Database population script finished.");
}

const port = process.env.PORT || 8000;
const COOKIES_KEY = process.env.SECRET;

if (COOKIES_KEY == null) {
    console.error("SECRET env var missing");
    process.exit(1);
}

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(cookieParser(COOKIES_KEY));

app.use(settings.settingsHandler);
app.use(session.sessionHandler);

const settingsRouter = express.Router();
settingsRouter.use("/toggle-theme", settings.themeToggle);
settingsRouter.use("/accept-cookies", settings.acceptCookies);
settingsRouter.use("/decline-cookies", settings.declineCookies);
settingsRouter.use("/manage-cookies", settings.manageCookies);
app.use("/settings", settingsRouter);

const authRouter = express.Router();
authRouter.get("/signup", auth.signup_get);
authRouter.post("/signup", auth.signup_post);
authRouter.get("/login", auth.login_get);
authRouter.post("/login", auth.login_post);
authRouter.get("/logout", auth.logout);
app.use("/auth", authRouter);

let songsData = songs.getOrderedLevelTable();
const games = songs.getGamesTable();

// Notka wstępna: tabela games jest nieedytowalna z poziomu aplikacji 'by design', tworzac analogie do projektu z fiszkami tabela scores to by byly fiszki a tabela songs to kategorie, games istnieje z powodów ideowych projektu. W związku z tym sposoby implementacji różnią się lekko od przykładowego projektu, lecz funkcjonalności zostają takie same.
//
// WYTŁUMACZNIE TERMINOLOGII
// AP - All Perfect (trafienie wszystkich nutek w ramach najwyższego timing judgementu)
// FC - Full Combo (trafienie wszystkich nutek, ale np z lekkim opoznieniem)
// są to typy wyników końcowych aplikowalne do prawie każdej gry rytmicznej
// level, czesto nazywany song level - poziom trudnosci danego poziomu

// rating functionality
app.get("/", (req, res) => {
    const userId = res.locals.user ? res.locals.user.id : null;
    let rating = 0;
    let fcTab = songs.getFCs(userId);
    let apTab = songs.getAPs(userId);

    rating = utils.increaseRating(fcTab, songs, songsData, rating, 1);
    rating = utils.increaseRating(apTab, songs, songsData, rating);

    rating = rating / (fcTab.length + apTab.length);
    rating = Number.isNaN(rating) ? 0 : rating.toFixed(2);

    res.render("rating", {
        title: "Your Rating",
        rating: rating,
        data: songsData,
        games: games,
        apTab: apTab,
        fcTab: fcTab,
        calcSongRating: songs.calcSongRating
    });
});

app.get("/diffs", (req, res) => {
    const userId = res.locals.user ? res.locals.user.id : null;

    songsData = songs.getOrderedLevelTable();
    res.render("diffs", {
        title: "Your scores",
        data: songsData,
        games: games,
        apTab: songs.getAPs(userId),
        fcTab: songs.getFCs(userId),
        utils: utils,
        targetUser: null
    });
});

app.post("/saveRating", (req, res) => {
    const userId = res.locals.user ? res.locals.user.id : null;
    let apIds = req.body.songApIds;
    let fcIds = req.body.songFcIds;

    songs.validateAndSetWeighedTabs(apIds, fcIds, userId);

    res.redirect(`/`);
});


// Song display functionality
app.get("/songs", (req, res) => {
    res.render("songs", {
        title: "All songs",
        songs: songs.getAllSongs(),
        games: games,
    });
});

app.get("/songs/view/:key", (req, res) => {
    const songKey = req.params.key;
    const song = songs.getSongDetailsWithDifficulties(songKey);

    if (!song) {
        return res.sendStatus(404);
    }

    res.render("song_info", {
        title: "Song info",
        song: song,
        games: games
    })
});

// Songs creation, updating and deletion functionality, only for admin account
app.get("/songs/song_new", (req, res) => {
    if (res.locals.user.role != "admin") {
        res.sendStatus(401);
        return;
    }

    res.render("song_new", {
        title: "Add song",
        games: games
    });
});

app.post("/songs/song_new", async (req, res) => {
    if (!res.locals.user || res.locals.user.role != "admin") {
        res.sendStatus(401);
        return;
    }

    let songKey = null;

    const name = req.body.name;
    const game = parseInt(req.body.game);
    const jacket = req.body.jacket;
    const difficulties = req.body.difficulties;

    const nameErrors = songs.validateSongName(name);
    const gameErrors = songs.validateSongGame(game, games);
    const jacketErrors = await songs.validateSongJacket(jacket);
    const difficultyErrors = songs.validateDifficulties(difficulties);

    let errors = [...nameErrors, ...gameErrors, ...jacketErrors, ...difficultyErrors];

    if (errors.length == 0) {
        songKey = songs.generateSongKey(name, game, games);
        if (songs.songExists(songKey)) {
            errors.push(`Song with key ${songKey} already exists`);
        }
    }

    if (errors.length == 0) {
        const newSong = songs.insertSong(game, songKey, name, jacket);
        songs.insertDifficulties(newSong.song_id, difficulties);
        res.redirect(`/songs/view/${songKey}`);
    } else {
        res.render("song_new", {
            errors,
            title: "New song",
            name: name,
            jacket: jacket,
            game: game,
            games: games,
            difficulties: difficulties
        });
    }
});

app.get("/songs/edit/:songKey", async (req, res) => {
    if (!res.locals.user || res.locals.user.role != "admin") {
        res.sendStatus(401);
        return;
    }

    const songKey = req.params.songKey;
    const song = songs.getSongDetailsWithDifficulties(songKey);

    if (!song) {
        return res.sendStatus(404);
    }

    res.render("song_edit", {
        title: `Edit song: ${song.name}`,
        song: song,
        name: song.name,
        jacket: song.jacket,
        game: song.game,
        difficulties: song.difficulties,
        games: games,
    });
});

app.post("/songs/edit/:songKey", async (req, res) => {
    if (!res.locals.user || res.locals.user.role != "admin") {
        res.sendStatus(401);
        return;
    }

    const originalSongKey = req.params.songKey;
    const originalSong = songs.getSongDetailsWithDifficulties(originalSongKey);

    if (!originalSong) {
        return res.sendStatus(404);
    }

    const name = req.body.name;
    const game = parseInt(req.body.game);
    const jacket = req.body.jacket;
    const difficulties = req.body.difficulties;

    const nameErrors = songs.validateSongName(name);
    const gameErrors = songs.validateSongGame(game, games);
    const jacketErrors = await songs.validateSongJacket(jacket);
    const difficultyErrors = songs.validateDifficulties(difficulties);

    let errors = [...nameErrors, ...gameErrors, ...jacketErrors, ...difficultyErrors];

    let newSongKey = songs.generateSongKey(name, game, games);

    if (newSongKey !== originalSongKey && songs.songExists(newSongKey)) {
        errors.push(`Song with key ${newSongKey} already exists`);
    }

    if (errors.length === 0) {
        songs.updateSong(originalSong.song_id, game, newSongKey, name, jacket);
        songs.updateDifficulties(originalSong.song_id, difficulties);
        res.redirect(`/songs/view/${newSongKey}`);
    } else {
        res.render("song_edit", {
            errors,
            title: `Edit song: ${name}`,
            song: originalSong,
            name: name,
            jacket: jacket,
            game: game,
            games: games,
            difficulties: difficulties
        });
    }
});

app.post("/songs/delete/:songKey", (req, res) => {
    if (!res.locals.user || res.locals.user.role != "admin") {
        res.sendStatus(401);
        return;
    }

    const songKey = req.params.songKey;
    songs.deleteSong(songKey);
    res.redirect("/songs");
});

// Paths only administrators can use, seperated from same views for normal users for security reasons
app.get("/admin/users", (req, res) => {
    if (!res.locals.user || res.locals.user.role != "admin") {
        res.sendStatus(401);
        return;
    }

    const users = userModel.getAllUsers();
    res.render("display_users", {
        title: "Manage Users",
        users: users,
        games: games
    });
});

app.get("/diffs/:user_id", (req, res) => {
    if (!res.locals.user || res.locals.user.role != "admin") {
        res.sendStatus(401);
        return;
    }

    const targetUserId = parseInt(req.params.user_id);
    if (isNaN(targetUserId)) {
        return res.status(400).send("Invalid User ID");
    }

    songsData = songs.getOrderedLevelTable();
    res.render("diffs", {
        title: `Scores for User (id: ${targetUserId})`,
        data: songsData,
        games: games,
        apTab: songs.getAPs(targetUserId),
        fcTab: songs.getFCs(targetUserId),
        utils: utils,
        targetUser: targetUserId,
    });
});

app.post("/saveRating/:user_id", (req, res) => {
    if (!res.locals.user || res.locals.user.role != "admin") {
        res.sendStatus(401);
        return;
    }

    const targetUserId = parseInt(req.params.user_id);
    if (isNaN(targetUserId)) {
        return res.status(400).send("Invalid User ID");
    }

    let apIds = req.body.songApIds;
    let fcIds = req.body.songFcIds;

    songs.validateAndSetWeighedTabs(apIds, fcIds, targetUserId);

    res.redirect(`/`);
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
