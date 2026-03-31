import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import songs, { getFCs, insertSong, validateSongJacket } from "./models/songs.js";
import utils from "./utils/util_functions.js";
import settings from "./models/settings.js";
import session from "./models/session.js";
import auth from "./controllers/authentication.js";

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

// TODO: usunac to jak bedzie zrobiony
// PROJEKT NIE GOTOWY DO OCENY

// Notka wstępna: tabela games jest nieedytowalna z poziomu aplikacji 'by design', tworzac analogie do projektu z fiszkami tabela scores to by byly fiszki a tabela songs to kategorie, games istnieje z powodów ideowych projektu. W związku z tym sposoby implementacji różnią się lekko od przykładowego projektu, lecz funkcjonalności zostają takie same. Informacje o terminologii używanej w nazwach zmiennych znajdują się w pliku songs.js

app.get("/", (req, res) => {
    let rating = 0;
    let fcTab = songs.getFCs();
    let apTab = songs.getAPs();

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

// TODO: rename this to diffs
app.get("/songs", (req, res) => {
    songsData = songs.getOrderedLevelTable();
    res.render("songs", {
        title: "Your scores",
        data: songsData,
        games: games,
        apTab: songs.getAPs(),
        fcTab: songs.getFCs(),
        utils: utils
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

app.get("/songs/song_new", (req, res) => {
    res.render("song_new", {
        title: "Add song",
        games: games
    });
});

app.post("/songs/song_new", async (req, res) => {
    let songKey = null;

    const name = req.body.name;
    const game = parseInt(req.body.game);
    const jacket = req.body.jacket;
    const difficulties = req.body.difficulties; // This will be an array of objects { name, level }

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
            difficulties: difficulties // Pass difficulties back to the form
        });
    }
});

app.post("/songs/saveRating", (req, res) => {
    let apIds = req.body.songApIds;
    let fcIds = req.body.songFcIds;

    songs.validateAndSetWeighedTabs(apIds, fcIds);

    res.redirect(`/`);
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
