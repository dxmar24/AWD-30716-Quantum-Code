const fs = require('fs');
const path = require('path');

const codeDir = path.join(__dirname, '..');
const root = path.join(codeDir, '..');
const routesPath = path.join(codeDir, 'backend', 'src', 'routes', 'api.js');
const collectionPath = path.join(root, 'postman', 'American-Latin-Class-API.postman_collection.json');

function declaredRoutes(source) {
  const routes = [];
  const routePattern = /router\.(get|post|patch|put|delete)\(\s*([`'"])(.*?)\2/g;
  for (const match of source.matchAll(routePattern)) {
    if (!match[3].includes('${')) routes.push([match[1].toUpperCase(), match[3]]);
  }

  const crudPattern = /registerCrud\(router,\s*'([^']+)'/g;
  for (const match of source.matchAll(crudPattern)) {
    const name = match[1];
    routes.push(
      ['GET', `/${name}`],
      ['GET', `/${name}/:id`],
      ['POST', `/${name}`],
      ['PATCH', `/${name}/:id`],
    );
  }

  return [...new Map(routes.map((route) => [route.join(' '), route])).values()];
}

function collectionRequests(collection) {
  const requests = [];
  function visit(items = []) {
    for (const item of items) {
      if (item.request) {
        const rawUrl = typeof item.request.url === 'string' ? item.request.url : item.request.url?.raw || '';
        requests.push({
          method:String(item.request.method || '').toUpperCase(),
          path:rawUrl.replace(/^\{\{base_url\}\}/, '').split('?')[0],
          name:item.name,
        });
      }
      visit(item.item);
    }
  }
  visit(collection.item);
  return requests;
}

function routeMatches(template, candidate) {
  const escaped = template
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${escaped}$`).test(candidate);
}

function main() {
  const routes = declaredRoutes(fs.readFileSync(routesPath, 'utf8'));
  const requests = collectionRequests(JSON.parse(fs.readFileSync(collectionPath, 'utf8')));
  const missing = routes.filter(([method, route]) => !requests.some((request) => (
    request.method === method && routeMatches(route, request.path)
  )));

  console.log(`Postman route coverage: ${routes.length - missing.length}/${routes.length} declared route contracts represented by ${requests.length} requests.`);
  if (missing.length) {
    for (const [method, route] of missing) console.error(`Missing: ${method} ${route}`);
    process.exitCode = 1;
  }
}

main();
