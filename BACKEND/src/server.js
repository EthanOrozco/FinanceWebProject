const express = require('express');
const cors = require('cors');
const path = require('path');

const usersRoutes = require('./routes/users.routes');
const accountsRoutes = require('./routes/accounts.routes');
const categoriesRoutes = require('./routes/categories.routes');
const goalsRoutes = require('./routes/goals.routes');
const transactionsRoutes = require('./routes/transactions.routes')
const viewsRoutes = require('./routes/views.routes');

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.resolve(__dirname, '../../FRONTEND/src')))

app.use('/api/users', usersRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/transactions', transactionsRoutes);

app.use('/', viewsRoutes);

app.listen(port, () => {
  console.log(`server running on http://localhost:${port}`);
});
