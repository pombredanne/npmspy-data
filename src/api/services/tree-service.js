import request from 'superagent';

const endpoint = `http://${process.env.NEO4J_HOST}:7474/db/data/transaction/commit`;
const authorization = `Basic ${process.env.NEO4J_AUTH}`;

export function getTree(versionId, options, callback) {
	options = options || {};
	const ts = Number(options.ts || new Date().getTime());

	const body = {
		statements: [{
			statement: `
			MATCH path=(:Version {id: {versionId}})-[ds:SATISFIED_BY*..100 {type: ""}]->(v:Version)
			WHERE ALL (d IN ds WHERE d.effective <= {ts} < d.superceded)
			RETURN tail(nodes(path))`,
			parameters: { versionId, ts },
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
					package: versionId,
					ts,
					tree: map(versionId, result.body.results[0].data.map(r => r.row[0]))
				});
			} else {
				callback();
			}
		});
}

function map(versionId, results) {
	let obj = {
		version: versionId.split('@')[1],
		dependencies: {}
	};

	results.forEach(result => {
		let cache = obj.dependencies;

		result.forEach(level => {

			const name = level.id.split('@')[0];
			const version = level.id.split('@')[1];

			cache[name] = cache[name] || { version, dependencies: {} };
			cache = cache[name].dependencies;
		});
	});

	return obj;
}
