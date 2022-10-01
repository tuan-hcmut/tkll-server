const dotenv = require("dotenv");
const mongoose = require("mongoose");
const initSockets = require("./src/sockets");
const mqtt = require("mqtt");
dotenv.config({ path: "./config.env" });

const app = require("./app");

const DB = process.env.DATABASE;
mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then((res) => {
    console.log("DB connected!!");
  });

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`Listen on port 127.0.0.1:${port}`);
});

const client = mqtt.connect("mqtt://test.mosquitto.org", {
  host: "energy-blockchain.cloud.shiftr.io",
  port: 1883,
});

client.on("connect", () => {
  console.log("sdfsdfsd");
});
const io = require("socket.io")(server, { cors: { origin: "*" } });

initSockets(io);
