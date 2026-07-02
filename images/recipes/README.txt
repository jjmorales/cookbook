Recipe photos uploaded from the Add recipe view get committed here,
one file per recipe (e.g. fried-rice.jpg). Keep images under ~1MB each —
resize/compress client-side before upload, since the GitHub Contents API
rejects files over 1MB on a single PUT request.

Each recipe's "image" field in data/recipes.json should point here, e.g.:
  "image": "images/recipes/fried-rice.jpg"
