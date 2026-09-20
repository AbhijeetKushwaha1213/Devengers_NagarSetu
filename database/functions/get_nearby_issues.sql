-- Function to query nearby civic issues based on latitude, longitude, and radius (in km)
CREATE OR REPLACE FUNCTION public.get_nearby_issues(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision DEFAULT 10.0
)
RETURNS SETOF public.issues AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.issues
  WHERE
    metadata->>'latitude' IS NOT NULL
    AND metadata->>'longitude' IS NOT NULL
    AND (
      6371 * acos(
        cos(radians(user_lat)) *
        cos(radians((metadata->>'latitude')::double precision)) *
        cos(radians((metadata->>'longitude')::double precision) - radians(user_lng)) +
        sin(radians(user_lat)) *
        sin(radians((metadata->>'latitude')::double precision))
      )
    ) <= radius_km
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;
