/**
 * Cloudflare Worker — Monday.com API Proxy
 *
 * Sits between the webapp and Monday.com's GraphQL API.
 * The MONDAY_API_TOKEN secret is stored in the Worker environment
 * and never exposed to the browser.
 *
 * Routes:
 *   GET  /boards          → list all boards (for validation)
 *   POST /columns         → get column names for a board
 *   POST /sync            → fetch + map items from a board
 */

const MONDAY_API = 'https://api.monday.com/v2';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
};

export default {
    async fetch(request, env) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            if (path === '/boards' && request.method === 'GET') {
                return await handleListBoards(env);
            }
            if (path === '/columns' && request.method === 'POST') {
                const body = await request.json();
                return await handleGetColumns(body, env);
            }
            if (path === '/groups' && request.method === 'POST') {
                const body = await request.json();
                return await handleGetGroups(body, env);
            }
            if (path === '/sync' && request.method === 'POST') {
                const body = await request.json();
                return await handleSync(body, env);
            }
            return jsonResponse({ error: 'Not found' }, 404);
        } catch (err) {
            console.error('Worker error:', err);
            return jsonResponse({ error: err.message || 'Internal error' }, 500);
        }
    }
};

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * GET /boards — list all boards to validate the token and let user pick one
 */
async function handleListBoards(env) {
    const query = `query {
        boards(limit: 50, order_by: created_at) {
            id
            name
            description
            items_count
        }
    }`;

    const data = await mondayQuery(query, {}, env);
    const boards = data?.boards ?? [];
    return jsonResponse({ boards });
}

/**
 * POST /columns { boardId } — return column names for field mapping
 * Strategy 1: query board columns directly.
 * Strategy 2 (fallback): fetch the first item and discover columns from its column_values.
 * Always prepends a synthetic "Item Name" entry (id='name').
 */
async function handleGetColumns({ boardId }, env) {
    if (!boardId) return jsonResponse({ error: 'boardId required' }, 400);

    const id = String(boardId);
    let rawColumns = [];
    let strategy = 'columns';
    let debugRaw = null;

    // Strategy 1: direct columns query
    try {
        const query = `query {
            boards(ids: [${id}]) {
                columns {
                    id
                    title
                    type
                }
            }
        }`;
        const data = await mondayQuery(query, {}, env);
        debugRaw = JSON.stringify(data).slice(0, 500);
        rawColumns = data?.boards?.[0]?.columns ?? [];
    } catch (e) {
        debugRaw = `columns query error: ${e.message}`;
    }

    // Strategy 2: if columns is empty, discover from first item's column_values
    if (rawColumns.length === 0) {
        strategy = 'items_fallback';
        try {
            const query = `query {
                boards(ids: [${id}]) {
                    items_page(limit: 1) {
                        items {
                            column_values {
                                id
                                type
                                column {
                                    title
                                }
                            }
                        }
                    }
                }
            }`;
            const data = await mondayQuery(query, {}, env);
            const firstItem = data?.boards?.[0]?.items_page?.items?.[0];
            debugRaw += ' | fallback: ' + JSON.stringify(data).slice(0, 300);
            if (firstItem?.column_values) {
                rawColumns = firstItem.column_values.map(cv => ({
                    id: cv.id,
                    title: cv.column?.title ?? cv.id,
                    type: cv.type ?? 'unknown',
                }));
            }
        } catch (e) {
            debugRaw += ` | fallback error: ${e.message}`;
        }
    }

    // Always include the item name as the first option
    const columns = [
        { id: 'name', title: 'Item Name (monday.com item title)', type: 'name' },
        ...rawColumns,
    ];

    return jsonResponse({
        columns,
        debug: { boardId: id, strategy, rawCount: rawColumns.length, raw: debugRaw }
    });
}

/**
 * POST /groups { boardId } — return all groups (tables) for a board
 */
async function handleGetGroups({ boardId }, env) {
    if (!boardId) return jsonResponse({ error: 'boardId required' }, 400);

    const query = `query {
        boards(ids: [${String(boardId)}]) {
            groups {
                id
                title
                color
            }
        }
    }`;

    const data = await mondayQuery(query, {}, env);
    const groups = data?.boards?.[0]?.groups ?? [];
    return jsonResponse({ groups });
}

/**
 * POST /sync { boardId, columnMap, groupIds? } — fetch items and map to employee objects
 *
 * columnMap example:
 * {
 *   name:       "name",          // always the item name column
 *   email:      "email_col_id",
 *   department: "dept_col_id",
 *   title:      "title_col_id",
 *   location:   "loc_col_id",
 *   status:     "status_col_id",
 *   manager:    "manager_col_id"  // optional
 * }
 * groupIds: optional array of group IDs to filter (sync only those groups/tables)
 */
async function handleSync({ boardId, columnMap, groupIds }, env) {
    if (!boardId) return jsonResponse({ error: 'boardId required' }, 400);
    if (!columnMap) return jsonResponse({ error: 'columnMap required' }, 400);

    const id = String(boardId);
    let allItems = [];

    if (groupIds && groupIds.length > 0) {
        // Strategy A: fetch items from specific groups only
        // Monday.com supports filtering items_page by group via query_params
        // but the safest approach is to fetch each group's items separately
        for (const groupId of groupIds) {
            let cursor = null;
            do {
                const query = cursor
                    ? `query {
                        boards(ids: [${id}]) {
                            groups(ids: ["${groupId}"]) {
                                items_page(limit: 500, cursor: "${cursor}") {
                                    cursor
                                    items {
                                        id
                                        name
                                        group { id title }
                                        column_values { id text value }
                                    }
                                }
                            }
                        }
                    }`
                    : `query {
                        boards(ids: [${id}]) {
                            groups(ids: ["${groupId}"]) {
                                items_page(limit: 500) {
                                    cursor
                                    items {
                                        id
                                        name
                                        group { id title }
                                        column_values { id text value }
                                    }
                                }
                            }
                        }
                    }`;

                const data = await mondayQuery(query, {}, env);
                const group = data?.boards?.[0]?.groups?.[0];
                const page = group?.items_page;
                if (!page) break;
                allItems = allItems.concat(page.items ?? []);
                cursor = page.cursor ?? null;
            } while (cursor);
        }
    } else {
        // Strategy B: paginate through all items on the board
        let cursor = null;
        do {
            const query = cursor
                ? `query {
                    boards(ids: [${id}]) {
                        items_page(limit: 500, cursor: "${cursor}") {
                            cursor
                            items {
                                id
                                name
                                group { id title }
                                column_values { id text value }
                            }
                        }
                    }
                }`
                : `query {
                    boards(ids: [${id}]) {
                        items_page(limit: 500) {
                            cursor
                            items {
                                id
                                name
                                group { id title }
                                column_values { id text value }
                            }
                        }
                    }
                }`;

            const data = await mondayQuery(query, {}, env);
            const page = data?.boards?.[0]?.items_page;
            if (!page) break;
            allItems = allItems.concat(page.items ?? []);
            cursor = page.cursor ?? null;
        } while (cursor);
    }

    // Map items to employee objects
    const employees = allItems.map(item => mapItemToEmployee(item, columnMap));

    // Filter out items with no email (can't upsert without a key)
    const valid = employees.filter(e => e.email && e.email.trim());

    return jsonResponse({
        employees: valid,
        total: allItems.length,
        valid: valid.length,
        skipped: allItems.length - valid.length
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a Monday.com item to an employee object using the column map
 */
function mapItemToEmployee(item, columnMap) {
    const colById = {};
    for (const cv of item.column_values ?? []) {
        colById[cv.id] = cv.text ?? '';
    }

    const get = (key) => {
        const colId = columnMap[key];
        if (!colId) return '';
        if (colId === 'name') return item.name ?? ''; // special: item name
        return colById[colId] ?? '';
    };

    return {
        mondayId: item.id,
        name: get('name'),
        email: get('email').toLowerCase().trim(),
        department: get('department'),
        title: get('title'),
        location: get('location'),
        status: normalizeStatus(get('status')),
        manager: get('manager'),
    };
}

function normalizeStatus(raw) {
    if (!raw) return 'active';
    const lower = raw.toLowerCase();
    if (lower.includes('active') || lower.includes('working')) return 'active';
    if (lower.includes('away') || lower.includes('leave')) return 'away';
    if (lower.includes('inactive') || lower.includes('off')) return 'inactive';
    return 'active';
}

/**
 * Execute a Monday.com GraphQL query
 */
async function mondayQuery(query, variables, env) {
    const token = env.MONDAY_API_TOKEN;
    if (!token) throw new Error('MONDAY_API_TOKEN secret not set in Worker');

    const res = await fetch(MONDAY_API, {
        method: 'POST',
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
            'API-Version': '2024-01',
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
        throw new Error(`Monday.com API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    if (json.errors?.length) {
        throw new Error(json.errors.map(e => e.message).join('; '));
    }
    return json.data;
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: CORS_HEADERS,
    });
}
