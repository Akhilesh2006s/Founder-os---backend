export function apiSuccess(data, message = "OK") {
  return { success: true, message, data };
}
