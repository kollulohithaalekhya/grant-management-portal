const MAX_LIMIT = 100;

/** Normalises `?page=&limit=` into safe positive integers. */
const parsePagination = (query = {}, defaultLimit = 10) => {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  return {
    page: Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1),
    limit: Number.isNaN(rawLimit)
      ? defaultLimit
      : Math.min(Math.max(rawLimit, 1), MAX_LIMIT),
  };
};

module.exports = { parsePagination, MAX_LIMIT };
