import amqp from 'amqplib/callback_api';
import fs from 'fs';
import path from 'path';
import request from 'superagent';

const replicationHost = process.env.REPLICATION_HOST; // 'https://replicate.npmjs.com';
const queueHost = `amqp://${process.env.QUEUE_HOST}`; // 'amqp://192.168.1.106';
const priorityQueue = process.env.PRIORITY_QUEUE; // 'priority';

const seqfile = process.env.NODE_ENV === 'production' ? '/state/seq' : 'seq';

const interval = 5000;

// Timeout allows rabbitmq to start before attempting to open the connection
console.log('waiting for rabbitmq to start ...');
setTimeout(() =>
	amqp.connect(queueHost, (err, connection) => {
		if (err) {
			console.log(err);
		} else {
			connection.createChannel(function (err, channel) {
				channel.assertQueue(priorityQueue, { durable: true });

				console.log('getting initial update_seq');
				getseq((err, result) => {
					if (err || !result) {
						console.log('(reset to latest change)');
						request.get(`${replicationHost}/`, (err, res) => {
							if (err) {
								console.log(err);
							} else {
								watch(res.body.update_seq, channel);
							}
						});
					} else {
						console.log('(picking up where we left off)');
						watch(Number(result), channel);
					}
				});
			});
		}
	})
	, 10000);

function watch(seq, channel) {
	let lastSeq = seq;
	console.log(`starting at ${lastSeq}...`);

	// Repeatedly fetch changes since last sequence ID
	(function loop() {
		request.get(`${replicationHost}/_changes?since=${lastSeq}&limit=200`, (err, res) => {
			if (err) {
				console.log(err);
			} else {
				lastSeq = res.body.last_seq;
				handleChanges(res.body.results, channel);
			}
			setseq('' + lastSeq, err => {
				if (err) {
					console.log(err);
				}
				setTimeout(loop, interval);
			});
		});
	})();
}

function handleChanges(changes, channel) {
	if (changes.length > 0) {
		changes.forEach(change => {
			change.changes.forEach(c => {
				var obj = { id: change.id, rev: c.rev, seq: change.seq, deleted: c.deleted || false };

				// Note: on Node 6 Buffer.from(msg) should be used
				channel.sendToQueue(priorityQueue, new Buffer(JSON.stringify(obj)), { persistent: true });
				console.log(obj);
			});
		});
	}
}

function getseq(callback) {
	fs.readFile(seqfile, 'utf8', (err, result) => {
		callback(err, result);
	});
}

function setseq(value, callback) {
	fs.writeFile(seqfile, '' + value, err => {
		callback(err);
	});
}
