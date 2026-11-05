const express = require('express');
const cors = require('cors');
const path = require('path');
const viewsRoutes = require('./routes/views.routes');
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.resolve(__dirname, '../../FRONTEND/src')))

app.use('/', viewsRoutes);

app.listen(port, () => {
  console.log(`server running on http://localhost:${port}`);
});