export async function paginateQuery(model, query, filter = {}, searchFields = []) {
  const page = Math.max(Number(query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(query.limit ?? 10), 1), 100);
  const skip = (page - 1) * limit;
  const sortBy = String(query.sortBy ?? "createdAt");
  const sortOrder = String(query.sortOrder ?? "desc") === "asc" ? 1 : -1;
  const search = String(query.search ?? "").trim();

  const normalizedFilter = { ...filter };
  if (search && searchFields.length) {
    normalizedFilter.$or = searchFields.map((field) => ({
      [field]: { $regex: search, $options: "i" }
    }));
  }

  const [items, total] = await Promise.all([
    model.find(normalizedFilter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit),
    model.countDocuments(normalizedFilter)
  ]);

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  };
}
