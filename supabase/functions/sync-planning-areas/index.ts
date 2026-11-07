const ONE_MAP_URL = 'https://www.onemap.gov.sg/api/public/popapi/getPlanningareaNames?year=2019';

type OneMapArea = {
  id?: string | number;
  name?: string;
  planningArea?: string;
  PLN_AREA_N?: string;
  pln_area_n?: string;
};

function extractAreas(payload: unknown): Array<{ id: string | null; name: string }> {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractAreas(item));
  }
  if (!payload || typeof payload !== 'object') return [];

  const area = payload as OneMapArea;
  const directName = area.name ?? area.planningArea ?? area.PLN_AREA_N ?? area.pln_area_n;
  if (directName) {
    return [{ id: area.id === undefined ? null : String(area.id), name: directName }];
  }

  return Object.values(payload as Record<string, unknown>).flatMap((value) => extractAreas(value));
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const token = Deno.env.get('ONEMAP_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Missing sync function secrets' }, { status: 500 });
  }

  const oneMapResponse = await fetch(ONE_MAP_URL, {
    headers: { Authorization: token, Accept: 'application/json' },
  });
  if (!oneMapResponse.ok) {
    return Response.json(
      {
        stage: 'onemap',
        error: `OneMap returned ${oneMapResponse.status}`,
        detail: (await oneMapResponse.text()).slice(0, 500),
      },
      { status: 502 },
    );
  }

  const payload = await oneMapResponse.json();
  const areas = extractAreas(payload)
    .map((area) => ({ ...area, name: area.name.trim() }))
    .filter((area) => area.name);
  if (areas.length === 0) {
    return Response.json(
      {
        stage: 'onemap',
        error: 'OneMap response contained no planning-area names',
        responseType: Array.isArray(payload) ? 'array' : typeof payload,
        responseKeys:
          payload && typeof payload === 'object' && !Array.isArray(payload)
            ? Object.keys(payload)
            : [],
      },
      { status: 502 },
    );
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: 'Bearer ' + serviceRoleKey,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
  const existingResponse = await fetch(
    `${supabaseUrl}/rest/v1/neighbourhoods?select=id,name&limit=1000`,
    { headers },
  );
  if (!existingResponse.ok) {
    return Response.json(
      {
        stage: 'supabase-lookup',
        error: 'Supabase neighbourhood lookup failed',
        detail: (await existingResponse.text()).slice(0, 500),
      },
      { status: 502 },
    );
  }

  const existing = (await existingResponse.json()) as { id: number; name: string }[];
  const existingByName = new Map(existing.map((row) => [row.name.trim().toLowerCase(), row.id]));

  for (const area of areas) {
    const existingId = existingByName.get(area.name.toLowerCase());
    const body = {
      name: area.name,
      ...(area.id ? { onemap_id: area.id } : {}),
    };
    const result = existingId
      ? await fetch(`${supabaseUrl}/rest/v1/neighbourhoods?id=eq.${existingId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        })
      : await fetch(`${supabaseUrl}/rest/v1/neighbourhoods`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...body, lat: null, lng: null }),
        });
    if (!result.ok) {
      return Response.json(
        {
          stage: 'supabase-write',
          error: 'Supabase neighbourhood update failed',
          detail: (await result.text()).slice(0, 500),
        },
        { status: 502 },
      );
    }
  }

  return Response.json({ updated: areas.length });
});
