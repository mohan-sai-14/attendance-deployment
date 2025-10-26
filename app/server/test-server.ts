import express from 'express';

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send('Test server is running!');
});

app.listen(PORT, () => {
  console.log(`Test server is running on http://localhost:${PORT}`);
});
