import express from "express";
import songs, { getFCs } from "./utils/songs.js";
import utils from "./utils/util_functions.js";

const port = 8000;

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

var songsData = songs.getOrderedLevelTable();

function validateData(req, res) {
    let apIds = req.body.songApIds;
    let fcIds = req.body.songFcIds;

    let errors = songs.validateAndSetWeighedTabs(apIds, fcIds, songsData.length);

    return errors;

}

function returnValidated(errors, ifFunct, elseFunct) {
    if (errors.length == 0) {
        ifFunct();
    } else {
        elseFunct();
    }
}


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
    let errors = validateData(req, res);
    returnValidated(errors, function() {
        res.redirect(`/rating`);
    }, function() {
        res.render("song_select_error", {
            errors: errors,
            title: "Add Songs",
            data: songsData,
            apTab: songs.getAPs(),
            fcTab: songs.getFCs(),
            utils: utils
        });
    })
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
