import express from 'express';

const app = express();

app.get('/', (req, res) => {
	res.send('hello world (ssl)');
});

app.listen(3000, () => {
	console.log('listening on port 3000');
});
