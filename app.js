const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const socketio = require("socket.io");
const axios = require("axios");

const server = http.createServer(app);
const io = socketio(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

const trackedUsers = {}; // Store location by unique identifier

app.get("/track/:identifier", function (req, res) {
  res.render("index", { identifier: req.params.identifier });
});

io.on("connection", function (socket) {
  const userIdentifier = socket.handshake.query.userIdentifier;
  socket.userIdentifier = userIdentifier;
  console.log("A user connected:", userIdentifier);

  socket.on("send-location", function (data) {
    if (userIdentifier) {
      trackedUsers[userIdentifier] = data;
      io.sockets.emit("receive-location", {
        id: socket.id,
        userIdentifier,
        ...data,
      });
    }
  });

  socket.on("calculate-route", async (data) => {
    const { user1Identifier, user2Identifier } = data;
    const start = trackedUsers[user1Identifier];
    const end = trackedUsers[user2Identifier];

    if (start && end) {
      try {
        const orsApiKey =
          "5b3ce3597851110001cf62483e92f555d7f946399d5fa43372c5ad47"; // Replace with your actual API key
        const response = await axios.get(
          `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsApiKey}&start=${start.longitude},${start.latitude}&end=${end.longitude},${end.latitude}`
        );

        const routeCoordinates =
          response.data.features[0].geometry.coordinates.map((coord) => [
            coord[1],
            coord[0],
          ]);

        io.sockets.emit("route-drawn", {
          user1Identifier,
          user2Identifier,
          routeCoordinates,
        });
      } catch (error) {
        console.error("Route calculation error:", error);
        socket.emit("route-error", "Error calculating route.");
      }
    } else {
      socket.emit(
        "route-error",
        "Could not find locations for selected users."
      );
    }
  });

  socket.on("disconnect", function () {
    delete trackedUsers[userIdentifier];
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
