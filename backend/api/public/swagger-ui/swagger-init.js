// Swagger UI init — alag file me rakha hai taaki helmet ke CSP (script-src 'self')
// inline script ko block na kare. Assets bhi locally serve hote hain (CDN-free).
window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: "/api/docs/openapi.json",
    dom_id: "#swagger-ui",
    deepLinking: true,
    displayRequestDuration: true,
    persistAuthorization: true,
    tryItOutEnabled: true,
  });
};
