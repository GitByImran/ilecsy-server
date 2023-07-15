const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("server connected");
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`app is running on port ${port}`);
});
