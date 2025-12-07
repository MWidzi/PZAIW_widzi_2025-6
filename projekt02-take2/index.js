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
        data: songs.getData(),
    });
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
