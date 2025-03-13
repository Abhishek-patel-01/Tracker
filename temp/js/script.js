document.addEventListener("DOMContentLoaded", () => {
  const userIdentifier = window.location.pathname.split("/").pop();
  const socket = io({ query: { userIdentifier } });

  const map = L.map("map").setView([0, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "Map data &copy; OpenStreetMap",
  }).addTo(map);

  const markers = {};
  let routePolyline = null;

  function fetchLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (position) => {
          socket.emit("send-location", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert("Could not get your location.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
      );
    } else {
      alert("Geolocation is not supported.");
    }
  }

  fetchLocation();

  socket.on("receive-location", (data) => {
    if (markers[data.userIdentifier]) {
      markers[data.userIdentifier].setLatLng([data.latitude, data.longitude]);
    } else {
      markers[data.userIdentifier] = L.marker([
        data.latitude,
        data.longitude,
      ]).addTo(map);
    }
    map.setView([data.latitude, data.longitude], 16);
  });

  document.getElementById("calculate-route").addEventListener("click", () => {
    const user1 = prompt("Enter first user identifier:");
    const user2 = prompt("Enter second user identifier:");
    if (user1 && user2) {
      socket.emit("calculate-route", {
        user1Identifier: user1,
        user2Identifier: user2,
      });
    }
  });

  socket.on("route-drawn", (data) => {
    if (routePolyline) map.removeLayer(routePolyline);
    routePolyline = L.polyline(data.routeCoordinates, {
      color: "blue",
    }).addTo(map);
    map.fitBounds(routePolyline.getBounds());
  });

  socket.on("route-error", (msg) => alert(msg));
});
