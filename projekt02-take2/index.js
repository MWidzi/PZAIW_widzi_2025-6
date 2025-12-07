import express from "express";
import songs from "./utils/songs.js";

const port = 8000;

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded());

app.get("/songs", (req, res) => {
    res.render("songs", {
        title: "Add Songs",
        data: songs.getOrderedLevelTable(),
    });
});

app.post("/songs/saveRating", (req, res) => {
    songs.setAPs(req.body.songApIds);
    songs.setFCs(req.body.songApIds);
    res.redirect(`/songs`);

});

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
