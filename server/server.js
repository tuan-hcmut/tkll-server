const dotenv = require("dotenv");
const mongoose = require("mongoose");
const initSockets = require("./src/sockets");
const mqtt = require("mqtt");
dotenv.config({ path: "./config.env" });

let users = [];
let currentUser = {
  account: "",
  role: "",
  energyRemaining: 1,
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

  socket.on("data-register", (data) => {
    if (data === undefined) return;
    if (users.length === 0) {
      users.push(data);
      currentUser = data;
    } else {
      let temp = false;
      for (let i = 0; i < users.length; i++) {
        if (users[i].account === data.account) {
          currentUser = users[i];
          temp = true;
          break;
        }
      }
      if (temp === false) {
        users.push(data);
        currentUser = data;
      }
    }
    socket.emit("current-user", currentUser);
  });
  socket.on("disconnect", () => {});

  /////////////// connect to broker //////////////////

  client.on("connect", () => {
    console.log("connect to mqtt broker");
    client.subscribe(process.env.MQTT_TOPIC1.toString(), () => {
      console.log(`Subscribe to topic '${process.env.MQTT_TOPIC1?.toString()}'`);
    });
    client.subscribe(process.env.MQTT_TOPIC2.toString(), () => {
      console.log(`Subscribe to topic '${process.env.MQTT_TOPIC2?.toString()}'`);
    });
    client.subscribe(process.env.MQTT_TOPIC3.toString(), () => {
      console.log(`Subscribe to topic '${process.env.MQTT_TOPIC3?.toString()}'`);
    });
  });
  const handleTransferData = () => {
    client.on("message", (topic, payload) => {
      console.log("Received Message:", topic, payload.toString());
      // esp send num of energy remaining (each time eps send, num of energy will be reduce)
      if (topic.toString() === "mqtt/energyUsed") {
        let energyRemaining = currentUser.energyRemaining - parseInt(payload.toString("utf8"));
        if (energyRemaining <= 0) {
          energyRemaining = 0;
          // client.unsubscribe(process.env.MQTT_TOPIC1.toString(), () => console.log(`UnSubscribe to topic '${process.env.MQTT_TOPIC1?.toString()}'`));
          client.publish("mqtt/energyAvailable", energyRemaining.toString(), { qos: 0, retain: false }, (error) => {
            if (error) {
              console.log(error);
            }
            return;
          });
        } else {
          socket.emit("current-user", currentUser);
        }
        console.log("energy used: " + parseInt(payload.toString("utf8")));
        //const energyRemaining = 10;
        currentUser.energyRemaining = energyRemaining;
        for (let i = 0; i < users.length; i++) {
          if (users[i].account === currentUser.account) {
            users[i].energyRemaining = energyRemaining;
            // socket.emit("current-user", users[i]);
            break;
          }
        }
        console.log(currentUser);
      }

      if (topic.toString() === "mqtt/connection") {
        console.log("device connected");
        if (currentUser.energyRemaining <= 0) {
          socket.emit("out-of-energy", currentUser);
          console.log("no energy left");
          client.publish("mqtt/energyAvailable", currentUser.energyRemaining.toString(), { qos: 0, retain: false }, (error) => {
            if (error) {
              console.log(error);
            }
            return;
          });
        } else {
          socket.emit("current-user", currentUser);
          client.publish("mqtt/energyAvailable", currentUser.energyRemaining.toString(), { qos: 0, retain: false }, (error) => {
            if (error) {
              console.log(error);
            }
          });
        }
      }
    });
  };

  handleTransferData();

  socket.on("buy-more-energy", (data) => {
    const eth = (parseInt(data.eth) / 1000000000000000000).toFixed(2);
    for (let i = 0; i < users.length; i++) {
      if (users[i].account === data.account) {
        users[i].energyRemaining = users[i].energyRemaining + data.energy;
        users[i].ethRemaining = users[i].ethRemaining - eth;
        socket.emit("current-user", users[i]);
        break;
      }
    }
    client.on("message", (topic, payload) => {
      if (topic.toString() === "mqtt/noEnergy") {
        client.publish("mqtt/energyAvailable", currentUser.energyRemaining.toString(), { qos: 0, retain: false }, (error) => {
          if (error) {
            console.log(error);
          }
          return;
        });
      }
    });
  });
});
