import request from 'superagent';

const endpoint = `http://${process.env.NEO4J_HOST}:7474/db/data/transaction/commit`;
const authorization = `Basic ${process.env.NEO4J_AUTH}`;

export function getDiffs(packageId, version, options, callback) {
	options = options || {};
	const before = options.before;
	const after = options.after;
	const count = Math.min(options.count || 25, 100);

	const versionId = packageId + '@' + version;

	const nowTs = new Date().getTime();

	const body = before || !after ?
		getBeforeQuery(versionId, Number(before || nowTs), count) :
		getAfterQuery(versionId, Number(after), count);

	request
		.post(endpoint)
		.send(body)
		.set('Authorization', authorization)
		.set('Content-Type', 'application/json')
		.end((err, result) => {
			if (err) {
				callback(err);
			} else {
				try {
					const history = mapDiffs(result.body.results[0].data).sort((a, b) => b.ts - a.ts);

					if (history.length === 0) {
						callback();
					} else {
						const maxTs = history[0].ts;
						const minTs = history[history.length - 1].ts;

						const response = {
							packageId,
							version,
							previousTs: minTs,
							nextTs: maxTs + 1,
							history
						};

						callback(null, response);
					}
				} catch (ex) {
					callback(ex);
				}
			}
		});
}

function getBeforeQuery(versionId, ts, count) {
	const statement = `
		MATCH path=(:Version {id: {versionId}})-[ds:SATISFIED_BY*..100 {type: ""}]->(v:Version)
		UNWIND ds AS d WITH ds, d, path
		WHERE d.effective < {upperBound} AND ALL (dep IN ds WHERE dep.effective <= d.effective AND d.effective < dep.superceded)
		RETURN DISTINCT d.effective AS change_ts, collect(path) AS paths
		ORDER BY d.effective DESC LIMIT {pageSize}`;

	const parameters = { versionId, upperBound: ts, pageSize: count };

	return getQuery(statement, parameters);
}

function getAfterQuery(versionId, ts, count) {
	const statement = `
		MATCH path=(:Version {id: {versionId}})-[ds:SATISFIED_BY*..100 {type: ""}]->(v:Version)
		UNWIND ds AS d WITH ds, d, path
		WHERE d.effective >= {lowerBound} AND ALL (dep IN ds WHERE dep.effective <= d.effective AND d.effective < dep.superceded)
		RETURN DISTINCT d.effective AS change_ts, collect(path) AS paths
		ORDER BY d.effective LIMIT {pageSize}`;

	const parameters = { versionId, lowerBound: ts, pageSize: count };

	var x = getQuery(statement, parameters);

	return x;
}

function getQuery(statement, parameters) {
	const body = {
		statements: [{
			statement,
			parameters,
			'resultDataContents': [
				'row'
			],
			'includeStats': false
		}]
	};

	return body;
}

function mapDiffs(rows) {
	let results = [];

	const mappedRows = rows.map(r => {
		return { ts: r.row[0], rawPaths: r.row[1] };
	});

	mappedRows.forEach(row => {
		const allPaths = row.rawPaths.map(rawPath => makePath(rawPath, row.ts));
		const fullPaths = getFullPaths(allPaths);

		results.push({
			ts: row.ts,
			paths: fullPaths
		});
	});

	return results;
}

function makePath(rawPath, rowTs) {
	let path = [];

	for (let i = 1; i < rawPath.length; i += 2) {

		const d = rawPath;

		let dependency = {
			versionId: rawPath[i + 1].id,
			semver: rawPath[i].semver
		};

		if (rawPath[i].effective === rowTs) {
			dependency.previous = rawPath[i].previous;
			dependency.changed = true;
		}

		if (rawPath[i].type !== '') {
			dependency.type = rawPath[i].type;
		}

		path.push(dependency);
	}

	return path;
}

function getFullPaths(allPaths) {
	let fullPaths = [];
	let nonTerminals = [];

	allPaths.forEach(path => {
		for (let i = 0; i < path.length - 2; i++) {
			nonTerminals.push(path[i].versionId);
		}
	});

	allPaths.forEach(path => {
		const lastVersionId = path[path.length - 1].versionId;

		if (nonTerminals.indexOf(lastVersionId) === -1) {
			fullPaths.push(path);
		}
	});

	return fullPaths;
}
