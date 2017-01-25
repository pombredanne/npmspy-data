export function getRouteInfo(url, method, swaggerDefinition) {
	const route = getBaseRoute(url);

	const pattern = Object.keys(swaggerDefinition.paths).filter(key => {
		return doesRouteMatch(key, route);
	})[0];

	let definition;

	const pathMethods = swaggerDefinition.paths[pattern];

	if (pathMethods) {
		definition = pathMethods[method.toLowerCase()];
	}

	return {
		pattern,
		definition
	};
}

export function doesRouteMatch(routePattern, route) {
	const regex = new RegExp('^' + routePattern.replace(/\{([^\/]*?)\}/g, '[^\/]*?') + '$', 'g');
	return regex.test(route);
}

export function getBaseRoute(url) {
	const route = ~url.indexOf('?') ? url.substr(0, url.indexOf('?')) : url;
	return route.endsWith('/') ? route.substr(0, route.length - 1) : route;
}

export function getRouteParams(routePattern, route) {
	const regex1 = new RegExp('^' + routePattern.replace(/\{.*?\}/g, '\{(.*?)\}') + '$', 'g');
	const regex2 = new RegExp('^' + routePattern.replace(/\{.*?\}/g, '(.*?)') + '$', 'g');

	var names = regex1.exec(routePattern) || [];
	var values = regex2.exec(route) || [];

	var params = {};

	for (let i = 1; i < names.length; i++) {
		params[names[i]] = values[i];
	}

	return params;
}

export function getValueFromPath(request, paramName, routePattern) {
	var route = getBaseRoute(request.url);
	return getRouteParams(routePattern, route)[paramName];
}

export function getValueFromQuery(request, paramName) {
	if (request.query) {
		const key = Object.keys(request.query).filter(param => param.toLowerCase() === paramName.toLowerCase())[0];
		return key ? request.query[key] : undefined;
	} else {
		return;
	}
}

export function getValueFromHeaders(request, paramName) {
	return request.get(paramName);
}

export function getValueFromBody(request, paramName) {
	return request.body; // ? request.body[paramName] : undefined;
}
