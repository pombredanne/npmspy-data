import request from 'superagent';

const replicationHost = process.env.REPLICATION_HOST; // 'https://replicate.npmjs.com';
const queueHost = `amqp://${process.env.QUEUE_HOST}`; // 'amqp://192.168.1.106';
const priorityQueue = process.env.PRIORITY_QUEUE; // 'priority';
const endpoint = `http://${process.env.NEO4J_HOST}:7474/db/data/transaction/commit`;
const authorization = `Basic ${process.env.NEO4J_AUTH}`;

export function handlePackage(id, callback) {
	callback = callback || function () { };

	request.get(`${replicationHost}/${id.replace('/', '%2f')}`, (err, res) => {

		getRevAndVersions(id, (err, result) => {
			const data = res.body;
			if (err) {
				callback(err);
			} else if (data.error) {
				callback(data);
			} else if (result && result.rev && Number(result.rev.split('-')[0]) >= Number(data._rev.split('-')[0])) {
				callback();
			} else {

				const versions = data.versions;
				const times = data.time || {};

				let versionsWithDependencies = [];
				let versionsWithoutDependencies = [];

				let newVersions = [];

				if (versions) {
					Object.keys(versions).forEach(key => {
						if (result && result.versions.indexOf(key) > -1) {
							return;
						}

						const version = versions[key];
						const time = times[key];
						const ts = time ? new Date(time).getTime() : 0;

						newVersions.push({ name: key, ts });

						let deps = [];

						mapDependencies(version.dependencies || []).forEach(d => deps.push({ v: key, ts, id: d.id, sv: d.semver, t: '' }));
						mapDependencies(version.devDependencies || []).forEach(d => deps.push({ v: key, ts, id: d.id, sv: d.semver, t: 'dev' }));
						mapDependencies(version.peerDependencies || []).forEach(d => deps.push({ v: key, ts, id: d.id, sv: d.semver, t: 'peer' }));
						mapDependencies(version.optionalDependencies || []).forEach(d => deps.push({ v: key, ts, id: d.id, sv: d.semver, t: 'optional' }));
						mapDependencies(version.bundledDependencies || version.bundleDependencies || []).forEach(d => deps.push({ v: key, ts, id: d.id, sv: d.semver, t: 'bundled' }));

						if (deps.length === 0) {
							versionsWithoutDependencies.push({ v: key, ts });
						}

						deps.forEach(d => versionsWithDependencies.push(d));
					});
				}

				writeVersions(data._id, data._rev, versionsWithDependencies, versionsWithoutDependencies, (err, results) => {
					if (err) {
						callback(err);
					} else {
						writeDownstream(data._id, newVersions, (err, results) => {
							if (err) {
								callback(err);
							} else {
								writeUpstream(data._id, newVersions, callback);
							}
						});
					}
				});
			}
		});
	});
}

export function ensureIndcies(callback) {
	request
		.get(`http://${process.env.NEO4J_HOST}:7474/db/data/schema/index`)
		.set('Authorization', authorization)
		.end((err, result) => {
			if (err) {
				callback(err);
			} else if (result && result.body) {
				if (result.body.length < 2) {

					const statements = [
						{ statement: 'CREATE CONSTRAINT ON (p:Package) ASSERT p.id IS UNIQUE' },
						{ statement: 'CREATE CONSTRAINT ON (v:Version) ASSERT v.id IS UNIQUE' }
					];

					query(statements, 10000, callback);

				} else {
					callback();
				}
			} else {
				callback('UNEXPECTED_RESULT');
			}
		});
}

function writeVersions(id, rev, versionsWithDependencies, versionsWithoutDependencies, callback) {
	console.log('writing versions...');
	// TODO: optimize when there are a large number of versions
	let statements = [{
		statement: `
			UNWIND {dat} as line
			MERGE (p:Package {id: {id}})
			MERGE (v:Version {id: {id} + "@" + line.v})
			MERGE (p)-[:RELEASED_AS]->(v)
			MERGE (d:Package {id: line.id})
			MERGE (v)-[:DEPENDS_ON {semver: line.sv, type: line.t}]->(d)
			SET p.rev = {rev}
			SET v.ts = line.ts, v.name = line.v`,
		parameters: { id, rev, dat: versionsWithDependencies }
	}];

	if (versionsWithoutDependencies.length > 0) {
		statements.push({
			statement: `
				UNWIND {dat} as line
				MERGE (p:Package {id: {id}})
				MERGE (v:Version {id: {id} + "@" + line.v})
				MERGE (p)-[:RELEASED_AS]->(v)
				SET p.rev = {rev}
				SET v.ts = line.ts, v.name = line.v`,
			parameters: { id, rev, dat: versionsWithoutDependencies }
		});
	}

	query(statements, 120000, (err, result) => {
		if (err) {
			callback(err);
		} else if (result.errors && result.errors.length > 0) {
			callback(result.errors);
		} else {
			callback(null, result.results);
		}
	});
}

function writeDownstream(id, newVersions, callback) {
	console.log('writing downstream...');

	if (!Array.isArray(newVersions) || newVersions.length < 1) {
		return callback();
	}

	let versions = newVersions.slice().sort((a, b) => b.ts - a.ts);

	(function loop() {

		var newVersion = versions.shift();

		const statements = [{
			statement: `
				MATCH (v1:Version {id: {versionId}})-[r:DEPENDS_ON]->(d:Package)-[:RELEASED_AS]->(v2:Version)
				WHERE semver.satisfies(v2.name, r.semver)
				OPTIONAL MATCH (d)-[:RELEASED_AS]->(next:Version)
				WHERE semver.satisfies(next.name, r.semver) AND next.ts > v2.ts
				WITH v1, v2, r, collect(next)[0] as next
				MERGE (v1)-[:SATISFIED_BY {
					semver: r.semver,
					type: r.type,
					effective: v2.ts,
					superceded: coalesce(next.ts, ${Number.MAX_SAFE_INTEGER})
				}]->(v2)
				`,
			parameters: { versionId: `${id}@${newVersion.name}` }
		}];

		query(statements, 60 * 1000, (err, results) => {
			if (err) {
				callback(err);
			} if (versions.length > 0) {
				process.nextTick(() => loop());
			} else {
				callback();
			}
		});
	})();
}

function writeUpstream(id, newVersions, callback) {
	console.log('writing upstream...');

	if (!Array.isArray(newVersions) || newVersions.length < 1) {
		return callback();
	}

	let versions = newVersions.slice().sort((a, b) => b.ts - a.ts);

	(function loop() {

		var newVersion = versions.shift();

		const statements = [{
			statement: `
				MATCH (v1:Version)-[r:DEPENDS_ON]->(d:Package)-[:RELEASED_AS]->(v2:Version {id: {versionId}})<-[old:SATISFIED_BY {superceded: ${Number.MAX_SAFE_INTEGER}}]-(v1)
				WHERE semver.satisfies(v2.name, r.semver)
				SET old.superceded = {superceded}
				`,
			parameters: { versionId: `${id}@${newVersion.name}`, superceded: newVersion.ts }
		},
		{
			statement: `
				MATCH (v1:Version)-[r:DEPENDS_ON]->(d:Package)-[:RELEASED_AS]->(v2:Version {id: {versionId}})
				WHERE semver.satisfies(v2.name, r.semver)
				OPTIONAL MATCH (d)-[:RELEASED_AS]->(next:Version)
				WHERE semver.satisfies(next.name, r.semver) AND next.ts > v2.ts
				WITH v1, v2, r, collect(next)[0] as next
				MERGE (v1)-[:SATISFIED_BY {
					semver: r.semver,
					type: r.type,
					effective: v2.ts,
					superceded: coalesce(next.ts, ${Number.MAX_SAFE_INTEGER})
				}]->(v2)
				`,
			parameters: { versionId: `${id}@${newVersion.name}` }
		}];

		query(statements, 90 * 1000, (err, results) => {
			if (err) {
				callback(err);
			} if (versions.length > 0) {
				process.nextTick(() => loop());
			} else {
				callback();
			}
		});
	})();
}

function getRevAndVersions(packageId, callback) {
	const statements = [{
		statement: `
		MATCH (p:Package {id: {id}})-[:RELEASED_AS]->(v:Version)
		RETURN p.rev as rev, collect(v.name) as version;`,
		parameters: { id: packageId }
	}];

	query(statements, 1000, (err, res) => {
		if (err) {
			callback(err);
		} else if (res.results && res.results[0] && res.results[0].data && res.results[0].data[0] && res.results[0].data[0].row) {
			callback(null, {
				rev: res.results[0].data[0].row[0],
				versions: res.results[0].data[0].row[1]
			});
		} else {
			callback();
		}
	});
}

function mapDependencies(dependencies) {
	let results = [];

	Object.keys(dependencies || {}).forEach(id => {
		results.push({ id, semver: dependencies[id] });
	});

	return results;
}

function query(statements, timeout, callback) {
	const body = {
		statements: statements.map(s => {
			return {
				statement: s.statement,
				parameters: s.parameters,
				resultDataContents: [
					'row'
				],
				includeStats: false
			};
		})
	};

	const s = new Date();
	request
		.post(endpoint)
		.send(body)
		.set('Authorization', authorization)
		.set('Content-Type', 'application/json')
		.timeout(timeout)
		.end((err, result) => {
			const e = new Date();
			console.log(`Completed in ${e - s}ms`);
			if (err) {
				callback(err);
			} else {
				callback(null, result.body);
			}
		});
}
