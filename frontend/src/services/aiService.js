import api from "./api";

/**
 * Sends a natural language query to the Customer AI Assistant.
 * @param {string} query - The customer query.
 * @param {string} [canteenId] - The active canteen ID.
 * @returns {Promise} Axios response promise.
 */
export const askCustomerAssistant = (query, canteenId) =>
  api.post("/ai/customer", {
    query,
    ...(canteenId ? { canteenId } : {}),
  });

/**
 * Sends an operational query to the Staff Kitchen AI Assistant.
 * @param {string} query - The kitchen/queue query.
 * @param {string} [canteenId] - The canteen ID (defaults to staff assigned canteen).
 * @returns {Promise} Axios response promise.
 */
export const askStaffAssistant = (query, canteenId) =>
  api.post("/ai/staff", {
    query,
    ...(canteenId ? { canteenId } : {}),
  });

/**
 * Sends an analytical query to the Admin Analytics AI Assistant.
 * @param {string} query - Natural language analytics question.
 * @param {string} [canteenId] - Optional canteen filter.
 * @param {string} [from] - Optional start date (YYYY-MM-DD).
 * @param {string} [to] - Optional end date (YYYY-MM-DD).
 * @returns {Promise} Axios response promise.
 */
export const askAdminAssistant = (query, canteenId, from, to) =>
  api.post("/ai/admin", {
    query,
    ...(canteenId ? { canteenId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

/**
 * Checks AI service and model health.
 * @returns {Promise} Axios response promise.
 */
export const getAIHealth = () => api.get("/ai/health");


