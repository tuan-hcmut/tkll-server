const initSockets = (io) => {
  let clients = {};
  io.on("connection", (socket) => {
    console.log("Socket connected!!");

    socket.on("new-connect", () => {
      console.log("hello!!!");
    });
    socket.on("disconnect", () => {});
  });
};

module.exports = initSockets;
