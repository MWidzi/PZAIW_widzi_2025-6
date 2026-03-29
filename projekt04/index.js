import express from "express";
import morgan from "morgan";
import songs, { getFCs } from "./utils/songs.js";
import utils from "./utils/util_functions.js";

const port = 8000;

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

const songsData = songs.getOrderedLevelTable();
const games = songs.getGamesTable();

// Notka wstępna: tabela games jest nieedytowalna z poziomu aplikacji 'by design', tworzac analogie do projektu z fiszkami tabela scores to by byly fiszki a tabela songs to kategorie, games istnieje z powodów ideowych projektu. W związku z tym sposoby implementacji różnią się lekko od przykładowego projektu, lecz funkcjonalności zostają takie same. Informacje o terminologii używanej w nazwach zmiennych znajdują się w pliku songs.js

app.get("/rating", (req, res) => {
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
    res.render("songs", {
        title: "Your scores",
        data: songsData,
        games: games,
        apTab: songs.getAPs(),
        fcTab: songs.getFCs(),
        utils: utils
    });
});

app.get("/songs/:key", (req, res) => {
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

app.post("/songs/song_new", (req, res) => {
    // TODO: w projekcie przykladowym category id jest dodatkowo zrobione zeby byla przyjazna nazwa w linku, trzeba to dodać do bazy i ogolnie
});

app.post("/songs/saveRating", (req, res) => {
    let apIds = req.body.songApIds;
    let fcIds = req.body.songFcIds;

    songs.validateAndSetWeighedTabs(apIds, fcIds);

    res.redirect(`/rating`);
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
