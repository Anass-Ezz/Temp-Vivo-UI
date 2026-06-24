// src/router/authGuard.js
/**
 * Installs a global Vue Router navigation guard that enforces authentication.
 * Public routes (/auth/login, /auth/access, /auth/error, /landing) are always allowed.
 * Any other route requires a token to be present in the auth object; missing token
 * redirects to /auth/login preserving the original destination as a query param.
 *
 * @param {Object} router - The Vue Router instance to attach the guard to.
 * @param {{ token: string|null }} auth - Authentication state object with a token property.
 * @returns {void}
 */
export function createAuthGuard(router, auth) {
    router.beforeEach((to, from, next) => {
      // Public routes that never require authentication
      const publicRoutes = [
        '/auth/login',
        '/auth/access',
        '/auth/error',
        '/landing'
      ]
  
      // Always allow navigation to public routes
      if (publicRoutes.includes(to.path)) {
        return next()
      }
  
      /* ------------------------------------------------------------------
         NEW LOGIC:
         - We treat the user as "provisionally authenticated" if a token is
           present in storage, even if auth.ready is still false while the
           WebSocket is verifying it.
         - If the token later proves invalid, createWs.js will clear it and
           redirect the user to /auth/login.
      ------------------------------------------------------------------ */
      if (!auth.token) {
        return next({
          path: '/auth/login',
          query: { redirect: to.fullPath }   // Preserve destination
        })
      }
  
      // Token exists – allow navigation
      next()
    })
  }
  
