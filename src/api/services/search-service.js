import request from 'superagent';

const endpoint = `http://${process.env.NEO4J_HOST}:7474/db/data/transaction/commit`;
const authorization = `Basic ${process.env.NEO4J_AUTH}`;

export function findPackages(q, offset, limit, callback) {
	q = q || '';
	offset = offset || 0;
	limit = limit || 25;

	const body = {
		statements: [{
			statement: `
			MATCH (p:Package)-[:RELEASED_AS]->(v:Version) WHERE p.id STARTS WITH {q}
			RETURN DISTINCT p.id AS packageId, collect({name: v.name, ts: v.ts}) AS versions
			ORDER BY packageId SKIP {offset} LIMIT {limit}`,
			parameters: { q, offset, limit },
			'resultDataContents': [
				'row'
			],
			'includeStats': false
		}]
	};

	request
		.post(endpoint)
		.send(body)
		.set('Authorization', authorization)
		.set('Content-Type', 'application/json')
		.end((err, result) => {
			if (err) {
				callback(err);
			} else if (result.body.results[0] && result.body.results[0].data) {
				callback(null, {
					packages: result.body.results[0].data.map(d => {
						return {
							id: d.row[0],
							versions: d.row[1] ? d.row[1].sort((a, b) => b.ts - a.ts) : []
						};
					})
				});
			} else {
				callback();
			}
		});
}

export function getVersions(packageId, offset, limit, callback) {
	packageId = packageId || '';
	offset = offset || 0;
	limit = limit || 25;

	const body = {
		statements: [{
			statement: `
			MATCH (n:Package)-[r:RELEASED_AS]->(v:Version) where n.id = {packageId}
			RETURN v.name, v.ts ORDER BY v.ts DESC skip {offset} LIMIT {limit}`,
			parameters: { packageId, offset, limit },
			'resultDataContents': [
				'row'
			],
			'includeStats': false
		}]
	};

	request
		.post(endpoint)
		.send(body)
		.set('Authorization', authorization)
		.set('Content-Type', 'application/json')
		.end((err, result) => {
			if (err) {
				callback(err);
			} else if (result.body.results[0] && result.body.results[0].data) {
				callback(null, {
					packageId,
					versions: result.body.results[0].data.map(d => {
						return { version: d.row[0], ts: d.row[1] };
					})
				});
			} else {
				callback();
			}
		});
}
