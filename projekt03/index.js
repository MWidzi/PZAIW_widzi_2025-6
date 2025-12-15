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

var songsData = songs.getOrderedLevelTable();

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

    songs.validateAndSetWeighedTabs(apIds, fcIds);

    res.redirect(`/rating`);
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
