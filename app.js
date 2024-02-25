require("./config/db.js");
const bodyParser = require("body-parser");
const express = require("express");
const authRoutes = require("./routes/auth.routes");
const filesRoutes = require("./routes/files.routes");
const app = express();
const cors = require("cors");

const corsOptions = {
  origin: 'https://my-watching-base.sanren.fr',
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
  credentials: true
};

app.use(cors((corsOptions)));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.raw({ type: "application/octet-stream", limit: "1000mb" }));

app.use("/backend/api/auth", authRoutes);

app.use("/backend", filesRoutes);

app.use("/backend/files", express.static("files"));

app.listen(process.env.PORT, () => {
  console.log(`listening on port ${process.env.PORT}`);
});
