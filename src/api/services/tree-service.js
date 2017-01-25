import deepdiff from 'deep-diff';
import semver from 'semver';
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

export function getTreeDiff(lhsVersionId, lhsTs, rhsVersionId, rhsTs, callback) {

	const now = new Date().getTime();

	lhsTs = lhsTs || now;
	rhsTs = rhsTs || now;

	let lhs;
	let rhs;

	Promise.all([
		new Promise((resolve, reject) => {
			getTree(lhsVersionId, { ts: lhsTs }, (err, result) => {
				if (err) {
					reject(err);
				} else {
					lhs = result;
					resolve();
				}
			});
		}),
		new Promise((resolve, reject) => {
			getTree(rhsVersionId, { ts: rhsTs }, (err, result) => {
				if (err) {
					reject(err);
				} else {
					rhs = result;
					resolve();
				}
			});
		})
	]).then(() => {

		lhs = {
			packageId: lhs.package.split('@')[0],
			version: lhs.package.split('@')[1],
			ts: lhsTs,
			dependencies: lhs.tree.dependencies
		};

		rhs = {
			packageId: rhs.package.split('@')[0],
			version: rhs.package.split('@')[1],
			ts: rhsTs,
			dependencies: rhs.tree.dependencies
		};

		getDiffs(lhs, rhs, (err, result) => {
			if (err) {
				callback(err);
			} else {
				// TODO: Include list of all changes
				callback(null, { lhs: result.lhs, rhs: result.rhs });
			}
		});

	}).catch(reason => callback(reason));
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

function getDiffs(lhs, rhs, callback) {
	lhs = JSON.parse(JSON.stringify(lhs));
	rhs = JSON.parse(JSON.stringify(rhs));
	const diffs = deepdiff(lhs, rhs) || [];

	let updatedVersions = {};

	diffs.forEach(diff => {
		if (diff.kind === 'E' && diff.path[diff.path.length - 1] === 'version') {
			const packageId = diff.path.length === 1 ? lhs.packageId : diff.path[diff.path.length - 2];
			updatedVersions[packageId] = null;
		}
	});

	const promises = Object.keys(updatedVersions).map(packageId => {
		return new Promise((resolve, reject) => {
			request.get(`https://registry.npmjs.com/${packageId}`, (err, res) => {
				if (err) {
					reject(err);
				} else {
					updatedVersions[packageId] = res.body;
					resolve();
				}
			});
		});
	});

	Promise.all(promises).then(() => {
		diffs.forEach(diff => {
			if (diff.kind === 'E' && diff.path[diff.path.length - 1] === 'version') {
				const packageId = diff.path.length === 1 ? lhs.packageId : diff.path[diff.path.length - 2];
				// dependency version change
				diff.path.pop();
				let lhsObj = lhs;
				let rhsObj = rhs;
				diff.path.forEach(prop => {
					lhsObj = lhsObj[prop];
					rhsObj = rhsObj[prop];
				});
				const change = {
					type: 'VERSION',
					uri: getGitDiffUri(updatedVersions[packageId], diff.lhs, diff.rhs)
				};
				lhsObj.$diff = change;
				rhsObj.$diff = change;
			} else if (diff.kind === 'D') {
				// dependency removed
				let lhsObj = lhs;
				diff.path.forEach(prop => {
					lhsObj = lhsObj[prop];
				});
				lhsObj.$diff = { type: 'REMOVED' };
			} else if (diff.kind === 'N') {
				// dependency added
				let rhsObj = rhs;
				diff.path.forEach(prop => {
					rhsObj = rhsObj[prop];
				});
				rhsObj.$diff = { type: 'ADDED' };
			}
		});

		callback(null, { lhs, rhs });
	}).catch(reason => callback(reason));
}

function getGitDiffUri(packageData, vStart, vEnd) {
	if (packageData && packageData.versions && packageData.versions[vStart] && packageData.versions[vStart]) {
		const start = packageData.versions[vStart];
		const end = packageData.versions[vEnd];

		if (start && end && start.repository && end.repository) {
			const uriStart = start.repository.url;
			const uriEnd = end.repository.url;

			if (uriStart && uriEnd && start.gitHead && end.gitHead && uriStart.indexOf('//github.com/') > -1 && uriEnd.indexOf('//github.com/') > -1) {
				const reg = /github\.com\/([^/]*)\/([^\.]*)/;
				const partsStart = reg.exec(uriStart);
				const partsEnd = reg.exec(uriEnd);

				const userStart = partsStart[1];
				const repoStart = partsStart[2];
				const userEnd = partsEnd[1];
				const repoEnd = partsEnd[2];

				if (userStart === userEnd && repoStart === repoEnd) {
					const span = semver.gt(vStart, vEnd) ? `${end.gitHead}...${start.gitHead}` : `${start.gitHead}...${end.gitHead}`;
					const uri = `https://github.com/${userEnd}/${repoEnd}/compare/${span}`;
					return uri;
				}
			}
		}
	}
}
