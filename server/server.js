const dotenv = require("dotenv");
const mongoose = require("mongoose");
const initSockets = require("./src/sockets");
const mqtt = require("mqtt");
dotenv.config({ path: "./config.env" });

let customer = [];
let seller = [];
let currentUser = {
  username: "",
  role: "",
  energyRemaining: 0,
  ethRemaining: 0,
};

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

const client = mqtt.connect(`mqtt://${process.env.MQTT_SERVER}:${process.env.MQTT_PORT}`, {
  clientId: process.env.MQTT_CLIENTID,
  clean: true,
  connectTimeout: 4000,
  username: process.env.MQTT_USERNAME.toString(),
  password: process.env.MQTT_PASSWORD.toString(),
  reconnectPeriod: 1000,
});

const handleSave = (type, data) => {
  if (type.length === 0) {
    type.push(data);
    currentUser = data;
  }
  for (let i = 0; i < type.length; i++) {
    if (type[i].username === data.username) {
      currentUser = type[i];
      socket.emit("error", { message: "username already exist!!", data: type[i] });
      break;
    } else {
      type.push(data);
      currentUser = data;
      socket.emit("success", { message: "Add success!!!", data: data });
      break;
    }
  }
  // console.log(customer, currentUser);
};
//////// socket /////////////////

const io = require("socket.io")(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("data-register", (data) => {
    ///// data : {username: String, role: String, energyRemaining: Number, ethRemaining: Number}   //////
    data.type === "buyer" ? handleSave(customer, data) : handleSave(seller, data);
  });
  socket.on("disconnect", () => {});

  /////////////// connect to broker //////////////////

  client.on("connect", () => {
    client.subscribe(process.env.MQTT_TOPIC.toString(), () => {
      console.log(`Subscribe to topic '${process.env.MQTT_TOPIC.toString()}'`);
    });
  });

  client.on("message", (topic, payload) => {
    // console.log("Received Message:", topic, payload.toString());
    // esp send num of energy remaining (each time eps send, num of energy will be reduce)
    if (topic.toString() === "mqtt/nodejs") {
      const energyRemaining = currentUser.energyRemaining - 1;
      currentUser.energyRemaining = energyRemaining;
      if (energyRemaining <= 0) {
        client.publish(process.env.MQTT_TOPIC.toString(), "Done", { qos: 0, retain: false }, (error) => {
          if (error) {
            console.log(error);
          }
        });
        socket.emit("energy-gone", "Energy is 0!!!");
      } else {
        client.publish(process.env.MQTT_TOPIC.toString(), energyRemaining.toString(), { qos: 0, retain: false }, (error) => {
          if (error) {
            console.log(error);
          }
        });
        socket.emit("energy-remaining", energyRemaining);
      }
    }
  });
});

// initSockets(io);
