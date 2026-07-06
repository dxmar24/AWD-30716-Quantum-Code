function setCachePolicy(res, cacheControl, policy) {
  res.set('Cache-Control', cacheControl);
  res.set('X-Cache-Policy', policy);
  if (!cacheControl.includes('no-cache')) res.removeHeader('Pragma');
}

function noStore(req, res, next) {
  setCachePolicy(res, 'no-store, no-cache, must-revalidate, private', 'sensitive-no-store');
  res.set('Pragma', 'no-cache');
  return next();
}

function publicCache(seconds, policy = 'public-cache') {
  return (req, res, next) => {
    setCachePolicy(res, `public, max-age=${seconds}, must-revalidate`, policy);
    return next();
  };
}

function privateCache(seconds, policy = 'private-cache') {
  return (req, res, next) => {
    setCachePolicy(res, `private, max-age=${seconds}, must-revalidate`, policy);
    return next();
  };
}

function staticAssetHeaders(res, filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/assets/')) {
    setCachePolicy(res, 'public, max-age=31536000, immutable', 'public-static-immutable');
    res.set('X-Content-Cache', 'static-asset');
    return;
  }
  if (normalized.endsWith('.html')) {
    setCachePolicy(res, 'no-cache, must-revalidate', 'html-revalidate');
  }
}

module.exports = { noStore, publicCache, privateCache, staticAssetHeaders };
