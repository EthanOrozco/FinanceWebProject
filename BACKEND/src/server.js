require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

if (!process.env.JWT_SECRET) { throw new Error('Falta JWT_SECRET en .env') };

const connectDB = require('./config/db');
const port = process.env.PORT || 3000;
const errorHandler = require('./middleware/errorHandler');

const usersRoutes = require('./routes/users.routes');
const accountsRoutes = require('./routes/accounts.routes');
const categoriesRoutes = require('./routes/categories.routes');
const goalsRoutes = require('./routes/goals.routes');
const transactionsRoutes = require('./routes/transactions.routes')
const viewsRoutes = require('./routes/views.routes');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.resolve(__dirname, '../../FRONTEND/src')))

app.use('/api/users', usersRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/transactions', transactionsRoutes);

app.use('/', viewsRoutes);

app.use(errorHandler);

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`server listening on http://localhost:${port}`);
  });
});
