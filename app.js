const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const jwt = require("jsonwebtoken");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();
let jwtToken;

const authenticateToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "djgdyegfhsbhcdb", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login", authenticateToken, async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

app.get("/states/", authenticateToken, async (request, response) => {
  const statesQuery = `
    SELECT * FROM state;`;
  const getStateArray = await db.all(statesQuery);
  response.send(getStateArray);
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const statesQuery = `
    SELECT * FROM state WHERE state_id = ${stateId};`;
  const getStateArray = await db.get(statesQuery);
  response.send(getStateArray);
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const statesQuery = `
  INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
  VALUES(
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
      );`;
  const getStateArray = await db.run(statesQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const statesQuery = `SELECT * FROM district WHERE district_id = '${districtId}'`;
    const getStateArray = await db.get(statesQuery);
    response.send(getStateArray);
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const statesQuery = `DELETE FROM district WHERE district_id = '${districtId}'`;
    const getStateArray = await db.run(statesQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const statesQuery = `
  UPDATE district
  SET
     district_name = '${districtName}',
     state_id = ${stateId},
     cases = ${cases},
     cured = ${cured},
     active = ${active},
     deaths = ${deaths}
    WHERE district_id = ${districtId};`;
    const getStateArray = await db.run(statesQuery);
    response.send("District Details Updated");
  }
);

app.get("/states/:stateId/stats/", async (request, response) => {
  const { stateId } = request.params;
  const getStateDetails = `
    SELECT SUM(cases) as totalCases,
            SUM(cured) as totalCured,
            SUM(active) as totalActive,
            SUM(deaths) as totalDeaths
    FROM district WHERE state_id = ${stateId};`;
  const statesArray = await db.get(getStateDetails);
  console.log(statesArray);
  response.send({
    totalCases: statesArray["totalCases"],
    totalCured: statesArray["totalCured"],
    totalActive: statesArray["totalActive"],
    totalDeaths: statesArray["totalDeaths"],
  });
});

module.exports = app;
