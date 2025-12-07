import express from "express";
import songs, { getFCs } from "./utils/songs.js";
import utils from "./utils/util_functions.js";

const port = 8000;

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

var songsData = songs.getOrderedLevelTable();

app.get("/rating", (req, res) => {
    let rating = 0;
    let fcTab = songs.getFCs();
    let apTab = songs.getAPs();

    fcTab.forEach((id) => {
        rating += songs.calcSongRating(songsData[id].game, songsData[id].lvl - 1);
    })
    apTab.forEach((id) => {
        rating += songs.calcSongRating(songsData[id].game, songsData[id].lvl);
    })

    rating = rating / (fcTab.length + apTab.length);
    rating = Number.isNaN(rating) ? 0 : rating.toFixed(2);

    res.render("rating", {
        title: "Your Rating",
        rating: rating,
        data: songsData,
        apTab: apTab,
        fcTab: fcTab,
        calcSongRating: songs.calcSongRating
    });
});

app.get("/songs", (req, res) => {
    res.render("songs", {
        title: "Add Songs",
        data: songsData,
        apTab: songs.getAPs(),
        fcTab: songs.getFCs(),
        utils: utils
    });
});

app.post("/songs/saveRating", (req, res) => {
    let apIds = req.body.songApIds;
    let fcIds = req.body.songFcIds;

    songs.validateAndSetWeighedTabs(apIds, fcIds, songsData.length);

    // TODO: Add error handling, validation in the rest of the paths, fallback 404 for not found path

    res.redirect(`/rating`);
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
