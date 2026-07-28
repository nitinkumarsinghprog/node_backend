require('dotenv').config();
const express = require('express');
const app = express();

const port = process.env.PORT || 4000;

app.get('/', (req, res) => {
    const data =[{
        status : "running",
        statusCode : 200
    }]
  res.send(data);
});

app.get("/login", (req, res) => {
    res.send("<h1>welcome********* to the login get method</h1>");
});

app.listen(port, () => {
  console.log(`Server is running on the port ${port}`);
});