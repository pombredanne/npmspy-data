import amqp from 'amqplib/callback_api';
import { handlePackage, ensureIndcies } from './db-importer';

// TODO: move to config
const queueHost = `amqp://${process.env.QUEUE_HOST}`; // 'amqp://192.168.1.106';
const priorityQueue = process.env.PRIORITY_QUEUE; // 'priority';

// Timeout allows rabbitmq and neo4j to start before attempting to operate
console.log('waiting for rabbitmq to start ...');
setTimeout(() =>
	amqp.connect(queueHost, (err, connection) => {
		if (err) {
			console.log(err);
		} else {
			connection.createChannel((err, channel) => {
				channel.assertQueue(priorityQueue, { durable: true });

				ensureIndcies(err => {
					if (err) {
						console.error('Could not create neo4j indecies:');
						console.error(err);
					} else {
						channel.prefetch(1);
						channel.consume(priorityQueue, function (msg) {

							try {
								const content = msg.content.toString();
								console.log(content);

								const packageId = JSON.parse(content).id;

								handlePackage(packageId, err => {
									if (err) {
										console.error(packageId);
										console.error(err);

										const retry = !msg.fields.redelivered;
										if (msg.fields.redelivered || err.code === 'ECONNABORTED') {
											console.log('abandoning message ...');
											channel.nack(msg, false, false);
										} else {
											channel.nack(msg, false, true);
										}
									} else {
										console.log(packageId);
										console.log('done');
										channel.ack(msg);
									}
								});
							} catch (ex) {
								//console.error(packageId);
								console.error(ex);
								console.log('abandoning message ...');
								channel.nack(msg, false, false);
							}

						}, { noAck: false });
					}
				});
			});
		}
	})
	, 10000);
