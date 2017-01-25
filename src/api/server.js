import express from 'express';
import swaggerizeUI from 'swaggerize-ui';

import * as swaggerValidator from './utility/swagger-validator';

import packageController from './package-controller';

import swagger from './swagger.json';

const app = express();

app.get('/', (req, res) => {
	res.json({ message: 'visit /docs for project documentation' });
});

// Enable documentation
app.use('/docs.json', (req, res) => res.json(require('./swagger')));
app.use('/docs', swaggerizeUI({ docs: '/docs.json' }));

app.use(swaggerValidator.middleware({
	swaggerDefinition: swagger,
	exceptions: ['^/favicon\.ico$']
}));

app.use('/packages', packageController);

// app.get('/:versionId', (req, res) => {
// 	services.treeService.getTree(
// 		req.params.versionId, {
// 			ts: req.query.ts
// 		}, (err, response) => {
// 			if (err) {
// 				res.status(503).send({ err });
// 			} else if (response) {
// 				res.send(response);
// 			} else {
// 				res.status(404).send({ message: 'Tree not found' });
// 			}
// 		});
// });

// app.get('/:versionId/diffs', (req, res) => {
// 	services.diffService.getDiffs(
// 		req.params.versionId, {
// 			before: req.query.before,
// 			after: req.query.after,
// 			count: req.query.count
// 		}, (err, response) => {
// 			if (err) {
// 				res.status(503).send({ err });
// 			} else if (response) {
// 				res.send(response);
// 			} else {
// 				res.status(404).send({ message: 'No diffs found' });
// 			}
// 		});
// });

app.use(swaggerValidator.errorHandler);

app.use((err, req, res, next) => {
	if (!res.headersSent) {
		res.status(500).send({
			code: 'UNHANDLED_ERROR',
			title: 'Unhandled Error',
			details: err.message,
			meta: err
		});
	}
});

const port = 3001;
app.listen(port, function () {
	console.log(`npmgraph API listening on port ${port}!`);
});
