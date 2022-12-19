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

//////// socket /////////////////

const io = require("socket.io")(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("socket connected");
  const handleSave = (type, data) => {
    data.energyRemaining = 20;
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
  socket.on("data-register", (data) => {
    ///// data : {username: String, role: String, energyRemaining: Number, ethRemaining: Number}   //////
    data.type === "buyer" ? handleSave(customer, data) : handleSave(seller, data);
    socket.emit("EnergyRemaining", currentUser.energyRemaining);
    console.log(currentUser);
  });
  socket.on("disconnect", () => {});

  /////////////// connect to broker //////////////////

  client.on("connect", () => {
    console.log("connect to mqtt broker");
    client.subscribe(process.env.MQTT_TOPIC1.toString(), () => {
      console.log(`Subscribe to topic ${process.env.MQTT_TOPIC1?.toString()}`);
    });
    client.subscribe(process.env.MQTT_TOPIC2.toString(), () => {
      console.log(`Subscribe to topic ${process.env.MQTT_TOPIC2?.toString()}`);
    });
    client.subscribe(process.env.MQTT_TOPIC3.toString(), () => {
      console.log(`Subscribe to topic ${process.env.MQTT_TOPIC3?.toString()}`);
    });
  });
  const handleTransferData = () => {
    console.log("start again");
    client.on("message", (topic, payload) => {
      console.log("Received Message:", topic, payload.toString());
      // esp send num of energy remaining (each time eps send, num of energy will be reduce)
      if (topic.toString() === "mqtt/energyUsed") {
        const energyRemaining = currentUser.energyRemaining - parseInt(payload.toString("utf8"));
        console.log("energy used: " + parseInt(payload.toString("utf8")));
        //const energyRemaining = 10;
        currentUser.energyRemaining = energyRemaining;
        if (currentUser.energyRemaining < 0) {
          currentUser.energyRemaining = 0;
        }
        socket.emit("EnergyRemaining", currentUser.energyRemaining);
        console.log(currentUser);
      }
      if (topic.toString() === "mqtt/connection") {
        console.log("device connected");
        if (currentUser.energyRemaining <= 0) {
          currentUser.energyRemaining = 0;
          socket.emit("out-of-energy", "");
          console.log("no energy left");
          client.publish("mqtt/remainingEnergy", "done", { qos: 0, retain: false }, (error) => {
            if (error) {
              console.log(error);
            }
            return;
          });
        } else {
          console.log("start connected, eneryremaning: " + currentUser.energyRemaining);
          client.publish("mqtt/remainingEnergy", "keep", { qos: 0, retain: false }, (error) => {
            if (error) {
              console.log(error);
            }
          });
        }
      }
      if (currentUser.energyRemaining <= 0) {
        currentUser.energyRemaining = 0;
        socket.emit("out-of-energy", "");
        console.log("no energy left");
        client.publish("mqtt/remainingEnergy", "done", { qos: 0, retain: false }, (error) => {
          if (error) {
            console.log(error);
          }
          return;
        });
      } else {
        client.publish("mqtt/remainingEnergy", "keep", { qos: 0, retain: false }, (error) => {
          if (error) {
            console.log(error);
          }
        });
      }
    });
  };

  handleTransferData();

  socket.on("buy-more-energy", (data) => {
    currentUser.energyRemaining = currentUser.energyRemaining + data;
    handleTransferData();
    console.log(currentUser.energyRemaining);
  });
});
