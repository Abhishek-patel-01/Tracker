require("dotenv").config();
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

const trackedUsers = {};

app.get("/", (req, res) => res.render("default"));

app.get("/track/:identifier", (req, res) => {
  res.render("track", { identifier: req.params.identifier });
});

io.on("connection", (socket) => {
  const userIdentifier = socket.handshake.query.userIdentifier;
  socket.userIdentifier = userIdentifier;
  console.log("A user connected:", userIdentifier);

  socket.on("send-location", (data) => {
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
        const orsApiKey = process.env.ORS_API_KEY;
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

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.userIdentifier);
    delete trackedUsers[socket.userIdentifier];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
