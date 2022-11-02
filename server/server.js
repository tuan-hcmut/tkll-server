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

const port = process.env.PORT || 3001;

const server = app.listen(port, () => {
  console.log(`Listen on port 127.0.0.1:${port}`);
});

const client = mqtt.connect(
  `mqtt://${process.env.MQTT_SERVER}:${process.env.MQTT_PORT}`,
  {
    clientId: process.env.MQTT_CLIENTID,
    clean: true,
    connectTimeout: 4000,
    username: process.env.MQTT_USERNAME.toString(),
    password: process.env.MQTT_PASSWORD.toString(),
    reconnectPeriod: 1000,
  }
);

client.on("connect", () => {
  console.log("connected");

  client.subscribe(process.env.MQTT_TOPIC.toString(), () => {
    console.log(`Subscribe to topic '${process.env.MQTT_TOPIC.toString()}'`);
  });

  client.publish(
    process.env.MQTT_TOPIC.toString(),
    "nodejs mqtt test",
    { qos: 0, retain: false },
    (error) => {
      if (error) {
        console.error(error);
      }
    }
  );
});

client.on("message", (topic, payload) => {
  console.log("Received Message:", topic, payload.toString());
});

const io = require("socket.io")(server, { cors: { origin: "*" } });

initSockets(io);
