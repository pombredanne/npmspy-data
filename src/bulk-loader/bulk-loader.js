import amqp from 'amqplib/callback_api';
import fs from 'fs';
import path from 'path';
import request from 'superagent';

const endpoint = process.env.REGISTRY_URI;
const queueHost = `amqp://${process.env.QUEUE_HOST}`;
const priorityQueue = process.env.PRIORITY_QUEUE;

console.log('downloading all ...');
request.get(endpoint, (err, res) => {
	console.log('done.');

	const all = JSON.parse(res.text);
	const packageIds = Object.keys(all);

	amqp.connect(queueHost, function (err, connection) {
		connection.createChannel(function (err, channel) {

			channel.assertQueue(priorityQueue, { durable: true });

			console.log(`Writing ${packageIds.legnth} package IDs ... `);

			let cursor = 240000;
			const chunkSize = 10000;
			const pause = 10000;

			(function writeChunks() {
				console.log(cursor);
				const chunk = packageIds.slice(cursor, cursor + chunkSize);

				chunk.forEach((id, i) => {
					channel.sendToQueue(priorityQueue, new Buffer(JSON.stringify({ id })), { persistent: true });
				});

				cursor += chunkSize;
				if (cursor < packageIds.length) {
					setTimeout(() => writeChunks(), pause);
				} else {
					console.log('Done ... ');
				}
			})();

			// packageIds.slice(200000, 300100).forEach((id, i) => {
			// 	channel.sendToQueue(priorityQueue, new Buffer(JSON.stringify({ id })), { persistent: true });
			// 	if (i % 100000 === 0) {
			// 		console.log(i);
			// 	}
			// });
		});
	});
});
