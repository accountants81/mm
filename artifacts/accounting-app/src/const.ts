export const COOKIE_NAME = "local-accounting-session";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Kept for the unused generic dashboard shell. This app intentionally uses its
// local access screen instead of a network login or an OAuth redirect.
export const startLogin = () => {
  window.location.href = "/local-access";
};
