
"use strict";

/*
  TRUSTCHAIN FRONTEND LOGIC
  This project uses localStorage as a fake database.
  It is okay for hackathon demo, but not safe for real passwords.
*/

const STORAGE_USERS = "trustchainUsers";
const STORAGE_CURRENT_USER_ID = "currentUserId";

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "login") {
    setupLoginPage();
  }

  if (page === "signup") {
    setupSignupPage();
  }

  if (page === "profile") {
    setupProfilePage();
  }

  if (page === "scan") {
    setupScanPage();
  }
});

/* ---------- localStorage helpers ---------- */

function getUsers() {
  const rawUsers = localStorage.getItem(STORAGE_USERS);

  if (!rawUsers) {
    return [];
  }

  try {
    return JSON.parse(rawUsers);
  } catch (error) {
    console.error("Failed to read users:", error);
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

function getCurrentUserId() {
  return localStorage.getItem(STORAGE_CURRENT_USER_ID);
}

function setCurrentUserId(userId) {
  localStorage.setItem(STORAGE_CURRENT_USER_ID, userId);
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE_CURRENT_USER_ID);
}

function findUserById(userId) {
  return getUsers().find((user) => user.id === String(userId));
}

function findUserByUsername(username) {
  return getUsers().find(
    (user) => user.username.toLowerCase() === username.toLowerCase()
  );
}

function createUserId() {
  return String(Date.now());
}

function setMessage(text, type = "error") {
  const message = document.getElementById("message");

  if (!message) {
    return;
  }

  message.textContent = text;
  message.className = type === "success" ? "success-message" : "error-message";
}

/* ---------- login ---------- */

function setupLoginPage() {
  const loginForm = document.getElementById("loginForm");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");

  if (!loginForm) {
    return;
  }

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!username || !password) {
      setMessage("Please enter username and password.");
      return;
    }

    const user = findUserByUsername(username);

    if (!user || user.password !== password) {
      setMessage("Username or password is incorrect.");
      return;
    }

    setCurrentUserId(user.id);

    setMessage("Login successful!", "success");

    window.location.href = `profile.html?id=${encodeURIComponent(user.id)}`;
  });

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (event) => {
      event.preventDefault();
      setMessage("For this demo, please create a new account if you forgot your password.");
    });
  }
}

/* ---------- signup ---------- */

function setupSignupPage() {
  const signupForm = document.getElementById("signupForm");

  if (!signupForm) {
    return;
  }

  signupForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = document.getElementById("signupUsername").value.trim();
    const password = document.getElementById("signupPassword").value;
    const roleInput = document.getElementById("signupRole").value.trim();

    const role = roleInput || "Citizen";

    if (!username || !password) {
      setMessage("Please enter username and password.");
      return;
    }

    const users = getUsers();
    const existingUser = users.find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );

    if (existingUser) {
      setMessage("This username already exists. Please choose another one.");
      return;
    }

    const newUser = {
      id: createUserId(),
      username,
      password,
      role,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);
    setCurrentUserId(newUser.id);

    setMessage("Account created successfully!", "success");

    window.location.href = `profile.html?id=${encodeURIComponent(newUser.id)}`;
  });
}

/* ---------- profile ---------- */

function setupProfilePage() {
  const params = new URLSearchParams(window.location.search);

  const profileIdFromUrl = params.get("id");
  const currentUserId = getCurrentUserId();

  const profileId = profileIdFromUrl || currentUserId;

  if (!profileId) {
    window.location.href = "index.html";
    return;
  }

  const user = findUserById(profileId);

  if (!user) {
    document.getElementById("profileUsername").textContent = "Unknown User";
    document.getElementById("profileRole").textContent = "Unknown";
    document.getElementById("profileId").textContent = profileId;
    setMessage("This profile does not exist.");
    return;
  }

  document.getElementById("profileUsername").textContent = user.username;
  document.getElementById("profileRole").textContent = user.role;
  document.getElementById("profileId").textContent = user.id;

  renderConfidence(user);
  renderProfileQRCode(user);
  renderGraph(user);

  const scanButton = document.getElementById("scanButton");
  const logoutButton = document.getElementById("logoutButton");

  if (scanButton) {
    scanButton.addEventListener("click", () => {
      window.location.href = "scan.html";
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      clearCurrentUser();
      window.location.href = "index.html";
    });
  }
}

function renderConfidence(user) {
  const confidenceScore = document.getElementById("confidenceScore");
  const vouchCount = document.getElementById("vouchCount");

  if (!window.TrustGraph) {
    confidenceScore.textContent = "0";
    vouchCount.textContent = "0";
    return;
  }

  const agg = window.TrustGraph.aggregateConfidence(user.id);

  confidenceScore.textContent = String(agg.score);
  vouchCount.textContent = String(agg.count);
}

function renderProfileQRCode(user) {
  const qrCode = document.getElementById("qrCode");

  if (!qrCode || !window.QRCode) {
    return;
  }

  qrCode.innerHTML = "";

  const profileUrl = new URL(
    `profile.html?id=${encodeURIComponent(user.id)}`,
    window.location.href
  ).href;

  new QRCode(qrCode, {
    text: profileUrl,
    width: 180,
    height: 180,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function renderGraph(user) {
  const graphMount = document.getElementById("trustGraphMount");

  if (!graphMount || !window.TrustGraph) {
    return;
  }

  window.TrustGraph.renderTrustGraph(graphMount, user.id, {
    centerPatch: {
      displayName: user.username,
      role: user.role
    }
  });
}

/* ---------- scan ---------- */

function setupScanPage() {
  const scanMessage = document.getElementById("scanMessage");
  const backToProfile = document.getElementById("backToProfile");

  if (backToProfile) {
    backToProfile.addEventListener("click", () => {
      const currentUserId = getCurrentUserId();

      if (currentUserId) {
        window.location.href = `profile.html?id=${encodeURIComponent(currentUserId)}`;
      } else {
        window.location.href = "index.html";
      }
    });
  }

  if (!window.Html5Qrcode) {
    scanMessage.textContent = "QR scanner library failed to load.";
    return;
  }

  const html5QrCode = new Html5Qrcode("reader");

  function onScanSuccess(decodedText) {
    scanMessage.textContent = "QR code scanned successfully!";

    html5QrCode
      .stop()
      .then(() => {
        const targetUrl = parseTrustChainProfileUrl(decodedText);

        if (targetUrl) {
          window.location.href = targetUrl;
        } else {
          scanMessage.textContent = "Invalid TrustChain QR code.";
        }
      })
      .catch((error) => {
        console.error("Failed to stop scanner:", error);
      });
  }

  function onScanFailure() {
    /*
      This runs many times while scanning.
      Do not console.log here, otherwise the console gets spammed.
    */
  }

  Html5Qrcode.getCameras()
    .then((cameras) => {
      if (!cameras || cameras.length === 0) {
        scanMessage.textContent = "No camera found.";
        return;
      }

      return html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250
          }
        },
        onScanSuccess,
        onScanFailure
      );
    })
    .catch((error) => {
      console.error(error);
      scanMessage.textContent = "Camera access failed. Please allow camera permission.";
    });
}

function parseTrustChainProfileUrl(decodedText) {
  try {
    const url = new URL(decodedText, window.location.href);
    const isProfilePage = url.pathname.endsWith("profile.html");
    const profileId = url.searchParams.get("id");

    if (!isProfilePage || !profileId) {
      return null;
    }

    return `profile.html?id=${encodeURIComponent(profileId)}`;
  } catch (error) {
    console.error("Invalid QR text:", error);
    return null;
  }
}
