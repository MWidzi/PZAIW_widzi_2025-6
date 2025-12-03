import express from "express";

const port = 8000;

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded());

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
