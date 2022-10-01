const initSockets = (io) => {
  let clients = {};
  io.on("connection", (socket) => {
    console.log("Socket connected!!");

    socket.on("disconnect", () => {});
  });
};

module.exports = initSockets;
